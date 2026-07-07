import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const VoucherPrefixes: React.FC = () => {
  const queryClient = useQueryClient();
  const [editingSequence, setEditingSequence] = useState<any | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch Sequences
  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ['voucherSequences'],
    queryFn: async () => {
      const res = await api.get('/config/voucher-sequences');
      return res.data;
    },
  });

  const { register, handleSubmit, setValue, watch } = useForm();
  const watchedPrefix = watch('prefix');
  const watchedPadding = watch('padding');
  const watchedNextNumber = watch('next_number');

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await api.put(`/config/voucher-sequences/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voucherSequences'] });
      setSuccessMsg('Voucher prefix configuration updated successfully!');
      setEditingSequence(null);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update voucher prefix.');
    },
  });

  const onSubmit = (values: any) => {
    if (!editingSequence) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    editMutation.mutate({
      id: editingSequence.id,
      data: {
        prefix: values.prefix,
        padding: Number(values.padding),
        next_number: Number(values.next_number),
      },
    });
  };

  const startEdit = (seq: any) => {
    setEditingSequence(seq);
    setValue('prefix', seq.prefix);
    setValue('padding', seq.padding);
    setValue('next_number', seq.current_number + 1);
  };

  const getFriendlyVoucherName = (type: string) => {
    if (type === 'RCV') return 'Receipt Voucher';
    if (type === 'PAY') return 'Payment Voucher';
    if (type === 'EXP') return 'Expense Voucher';
    if (type === 'TRF') return 'Transfer Voucher';
    return type;
  };

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Voucher Prefix Configuration</h2>
          <p className="page-subtitle">Configure auto-numbering prefixes and padding formatting for bookkeeping</p>
        </div>
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

      {editingSequence && (
        <div className="card bg-white p-6 border border-[#e2e8e6] shadow-sm animate-in fade-in duration-200">
          <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-4">
            Edit: {getFriendlyVoucherName(editingSequence.voucher_type)}
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Voucher Type (Read Only)</label>
                <input 
                  type="text" 
                  disabled 
                  className="input bg-gray-100 cursor-not-allowed font-semibold text-gray-500" 
                  value={getFriendlyVoucherName(editingSequence.voucher_type)} 
                />
              </div>
              <div>
                <label className="label">Custom Prefix</label>
                <input type="text" className="input font-semibold" required {...register('prefix')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Padding Length</label>
                <select className="input select bg-white font-semibold" {...register('padding')}>
                  <option value="4">4 (e.g. 0001)</option>
                  <option value="5">5 (e.g. 00001)</option>
                  <option value="6">6 (e.g. 000001)</option>
                  <option value="7">7 (e.g. 0000001)</option>
                </select>
              </div>
              <div>
                <label className="label">Next Running Number</label>
                <input 
                  type="number" 
                  min="1" 
                  className="input font-semibold" 
                  required 
                  {...register('next_number')} 
                />
              </div>
              <div>
                <label className="label">Next Number Preview</label>
                <input 
                  type="text" 
                  disabled 
                  className="input bg-gray-100 cursor-not-allowed text-gray-500 font-semibold" 
                  value={
                    watchedPrefix && watchedPadding && watchedNextNumber 
                      ? `${watchedPrefix}-${String(watchedNextNumber).padStart(Number(watchedPadding), '0')}`
                      : ''
                  } 
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
              <button type="button" onClick={() => setEditingSequence(null)} className="btn-ghost">Cancel</button>
              <button type="submit" className="btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton rows={3} cols={4} />
      ) : (
        <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Voucher Type</th>
                  <th>Current Prefix</th>
                  <th>Running Number</th>
                  <th>FY Scope</th>
                  <th>Number Preview Example</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sequences.map((seq: any) => (
                  <tr key={seq.id}>
                    <td className="font-bold text-[#0d1f1a] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#023020]" />
                      <span>{getFriendlyVoucherName(seq.voucher_type)}</span>
                    </td>
                    <td className="font-semibold text-emerald-800">{seq.prefix}</td>
                    <td>{seq.current_number}</td>
                    <td>FY {seq.fy_start}-{seq.fy_end.toString().slice(-2)}</td>
                    <td className="font-mono text-xs text-gray-500">
                      {seq.prefix}-{String(seq.current_number + 1).padStart(seq.padding, '0')}
                    </td>
                    <td className="text-right">
                      <button onClick={() => startEdit(seq)} className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer" title="Edit Prefix">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
