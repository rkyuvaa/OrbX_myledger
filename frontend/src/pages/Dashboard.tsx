import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownRight, ArrowUpRight, Wallet, Landmark, Plus
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import api from '../lib/api';
import { BalanceCard } from '../components/BalanceCard';
import { StatCard } from '../components/StatCard';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary');
      return response.data;
    },
    refetchInterval: 15000, // Refresh dashboard every 15s
  });

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

  const { kpis, monthly_flow } = dashboardData;

  const totalBankAndCash = kpis.total_bank_balance + kpis.total_cash_balance;

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
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
        <StatCard 
          title="Cash Balance" 
          value={fmt(kpis.total_cash_balance)} 
          icon={Wallet} 
          description="Cash in Hand" 
        />
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
    </div>
  );
};
