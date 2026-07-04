import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, Plus, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const Banks: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBank, setEditingBank] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch bank accounts
  const { data: banks = [], isLoading } = useQuery({
    queryKey: ['bankAccountsList'],
    queryFn: async () => {
      const res = await api.get('/banks/');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, setValue } = useForm();

  // Create Bank Mutation
  const createMutation = useMutation({
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
      setShowAddForm(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to register bank account.');
    },
  });

  // Edit Bank Mutation
  const editMutation = useMutation({
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

  const handleAddSubmit = (values: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    createMutation.mutate(values);
  };

  const handleEditSubmit = (values: any) => {
    if (!editingBank) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    editMutation.mutate({
      id: editingBank.id,
      data: {
        name: values.name,
        account_number: values.account_number,
        ifsc_code: values.ifsc_code,
        bank_branch_name: values.bank_branch_name,
        is_overdraft_allowed: values.is_overdraft_allowed === 'true' || values.is_overdraft_allowed === true,
        status: values.status,
        notes: values.notes,
      },
    });
  };

  const startEdit = (bank: any) => {
    setEditingBank(bank);
    setValue('name', bank.name);
    setValue('account_number', bank.account_number || '');
    setValue('ifsc_code', bank.ifsc_code || '');
    setValue('bank_branch_name', bank.bank_branch_name || '');
    setValue('is_overdraft_allowed', bank.is_overdraft_allowed);
    setValue('status', bank.status);
    setValue('notes', bank.notes || '');
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Bank Accounts</h2>
          <p className="page-subtitle">Configure corporate bank ledgers and opening balances</p>
        </div>
        {!showAddForm && !editingBank && (
          <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs gap-1 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Add Bank Account</span>
          </button>
        )}
      </div>

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

      {/* Add Bank Form */}
      {showAddForm && (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Register New Bank Account</h3>
          <form onSubmit={handleSubmit(handleAddSubmit)} className="space-y-4">
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
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Register Bank</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Bank Form */}
      {editingBank && (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Edit Bank Details: {editingBank.name}</h3>
          <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-4">
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
                <label className="label">Opening Balance (Read Only)</label>
                <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-gray-500" value={fmt(editingBank.opening_balance)} />
              </div>
              <div>
                <label className="label">Current Calculated Balance</label>
                <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-[#023020]" value={fmt(editingBank.current_balance)} />
              </div>
              <div>
                <label className="label">Allow Overdraft (OD)?</label>
                <select className="input select bg-white" {...register('is_overdraft_allowed')}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <select className="input select bg-white" {...register('status')}>
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
              <button type="button" onClick={() => setEditingBank(null)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Bank List table */}
      {isLoading ? (
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
                        <button onClick={() => startEdit(bank)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Edit Bank">
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
    </div>
  );
};
