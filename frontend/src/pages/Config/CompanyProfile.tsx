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
    return <LoadingSkeleton rows={4} cols={2} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Company Profile & FY Parameters</h2>
          <p className="page-subtitle">Configure legal entity details and accounting bounds</p>
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
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section: Entity Details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Building2 className="w-5 h-5 text-[#023020]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d1f1a]">Legal Entity Profile</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Registered Company Name</label>
                <input type="text" className="input font-semibold" required {...register('name')} />
              </div>
              <div>
                <label className="label">GSTIN Identification</label>
                <input type="text" placeholder="e.g. 29AAAAA0000A1Z5" className="input" {...register('gstin')} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Corporate Email Address</label>
                <input type="email" className="input" {...register('email')} />
              </div>
              <div>
                <label className="label">Support Phone</label>
                <input type="text" className="input" {...register('phone')} />
              </div>
            </div>

            <div>
              <label className="label">Office Address</label>
              <textarea className="input h-16 resize-none" {...register('address')}></textarea>
            </div>
          </div>

          {/* Section: Financial Year */}
          <div className="space-y-4 pt-4 border-t border-[#e2e8e6]">
            <div className="flex items-center gap-2 border-b pb-2">
              <Calendar className="w-5 h-5 text-[#023020]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#0d1f1a]">Financial Year Settings</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Starting Year (April 1st)</label>
                <select className="input select bg-white font-semibold" {...register('fy_start_year')}>
                  <option value="2025">2025 (FY 2025-26)</option>
                  <option value="2026">2026 (FY 2026-27)</option>
                  <option value="2027">2027 (FY 2027-28)</option>
                  <option value="2028">2028 (FY 2028-29)</option>
                </select>
              </div>
              <div>
                <label className="label">Active Scope End Date (March 31st)</label>
                <input type="text" disabled className="input bg-gray-100 cursor-not-allowed font-semibold text-gray-500" value="Calculated Automatically" />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
            <button type="submit" className="btn-primary px-6 gap-1.5 cursor-pointer">
              <Save className="w-4 h-4" />
              <span>Save Configurations</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
