import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useToastStore } from '../store/toastStore';

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
  const addToast = useToastStore((state) => state.addToast);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState<TransferFormValues | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      addToast(`Internal fund transfer posted! Voucher Number: ${data.voucher_number}`, 'success');
      reset();
      setShowConfirm(false);
      navigate('/dashboard');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred during transfer posting.');
      setShowConfirm(false);
    },
  });

  const handleFormSubmit = (values: TransferFormValues) => {
    setErrorMessage(null);
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
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="page-header pb-1">
        <div>
          <h2 className="page-title text-lg font-bold">Internal Fund Transfer</h2>
          <p className="page-subtitle text-xs">Move money between bank accounts and cash vaults</p>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-xs border border-red-100 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="card bg-white p-4 sm:p-5 shadow-sm rounded-2xl border border-[#e2e8e6]">
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          
          {/* Row 1: Date | Amount | Reference (3 columns) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label text-[11px] font-bold">Transfer Date</label>
              <input type="date" className="input py-2 text-xs" {...register('date')} />
              {errors.date && <p className="text-red-500 text-[10px] mt-0.5 font-semibold">{errors.date.message}</p>}
            </div>

            <div>
              <label className="label text-[11px] font-bold">Amount (₹)</label>
              <input type="number" step="0.01" placeholder="0.00" className="input py-2 text-xs font-semibold" {...register('amount')} />
              {errors.amount && <p className="text-red-500 text-[10px] mt-0.5 font-semibold">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="label text-[11px] font-bold">Reference Number <span className="text-[9px] text-[#8aa89f] font-normal">(Optional)</span></label>
              <input type="text" placeholder="slip or memo number" className="input py-2 text-xs" {...register('reference_number')} />
            </div>
          </div>

          {/* Row 2: Source | Destination Cards (2 columns) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SOURCE ACCOUNT */}
            <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
              <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Source (From)</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                    <input type="radio" value="bank" {...register('from_account_type')} className="accent-[#023020] w-3 h-3" />
                    <span>Bank</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                    <input type="radio" value="cash" {...register('from_account_type')} className="accent-[#023020] w-3 h-3" />
                    <span>Cash</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label text-[10px] font-bold">Select Source Account</label>
                <select className="input select py-1.5 text-xs bg-white" {...register('from_account_id')}>
                  <option value="">Select Account</option>
                  {fromAccountType === 'bank'
                    ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                    : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                  }
                </select>
                {errors.from_account_id && <p className="text-red-500 text-[10px] mt-0.5 font-semibold">{errors.from_account_id.message}</p>}
              </div>
            </div>

            {/* DESTINATION ACCOUNT */}
            <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
              <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Destination (To)</span>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                    <input type="radio" value="bank" {...register('to_account_type')} className="accent-[#023020] w-3 h-3" />
                    <span>Bank</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                    <input type="radio" value="cash" {...register('to_account_type')} className="accent-[#023020] w-3 h-3" />
                    <span>Cash</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label text-[10px] font-bold">Select Destination Account</label>
                <select className="input select py-1.5 text-xs bg-white" {...register('to_account_id')}>
                  <option value="">Select Account</option>
                  {toAccountType === 'bank'
                    ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance})</option>)
                    : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance})</option>)
                  }
                </select>
                {errors.to_account_id && <p className="text-red-500 text-[10px] mt-0.5 font-semibold">{errors.to_account_id.message}</p>}
              </div>
            </div>
          </div>

          {/* Row 3: Narration */}
          <div>
            <label className="label text-[11px] font-bold">Narration <span className="text-[9px] text-[#8aa89f] font-normal">(Optional)</span></label>
            <textarea placeholder="Purpose or context of internal fund transfer..." className="input h-12 py-1.5 text-xs resize-none" {...register('narration')}></textarea>
          </div>

          {/* Row 4: Action Buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8e6]">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost px-5 py-2 text-xs font-bold">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-6 py-2 text-xs font-bold">
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
