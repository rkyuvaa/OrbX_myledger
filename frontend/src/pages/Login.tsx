import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import axios from 'axios';
import { User, Lock, Eye, EyeOff, Check, Moon, ExternalLink, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

// Official vector SVGs (logoDark = white text for dark bg; logoLight = dark text for white card)
import logoDark from '../assets/logo-dark.svg';
import logoLight from '../assets/logo-light.svg';

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
    <div className="w-full min-h-screen min-h-[100dvh] bg-[#0b291d] flex flex-col lg:flex-row overflow-x-hidden relative selection:bg-[#22c55e] selection:text-white">
      {/* ─────────────────────────────────────────────────────────────
          LEFT PANEL: 55% width on desktop, full-height, branded
          Positioned 5% from left, ~13-15% from top
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[55%] flex flex-col justify-between p-6 sm:p-12 lg:pl-[5%] lg:pr-12 lg:pt-[14vh] lg:pb-8 border-b lg:border-b-0 lg:border-r border-white/10 relative z-10">
        <div className="max-w-[640px]">
          {/* Logo with ERP badge */}
          <div className="flex items-center gap-3.5">
            <img
              src={logoDark}
              alt="OrbX Logo"
              className="h-12 sm:h-14 lg:h-[62px] w-auto object-contain"
            />
            <span className="px-3 py-1 rounded-md text-[11px] sm:text-xs font-bold tracking-wider uppercase border border-[#22c55e]/40 text-[#22c55e] bg-[#0c3524]/90 shadow-sm">
              ERP
            </span>
          </div>

          {/* Subheading Tagline */}
          <p className="text-xs sm:text-[13px] font-bold tracking-[0.2em] text-[#22c55e] uppercase mt-10 sm:mt-12 lg:mt-14 mb-4">
            WHERE BUSINESS MEETS INTELLIGENCE
          </p>

          {/* Main Headline - exact clean 2-line wrap */}
          <h1 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] font-extrabold text-white leading-[1.18] tracking-tight mb-8 sm:mb-10 max-w-[620px]">
            Run your entire enterprise on one<br className="hidden sm:inline" /> intelligent platform.
          </h1>

          {/* Feature List */}
          <ul className="space-y-4 mb-10 lg:mb-14">
            {featureList.map((feature, idx) => (
              <li key={idx} className="flex items-center gap-3.5 text-white/95 text-sm sm:text-base font-medium">
                <div className="w-5 h-5 rounded-full bg-[#113d2c] border border-[#22c55e]/50 flex items-center justify-center text-[#22c55e] shrink-0 shadow-sm">
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Left Footer */}
        <div className="flex items-center gap-2 text-xs sm:text-[13px] text-white/60 pt-6">
          <a
            href="https://orbx.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-white/80 hover:text-white transition-colors"
          >
            <span>orbx.in</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <span className="text-white/30">•</span>
          <span className="text-white/60">Where Business Meets Intelligence</span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT PANEL: 45% width on desktop, perfectly centered card
          Targeting ~510px width x 490px height
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[45%] flex flex-col justify-between items-center p-6 sm:p-10 lg:p-8 relative min-h-full z-10">
        {/* Top-Right Theme toggle */}
        <div className="w-full flex justify-end lg:absolute lg:top-8 lg:right-8 z-20 mb-6 lg:mb-0">
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-[#113827] border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-all shadow-md cursor-pointer"
            aria-label="Toggle theme"
          >
            <Moon className="w-4 h-4 fill-white/80" />
          </button>
        </div>

        {/* Centered Login Card Container */}
        <div className="w-full flex-1 flex flex-col items-center justify-center py-4 lg:py-6">
          <div className="w-full max-w-[510px] min-h-[480px] sm:min-h-[490px] bg-white rounded-[28px] sm:rounded-[32px] shadow-2xl p-8 sm:p-12 flex flex-col items-center justify-center">
            {/* Logo inside card - Dark text for white card */}
            <img
              src={logoLight}
              alt="OrbX"
              className="h-10 sm:h-12 w-auto object-contain mb-2"
            />

            <p className="text-xs sm:text-sm font-semibold text-gray-700 tracking-normal mb-6 text-center">
              Enterprise Resource Planning Suite
            </p>

            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 text-center">
              Welcome back
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 text-center">
              Sign in to your account to continue
            </p>

            {serverError && (
              <div className="w-full mb-4 p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-100">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{serverError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="w-full space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Username
                </label>
                <div className="relative flex items-center rounded-xl bg-[#f3f4f6] border border-transparent focus-within:border-[#22c55e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#22c55e]/10 transition-all">
                  <User className="absolute left-4 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder=""
                    className="w-full pl-11 pr-4 py-3 sm:py-3.5 bg-transparent text-sm text-gray-900 focus:outline-none"
                    {...register('username')}
                  />
                </div>
                {errors.username && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">{errors.username.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative flex items-center rounded-xl bg-[#f3f4f6] border border-transparent focus-within:border-[#22c55e] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#22c55e]/10 transition-all">
                  <Lock className="absolute left-4 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder=""
                    className="w-full pl-11 pr-11 py-3 sm:py-3.5 bg-transparent text-sm text-gray-900 focus:outline-none"
                    {...register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 text-gray-400 hover:text-gray-600 focus:outline-none cursor-pointer"
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
                className="w-full py-3.5 sm:py-4 px-4 mt-6 rounded-2xl bg-[#00c067] hover:bg-[#00ad5c] active:scale-[0.99] text-white font-bold text-base tracking-wide transition-all shadow-lg shadow-[#00c067]/25 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Right Footer */}
        <div className="w-full pb-8 pt-4 text-xs text-white/50 flex items-center justify-center gap-6">
          <a
            href="https://orbx.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <span>orbx.in</span>
            <ExternalLink className="w-3.5 h-3.5" />
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
  );
};
