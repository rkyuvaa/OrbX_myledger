import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as zod from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileInput, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';

const receiveSchema = zod.object({
  date: zod.string().min(1, 'Date is required'),
  branch_id: zod.string().min(1, 'Branch is required'),
  received_from: zod.string().min(1, 'Sender name is required'),
  amount: zod.preprocess((val) => Number(val), zod.number().positive('Amount must be greater than zero')),
  payment_mode: zod.enum(['bank', 'cash']),
  bank_account_id: zod.string().optional(),
  cash_account_id: zod.string().optional(),
  reference_number: zod.string().optional(),
  narration: zod.string().optional(),
}).refine((data) => {
  if (data.payment_mode === 'bank' && !data.bank_account_id) return false;
  return true;
}, {
  message: 'Bank account selection is required',
  path: ['bank_account_id'],
}).refine((data) => {
  if (data.payment_mode === 'bank' && !data.reference_number) return false;
  return true;
}, {
  message: 'Reference number is mandatory for bank transactions',
  path: ['reference_number'],
}).refine((data) => {
  if (data.payment_mode === 'cash' && !data.cash_account_id) return false;
  return true;
}, {
  message: 'Cash account selection is required',
  path: ['cash_account_id'],
});

type ReceiveFormValues = zod.infer<typeof receiveSchema>;

export const Receive: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showConfirm, setShowConfirm] = useState(false);
  const [formData, setFormData] = useState<ReceiveFormValues | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch Branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data;
    },
  });

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
  } = useForm<ReceiveFormValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: {
      date: new Date().toISOString().substring(0, 10),
      payment_mode: 'bank',
    },
  });

  const paymentMode = watch('payment_mode');

  const mutation = useMutation({
    mutationFn: async (data: ReceiveFormValues) => {
      const res = await api.post('/receipts/', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      setSuccessMessage(`Receipt entry posted successfully! Voucher Number: ${data.voucher_number}`);
      reset();
      setShowConfirm(false);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred while posting receipt voucher.');
      setShowConfirm(false);
    },
  });

  const handleFormSubmit = (values: ReceiveFormValues) => {
    setFormData(values);
    setErrorMessage(null);
    setSuccessMessage(null);
    setShowConfirm(true);
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
          <h2 className="page-title">Receive Transaction</h2>
          <p className="page-subtitle">Record cash or bank collections from branches</p>
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
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Voucher Date</label>
              <input type="date" className="input" {...register('date')} />
              {errors.date && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.date.message}</p>}
            </div>

            <div>
              <label className="label">Branch</label>
              <select className="input select" {...register('branch_id')}>
                <option value="">Select Branch</option>
                {branches.filter((b: any) => b.status === 'active').map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
              {errors.branch_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.branch_id.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Received From</label>
              <input type="text" placeholder="e.g. Branch Executive or Customer Name" className="input" {...register('received_from')} />
              {errors.received_from && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.received_from.message}</p>}
            </div>

            <div>
              <label className="label">Amount (₹)</label>
              <input type="number" step="0.01" placeholder="0.00" className="input" {...register('amount')} />
              {errors.amount && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.amount.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Payment Mode</label>
              <div className="flex gap-4 mt-2">
                <label className="flex items-center gap-2 text-sm text-[#4a6b62] font-semibold">
                  <input type="radio" value="bank" {...register('payment_mode')} className="accent-[#023020]" />
                  <span>Bank Deposit</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-[#4a6b62] font-semibold">
                  <input type="radio" value="cash" {...register('payment_mode')} className="accent-[#023020]" />
                  <span>Cash Handover</span>
                </label>
              </div>
            </div>

            {paymentMode === 'bank' ? (
              <div>
                <label className="label">Deposit Bank Account</label>
                <select className="input select" {...register('bank_account_id')}>
                  <option value="">Select Target Bank</option>
                  {bankAccounts.map((bank: any) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.name} (Bal: ₹{bank.current_balance})
                    </option>
                  ))}
                </select>
                {errors.bank_account_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.bank_account_id.message}</p>}
              </div>
            ) : (
              <div>
                <label className="label">Receive Cash Account</label>
                <select className="input select" {...register('cash_account_id')}>
                  <option value="">Select Cash Counter</option>
                  {cashAccounts.map((cash: any) => (
                    <option key={cash.id} value={cash.id}>
                      {cash.name} (Bal: ₹{cash.current_balance})
                    </option>
                  ))}
                </select>
                {errors.cash_account_id && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.cash_account_id.message}</p>}
              </div>
            )}
          </div>

          <div>
            <label className="label">
              Reference Number {paymentMode === 'bank' ? <span className="text-red-500 font-bold">*</span> : '(Optional)'}
            </label>
            <input type="text" placeholder="Transaction ID, Cheque, or Challan Number" className="input" {...register('reference_number')} />
            {errors.reference_number && <p className="text-red-500 text-[10px] mt-1 font-semibold">{errors.reference_number.message}</p>}
          </div>

          <div>
            <label className="label">Narration</label>
            <textarea placeholder="Brief particulars or comments about receipt transaction" className="input h-20 resize-none" {...register('narration')}></textarea>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#e2e8e6]">
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-ghost px-5">
              Cancel
            </button>
            <button type="submit" className="btn-primary px-6">
              Post Receipt
            </button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirm Receipt Voucher Posting"
        message={`Are you sure you want to post this receipt of ₹${formData?.amount || 0.0} from ${formData?.received_from || ''}? Once posted, this transaction cannot be deleted. Only reversing entries are permitted.`}
        onConfirm={handleConfirmPost}
        onCancel={() => setShowConfirm(false)}
        isSubmitting={mutation.isPending}
      />
    </div>
  );
};
