import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Save, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';
import { useForm } from 'react-hook-form';
import api from '../../lib/api';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';

export const CompanyProfile: React.FC = () => {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch company details
  const { data: company, isLoading } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const res = await api.get('/config/company');
      return res.data;
    },
  });

  const { register, handleSubmit, setValue } = useForm();

  // Populate values when loaded
  React.useEffect(() => {
    if (company) {
      setValue('name', company.name);
      setValue('address', company.address || '');
      setValue('gstin', company.gstin || '');
      setValue('phone', company.phone || '');
      setValue('email', company.email || '');
      setValue('fy_start_year', company.fy_start_year);
    }
  }, [company, setValue]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.put('/config/company', {
        ...data,
        fy_start_year: Number(data.fy_start_year),
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companyProfile'] });
      setSuccessMsg('Company Profile and Financial Year parameters updated!');
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.detail || 'Failed to update company profile.');
    },
  });

  const onSubmit = (values: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    mutation.mutate(values);
  };

  if (isLoading) {
    return <LoadingSkeleton rows={3} cols={2} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="page-header pb-1">
        <div>
          <h2 className="page-title text-lg font-bold">Company Profile & FY Parameters</h2>
          <p className="page-subtitle text-xs">Configure legal entity details and accounting bounds</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-xs border border-green-100 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-600 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-100 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="card bg-white p-4 sm:p-5 shadow-sm border border-[#e2e8e6] rounded-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          
          {/* Section: Entity Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-[#e2e8e6] pb-1.5">
              <Building2 className="w-4.5 h-4.5 text-[#023020]" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0d1f1a]">Legal Entity Profile</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-[10px] font-bold">Registered Company Name</label>
                <input type="text" className="input py-1.5 text-xs font-semibold" required {...register('name')} />
              </div>
              <div>
                <label className="label text-[10px] font-bold">GSTIN Identification</label>
                <input type="text" placeholder="e.g. 29AAAAA0000A1Z5" className="input py-1.5 text-xs" {...register('gstin')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-[10px] font-bold">Corporate Email Address</label>
                <input type="email" className="input py-1.5 text-xs" {...register('email')} />
              </div>
              <div>
                <label className="label text-[10px] font-bold">Support Phone</label>
                <input type="text" className="input py-1.5 text-xs" {...register('phone')} />
              </div>
            </div>
          </div>

          {/* Section: Financial Year */}
          <div className="space-y-3 pt-2 border-t border-[#e2e8e6]">
            <div className="flex items-center gap-2 border-b border-[#e2e8e6] pb-1.5">
              <Calendar className="w-4.5 h-4.5 text-[#023020]" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0d1f1a]">Financial Year Settings</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label text-[10px] font-bold">Starting Year (April 1st)</label>
                <select className="input select py-1.5 text-xs bg-white font-semibold" {...register('fy_start_year')}>
                  <option value="2025">2025 (FY 2025-26)</option>
                  <option value="2026">2026 (FY 2026-27)</option>
                  <option value="2027">2027 (FY 2027-28)</option>
                  <option value="2028">2028 (FY 2028-29)</option>
                </select>
              </div>
              <div>
                <label className="label text-[10px] font-bold">Active Scope End Date (March 31st)</label>
                <input type="text" disabled className="input bg-gray-50 cursor-not-allowed font-semibold py-1.5 text-xs text-gray-400" value="Calculated Automatically" />
              </div>
            </div>
          </div>

          {/* Office Address */}
          <div>
            <label className="label text-[10px] font-bold">Office Address</label>
            <textarea className="input h-10 py-1 text-xs resize-none" {...register('address')}></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8e6]">
            <button type="submit" className="btn-primary px-5 py-2 text-xs gap-1.5 cursor-pointer font-bold">
              <Save className="w-3.5 h-3.5" />
              <span>Save Configurations</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
