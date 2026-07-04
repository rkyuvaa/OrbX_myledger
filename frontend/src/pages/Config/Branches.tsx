import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, ShieldAlert, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const Branches: React.FC = () => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch branches
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branchesList'],
    queryFn: async () => {
      const res = await api.get('/branches/');
      return res.data;
    },
  });

  const { register, handleSubmit, reset, setValue } = useForm();

  // Create Branch Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/branches/', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchesList'] });
      setSuccessMsg('Branch registered successfully!');
      reset();
      setShowAddForm(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to create branch.');
    },
  });

  // Edit Branch Mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/branches/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branchesList'] });
      setSuccessMsg('Branch details updated!');
      setEditingBranch(null);
      reset();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update branch.');
    },
  });

  const handleAddSubmit = (values: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    createMutation.mutate(values);
  };

  const handleEditSubmit = (values: any) => {
    if (!editingBranch) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    editMutation.mutate({
      id: editingBranch.id,
      data: {
        name: values.name,
        address: values.address,
        contact_person: values.contact_person,
        phone: values.phone,
        email: values.email,
        status: values.status,
      },
    });
  };

  const startEdit = (branch: any) => {
    setEditingBranch(branch);
    setValue('name', branch.name);
    setValue('address', branch.address || '');
    setValue('contact_person', branch.contact_person || '');
    setValue('phone', branch.phone || '');
    setValue('email', branch.email || '');
    setValue('status', branch.status);
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Branches</h2>
          <p className="page-subtitle">Configure collection and disbursement branches</p>
        </div>
        {!showAddForm && !editingBranch && (
          <button onClick={() => setShowAddForm(true)} className="btn-primary text-xs gap-1 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Add Branch</span>
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

      {/* Add Branch Form */}
      {showAddForm && (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Register New Branch</h3>
          <form onSubmit={handleSubmit(handleAddSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Branch Name</label>
                <input type="text" placeholder="e.g. Bangalore South Branch" className="input" required {...register('name')} />
              </div>
              <div>
                <label className="label">Branch Code</label>
                <input type="text" placeholder="e.g. BLR-S" className="input" required {...register('code')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Contact Person</label>
                <input type="text" placeholder="e.g. Ramesh Kumar" className="input" {...register('contact_person')} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" placeholder="e.g. 9876543210" className="input" {...register('phone')} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input type="email" placeholder="e.g. blr.south@orbx.com" className="input" {...register('email')} />
              </div>
            </div>

            <div>
              <label className="label">Branch Address</label>
              <textarea placeholder="Write exact postal address..." className="input h-20 resize-none" {...register('address')}></textarea>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
              <button type="button" onClick={() => setShowAddForm(false)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Register Branch</button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Branch Form */}
      {editingBranch && (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">Edit Branch: {editingBranch.code}</h3>
          <form onSubmit={handleSubmit(handleEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Branch Name</label>
                <input type="text" className="input" required {...register('name')} />
              </div>
              <div>
                <label className="label">Branch Code (Read Only)</label>
                <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-gray-500" value={editingBranch.code} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Contact Person</label>
                <input type="text" className="input" {...register('contact_person')} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input type="text" className="input" {...register('phone')} />
              </div>
              <div>
                <label className="label">Email Address</label>
                <input type="email" className="input" {...register('email')} />
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
                <label className="label">Branch Address</label>
                <input type="text" className="input" {...register('address')} />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
              <button type="button" onClick={() => setEditingBranch(null)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {/* Branches List Table */}
      {isLoading ? (
        <LoadingSkeleton rows={5} cols={5} />
      ) : (
        <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Contact Person</th>
                  <th>Phone / Email</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {branches.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-sm text-[#8aa89f]">No branches configured.</td>
                  </tr>
                ) : (
                  branches.map((branch: any) => (
                    <tr key={branch.id}>
                      <td className="font-bold text-[#023020]">{branch.code}</td>
                      <td className="font-semibold">{branch.name}</td>
                      <td>{branch.contact_person || '—'}</td>
                      <td>
                        <p className="text-xs font-medium text-[#4a6b62]">{branch.phone || '—'}</p>
                        {branch.email && <p className="text-[10px] text-[#8aa89f]">{branch.email}</p>}
                      </td>
                      <td>
                        <span className={`badge ${branch.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                          {branch.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <button onClick={() => startEdit(branch)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Edit Branch">
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
