import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, Check, Moon, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Import official SVGs so Vite hashes URLs to completely prevent browser caching issues
import logoLight from '../assets/logo-light.svg';
import logoDark from '../assets/logo-dark.svg';

const loginSchema = zod.object({
  username: zod.string().min(1, 'Please enter your username or email'),
  password: zod.string().min(1, 'Please enter your password'),
});

type LoginFormValues = zod.infer<typeof loginSchema>;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    formData.append('username', values.username);
    formData.append('password', values.password);

    try {
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
        setServerError('Incorrect username/email or password.');
      } else if (err.response?.data?.detail) {
        setServerError(err.response.data.detail);
      } else {
        setServerError('Failed to connect to the server. Please check your network or backend service.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const featureList = [
    '360° Business View',
    'AI Powered Insights',
    'ERP Unified Platform',
    'Secure Enterprise Ready',
    'Built for modern businesses',
  ];

  return (
    <div className="min-h-screen bg-[#0b291d] flex flex-col justify-between p-6 sm:p-10 lg:px-16 lg:py-12 relative overflow-x-hidden selection:bg-[#22c55e] selection:text-white">
      {/* Top right Theme toggle */}
      <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-20">
        <button
          type="button"
          className="w-9 h-9 rounded-full bg-[#113827] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-md cursor-pointer"
          aria-label="Toggle theme"
        >
          <Moon className="w-4 h-4 fill-white/80" />
        </button>
      </div>

      {/* Main Container */}
      <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col lg:flex-row items-center justify-between gap-10 lg:gap-14 my-auto pt-4 pb-4">
        {/* Left Side: Branding and Value Props */}
        <div className="w-full lg:w-[54%] max-w-xl text-left">
          {/* Logo with ERP badge - Uses logoLight (white text on dark background) */}
          <div className="flex items-center gap-3">
            <img
              src={logoLight}
              alt="OrbX Logo"
              className="h-10 sm:h-11 w-auto object-contain"
            />
            <span className="px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase border border-[#22c55e]/40 text-[#22c55e] bg-[#0c3524]/80">
              ERP
            </span>
          </div>

          {/* Subheading Tagline */}
          <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] text-[#22c55e] uppercase mt-8 sm:mt-10 mb-3">
            WHERE BUSINESS MEETS INTELLIGENCE
          </p>

          {/* Main Headline - exact 2-line clean wrap matching reference image */}
          <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white leading-[1.25] tracking-tight mb-7">
            Run your entire enterprise on one<br className="hidden sm:inline" /> intelligent platform.
          </h1>

          {/* Feature List */}
          <ul className="space-y-3 mb-10">
            {featureList.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3 text-white/90 text-sm sm:text-[14px] font-medium">
                <div className="w-[18px] h-[18px] rounded-full bg-[#113d2c] border border-[#22c55e]/50 flex items-center justify-center text-[#22c55e] shrink-0">
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {/* Bottom Left Link */}
          <div className="flex items-center gap-2 text-xs text-white/60">
            <a
              href="https://orbx.in"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
            >
              <span>orbx.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-white/30">•</span>
            <span className="text-white/60">Where Business Meets Intelligence</span>
          </div>
        </div>

        {/* Right Side: Login Card */}
        <div className="w-full lg:w-[46%] flex flex-col items-center justify-center">
          <div className="w-full max-w-[400px] bg-white rounded-[24px] shadow-2xl p-7 sm:p-9 flex flex-col items-center">
            {/* Logo inside card - Uses logoDark (dark text on white card background) */}
            <img
              src={logoDark}
              alt="OrbX"
              className="h-9 sm:h-10 w-auto object-contain mb-2"
            />

            <p className="text-xs text-gray-700 font-medium tracking-normal mb-5 text-center">
              Enterprise Resource Planning Suite
            </p>

            <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">
              Welcome back
            </h2>
            <p className="text-xs text-gray-500 mb-5 text-center">
              Sign in to your account to continue
            </p>

            {serverError && (
              <div className="w-full mb-3 p-2.5 bg-red-50 text-red-700 rounded-lg flex items-start gap-2 text-xs border border-red-100">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Username
                </label>
                <div className="relative flex items-center rounded-xl bg-[#f3f4f6] border border-transparent focus-within:border-[#22c55e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#22c55e]/10 transition-all">
                  <User className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder=""
                    className="w-full pl-9 pr-3 py-2.5 bg-transparent text-sm text-gray-900 focus:outline-none"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative flex items-center rounded-xl bg-[#f3f4f6] border border-transparent focus-within:border-[#22c55e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#22c55e]/10 transition-all">
                  <Lock className="absolute left-3 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder=""
                    className="w-full pl-9 pr-9 py-2.5 bg-transparent text-sm text-gray-900 focus:outline-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">{errors.password.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 px-4 mt-5 rounded-xl bg-[#00c067] hover:bg-[#00ad5c] active:scale-[0.99] text-white font-bold text-sm tracking-wide transition-all shadow-md shadow-[#00c067]/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          {/* Footer below Card */}
          <div className="flex items-center justify-center gap-5 mt-6 text-xs text-white/50">
            <a
              href="https://orbx.in"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 hover:text-white transition-colors"
            >
              <span>orbx.in</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Privacy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
