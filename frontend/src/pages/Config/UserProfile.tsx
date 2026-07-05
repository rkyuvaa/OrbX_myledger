import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { User, Key, Save, AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const UserProfile: React.FC = () => {
  const queryClient = useQueryClient();
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState<string | null>(null);
  const [passwordErrorMsg, setPasswordErrorMsg] = useState<string | null>(null);

  // Fetch logged-in user profile
  const { data: me, isLoading } = useQuery({
    queryKey: ['myProfile'],
    queryFn: async () => {
      const res = await api.get('/auth/me');
      return res.data;
    },
  });

  const { register: registerProfile, handleSubmit: handleProfileSubmit, setValue: setProfileValue } = useForm();
  const { register: registerPassword, handleSubmit: handlePasswordSubmit, reset: resetPasswordForm } = useForm();

  // Populate values when user data is fetched
  React.useEffect(() => {
    if (me) {
      setProfileValue('full_name', me.full_name);
      setProfileValue('email', me.email);
    }
  }, [me, setProfileValue]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/auth/me', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myProfile'] });
      setProfileSuccessMsg('User details updated!');
    },
    onError: (err: any) => {
      setProfileErrorMsg(err.response?.data?.detail || 'Failed to update details.');
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/auth/me/password', {
        current_password: data.current_password,
        new_password: data.new_password,
      });
      return res.data;
    },
    onSuccess: () => {
      setPasswordSuccessMsg('Password updated successfully!');
      resetPasswordForm();
    },
    onError: (err: any) => {
      setPasswordErrorMsg(err.response?.data?.detail || 'Failed to update password.');
    },
  });

  const onProfileSubmit = (values: any) => {
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);
    updateProfileMutation.mutate(values);
  };

  const onPasswordSubmit = (values: any) => {
    setPasswordErrorMsg(null);
    setPasswordSuccessMsg(null);

    if (values.new_password !== values.confirm_password) {
      setPasswordErrorMsg('New passwords do not match.');
      return;
    }

    if (values.new_password.length < 6) {
      setPasswordErrorMsg('Password must be at least 6 characters.');
      return;
    }

    changePasswordMutation.mutate(values);
  };

  if (isLoading) {
    return <LoadingSkeleton rows={3} cols={2} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      {/* Tab Header */}
      <div className="page-header pb-1">
        <div>
          <h2 className="page-title text-lg font-bold">User Profile & Credentials</h2>
          <p className="page-subtitle text-xs">Configure your login credentials, user ID, name, and password security</p>
        </div>
      </div>

      {/* CARD 1: Identity Profile details */}
      <div className="card bg-white p-4 shadow-sm border border-[#e2e8e6] rounded-2xl">
        <form onSubmit={handleProfileSubmit(onProfileSubmit)} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e2e8e6] pb-1.5">
            <User className="w-4.5 h-4.5 text-[#023020]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0d1f1a]">User Identity Profile</h3>
          </div>

          {profileSuccessMsg && (
            <div className="p-2.5 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-xs border border-green-100 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
              <span>{profileSuccessMsg}</span>
            </div>
          )}

          {profileErrorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-100 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{profileErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-[10px] font-bold">Full Name</label>
              <input type="text" className="input py-1.5 text-xs font-semibold" required {...registerProfile('full_name')} />
            </div>
            <div>
              <label className="label text-[10px] font-bold">User Login ID (Email)</label>
              <input type="email" className="input py-1.5 text-xs font-semibold" required {...registerProfile('email')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-[10px] font-bold">System User Role</label>
              <input 
                type="text" 
                disabled 
                className="input bg-[#f8fafb] text-gray-500 cursor-not-allowed font-bold capitalize py-1.5 text-xs" 
                value={me?.role || 'User'} 
              />
            </div>
            <div>
              <label className="label text-[10px] font-bold">Account Status</label>
              <div className="h-8 flex items-center px-3 border border-[#e2e8e6] bg-[#f8fafb] rounded-xl text-xs font-bold text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                <span>Active Account</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="submit" disabled={updateProfileMutation.isPending} className="btn-primary px-5 py-2 text-xs gap-1.5 cursor-pointer font-bold">
              <Save className="w-3.5 h-3.5" />
              <span>{updateProfileMutation.isPending ? 'Updating...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* CARD 2: Password Security credentials */}
      <div className="card bg-white p-4 shadow-sm border border-[#e2e8e6] rounded-2xl">
        <form onSubmit={handlePasswordSubmit(onPasswordSubmit)} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-[#e2e8e6] pb-1.5">
            <Lock className="w-4.5 h-4.5 text-[#023020]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0d1f1a]">Credentials & Password Security</h3>
          </div>

          {passwordSuccessMsg && (
            <div className="p-2.5 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-xs border border-green-100 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
              <span>{passwordSuccessMsg}</span>
            </div>
          )}

          {passwordErrorMsg && (
            <div className="p-2.5 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-100 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <span>{passwordErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label text-[10px] font-bold">Current Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                className="input py-1.5 text-xs font-semibold" 
                {...registerPassword('current_password')} 
              />
            </div>
            
            <div>
              <label className="label text-[10px] font-bold">New Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                className="input py-1.5 text-xs font-semibold" 
                {...registerPassword('new_password')} 
              />
            </div>
            
            <div>
              <label className="label text-[10px] font-bold">Confirm New Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                required 
                className="input py-1.5 text-xs font-semibold" 
                {...registerPassword('confirm_password')} 
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="submit" disabled={changePasswordMutation.isPending} className="btn-primary px-5 py-2 text-xs gap-1.5 cursor-pointer font-bold">
              <Key className="w-3.5 h-3.5" />
              <span>{changePasswordMutation.isPending ? 'Updating...' : 'Change Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
