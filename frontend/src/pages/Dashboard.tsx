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
        <p className="text-sm mt-2">Failed to communicate with Orbx My Ledger API service.</p>
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
    <div className="space-y-6">
      {/* Top Header Buttons Bar */}
      <div className="flex items-center justify-between bg-white card p-4 border border-[#e2e8e6] shadow-xs">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
          <span className="text-xs font-semibold text-[#4a6b62] uppercase tracking-wider">Live System Active</span>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/receive')}
            className="btn-primary text-xs cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Receive Money</span>
          </button>
          <button 
            onClick={() => navigate('/pay')}
            className="btn-outline text-xs cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>Send Money</span>
          </button>
        </div>
      </div>

      {/* Large Balance Card */}
      <BalanceCard totalBalance={totalBankAndCash} accounts={kpis.account_tiles} />

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

      {/* Analytics Charts & Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Cash Flow Area Chart */}
        <div className="card lg:col-span-2 p-5 flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Monthly Cash Flow</h3>
          </div>
          <div className="w-full h-[280px]">
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

        {/* Bank distribution donut chart */}
        <div className="card p-5 flex flex-col justify-between min-h-[350px]">
          <div>
            <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Balance Distribution</h3>
          </div>
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center text-[10px] font-semibold text-[#4a6b62]">
            {pieData.map((item: any, i: number) => (
              <div key={item.name} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span>{item.name} ({Math.round((item.value / totalBankAndCash) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List */}
        <div className="card lg:col-span-2 p-5 min-h-[300px]">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Recent Transactions</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher</th>
                  <th>Date</th>
                  <th>Particulars</th>
                  <th>Mode</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {recent_transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-6 text-sm text-[#8aa89f]">
                      No transactions recorded yet
                    </td>
                  </tr>
                ) : (
                  recent_transactions.map((tx: any) => (
                    <tr key={tx.id}>
                      <td className="font-semibold text-[#023020]">{tx.voucher_number}</td>
                      <td>{tx.date}</td>
                      <td>{tx.type} {tx.type === 'Receipt' ? 'from' : 'to'} <span className="font-medium">{tx.party}</span></td>
                      <td className="capitalize text-xs text-[#4a6b62]">{tx.payment_mode}</td>
                      <td className="font-bold">
                        <span className={tx.type === 'Receipt' ? 'text-green-600' : 'text-red-600'}>
                          {tx.type === 'Receipt' ? '+' : '-'}{fmt(tx.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Branch Collections (Monthly) */}
        <div className="card p-5 min-h-[300px] flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Top Branch Collections</h3>
          </div>
          <div className="w-full h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top_branch_collections} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f4" />
                <XAxis type="number" stroke="#8aa89f" fontSize={10} />
                <YAxis dataKey="branch_code" type="category" stroke="#8aa89f" fontSize={10} width={30} />
                <Tooltip />
                <Bar dataKey="amount" fill="#023020" radius={[0, 4, 4, 0]}>
                  {top_branch_collections.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#023020' : '#00c87f'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
