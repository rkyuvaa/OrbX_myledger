import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import axios from 'axios';
import { ShieldAlert, LogIn, Lock, Mail, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const loginSchema = zod.object({
  email: zod.string().email('Enter a valid email address'),
  password: zod.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsSubmitting(true);
    setServerError(null);

    const formData = new URLSearchParams();
    formData.append('username', values.email);
    formData.append('password', values.password);

    try {
      // POST OAuth2 Password login
      const response = await axios.post('/api/v1/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, refresh_token } = response.data;

      // Fetch user profile info
      const meResponse = await axios.get('/api/v1/auth/me', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      setAuth(meResponse.data, access_token, refresh_token);
      navigate('/dashboard');
    } catch (err: any) {
      if (err.response?.status === 401) {
        setServerError('Incorrect email address or password.');
      } else if (err.response?.data?.detail) {
        setServerError(err.response.data.detail);
      } else {
        setServerError('Failed to connect to Orbx My Ledger API. Please check backend connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#011a12] via-[#023020] to-[#011a12] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background circles */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-x-12 -translate-y-12"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#00a86b]/10 rounded-full blur-3xl translate-x-12 translate-y-12"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo/Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-white/10 rounded-xl text-emerald-400 mb-3 border border-white/10 shadow-lg backdrop-blur-md">
            <ShieldAlert className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Orbx My Ledger</h2>
          <p className="text-xs text-emerald-300/70 uppercase tracking-widest mt-1">Cash & Bank Management System</p>
        </div>

        {/* Login glass-card */}
        <div className="bg-white/95 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8">
          <h3 className="text-lg font-bold text-[#0d1f1a] mb-2 text-center">Welcome Back</h3>
          <p className="text-xs text-[#8aa89f] text-center mb-6">Enter credentials to manage company books</p>

          {serverError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-xs border border-red-100">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Corporate Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8aa89f]" />
                <input
                  type="email"
                  placeholder="admin@orbxledger.com"
                  className="input pl-9 text-sm"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-red-500 text-[10px] mt-1 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Secure Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8aa89f]" />
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input pl-9 text-sm"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-red-500 text-[10px] mt-1 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary justify-center text-sm py-2.5 mt-2 bg-[#023020] hover:bg-[#034a31] cursor-pointer"
            >
              {isSubmitting ? (
                <span>Verifying details...</span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Secure Login</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info footer */}
        <p className="text-center text-[10px] text-emerald-300/40 mt-8">
          Powered by Orbx Business Solutions. All rights reserved.
        </p>
      </div>
    </div>
  );
};
