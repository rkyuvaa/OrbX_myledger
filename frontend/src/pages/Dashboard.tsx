import React from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownRight, ArrowUpRight, Wallet, Landmark, Plus, X
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../lib/api';
import { BalanceCard } from '../components/BalanceCard';
import { StatCard } from '../components/StatCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { useToastStore } from '../store/toastStore';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useToastStore((state) => state.addToast);

  const [activeChequeModal, setActiveChequeModal] = React.useState<'received' | 'given' | null>(null);
  const [clearingVoucher, setClearingVoucher] = React.useState<{ id: string; type: string; number: string; amount: number } | null>(null);

  const { data: dashboardData, isLoading, error, refetch: refetchSummary } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary');
      return response.data;
    },
    refetchInterval: 15000, // Refresh dashboard every 15s
  });

  const { data: pendingCheques = [], refetch: refetchPending } = useQuery({
    queryKey: ['pendingCheques'],
    queryFn: async () => {
      const response = await api.get('/daybook/', {
        params: { search: 'Status: Pending' }
      });
      return response.data;
    },
  });

  const clearMutation = useMutation({
    mutationFn: async ({ type, id }: { type: string; id: string }) => {
      const response = await api.post(`/ledger/clear-cheque/${type}/${id}`);
      return response.data;
    },
    onSuccess: () => {
      addToast('Cheque marked as cleared successfully!', 'success');
      refetchSummary();
      refetchPending();
      setClearingVoucher(null);
    },
    onError: (err: any) => {
      addToast(err.response?.data?.detail || 'Failed to clear cheque.', 'error');
    }
  });

  const filteredCheques = React.useMemo(() => {
    if (!activeChequeModal || !Array.isArray(pendingCheques)) return [];
    return pendingCheques.filter((entry: any) => {
      const isRcv = entry.voucher_type === 'RCV';
      if (activeChequeModal === 'received') return isRcv;
      return !isRcv;
    });
  }, [pendingCheques, activeChequeModal]);

  if (isLoading) {
    return <LoadingSkeleton rows={6} cols={4} />;
  }

  if (error) {
    return (
      <div className="card p-6 border-red-200 bg-red-50 text-red-700 text-center">
        <h3 className="font-bold">Error loading dashboard</h3>
        <p className="text-sm mt-2">Failed to communicate with My Ledger API service.</p>
      </div>
    );
  }

  const kpis = dashboardData?.kpis;
  const monthly_flow = dashboardData?.monthly_flow || [];

  if (!kpis) {
    return (
      <div className="card p-6 border-red-200 bg-red-50 text-red-700 text-center">
        <h3 className="font-bold">Error loading dashboard data</h3>
        <p className="text-sm mt-2">Received invalid response format from the server.</p>
      </div>
    );
  }

  const totalBankAndCash = (kpis.total_bank_balance || 0) + (kpis.total_cash_balance || 0);

  // Format currency helper
  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-4">
      {/* Balance & Action Buttons Row */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <div className="w-full md:w-[70%]">
          <BalanceCard totalBalance={totalBankAndCash} accounts={kpis.account_tiles} />
        </div>
        <div className="w-full md:w-[30%] flex flex-col gap-3">
          <button 
            onClick={() => navigate('/receive')}
            className="flex-1 btn-primary text-base font-bold flex items-center justify-center gap-3 cursor-pointer shadow-md rounded-2xl py-3"
          >
            <Plus className="w-5 h-5 text-emerald-400" />
            <span>Receive Money</span>
          </button>
          <button 
            onClick={() => navigate('/pay')}
            className="flex-1 text-base font-bold flex items-center justify-center gap-3 cursor-pointer shadow-md rounded-2xl py-3 bg-red-800 text-white hover:bg-red-950 transition-colors"
          >
            <ArrowUpRight className="w-5 h-5 text-white" />
            <span>Send Money</span>
          </button>
          <button 
            onClick={() => navigate('/expense')}
            className="flex-1 text-base font-bold flex items-center justify-center gap-3 cursor-pointer shadow-md rounded-2xl py-3 bg-amber-800 text-white hover:bg-amber-950 transition-colors"
          >
            <Wallet className="w-5 h-5 text-amber-300" />
            <span>Expenses</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        <StatCard 
          title="Today's Receipts" 
          value={fmt(kpis.today_receipts)} 
          icon={ArrowDownRight} 
          description="Totally received" 
          valueClass="text-emerald-700 font-extrabold"
          iconBgClass="bg-emerald-50"
          iconClass="text-emerald-800 font-bold"
        />
        <StatCard 
          title="Today's Payments" 
          value={fmt(kpis.today_payments)} 
          icon={ArrowUpRight} 
          description="Totally Sent" 
          valueClass="text-red-600 font-extrabold"
          iconBgClass="bg-red-50"
          iconClass="text-red-600 font-bold"
        />
        <StatCard 
          title="Today's Expenses" 
          value={fmt(kpis.today_expenses)} 
          icon={Wallet} 
          description="Totally Spent (Expenses)" 
          valueClass="text-amber-600 font-extrabold"
          iconBgClass="bg-amber-50"
          iconClass="text-amber-600 font-bold"
        />
        <div onClick={() => setActiveChequeModal('received')} className="cursor-pointer">
          <StatCard 
            title={<>Cheques<br/>Received Today</>} 
            value={fmt(kpis.today_received_cheques_clear)} 
            description="Incoming clearing today"
            valueClass="text-emerald-700 font-extrabold"
            cardClass={kpis.today_received_cheques_clear > 0 ? 'animate-highlight-emerald border-emerald-500' : ''}
          />
        </div>
        <div onClick={() => setActiveChequeModal('given')} className="cursor-pointer">
          <StatCard 
            title={<>Cheques<br/>Given Today</>} 
            value={fmt(kpis.today_given_cheques_clear)} 
            description="Outgoing clearing today"
            valueClass="text-red-600 font-extrabold"
            cardClass={kpis.today_given_cheques_clear > 0 ? 'animate-highlight-red border-red-500' : ''}
          />
        </div>
        <StatCard 
          title="Branch Collection Today" 
          value={fmt(kpis.branch_collection_today)} 
          icon={Landmark} 
        />
      </div>

      {/* Monthly Cash Flow Area Chart */}
      <div className="card p-5 flex flex-col justify-between min-h-[220px]">
        <div>
          <h3 className="text-xs font-bold text-[#0d1f1a] uppercase tracking-wider mb-2">Monthly Cash Flow</h3>
        </div>
        <div className="w-full h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthly_flow}>
              <defs>
                <linearGradient id="colorReceipts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a86b" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#00a86b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPayments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
              <XAxis dataKey="month" stroke="#8aa89f" fontSize={11} />
              <YAxis stroke="#8aa89f" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="receipts" name="Receipts" stroke="#00a86b" fillOpacity={1} fill="url(#colorReceipts)" strokeWidth={2} />
              <Area type="monotone" dataKey="payments" name="Payments" stroke="#dc2626" fillOpacity={1} fill="url(#colorPayments)" strokeWidth={2} />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#d97706" fillOpacity={1} fill="url(#colorExpenses)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Cheque Clearing List Modal */}
      {activeChequeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e2e8e6] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-[#e2e8e6] bg-[#f8fafb]">
              <div>
                <h3 className="text-lg font-bold text-[#0d1f1a]">
                  Pending Cheques - {activeChequeModal === 'received' ? 'Received (Inflow)' : 'Given (Outflow)'}
                </h3>
                <p className="text-xs text-[#8aa89f] font-semibold mt-0.5">
                  Verify and mark cheques as cleared to update bank account ledger balances
                </p>
              </div>
              <button 
                onClick={() => setActiveChequeModal(null)}
                className="p-2 rounded-xl text-[#4a6b62] hover:bg-[#f1f5f4] hover:text-[#0d1f1a] transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 p-6 overflow-y-auto space-y-3">
              {filteredCheques.length === 0 ? (
                <div className="py-12 text-center text-[#8aa89f] text-sm font-medium">
                  No pending cheques scheduled for clearance today.
                </div>
              ) : (
                filteredCheques.map((item: any) => {
                  const amt = item.credit > 0 ? item.credit : item.debit;
                  const ref = item.reference_number || '';
                  const chqNoMatch = ref.match(/Cheque No:\s*([^\s|]+)/);
                  const chqDateMatch = ref.match(/Date:\s*([^\s|]+)/);
                  const chqNo = chqNoMatch ? chqNoMatch[1] : '—';
                  const chqDate = chqDateMatch ? chqDateMatch[1] : '—';

                  return (
                    <div key={item.id} className="p-4 bg-[#f8fafb] rounded-2xl border border-[#e2e8e6] flex justify-between items-center hover:bg-[#f1f5f4] transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                            {item.voucher_number}
                          </span>
                          <span className="text-xs text-[#4a6b62] font-semibold">
                            Cheque No: <strong className="text-[#0d1f1a]">{chqNo}</strong>
                          </span>
                        </div>
                        <p className="text-xs font-bold text-[#0d1f1a]">{item.particulars}</p>
                        <div className="flex items-center gap-3 text-[10px] text-[#8aa89f] font-semibold">
                          <span>Cheque Date: {chqDate}</span>
                          <span>•</span>
                          <span>Entered Date: {item.date}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-extrabold text-[#023020]">
                          {fmt(amt)}
                        </span>
                        <button
                          onClick={() => setClearingVoucher({
                            id: item.voucher_id,
                            type: item.voucher_type,
                            number: chqNo,
                            amount: amt
                          })}
                          className="px-4 py-2 bg-[#023020] text-white hover:bg-[#034a31] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
                        >
                          Clear Cheque
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-[#e2e8e6] bg-[#f8fafb] flex justify-end">
              <button
                onClick={() => setActiveChequeModal(null)}
                className="btn-outline px-5 py-2 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {clearingVoucher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 border border-[#e2e8e6] text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Landmark className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0d1f1a]">Confirm Clearance</h3>
              <p className="text-xs text-[#8aa89f] px-2">
                Is Cheque **{clearingVoucher.number}** for **{fmt(clearingVoucher.amount)}** cleared in bank statement?
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setClearingVoucher(null)}
                className="w-1/2 btn-outline py-2.5 text-xs font-bold rounded-xl border-[#e2e8e6] text-[#4a6b62] hover:bg-[#f8fafb]"
                disabled={clearMutation.isPending}
              >
                No
              </button>
              <button
                onClick={() => clearMutation.mutate({ type: clearingVoucher.type, id: clearingVoucher.id })}
                className="w-1/2 py-2.5 bg-[#023020] text-white hover:bg-[#034a31] text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
                disabled={clearMutation.isPending}
              >
                {clearMutation.isPending ? 'Clearing...' : 'Yes, Cleared'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
