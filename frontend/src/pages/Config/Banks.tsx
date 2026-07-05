import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Edit2, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const Banks: React.FC = () => {
  const queryClient = useQueryClient();
  const [subTab, setSubTab] = useState<'banks' | 'cash'>('banks');
  
  // Bank Form States
  const [showAddBankForm, setShowAddBankForm] = useState(false);
  const [editingBank, setEditingBank] = useState<any | null>(null);
  
  // Cash Form States
  const [showAddCashForm, setShowAddCashForm] = useState(false);
  const [editingCash, setEditingCash] = useState<any | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // React Hook Form
  const { register, handleSubmit, reset, setValue } = useForm();

  // Fetch Bank Accounts
  const { data: banks = [], isLoading: isLoadingBanks } = useQuery({
    queryKey: ['bankAccountsList'],
    queryFn: async () => {
      const res = await api.get('/banks/');
      return res.data;
    },
  });

  // Fetch Cash Accounts
  const { data: cashAccounts = [], isLoading: isLoadingCash } = useQuery({
    queryKey: ['cashAccountsList'],
    queryFn: async () => {
      const res = await api.get('/banks/cash/all');
      return res.data;
    },
  });

  // Bank Mutations
  const createBankMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/banks/', {
        ...data,
        opening_balance: Number(data.opening_balance),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] });
      setSuccessMsg('Bank account registered successfully!');
      reset();
      setShowAddBankForm(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to register bank account.');
    },
  });

  const editBankMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/banks/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankAccountsList'] });
      setSuccessMsg('Bank account details updated!');
      setEditingBank(null);
      reset();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update bank account.');
    },
  });

  // Cash Mutations
  const createCashMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/banks/cash', {
        name: data.name,
        opening_balance: Number(data.opening_balance),
        opening_date: data.opening_date,
        status: data.status,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashAccountsList'] });
      setSuccessMsg('Cash account registered successfully!');
      reset();
      setShowAddCashForm(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to register cash account.');
    },
  });

  const editCashMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/banks/cash/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashAccountsList'] });
      setSuccessMsg('Cash account details updated!');
      setEditingCash(null);
      reset();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update cash account.');
    },
  });

  const handleBankAddSubmit = (values: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    createBankMutation.mutate(values);
  };

  const handleBankEditSubmit = (values: any) => {
    if (!editingBank) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    editBankMutation.mutate({
      id: editingBank.id,
      data: {
        name: values.name,
        account_number: values.account_number,
        ifsc_code: values.ifsc_code,
        bank_branch_name: values.bank_branch_name,
        opening_balance: Number(values.opening_balance),
        opening_date: values.opening_date,
        is_overdraft_allowed: values.is_overdraft_allowed === 'true' || values.is_overdraft_allowed === true,
        status: values.status,
        notes: values.notes,
      },
    });
  };

  const handleCashAddSubmit = (values: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    createCashMutation.mutate(values);
  };

  const handleCashEditSubmit = (values: any) => {
    if (!editingCash) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    editCashMutation.mutate({
      id: editingCash.id,
      data: {
        name: values.name,
        opening_balance: Number(values.opening_balance),
        opening_date: values.opening_date,
        status: values.status,
      },
    });
  };

  const startEditBank = (bank: any) => {
    setEditingBank(bank);
    setValue('name', bank.name);
    setValue('account_number', bank.account_number || '');
    setValue('ifsc_code', bank.ifsc_code || '');
    setValue('bank_branch_name', bank.bank_branch_name || '');
    setValue('opening_balance', bank.opening_balance);
    setValue('opening_date', bank.opening_date);
    setValue('is_overdraft_allowed', bank.is_overdraft_allowed);
    setValue('status', bank.status);
    setValue('notes', bank.notes || '');
  };

  const startEditCash = (cash: any) => {
    setEditingCash(cash);
    setValue('name', cash.name);
    setValue('opening_balance', cash.opening_balance);
    setValue('opening_date', cash.opening_date);
    setValue('status', cash.status);
  };

  const clearForms = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setShowAddBankForm(false);
    setShowAddCashForm(false);
    setEditingBank(null);
    setEditingCash(null);
    reset();
  };

  const handleSubTabChange = (tab: 'banks' | 'cash') => {
    setSubTab(tab);
    clearForms();
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Bank & Cash Accounts</h2>
          <p className="page-subtitle">Configure financial ledgers, cash vault limits, and opening balances</p>
        </div>
        
        {/* Conditional Add Buttons */}
        {subTab === 'banks' && !showAddBankForm && !editingBank && (
          <button onClick={() => setShowAddBankForm(true)} className="btn-primary text-xs gap-1 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Add Bank Account</span>
          </button>
        )}
        {subTab === 'cash' && !showAddCashForm && !editingCash && (
          <button onClick={() => setShowAddCashForm(true)} className="btn-primary text-xs gap-1 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Add Cash Account</span>
          </button>
        )}
      </div>

      {/* Sub-tab navigation */}
      <div className="flex border-b border-[#e2e8e6] gap-6">
        <button
          onClick={() => handleSubTabChange('banks')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
            subTab === 'banks' 
              ? 'border-b-2 border-[#023020] text-[#023020]' 
              : 'text-[#8aa89f] hover:text-[#4a6b62]'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>Bank Accounts</span>
        </button>
        <button
          onClick={() => handleSubTabChange('cash')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 cursor-pointer transition-colors ${
            subTab === 'cash' 
              ? 'border-b-2 border-[#023020] text-[#023020]' 
              : 'text-[#8aa89f] hover:text-[#4a6b62]'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Cash Accounts / Vaults</span>
        </button>
      </div>

      {/* Alerts */}
      {successMsg && (
        <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-sm border border-green-100">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ─── BANK PANEL ─── */}
      {subTab === 'banks' && (
        <>
          {/* Add Bank Form */}
          {showAddBankForm && (
            <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Register New Bank Account</h3>
              <form onSubmit={handleSubmit(handleBankAddSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Bank Name</label>
                    <input type="text" placeholder="e.g. ICICI Bank" className="input" required {...register('name')} />
                  </div>
                  <div>
                    <label className="label">Account Number</label>
                    <input type="text" placeholder="e.g. 50100234900" className="input" {...register('account_number')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">IFSC Code</label>
                    <input type="text" placeholder="e.g. ICIC0000104" className="input" {...register('ifsc_code')} />
                  </div>
                  <div>
                    <label className="label">Bank Branch Name</label>
                    <input type="text" placeholder="e.g. Connaught Place, Delhi" className="input" {...register('bank_branch_name')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Opening Balance (₹)</label>
                    <input type="number" step="0.01" placeholder="0.00" className="input" required {...register('opening_balance')} />
                  </div>
                  <div>
                    <label className="label">Opening Date</label>
                    <input type="date" className="input" required {...register('opening_date')} />
                  </div>
                  <div>
                    <label className="label">Allow Overdraft (OD)?</label>
                    <select className="input select bg-white" {...register('is_overdraft_allowed')}>
                      <option value="false">No (Disallow negative balances)</option>
                      <option value="true">Yes (Allow overdraft limit)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="label">Notes / Description</label>
                  <textarea placeholder="Write ledger details..." className="input h-20 resize-none" {...register('notes')}></textarea>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
                  <button type="button" onClick={clearForms} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Register Bank</button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Bank Form */}
          {editingBank && (
            <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Edit Bank Details: {editingBank.name}</h3>
              <form onSubmit={handleSubmit(handleBankEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Bank Name</label>
                    <input type="text" className="input" required {...register('name')} />
                  </div>
                  <div>
                    <label className="label">Account Number</label>
                    <input type="text" className="input" {...register('account_number')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">IFSC Code</label>
                    <input type="text" className="input" {...register('ifsc_code')} />
                  </div>
                  <div>
                    <label className="label">Bank Branch Name</label>
                    <input type="text" className="input" {...register('bank_branch_name')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Opening Balance (₹)</label>
                    <input type="number" step="0.01" className="input font-semibold" required {...register('opening_balance')} />
                  </div>
                  <div>
                    <label className="label">Opening Date</label>
                    <input type="date" className="input font-semibold" required {...register('opening_date')} />
                  </div>
                  <div>
                    <label className="label">Allow Overdraft (OD)?</label>
                    <select className="input select bg-white font-semibold" {...register('is_overdraft_allowed')}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Current Calculated Balance</label>
                    <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-[#023020]" value={fmt(editingBank.current_balance)} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input select bg-white font-semibold" {...register('status')}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Notes / Description</label>
                    <input type="text" className="input" {...register('notes')} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
                  <button type="button" onClick={clearForms} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          )}

          {/* Bank List table */}
          {isLoadingBanks ? (
            <LoadingSkeleton rows={5} cols={5} />
          ) : (
            <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bank Name</th>
                      <th>Account Number</th>
                      <th>IFSC</th>
                      <th>Opening Bal</th>
                      <th>Current Bal</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {banks.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-sm text-[#8aa89f]">No banks configured.</td>
                      </tr>
                    ) : (
                      banks.map((bank: any) => (
                        <tr key={bank.id}>
                          <td className="font-bold text-[#0d1f1a] flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-[#023020]" />
                            <span>{bank.name}</span>
                          </td>
                          <td className="font-semibold text-xs text-[#4a6b62]">{bank.account_number || '—'}</td>
                          <td className="text-xs text-[#4a6b62]">{bank.ifsc_code || '—'}</td>
                          <td>{fmt(bank.opening_balance)}</td>
                          <td className="font-bold text-[#023020]">{fmt(bank.current_balance)}</td>
                          <td>
                            <span className={`badge ${bank.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                              {bank.status}
                            </span>
                          </td>
                          <td className="text-right">
                            <button onClick={() => startEditBank(bank)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Edit Bank">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── CASH PANEL ─── */}
      {subTab === 'cash' && (
        <>
          {/* Add Cash Form */}
          {showAddCashForm && (
            <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Register New Cash Counter / Vault</h3>
              <form onSubmit={handleSubmit(handleCashAddSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Cash Ledger Name</label>
                    <input type="text" placeholder="e.g. Main Vault Cash" className="input" required {...register('name')} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input select bg-white" {...register('status')}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Opening Balance (₹)</label>
                    <input type="number" step="0.01" placeholder="0.00" className="input" required {...register('opening_balance')} />
                  </div>
                  <div>
                    <label className="label">Opening Date</label>
                    <input type="date" className="input" required {...register('opening_date')} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
                  <button type="button" onClick={clearForms} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Register Cash Ledger</button>
                </div>
              </form>
            </div>
          )}

          {/* Edit Cash Form */}
          {editingCash && (
            <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Edit Cash Ledger: {editingCash.name}</h3>
              <form onSubmit={handleSubmit(handleCashEditSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Cash Ledger Name</label>
                    <input type="text" className="input font-semibold" required {...register('name')} />
                  </div>
                  <div>
                    <label className="label">Status</label>
                    <select className="input select bg-white font-semibold" {...register('status')}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="label">Opening Balance (₹)</label>
                    <input type="number" step="0.01" className="input font-semibold" required {...register('opening_balance')} />
                  </div>
                  <div>
                    <label className="label">Opening Date</label>
                    <input type="date" className="input font-semibold" required {...register('opening_date')} />
                  </div>
                  <div>
                    <label className="label">Current Calculated Balance</label>
                    <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-[#023020]" value={fmt(editingCash.current_balance)} />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
                  <button type="button" onClick={clearForms} className="btn-ghost">Cancel</button>
                  <button type="submit" className="btn-primary">Save Changes</button>
                </div>
              </form>
            </div>
          )}

          {/* Cash List table */}
          {isLoadingCash ? (
            <LoadingSkeleton rows={4} cols={5} />
          ) : (
            <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs">
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cash Ledger Name</th>
                      <th>Opening Balance</th>
                      <th>Opening Date</th>
                      <th>Current Calculated Balance</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashAccounts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-sm text-[#8aa89f]">No cash accounts configured.</td>
                      </tr>
                    ) : (
                      cashAccounts.map((cash: any) => (
                        <tr key={cash.id}>
                          <td className="font-bold text-[#0d1f1a] flex items-center gap-2">
                            <Wallet className="w-4 h-4 text-[#023020]" />
                            <span>{cash.name}</span>
                          </td>
                          <td>{fmt(cash.opening_balance)}</td>
                          <td>{cash.opening_date}</td>
                          <td className="font-bold text-[#023020]">{fmt(cash.current_balance)}</td>
                          <td>
                            <span className={`badge ${cash.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                              {cash.status}
                            </span>
                          </td>
                          <td className="text-right">
                            <button onClick={() => startEditCash(cash)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Edit Cash Details">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
