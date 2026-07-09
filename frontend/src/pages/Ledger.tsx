import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Search, ArrowUpRight, ArrowDownRight, Printer } from 'lucide-react';
import api from '../lib/api';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const Ledger: React.FC = () => {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return `${parts[0]}-${parts[1]}-${parts[2]}`;
    }
    return dateStr;
  };

  const [accountId, setAccountId] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('bank');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Fetch bank and cash accounts list
  const { data: accountsList } = useQuery({
    queryKey: ['ledgerAccountsList'],
    queryFn: async () => {
      const res = await api.get('/ledger/accounts');
      return res.data;
    },
  });

  const bankAccounts = accountsList?.bank_accounts || [];
  const cashAccounts = accountsList?.cash_accounts || [];

  // Fetch statement data
  const { data: statement, isLoading } = useQuery({
    queryKey: ['ledgerStatement', accountType, accountId, fromDate, toDate],
    queryFn: async () => {
      if (!accountId) return null;
      const res = await api.get('/ledger/statement', {
        params: {
          account_type: accountType,
          account_id: accountId,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
        },
      });
      return res.data;
    },
    enabled: !!accountId,
  });

  const handleAccountChange = (val: string) => {
    if (!val) {
      setAccountId('');
      return;
    }
    const [type, id] = val.split(':');
    setAccountType(type);
    setAccountId(id);
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Page Header Print Button (right-aligned) */}
      {statement && (
        <div className="flex justify-end print:hidden mb-2">
          <button onClick={handlePrint} className="btn-outline text-xs gap-1.5 cursor-pointer">
            <Printer className="w-4 h-4" />
            <span>Print Statement</span>
          </button>
        </div>
      )}

      {/* Selector Filters Card */}
      <div className="card bg-white p-5 border border-[#e2e8e6] shadow-xs print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <label className="label">Select Account (Bank or Cash)</label>
            <select 
              className="input select text-xs bg-white font-semibold"
              onChange={(e) => handleAccountChange(e.target.value)}
              defaultValue=""
            >
              <option value="">Choose a Bank or Cash Ledger Account</option>
              <optgroup label="Bank Accounts">
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={`bank:${b.id}`}>
                    {b.name} (Bal: {fmt(b.current_balance)})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Cash Counters">
                {cashAccounts.map((c: any) => (
                  <option key={c.id} value={`cash:${c.id}`}>
                    {c.name} (Bal: {fmt(c.current_balance)})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

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
        </div>
      </div>

      {/* Statement Sheet */}
      {!accountId ? (
        <div className="card bg-white py-16 text-center border-dashed border-[#e2e8e6] rounded-xl print:hidden">
          <p className="text-sm text-[#8aa89f]">Please select a ledger account to load the statement sheet.</p>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton rows={10} cols={5} />
      ) : statement ? (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm space-y-6 print:border-none print:shadow-none">
          {/* Print Header */}
          <div className="hidden print:block text-center border-b pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-[#023020]">My Ledger</h1>
            <p className="text-xs text-[#8aa89f] tracking-widest mt-1">ACCOUNT STATEMENT</p>
            <p className="text-[10px] text-[#4a6b62] font-semibold mt-2">
              Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}
            </p>
          </div>

          {/* Statement Account Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#f8fafb] p-4 rounded-xl border border-[#e2e8e6] print:bg-white print:border-none">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#8aa89f]">Ledger Account</span>
              <h3 className="text-lg font-bold text-[#023020] mt-0.5">{statement.account_name}</h3>
              <p className="text-xs text-[#4a6b62] capitalize mt-0.5">Classification: {statement.account_type} Account</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#8aa89f] font-semibold">Opening Balance</span>
                <p className="text-sm font-bold text-[#0d1f1a]">{fmt(statement.opening_balance)}</p>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-[#8aa89f] font-semibold">Closing Balance</span>
                <p className="text-sm font-extrabold text-[#023020]">{fmt(statement.closing_balance)}</p>
              </div>
            </div>
          </div>

          <div className="table-container bg-white border border-[#e2e8e6]">
            <table className="data-table ledger-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher #</th>
                  <th>Particulars / Description</th>
                  <th>Received (Cr)</th>
                  <th>Paid (Dr)</th>
                  <th className="text-right">Balance (₹)</th>
                </tr>
              </thead>
              <tbody>
                {/* Opening Balance Row */}
                <tr className="bg-[#f8fafb]/50">
                  <td className="font-semibold text-xs text-[#8aa89f]" colSpan={3}>OPENING BALANCE RECORDED</td>
                  <td>—</td>
                  <td>—</td>
                  <td className="font-bold text-right text-[#0d1f1a]">{fmt(statement.opening_balance)}</td>
                </tr>

                {statement.entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-xs text-[#8aa89f]">
                      No transaction entries recorded in this period.
                    </td>
                  </tr>
                ) : (
                  statement.entries.map((entry: any) => (
                    <tr key={entry.id}>
                      <td>{entry.date}</td>
                      <td className="font-bold text-[#023020]">{entry.voucher_number}</td>
                      <td className="text-xs font-semibold text-[#4a6b62]">{entry.description || '—'}</td>
                      <td className="font-medium text-green-600">
                        {entry.credit > 0 ? fmt(entry.credit) : '—'}
                      </td>
                      <td className="font-medium text-red-600">
                        {entry.debit > 0 ? fmt(entry.debit) : '—'}
                      </td>
                      <td className="font-bold text-right text-[#0d1f1a]">{fmt(entry.running_balance)}</td>
                    </tr>
                  ))
                )}

                {/* Totals Summary Row */}
                <tr className="bg-[#f8fafb]/80 border-t-2 border-[#e2e8e6] font-semibold">
                  <td colSpan={3} className="text-xs uppercase tracking-wider text-[#4a6b62] font-bold">Total Statement Summaries</td>
                  <td className="text-green-700 font-bold">{fmt(statement.total_credit)}</td>
                  <td className="text-red-700 font-bold">{fmt(statement.total_debit)}</td>
                  <td className="text-right text-[#023020] font-extrabold">{fmt(statement.closing_balance)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* Print Footer */}
          <div className="print-footer hidden">
            <span>My Ledger - Account Statement</span>
            <span>Printed on: {new Date().toLocaleDateString('en-IN')}</span>
            <span>Page <span className="print-footer-page"></span></span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
