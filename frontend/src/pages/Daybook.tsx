import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RotateCcw, AlertCircle, Calendar, RefreshCw, Edit2, X } from 'lucide-react';
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

  // Fetch Accounts
  const { data: accountsData } = useQuery({
    queryKey: ['ledgerAccounts'],
    queryFn: async () => {
      const res = await api.get('/ledger/accounts');
      return res.data;
    },
  });

  const bankAccounts = accountsData?.bank_accounts || [];
  const cashAccounts = accountsData?.cash_accounts || [];

  // Edit State
  const [editingVoucher, setEditingVoucher] = useState<{ id: string; type: string; data: any } | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editParticularName, setEditParticularName] = useState<string>(''); // received_from or paid_to
  const [editPaymentMode, setEditPaymentMode] = useState<'bank' | 'cash'>('bank');
  const [editBankAccountId, setEditBankAccountId] = useState<string>('');
  const [editCashAccountId, setEditCashAccountId] = useState<string>('');
  const [editReferenceNumber, setEditReferenceNumber] = useState<string>('');
  const [editNarration, setEditNarration] = useState<string>('');

  // For Transfer edits:
  const [editFromAccountType, setEditFromAccountType] = useState<'bank' | 'cash'>('bank');
  const [editFromAccountId, setEditFromAccountId] = useState<string>('');
  const [editToAccountType, setEditToAccountType] = useState<'bank' | 'cash'>('cash');
  const [editToAccountId, setEditToAccountId] = useState<string>('');

  const handleEdit = async (id: string, type: string) => {
    try {
      setReversalError(null);
      let endpoint = '';
      if (type === 'RCV') endpoint = `/receipts/${id}`;
      else if (type === 'PAY') endpoint = `/payments/${id}`;
      else if (type === 'TRF') endpoint = `/transfers/${id}`;

      const res = await api.get(endpoint);
      const data = res.data;

      setEditingVoucher({ id, type, data });
      setEditDate(data.date);
      setEditBranchId(data.branch_id || '');
      setEditAmount(String(data.amount));
      setEditReferenceNumber(data.reference_number || '');
      setEditNarration(data.narration || '');

      if (type === 'RCV') {
        setEditParticularName(data.received_from);
        setEditPaymentMode(data.payment_mode);
        setEditBankAccountId(data.bank_account_id || '');
        setEditCashAccountId(data.cash_account_id || '');
      } else if (type === 'PAY') {
        setEditParticularName(data.paid_to);
        setEditPaymentMode(data.payment_mode);
        setEditBankAccountId(data.bank_account_id || '');
        setEditCashAccountId(data.cash_account_id || '');
      } else if (type === 'TRF') {
        setEditFromAccountType(data.from_account_type);
        setEditFromAccountId(data.from_account_id);
        setEditToAccountType(data.to_account_type);
        setEditToAccountId(data.to_account_id);
      }
    } catch (err: any) {
      setReversalError(err.response?.data?.detail || 'Failed to fetch voucher details.');
    }
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, type, payload }: { id: string; type: string; payload: any }) => {
      let endpoint = '';
      if (type === 'RCV') endpoint = `/receipts/${id}`;
      else if (type === 'PAY') endpoint = `/payments/${id}`;
      else if (type === 'TRF') endpoint = `/transfers/${id}`;

      const res = await api.put(endpoint, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      alert('Voucher updated successfully!');
      setEditingVoucher(null);
    },
    onError: (err: any) => {
      setReversalError(err.response?.data?.detail || 'Failed to update voucher.');
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;

    let payload: any = {
      date: editDate,
      amount: Number(editAmount),
      reference_number: editReferenceNumber || undefined,
      narration: editNarration || undefined,
    };

    if (editingVoucher.type === 'RCV') {
      payload.branch_id = editBranchId || undefined;
      payload.received_from = editParticularName;
      payload.payment_mode = editPaymentMode;
      payload.bank_account_id = editPaymentMode === 'bank' ? editBankAccountId : undefined;
      payload.cash_account_id = editPaymentMode === 'cash' ? editCashAccountId : undefined;
    } else if (editingVoucher.type === 'PAY') {
      payload.branch_id = editBranchId || undefined;
      payload.paid_to = editParticularName;
      payload.payment_mode = editPaymentMode;
      payload.bank_account_id = editPaymentMode === 'bank' ? editBankAccountId : undefined;
      payload.cash_account_id = editPaymentMode === 'cash' ? editCashAccountId : undefined;
    } else if (editingVoucher.type === 'TRF') {
      payload.from_account_type = editFromAccountType;
      payload.from_account_id = editFromAccountId;
      payload.to_account_type = editToAccountType;
      payload.to_account_id = editToAccountId;

      if (editFromAccountType === editToAccountType && editFromAccountId === editToAccountId) {
        alert('Source and destination accounts must be different');
        return;
      }
    }

    editMutation.mutate({ id: editingVoucher.id, type: editingVoucher.type, payload });
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
                      <td className="text-right flex items-center justify-end gap-1.5">
                        {!entry.particulars.includes('REVERSAL') && !entry.narration?.includes('REVERSAL') && (
                          <button
                            onClick={() => handleEdit(entry.voucher_id, entry.voucher_type)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit transaction"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(entry.voucher_type === 'RCV' || entry.voucher_type === 'PAY') && 
                         !entry.particulars.includes('REVERSAL') && !entry.narration?.includes('REVERSAL') && (
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
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8e6] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e2e8e6] bg-[#f8fafb]">
              <div>
                <h3 className="text-base font-bold text-[#0d1f1a]">
                  Edit {editingVoucher.type === 'RCV' ? 'Receipt' : editingVoucher.type === 'PAY' ? 'Payment' : 'Transfer'} Voucher
                </h3>
                <p className="text-xs text-[#8aa89f] font-semibold mt-0.5">
                  Voucher No: {editingVoucher.data.voucher_number}
                </p>
              </div>
              <button 
                onClick={() => setEditingVoucher(null)}
                className="p-2 rounded-lg text-[#4a6b62] hover:bg-[#f1f5f4] hover:text-[#0d1f1a] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Common Fields Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label text-[11px] font-bold">Voucher Date</label>
                  <input 
                    type="date" 
                    required 
                    value={editDate} 
                    onChange={(e) => setEditDate(e.target.value)} 
                    className="input py-2 text-xs font-semibold" 
                  />
                </div>
                <div>
                  <label className="label text-[11px] font-bold">Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    min="0.01" 
                    value={editAmount} 
                    onChange={(e) => setEditAmount(e.target.value)} 
                    className="input py-2 text-xs font-bold text-emerald-950" 
                  />
                </div>
                <div>
                  <label className="label text-[11px] font-bold">Reference Number</label>
                  <input 
                    type="text" 
                    value={editReferenceNumber} 
                    onChange={(e) => setEditReferenceNumber(e.target.value)} 
                    placeholder="Reference/Ref" 
                    className="input py-2 text-xs font-semibold" 
                  />
                </div>
              </div>

              {/* Type specific fields */}
              {editingVoucher.type !== 'TRF' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">Branch</label>
                      <select 
                        value={editBranchId} 
                        onChange={(e) => setEditBranchId(e.target.value)} 
                        className="input select py-2 text-xs bg-white"
                      >
                        <option value="">Corp / HQ</option>
                        {branches.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-[11px] font-bold">
                        {editingVoucher.type === 'RCV' ? 'Received From' : 'Paid To'}
                      </label>
                      <input 
                        type="text" 
                        required 
                        value={editParticularName} 
                        onChange={(e) => setEditParticularName(e.target.value)} 
                        placeholder={editingVoucher.type === 'RCV' ? "Sender name" : "Recipient name"} 
                        className="input py-2 text-xs font-semibold" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">Payment Mode</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editPaymentMode" 
                            value="bank" 
                            checked={editPaymentMode === 'bank'} 
                            onChange={() => setEditPaymentMode('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editPaymentMode" 
                            value="cash" 
                            checked={editPaymentMode === 'cash'} 
                            onChange={() => setEditPaymentMode('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="label text-[11px] font-bold">
                        Select {editPaymentMode === 'bank' ? 'Bank Account' : 'Cash Account'}
                      </label>
                      {editPaymentMode === 'bank' ? (
                        <select 
                          required 
                          value={editBankAccountId} 
                          onChange={(e) => setEditBankAccountId(e.target.value)} 
                          className="input select py-2 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Bank</option>
                          {bankAccounts.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>
                          ))}
                        </select>
                      ) : (
                        <select 
                          required 
                          value={editCashAccountId} 
                          onChange={(e) => setEditCashAccountId(e.target.value)} 
                          className="input select py-2 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Cash Account</option>
                          {cashAccounts.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
                    <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Source (From)</span>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editFromType" 
                            value="bank" 
                            checked={editFromAccountType === 'bank'} 
                            onChange={() => setEditFromAccountType('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editFromType" 
                            value="cash" 
                            checked={editFromAccountType === 'cash'} 
                            onChange={() => setEditFromAccountType('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <select 
                        required 
                        value={editFromAccountId} 
                        onChange={(e) => setEditFromAccountId(e.target.value)} 
                        className="input select py-1.5 text-xs bg-white font-semibold"
                      >
                        <option value="">Select Source</option>
                        {editFromAccountType === 'bank'
                          ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                          : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                        }
                      </select>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
                    <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Destination (To)</span>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editToType" 
                            value="bank" 
                            checked={editToAccountType === 'bank'} 
                            onChange={() => setEditToAccountType('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editToType" 
                            value="cash" 
                            checked={editToAccountType === 'cash'} 
                            onChange={() => setEditToAccountType('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <select 
                        required 
                        value={editToAccountId} 
                        onChange={(e) => setEditToAccountId(e.target.value)} 
                        className="input select py-1.5 text-xs bg-white font-semibold"
                      >
                        <option value="">Select Destination</option>
                        {editToAccountType === 'bank'
                          ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                          : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                        }
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Narration */}
              <div>
                <label className="label text-[11px] font-bold">Narration</label>
                <textarea 
                  value={editNarration} 
                  onChange={(e) => setEditNarration(e.target.value)} 
                  placeholder="Voucher details..." 
                  className="input h-16 py-1.5 text-xs resize-none font-medium" 
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8e6]">
                <button 
                  type="button" 
                  onClick={() => setEditingVoucher(null)} 
                  className="btn-ghost px-5 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={editMutation.isPending}
                  className="btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  {editMutation.isPending && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
