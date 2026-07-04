import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Lock, Save } from 'lucide-react';
import api from '../lib/api';

const passwordSchema = zod.object({
  current_password: zod.string().min(1, 'Current password is required'),
  new_password: zod.string().min(6, 'New password must be at least 6 characters'),
  confirm_password: zod.string(),
}).refine((data) => data.new_password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type PasswordFormValues = zod.infer<typeof passwordSchema>;

export const Settings: React.FC = () => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
  });

  const mutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      const res = await api.put('/auth/me/password', {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      return res.data;
    },
    onSuccess: () => {
      setSuccessMsg('Your security password has been changed successfully!');
      reset();
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update password.');
    },
  });

  const onSubmit = (values: PasswordFormValues) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    mutation.mutate(values);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">User Settings</h2>
          <p className="page-subtitle">Manage login password and secure account credentials</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-sm border border-green-100 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="card bg-white p-6 shadow-sm border border-[#e2e8e6]">
        <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider mb-6 flex items-center gap-2 border-b pb-3">
          <Lock className="w-5 h-5 text-[#023020]" />
          <span>Change Account Password</span>
        </h3>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Current Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="input" 
              required
              {...register('current_password')} 
            />
            {errors.current_password && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.current_password.message}</p>}
          </div>

          <div>
            <label className="label">New Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="input" 
              required
              {...register('new_password')} 
            />
            {errors.new_password && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.new_password.message}</p>}
          </div>

          <div>
            <label className="label">Confirm New Password</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              className="input" 
              required
              {...register('confirm_password')} 
            />
            {errors.confirm_password && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.confirm_password.message}</p>}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
            <button 
              type="submit" 
              disabled={mutation.isPending}
              className="btn-primary px-6 gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{mutation.isPending ? 'Updating...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
