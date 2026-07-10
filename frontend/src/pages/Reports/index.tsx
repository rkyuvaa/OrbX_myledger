import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, ArrowDownRight, ArrowUpRight, BarChart3, Landmark, RefreshCw, Printer } from 'lucide-react';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

type ReportTab = 'cash-book' | 'bank-book' | 'branch-collect' | 'branch-pay' | 'cash-flow';

export const Reports: React.FC = () => {
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

  const [activeTab, setActiveTab] = useState<ReportTab>('cash-book');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [bankId, setBankId] = useState<string>('');

  // Fetch bank accounts for Bank Book
  const { data: accountsList } = useQuery({
    queryKey: ['ledgerAccountsList'],
    queryFn: async () => {
      const res = await api.get('/ledger/accounts');
      return res.data;
    },
  });
  const bankAccounts = accountsList?.bank_accounts || [];

  // Fetch company profile for print footer
  const { data: company } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const res = await api.get('/config/company');
      return res.data;
    },
  });
  const companyName = company?.name || 'My Ledger';

  const [printDateTime, setPrintDateTime] = useState<string>('');

  const handlePrint = () => {
    setPrintDateTime(new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }).format(new Date()));
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Report Queries
  const { data: cashBookData, isLoading: loadingCash } = useQuery({
    queryKey: ['reportCashBook', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/cash-book', {
        params: { from_date: fromDate || undefined, to_date: toDate || undefined },
      });
      return res.data;
    },
    enabled: activeTab === 'cash-book',
  });

  const { data: bankBookData, isLoading: loadingBank } = useQuery({
    queryKey: ['reportBankBook', bankId, fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/bank-book', {
        params: { bank_account_id: bankId, from_date: fromDate || undefined, to_date: toDate || undefined },
      });
      return res.data;
    },
    enabled: activeTab === 'bank-book' && !!bankId,
  });

  const { data: branchCollectData, isLoading: loadingBranchCollect } = useQuery({
    queryKey: ['reportBranchCollect', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/branch-collection', {
        params: { from_date: fromDate || undefined, to_date: toDate || undefined },
      });
      return res.data;
    },
    enabled: activeTab === 'branch-collect',
  });

  const { data: branchPayData, isLoading: loadingBranchPay } = useQuery({
    queryKey: ['reportBranchPay', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/branch-payment', {
        params: { from_date: fromDate || undefined, to_date: toDate || undefined },
      });
      return res.data;
    },
    enabled: activeTab === 'branch-pay',
  });

  const { data: cashFlowData, isLoading: loadingCashFlow } = useQuery({
    queryKey: ['reportCashFlow', fromDate, toDate],
    queryFn: async () => {
      const res = await api.get('/reports/cash-flow', {
        params: { from_date: fromDate || undefined, to_date: toDate || undefined },
      });
      return res.data;
    },
    enabled: activeTab === 'cash-flow',
  });

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const fmtNoCurr = (val: number) => 
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const renderAmount = (val: number, fallback = '—') => {
    if (val === undefined || val === null || val === 0) return fallback;
    return (
      <>
        <span className="print-hidden">{fmt(val)}</span>
        <span className="print-only-inline">{fmtNoCurr(val)}</span>
      </>
    );
  };

  return (
    <div className="space-y-6">

      {/* Report Switcher & Date Filters */}
      <div className="card bg-white p-5 border border-[#e2e8e6] shadow-xs space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-[#e2e8e6] pb-3">
          {(
            [
              { id: 'cash-book', label: 'Cash Book', icon: FileText },
              { id: 'bank-book', label: 'Bank Book', icon: Landmark },
              { id: 'branch-collect', label: 'Branch Collections', icon: ArrowDownRight },
              { id: 'branch-pay', label: 'Branch Payments', icon: ArrowUpRight },
              { id: 'cash-flow', label: 'Cash Flow', icon: BarChart3 },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#023020] text-white shadow-xs'
                  : 'text-[#4a6b62] hover:bg-[#f1f5f4]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

          {activeTab === 'bank-book' && (
            <div>
              <label className="label">Select Bank Account</label>
              <select
                className="input select text-xs bg-white"
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
              >
                <option value="">Select Account</option>
                {bankAccounts.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* REPORT CONTENT VIEWER */}

      {/* 1. Cash Book */}
      {activeTab === 'cash-book' && (
        loadingCash ? <LoadingSkeleton rows={6} cols={4} /> : cashBookData ? (
          <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-md font-bold text-[#023020] uppercase tracking-wider">Cash Book Statement</h3>
                <p className="text-xs text-[#8aa89f]">Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrint}
                  className="btn-outline text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 no-print"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report</span>
                </button>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#8aa89f] block uppercase">Net Flow Balance</span>
                  <span className={`text-md font-extrabold ${cashBookData.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(cashBookData.net)}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receipts Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider bg-green-50 p-2 rounded-lg">Receipts (Cr)</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher</th>
                        <th>Particulars</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashBookData.receipts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-xs text-[#8aa89f]">No receipts</td>
                        </tr>
                      ) : (
                        cashBookData.receipts.map((r: any) => (
                          <tr key={r.voucher_number}>
                            <td>{r.date}</td>
                            <td className="font-bold text-[#023020]">{r.voucher_number}</td>
                            <td className="text-xs">{r.received_from}</td>
                            <td className="text-right font-semibold text-green-600">{renderAmount(r.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider bg-red-50 p-2 rounded-lg">Payments (Dr)</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher</th>
                        <th>Particulars</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashBookData.payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-xs text-[#8aa89f]">No payments</td>
                        </tr>
                      ) : (
                        cashBookData.payments.map((p: any) => (
                          <tr key={p.voucher_number}>
                            <td>{p.date}</td>
                            <td className="font-bold text-[#023020]">{p.voucher_number}</td>
                            <td className="text-xs">{p.paid_to}</td>
                            <td className="text-right font-semibold text-red-600">{renderAmount(p.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* 2. Bank Book */}
      {activeTab === 'bank-book' && (
        !bankId ? (
          <div className="card bg-white py-12 text-center border-dashed border-[#e2e8e6] rounded-xl">
            <p className="text-xs text-[#8aa89f]">Please select a Bank Account filter above.</p>
          </div>
        ) : loadingBank ? <LoadingSkeleton rows={6} cols={5} /> : bankBookData ? (
          <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <div>
                <h3 className="text-md font-bold text-[#023020] uppercase tracking-wider">Bank Book: {bankBookData.bank_name}</h3>
                <p className="text-xs text-[#8aa89f]">Statement Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePrint}
                  className="btn-outline text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 no-print"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report</span>
                </button>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-[#8aa89f] block uppercase">Current Bank Balance</span>
                  <span className="text-md font-extrabold text-[#023020]">{fmt(bankBookData.current_balance)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Receipts Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-green-700 uppercase tracking-wider bg-green-50 p-2 rounded-lg">Receipts (Cr)</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher</th>
                        <th>Ref #</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankBookData.receipts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-xs text-[#8aa89f]">No bank receipts</td>
                        </tr>
                      ) : (
                        bankBookData.receipts.map((r: any) => (
                          <tr key={r.voucher_number}>
                            <td>{r.date}</td>
                            <td className="font-bold text-[#023020]">{r.voucher_number}</td>
                            <td className="text-xs truncate max-w-[80px]" title={r.reference_number}>{r.reference_number}</td>
                            <td className="text-right font-semibold text-green-600">{renderAmount(r.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments Column */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-red-700 uppercase tracking-wider bg-red-50 p-2 rounded-lg">Payments (Dr)</h4>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Voucher</th>
                        <th>Ref #</th>
                        <th className="text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankBookData.payments.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-xs text-[#8aa89f]">No bank payments</td>
                        </tr>
                      ) : (
                        bankBookData.payments.map((p: any) => (
                          <tr key={p.voucher_number}>
                            <td>{p.date}</td>
                            <td className="font-bold text-[#023020]">{p.voucher_number}</td>
                            <td className="text-xs truncate max-w-[80px]" title={p.reference_number}>{p.reference_number}</td>
                            <td className="text-right font-semibold text-red-600">{renderAmount(p.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null
      )}

      {/* 3. Branch Collection */}
      {activeTab === 'branch-collect' && (
        loadingBranchCollect ? <LoadingSkeleton rows={6} cols={4} /> : branchCollectData ? (
          <div className="card bg-white p-5 border border-[#e2e8e6] shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3 mb-1">
              <div>
                <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider">Branch-wise Collections Today</h3>
                <p className="text-xs text-[#8aa89f]">Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}</p>
              </div>
              <button
                onClick={handlePrint}
                className="btn-outline text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 no-print"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch Code</th>
                    <th>Branch Name</th>
                    <th>Transactions Count</th>
                    <th className="text-right">Total Collection (Cr)</th>
                  </tr>
                </thead>
                <tbody>
                  {branchCollectData.data.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-xs text-[#8aa89f]">No branch collections found.</td>
                    </tr>
                  ) : (
                    branchCollectData.data.map((item: any) => (
                      <tr key={item.branch_id}>
                        <td className="font-bold text-[#023020]">{item.branch_code}</td>
                        <td className="font-medium">{item.branch_name}</td>
                        <td>{item.transaction_count}</td>
                        <td className="text-right font-bold text-green-600">{renderAmount(item.total_collected)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      )}

      {/* 4. Branch Payment */}
      {activeTab === 'branch-pay' && (
        loadingBranchPay ? <LoadingSkeleton rows={6} cols={4} /> : branchPayData ? (
          <div className="card bg-white p-5 border border-[#e2e8e6] shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-3 mb-1">
              <div>
                <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider">Branch-wise Payments Today</h3>
                <p className="text-xs text-[#8aa89f]">Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}</p>
              </div>
              <button
                onClick={handlePrint}
                className="btn-outline text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 no-print"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Branch Code</th>
                    <th>Branch Name</th>
                    <th>Transactions Count</th>
                    <th className="text-right">Total Outflow (Dr)</th>
                  </tr>
                </thead>
                <tbody>
                  {branchPayData.data.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-xs text-[#8aa89f]">No branch payments found.</td>
                    </tr>
                  ) : (
                    branchPayData.data.map((item: any) => (
                      <tr key={item.branch_id}>
                        <td className="font-bold text-[#023020]">{item.branch_code}</td>
                        <td className="font-medium">{item.branch_name}</td>
                        <td>{item.transaction_count}</td>
                        <td className="text-right font-bold text-red-600">{renderAmount(item.total_paid)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null
      )}

      {/* 5. Cash Flow Summary */}
      {activeTab === 'cash-flow' && (
        loadingCashFlow ? <LoadingSkeleton rows={3} cols={3} /> : cashFlowData ? (
          <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#023020] uppercase tracking-wider">Company Cash Flow Statement</h3>
                <p className="text-xs text-[#8aa89f]">Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}</p>
              </div>
              <button
                onClick={handlePrint}
                className="btn-outline text-xs cursor-pointer flex items-center gap-1.5 px-3 py-1.5 no-print"
              >
                <Printer className="w-4 h-4" />
                <span>Print Report</span>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100 flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Total Cash & Bank Inflow</span>
                <span className="text-2xl font-bold text-green-600 mt-2">{fmt(cashFlowData.total_inflow)}</span>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] uppercase font-bold text-red-700 tracking-wider">Total Cash & Bank Outflow</span>
                <span className="text-2xl font-bold text-red-600 mt-2">{fmt(cashFlowData.total_outflow)}</span>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] uppercase font-bold text-[#023020] tracking-wider">Net Surplus/Deficit</span>
                <span className={`text-2xl font-extrabold mt-2 ${cashFlowData.net_flow >= 0 ? 'text-[#023020]' : 'text-red-700'}`}>
                  {fmt(cashFlowData.net_flow)}
                </span>
              </div>
            </div>
          </div>
        ) : null
      )}
      {/* Print Footer */}
      <div className="print-footer hidden">
        <span>{companyName}</span>
        <span>Printed on: {printDateTime}</span>
        <span>Page <span className="print-footer-page"></span></span>
      </div>
    </div>
  );
};
