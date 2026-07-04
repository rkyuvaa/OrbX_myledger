import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RotateCcw, AlertCircle, Calendar, RefreshCw } from 'lucide-react';
import api from '../lib/api';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const Daybook: React.FC = () => {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [voucherType, setVoucherType] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  // Fetch branches for filter
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data;
    },
  });

  // Fetch daybook entries
  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['daybook', fromDate, toDate, branchId, voucherType, paymentMode, search],
    queryFn: async () => {
      const res = await api.get('/daybook/', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          branch_id: branchId || undefined,
          voucher_type: voucherType || undefined,
          payment_mode: paymentMode || undefined,
          search: search || undefined,
        },
      });
      return res.data;
    },
  });

  // Reversal Mutation
  const reverseMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const endpoint = type === 'RCV' ? `/receipts/${id}/reverse` : `/payments/${id}/reverse`;
      const res = await api.post(endpoint);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      alert('Voucher reversed successfully!');
    },
    onError: (err: any) => {
      setReversalError(err.response?.data?.detail || 'Failed to reverse voucher.');
    },
  });

  const handleReverse = (id: string, type: string) => {
    if (window.confirm('Are you sure you want to reverse this transaction? This creates an offsetting entry.')) {
      setReversalError(null);
      reverseMutation.mutate({ id, type });
    }
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Daybook Register</h2>
          <p className="page-subtitle">Chronological register of all financial transactions</p>
        </div>
      </div>

      {reversalError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{reversalError}</span>
        </div>
      )}

      {/* Advanced Filters Card */}
      <div className="card bg-white p-5 border border-[#e2e8e6] shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="label">From Date</label>
            <input 
              type="date" 
              className="input text-xs" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">To Date</label>
            <input 
              type="date" 
              className="input text-xs" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Branch</label>
            <select 
              className="input select text-xs bg-white"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Voucher Type</label>
            <select 
              className="input select text-xs bg-white"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="RCV">Receipts</option>
              <option value="PAY">Payments</option>
              <option value="TRF">Transfers</option>
            </select>
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <select 
              className="input select text-xs bg-white"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="">All Modes</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8aa89f]" />
            <input 
              type="text" 
              placeholder="Search by Voucher #, Party name, Reference, or Narration..." 
              className="input pl-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setFromDate('');
              setToDate('');
              setBranchId('');
              setVoucherType('');
              setPaymentMode('');
              setSearch('');
            }}
            className="btn-outline text-xs px-4"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Results Register */}
      {isLoading ? (
        <LoadingSkeleton rows={8} cols={6} />
      ) : (
        <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs overflow-hidden">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher #</th>
                  <th>Date</th>
                  <th>Branch</th>
                  <th>Particulars</th>
                  <th>Received (Cr)</th>
                  <th>Paid (Dr)</th>
                  <th>Reference</th>
                  <th>Reversed?</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-sm text-[#8aa89f]">
                      No transactions match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: any) => (
                    <tr key={entry.id} className={entry.credit > 0 ? 'bg-green-50/20' : 'bg-red-50/10'}>
                      <td className="font-bold text-[#023020]">{entry.voucher_number}</td>
                      <td>{entry.date}</td>
                      <td>
                        <span className="text-xs font-semibold text-[#4a6b62]">
                          {entry.branch_name || 'Corp / HQ'}
                        </span>
                      </td>
                      <td>
                        <div>
                          <p className="font-semibold text-xs text-[#0d1f1a]">{entry.particulars}</p>
                          {entry.narration && <p className="text-[10px] text-[#8aa89f] italic">{entry.narration}</p>}
                        </div>
                      </td>
                      <td className="font-semibold text-green-600">
                        {entry.credit > 0 ? fmt(entry.credit) : '—'}
                      </td>
                      <td className="font-semibold text-red-600">
                        {entry.debit > 0 ? fmt(entry.debit) : '—'}
                      </td>
                      <td className="text-xs text-[#4a6b62]">
                        {entry.reference_number || '—'}
                      </td>
                      <td>
                        {entry.particulars.includes('REVERSAL') || entry.narration?.includes('REVERSAL') ? (
                          <span className="badge badge-red font-semibold text-[10px]">Reversal Entry</span>
                        ) : (
                          <span className="text-[10px] text-[#8aa89f]">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {(entry.voucher_type === 'RCV' || entry.voucher_type === 'PAY') && 
                         !entry.particulars.includes('REVERSAL') && (
                          <button
                            onClick={() => handleReverse(entry.voucher_id, entry.voucher_type)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Reverse transaction"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
