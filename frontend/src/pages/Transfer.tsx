import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';

const transferSchema = zod.object({
  date: zod.string().min(1, 'Date is required'),
  from_account_type: zod.enum(['bank', 'cash']),
  from_account_id: zod.string().min(1, 'Source account is required'),
  to_account_type: zod.enum(['bank', 'cash']),
  to_account_id: zod.string().min(1, 'Destination account is required'),
  amount: zod.preprocess((val) => Number(val), zod.number().positive('Amount must be greater than zero')),
  reference_number: zod.string().optional(),
  narration: zod.string().optional(),
}).refine((data) => {
  if (data.from_account_type === data.to_account_type && data.from_account_id === data.to_account_id) {
    return false;
  }
  return true;
}, {
  message: 'Source and destination accounts must be different',
  path: ['to_account_id'],
});

type TransferFormValues = zod.infer<typeof transferSchema>;

export const Transfer: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState<TransferFormValues | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Accounts
  const { data: accountsData } = useQuery({
    queryKey: ['ledgerAccounts'],
    queryFn: async () => {
      const res = await api.get('/ledger/accounts');
      return res.data;
    },
  });

  const bankAccounts = accountsData?.bank_accounts || [];
  const cashAccounts = accountsData?.cash_accounts || [];

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      date: new Date().toISOString().substring(0, 10),
      from_account_type: 'bank',
      to_account_type: 'cash',
    },
  });

  const fromAccountType = watch('from_account_type');
  const toAccountType = watch('to_account_type');

  const validateTransferBalance = (values: TransferFormValues): boolean => {
    if (values.from_account_type === 'bank') {
      const srcBank = bankAccounts.find((b: any) => b.id === values.from_account_id);
      if (srcBank && !srcBank.is_overdraft_allowed && srcBank.current_balance < values.amount) {
        setErrorMessage(`Insufficient balance in ${srcBank.name}. Available: ₹${srcBank.current_balance}`);
        return false;
      }
    } else {
      const srcCash = cashAccounts.find((c: any) => c.id === values.from_account_id);
      if (srcCash && srcCash.current_balance < values.amount) {
        setErrorMessage(`Insufficient cash balance in ${srcCash.name}. Available: ₹${srcCash.current_balance}`);
        return false;
      }
    }
    return true;
  };

  const mutation = useMutation({
    mutationFn: async (data: TransferFormValues) => {
      const res = await api.post('/transfers/', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setSuccessMessage(`Internal fund transfer posted! Voucher Number: ${data.voucher_number}`);
      reset();
      setShowConfirm(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred during transfer posting.');
      setShowConfirm(false);
    },
  });

  const handleFormSubmit = (values: TransferFormValues) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (validateTransferBalance(values)) {
      setFormData(values);
      setShowConfirm(true);
    }
  };

  const handleConfirmPost = () => {
    if (formData) {
      mutation.mutate(formData);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h2 className="page-title">Internal Fund Transfer</h2>
          <p className="page-subtitle">Move money between bank accounts and cash vaults</p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-green-50 text-green-700 rounded-xl flex items-start gap-2 text-sm border border-green-100 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-green-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="card bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          <div>
            <label className="label">Transfer Date</label>
            <input type="date" className="input" {...register('date')} />
            {errors.date && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.date.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SOURCE ACCOUNT */}
            <div className="p-4 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#4a6b62]">Source (From)</span>
              <div>
                <label className="label">Account Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-[#4a6b62]">
                    <input type="radio" value="bank" {...register('from_account_type')} className="accent-[#023020]" />
                    <span>Bank</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#4a6b62]">
                    <input type="radio" value="cash" {...register('from_account_type')} className="accent-[#023020]" />
                    <span>Cash</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Select Source Account</label>
                <select className="input select bg-white" {...register('from_account_id')}>
                  <option value="">Select Account</option>
                  {fromAccountType === 'bank'
                    ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                    : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                  }
                </select>
                {errors.from_account_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.from_account_id.message}</p>}
              </div>
            </div>

            {/* DESTINATION ACCOUNT */}
            <div className="p-4 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-3">
              <span className="text-xs uppercase font-bold tracking-wider text-[#4a6b62]">Destination (To)</span>
              <div>
                <label className="label">Account Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-[#4a6b62]">
                    <input type="radio" value="bank" {...register('to_account_type')} className="accent-[#023020]" />
                    <span>Bank</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[#4a6b62]">
                    <input type="radio" value="cash" {...register('to_account_type')} className="accent-[#023020]" />
                    <span>Cash</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Select Destination Account</label>
                <select className="input select bg-white" {...register('to_account_id')}>
                  <option value="">Select Account</option>
                  {toAccountType === 'bank'
                    ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                    : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                  }
                </select>
                {errors.to_account_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.to_account_id.message}</p>}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" step="0.01" placeholder="0.00" className="input" {...register('amount')} />
              {errors.amount && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="label">Reference Number (Optional)</label>
              <input type="text" placeholder="e.g. Bank slip or memo number" className="input" {...register('reference_number')} />
            </div>
          </div>

          <div>
            <label className="label">Narration</label>
            <textarea placeholder="Purpose or context of internal fund transfer..." className="input h-20 resize-none" {...register('narration')}></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost px-5">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-6">
              Post Transfer
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirm Fund Transfer"
        message="Are you sure you want to execute this internal fund transfer? This will debit the source account and credit the destination account immediately."
        onConfirm={handleConfirmPost}
        onCancel={() => setShowConfirm(false)}
        isSubmitting={mutation.isPending}
      />
    </div>
  );
};
