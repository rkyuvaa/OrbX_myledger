import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowDownRight, ArrowUpRight, Wallet, Landmark, 
  TrendingUp, TrendingDown, RefreshCw, Plus, ArrowUp, ArrowDown
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, Legend
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

  const { kpis, monthly_flow, top_branch_collections, recent_transactions } = dashboardData;

  const totalBankAndCash = kpis.total_bank_balance + kpis.total_cash_balance;

  // Format currency helper
  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  // Pie chart data
  const pieData = kpis.account_tiles.map((tile: any) => ({
    name: tile.name,
    value: tile.balance,
  })).filter((item: any) => item.value > 0);

  const COLORS = ['#023020', '#00a86b', '#00c87f', '#4a6b62', '#8aa89f', '#10b981', '#34d399'];

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
            className="flex-1 btn-outline text-base font-bold flex items-center justify-center gap-3 cursor-pointer shadow-sm rounded-2xl py-3 border-2 border-[#023020] hover:bg-[#023020]/5"
          >
            <ArrowUpRight className="w-5 h-5 text-[#023020]" />
            <span>Send Money</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Today's Receipts" 
          value={fmt(kpis.today_receipts)} 
          icon={ArrowDownRight} 
          description="Total branch & direct collections" 
        />
        <StatCard 
          title="Today's Payments" 
          value={fmt(kpis.today_payments)} 
          icon={ArrowUpRight} 
          description="Total branch & corporate payments" 
        />
        <StatCard 
          title="Cash Balance" 
          value={fmt(kpis.total_cash_balance)} 
          icon={Wallet} 
          description="Available cash in vault" 
        />
        <StatCard 
          title="Branch Collection Today" 
          value={fmt(kpis.branch_collection_today)} 
          icon={Landmark} 
          description="Collections received from 6+ branches" 
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
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
              <XAxis dataKey="month" stroke="#8aa89f" fontSize={11} />
              <YAxis stroke="#8aa89f" fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="receipts" name="Receipts" stroke="#00a86b" fillOpacity={1} fill="url(#colorReceipts)" strokeWidth={2} />
              <Area type="monotone" dataKey="payments" name="Payments" stroke="#dc2626" fillOpacity={1} fill="url(#colorPayments)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
