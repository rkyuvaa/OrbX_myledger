import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, RotateCcw, AlertCircle, Calendar, RefreshCw, Edit2, X, Printer, Trash2 } from 'lucide-react';
import api from '../lib/api';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isDateRangeInvalid = (from: string, to: string) => {
  if (!from && !to) return null;
  if (!from || !to) return 'Both From Date and To Date must be specified';
  const f = new Date(from);
  const t = new Date(to);
  if (isNaN(f.getTime()) || isNaN(t.getTime())) {
    return 'Invalid date format';
  }
  if (f > t) return 'From Date cannot be after To Date';
  const diffTime = t.getTime() - f.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  if (diffDays > 92) {
    return 'Date range cannot exceed 3 months (92 days)';
  }
  return null;
};

export const Daybook: React.FC = () => {
  const queryClient = useQueryClient();
  const [fromDate, setFromDate] = useState<string>(getTodayStr());
  const [toDate, setToDate] = useState<string>(getTodayStr());
  const [branchId, setBranchId] = useState<string>('');
  const [voucherType, setVoucherType] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [reversalError, setReversalError] = useState<string | null>(null);

  const dateValidationError = isDateRangeInvalid(fromDate, toDate);

  // Fetch branches for filter
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get('/branches');
      return res.data;
    },
  });

  // Fetch daybook entries
  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ['daybook', fromDate, toDate, branchId, voucherType, paymentMode, search],
    queryFn: async () => {
      if (dateValidationError) {
        throw new Error(dateValidationError);
      }
      const res = await api.get('/daybook/', {
        params: {
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          branch_id: branchId || undefined,
          voucher_type: voucherType || undefined,
          payment_mode: paymentMode || undefined,
          search: search || undefined,
        },
      });
      return res.data;
    },
    enabled: !dateValidationError,
  });

  const totalCredit = entries.reduce((sum: number, entry: any) => sum + (entry.credit || 0), 0);
  const totalDebit = entries.reduce((sum: number, entry: any) => sum + (entry.debit || 0), 0);

  // Deletion Mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const endpoint = type === 'RCV' ? `/receipts/${id}` : type === 'EXP' ? `/expenses/${id}` : `/payments/${id}`;
      const res = await api.delete(endpoint);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      alert('Voucher deleted successfully!');
    },
    onError: (err: any) => {
      setReversalError(err.response?.data?.detail || 'Failed to delete voucher.');
    },
  });

  const handleDelete = (id: string, type: string) => {
    if (window.confirm('Are you sure you want to delete this voucher? This will permanently delete the voucher and restore the company accounts balance.')) {
      setReversalError(null);
      deleteMutation.mutate({ id, type });
    }
  };

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

  // Fetch Company Profile for printing header
  const { data: companyData } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const res = await api.get('/config/company');
      return res.data;
    },
  });

  // Edit State
  const [editingVoucher, setEditingVoucher] = useState<{ id: string; type: string; data: any } | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editBranchId, setEditBranchId] = useState<string>('');
  const [editAmount, setEditAmount] = useState<string>('');
  const [editParticularName, setEditParticularName] = useState<string>(''); // received_from or paid_to
  const [editPaymentMode, setEditPaymentMode] = useState<'bank' | 'cash'>('bank');
  const [editBankAccountId, setEditBankAccountId] = useState<string>('');
  const [editCashAccountId, setEditCashAccountId] = useState<string>('');
  const [editReferenceNumber, setEditReferenceNumber] = useState<string>('');
  const [editNarration, setEditNarration] = useState<string>('');

  // For Transfer edits:
  const [editFromAccountType, setEditFromAccountType] = useState<'bank' | 'cash'>('bank');
  const [editFromAccountId, setEditFromAccountId] = useState<string>('');
  const [editToAccountType, setEditToAccountType] = useState<'bank' | 'cash'>('cash');
  const [editToAccountId, setEditToAccountId] = useState<string>('');

  const handleEdit = async (id: string, type: string) => {
    try {
      setReversalError(null);
      let endpoint = '';
      if (type === 'RCV') endpoint = `/receipts/${id}`;
      else if (type === 'PAY') endpoint = `/payments/${id}`;
      else if (type === 'EXP') endpoint = `/expenses/${id}`;
      else if (type === 'TRF') endpoint = `/transfers/${id}`;

      const res = await api.get(endpoint);
      const data = res.data;

      setEditingVoucher({ id, type, data });
      setEditDate(data.date);
      setEditBranchId(data.branch_id || '');
      setEditAmount(String(data.amount));
      setEditReferenceNumber(data.reference_number || '');
      setEditNarration(data.narration || '');

      if (type === 'RCV') {
        setEditParticularName(data.received_from);
        setEditPaymentMode(data.payment_mode);
        setEditBankAccountId(data.bank_account_id || '');
        setEditCashAccountId(data.cash_account_id || '');
      } else if (type === 'PAY' || type === 'EXP') {
        setEditParticularName(data.paid_to);
        setEditPaymentMode(data.payment_mode);
        setEditBankAccountId(data.bank_account_id || '');
        setEditCashAccountId(data.cash_account_id || '');
      } else if (type === 'TRF') {
        setEditFromAccountType(data.from_account_type);
        setEditFromAccountId(data.from_account_id);
        setEditToAccountType(data.to_account_type);
        setEditToAccountId(data.to_account_id);
      }
    } catch (err: any) {
      setReversalError(err.response?.data?.detail || 'Failed to fetch voucher details.');
    }
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, type, payload }: { id: string; type: string; payload: any }) => {
      let endpoint = '';
      if (type === 'RCV') endpoint = `/receipts/${id}`;
      else if (type === 'PAY') endpoint = `/payments/${id}`;
      else if (type === 'EXP') endpoint = `/expenses/${id}`;
      else if (type === 'TRF') endpoint = `/transfers/${id}`;

      const res = await api.put(endpoint, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daybook'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      alert('Voucher updated successfully!');
      setEditingVoucher(null);
    },
    onError: (err: any) => {
      setReversalError(err.response?.data?.detail || 'Failed to update voucher.');
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVoucher) return;

    let payload: any = {
      date: editDate,
      amount: Number(editAmount),
      reference_number: editReferenceNumber || undefined,
      narration: editNarration || undefined,
    };

    if (editingVoucher.type === 'RCV') {
      payload.branch_id = editBranchId || undefined;
      payload.received_from = editParticularName;
      payload.payment_mode = editPaymentMode;
      payload.bank_account_id = editPaymentMode === 'bank' ? editBankAccountId : undefined;
      payload.cash_account_id = editPaymentMode === 'cash' ? editCashAccountId : undefined;
    } else if (editingVoucher.type === 'PAY' || editingVoucher.type === 'EXP') {
      payload.branch_id = editBranchId || undefined;
      payload.paid_to = editParticularName;
      payload.payment_mode = editPaymentMode;
      payload.bank_account_id = editPaymentMode === 'bank' ? editBankAccountId : undefined;
      payload.cash_account_id = editPaymentMode === 'cash' ? editCashAccountId : undefined;
    } else if (editingVoucher.type === 'TRF') {
      payload.from_account_type = editFromAccountType;
      payload.from_account_id = editFromAccountId;
      payload.to_account_type = editToAccountType;
      payload.to_account_id = editToAccountId;

      if (editFromAccountType === editToAccountType && editFromAccountId === editToAccountId) {
        alert('Source and destination accounts must be different');
        return;
      }
    }

    editMutation.mutate({ id: editingVoucher.id, type: editingVoucher.type, payload });
  };

  const handlePrint = async (voucherId: string, voucherType: string) => {
    try {
      setReversalError(null);
      if (!voucherId) {
        setReversalError("Voucher ID is missing for this transaction.");
        return;
      }

      let endpoint = '';
      const typeUpper = (voucherType || '').toUpperCase();
      if (typeUpper === 'RCV' || typeUpper === 'RECEIPT') endpoint = `/receipts/${voucherId}`;
      else if (typeUpper === 'PAY' || typeUpper === 'PAYMENT') endpoint = `/payments/${voucherId}`;
      else if (typeUpper === 'EXP' || typeUpper === 'EXPENSE') endpoint = `/expenses/${voucherId}`;
      else if (typeUpper === 'TRF' || typeUpper === 'TRANSFER') endpoint = `/transfers/${voucherId}`;
      else {
        setReversalError(`Unsupported voucher type: ${voucherType}`);
        return;
      }

      const res = await api.get(endpoint);
      const voucher = res.data;

      if (!voucher) {
        throw new Error("No data returned from the server.");
      }

      if (voucher.amount === undefined || voucher.amount === null) {
        throw new Error("Voucher amount is missing.");
      }

      const companyName = companyData?.name || 'Orbx Corporation';
      const companyGstin = companyData?.gstin ? `GSTIN: ${companyData.gstin}` : '';
      const companyPhone = companyData?.phone ? `Phone: ${companyData.phone}` : '';
      const companyEmail = companyData?.email ? `Email: ${companyData.email}` : '';
      const companyAddress = companyData?.address || '';

      const branchName = (voucher.voucher_number?.startsWith('EXP') && !voucher.branch_id) ? 'Personal' : (voucher.branch_name || 'Main Branch');
      const accountName = voucher.payment_mode === 'bank' 
        ? voucher.bank_account_name 
        : voucher.cash_account_name;

      const formattedAmount = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
      }).format(voucher.amount);

      const amountInWords = numberToWords(voucher.amount) + ' Only';

      let htmlContent = '';

      if (typeUpper === 'RCV' || typeUpper === 'RECEIPT') {
        htmlContent = `
          <html>
            <head>
              <title>Print Voucher - ${voucher.voucher_number}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  font-size: 11px;
                  line-height: 1.4;
                }
                .voucher-container {
                  border: 1px solid #ccc;
                  padding: 8mm;
                  border-radius: 4px;
                  box-sizing: border-box;
                  height: 132mm;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #023020;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
                }
                .company-info h1 {
                  font-size: 16px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  text-transform: uppercase;
                  font-weight: bold;
                }
                .company-info p {
                  margin: 0;
                  color: #666;
                  font-size: 10px;
                }
                .voucher-title {
                  text-align: right;
                }
                .voucher-title h2 {
                  font-size: 14px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  font-weight: bold;
                  letter-spacing: 1px;
                }
                .voucher-title p {
                  margin: 0;
                  font-weight: bold;
                  font-size: 10px;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 4px;
                  margin-top: 6px;
                }
                .detail-item {
                  display: flex;
                  border-bottom: 1px dashed #ddd;
                  padding: 3px 0;
                }
                .detail-label {
                  font-weight: bold;
                  color: #555;
                  width: 100px;
                  flex-shrink: 0;
                }
                .detail-value {
                  color: #111;
                  word-break: break-all;
                }
                .amount-row {
                  margin-top: 10px;
                  background-color: #f5fcf8;
                  border: 1px solid #b2dfdb;
                  padding: 6px 10px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-radius: 4px;
                }
                .amount-words {
                  font-style: italic;
                  color: #555;
                  font-size: 10px;
                }
                .amount-value {
                  font-size: 14px;
                  font-weight: bold;
                  color: #023020;
                }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 25px;
                  padding-top: 5px;
                }
                .signature-box {
                  text-align: center;
                  width: 30%;
                }
                .signature-line {
                  border-top: 1px solid #999;
                  margin-bottom: 3px;
                }
                .signature-label {
                  font-size: 9px;
                  color: #666;
                  text-transform: uppercase;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="voucher-container">
                <div>
                  <div class="header">
                    <div class="company-info">
                      <h1>${companyName}</h1>
                      <p>${companyAddress}</p>
                      <p>${companyPhone} | ${companyEmail}</p>
                      <p><strong>${companyGstin}</strong></p>
                    </div>
                    <div class="voucher-title">
                      <h2>RECEIPT VOUCHER</h2>
                      <p>Voucher No: <span style="color:#e53935">${voucher.voucher_number}</span></p>
                      <p>Date: ${new Date(voucher.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  
                  <div class="details-grid">
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Received From:</span>
                      <span class="detail-value" style="font-weight: bold; font-size:11px;">${voucher.received_from}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Branch Name:</span>
                      <span class="detail-value">${branchName}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">${voucher.payment_mode === 'bank' ? 'Bank Account:' : 'Cash Account:'}</span>
                      <span class="detail-value">${accountName}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Reference No:</span>
                      <span class="detail-value">${voucher.reference_number || 'N/A'}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Narration:</span>
                      <span class="detail-value">${voucher.narration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div class="amount-row">
                    <div class="amount-words">
                      <strong>Amount in words:</strong><br/>
                      ${amountInWords}
                    </div>
                    <div class="amount-value">${formattedAmount}</div>
                  </div>
                  
                  <div class="signatures">
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Prepared By</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Receiver's Signature</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      } else if (typeUpper === 'PAY' || typeUpper === 'PAYMENT') {
        htmlContent = `
          <html>
            <head>
              <title>Print Voucher - ${voucher.voucher_number}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  font-size: 11px;
                  line-height: 1.4;
                }
                .voucher-container {
                  border: 1px solid #ccc;
                  padding: 8mm;
                  border-radius: 4px;
                  box-sizing: border-box;
                  height: 132mm;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #023020;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
                }
                .company-info h1 {
                  font-size: 16px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  text-transform: uppercase;
                  font-weight: bold;
                }
                .company-info p {
                  margin: 0;
                  color: #666;
                  font-size: 10px;
                }
                .voucher-title {
                  text-align: right;
                }
                .voucher-title h2 {
                  font-size: 14px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  font-weight: bold;
                  letter-spacing: 1px;
                }
                .voucher-title p {
                  margin: 0;
                  font-weight: bold;
                  font-size: 10px;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 4px;
                  margin-top: 6px;
                }
                .detail-item {
                  display: flex;
                  border-bottom: 1px dashed #ddd;
                  padding: 3px 0;
                }
                .detail-label {
                  font-weight: bold;
                  color: #555;
                  width: 100px;
                  flex-shrink: 0;
                }
                .detail-value {
                  color: #111;
                  word-break: break-all;
                }
                .amount-row {
                  margin-top: 10px;
                  background-color: #f5fcf8;
                  border: 1px solid #b2dfdb;
                  padding: 6px 10px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-radius: 4px;
                }
                .amount-words {
                  font-style: italic;
                  color: #555;
                  font-size: 10px;
                }
                .amount-value {
                  font-size: 14px;
                  font-weight: bold;
                  color: #023020;
                }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 25px;
                  padding-top: 5px;
                }
                .signature-box {
                  text-align: center;
                  width: 30%;
                }
                .signature-line {
                  border-top: 1px solid #999;
                  margin-bottom: 3px;
                }
                .signature-label {
                  font-size: 9px;
                  color: #666;
                  text-transform: uppercase;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="voucher-container">
                <div>
                  <div class="header">
                    <div class="company-info">
                      <h1>${companyName}</h1>
                      <p>${companyAddress}</p>
                      <p>${companyPhone} | ${companyEmail}</p>
                      <p><strong>${companyGstin}</strong></p>
                    </div>
                    <div class="voucher-title">
                      <h2>PAYMENT VOUCHER</h2>
                      <p>Voucher No: <span style="color:#e53935">${voucher.voucher_number}</span></p>
                      <p>Date: ${new Date(voucher.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  
                  <div class="details-grid">
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Paid To:</span>
                      <span class="detail-value" style="font-weight: bold; font-size:11px;">${voucher.paid_to}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Branch Name:</span>
                      <span class="detail-value">${branchName}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">${voucher.payment_mode === 'bank' ? 'Bank Account:' : 'Cash Account:'}</span>
                      <span class="detail-value">${accountName}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Reference No:</span>
                      <span class="detail-value">${voucher.reference_number || 'N/A'}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Narration:</span>
                      <span class="detail-value">${voucher.narration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div class="amount-row">
                    <div class="amount-words">
                      <strong>Amount in words:</strong><br/>
                      ${amountInWords}
                    </div>
                    <div class="amount-value">${formattedAmount}</div>
                  </div>
                  
                  <div class="signatures">
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Prepared By</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Receiver's Signature</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      } else if (typeUpper === 'EXP' || typeUpper === 'EXPENSE') {
        htmlContent = `
          <html>
            <head>
              <title>Print Voucher - ${voucher.voucher_number}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  font-size: 11px;
                  line-height: 1.4;
                }
                .voucher-container {
                  border: 1px solid #ccc;
                  padding: 8mm;
                  border-radius: 4px;
                  box-sizing: border-box;
                  height: 132mm;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #023020;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
                }
                .company-info h1 {
                  font-size: 16px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  text-transform: uppercase;
                  font-weight: bold;
                }
                .company-info p {
                  margin: 0;
                  color: #666;
                  font-size: 10px;
                }
                .voucher-title {
                  text-align: right;
                }
                .voucher-title h2 {
                  font-size: 14px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  font-weight: bold;
                  letter-spacing: 1px;
                }
                .voucher-title p {
                  margin: 0;
                  font-weight: bold;
                  font-size: 10px;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 4px;
                  margin-top: 6px;
                }
                .detail-item {
                  display: flex;
                  border-bottom: 1px dashed #ddd;
                  padding: 3px 0;
                }
                .detail-label {
                  font-weight: bold;
                  color: #555;
                  width: 100px;
                  flex-shrink: 0;
                }
                .detail-value {
                  color: #111;
                  word-break: break-all;
                }
                .amount-row {
                  margin-top: 10px;
                  background-color: #f5fcf8;
                  border: 1px solid #b2dfdb;
                  padding: 6px 10px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-radius: 4px;
                }
                .amount-words {
                  font-style: italic;
                  color: #555;
                  font-size: 10px;
                }
                .amount-value {
                  font-size: 14px;
                  font-weight: bold;
                  color: #023020;
                }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 25px;
                  padding-top: 5px;
                }
                .signature-box {
                  text-align: center;
                  width: 30%;
                }
                .signature-line {
                  border-top: 1px solid #999;
                  margin-bottom: 3px;
                }
                .signature-label {
                  font-size: 9px;
                  color: #666;
                  text-transform: uppercase;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="voucher-container">
                <div>
                  <div class="header">
                    <div class="company-info">
                      <h1>${companyName}</h1>
                      <p>${companyAddress}</p>
                      <p>${companyPhone} | ${companyEmail}</p>
                      <p><strong>${companyGstin}</strong></p>
                    </div>
                    <div class="voucher-title">
                      <h2>EXPENSE VOUCHER</h2>
                      <p>Voucher No: <span style="color:#e53935">${voucher.voucher_number}</span></p>
                      <p>Date: ${new Date(voucher.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  
                  <div class="details-grid">
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Paid To:</span>
                      <span class="detail-value" style="font-weight: bold; font-size:11px;">${voucher.paid_to}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">Branch Name:</span>
                      <span class="detail-value">${branchName}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">${voucher.payment_mode === 'bank' ? 'Bank Account:' : 'Cash Account:'}</span>
                      <span class="detail-value">${accountName}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Reference No:</span>
                      <span class="detail-value">${voucher.reference_number || 'N/A'}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Narration:</span>
                      <span class="detail-value">${voucher.narration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div class="amount-row">
                    <div class="amount-words">
                      <strong>Amount in words:</strong><br/>
                      ${amountInWords}
                    </div>
                    <div class="amount-value">${formattedAmount}</div>
                  </div>
                  
                  <div class="signatures">
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Prepared By</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Receiver's Signature</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      } else if (typeUpper === 'TRF' || typeUpper === 'TRANSFER') {
        htmlContent = `
          <html>
            <head>
              <title>Print Voucher - ${voucher.voucher_number}</title>
              <style>
                @page {
                  size: A4 portrait;
                  margin: 8mm;
                }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  color: #333;
                  margin: 0;
                  padding: 0;
                  font-size: 11px;
                  line-height: 1.4;
                }
                .voucher-container {
                  border: 1px solid #ccc;
                  padding: 8mm;
                  border-radius: 4px;
                  box-sizing: border-box;
                  height: 132mm;
                  display: flex;
                  flex-direction: column;
                  justify-content: space-between;
                }
                .header {
                  display: flex;
                  justify-content: space-between;
                  border-bottom: 2px solid #023020;
                  padding-bottom: 3px;
                  margin-bottom: 5px;
                }
                .company-info h1 {
                  font-size: 16px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  text-transform: uppercase;
                  font-weight: bold;
                }
                .company-info p {
                  margin: 0;
                  color: #666;
                  font-size: 10px;
                }
                .voucher-title {
                  text-align: right;
                }
                .voucher-title h2 {
                  font-size: 14px;
                  margin: 0 0 3px 0;
                  color: #023020;
                  font-weight: bold;
                  letter-spacing: 1px;
                }
                .voucher-title p {
                  margin: 0;
                  font-weight: bold;
                  font-size: 10px;
                }
                .details-grid {
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 4px;
                  margin-top: 6px;
                }
                .detail-item {
                  display: flex;
                  border-bottom: 1px dashed #ddd;
                  padding: 3px 0;
                }
                .detail-label {
                  font-weight: bold;
                  color: #555;
                  width: 100px;
                  flex-shrink: 0;
                }
                .detail-value {
                  color: #111;
                  word-break: break-all;
                }
                .amount-row {
                  margin-top: 10px;
                  background-color: #f5fcf8;
                  border: 1px solid #b2dfdb;
                  padding: 6px 10px;
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  border-radius: 4px;
                }
                .amount-words {
                  font-style: italic;
                  color: #555;
                  font-size: 10px;
                }
                .amount-value {
                  font-size: 14px;
                  font-weight: bold;
                  color: #023020;
                }
                .signatures {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 25px;
                  padding-top: 5px;
                }
                .signature-box {
                  text-align: center;
                  width: 30%;
                }
                .signature-line {
                  border-top: 1px solid #999;
                  margin-bottom: 3px;
                }
                .signature-label {
                  font-size: 9px;
                  color: #666;
                  text-transform: uppercase;
                  font-weight: bold;
                }
              </style>
            </head>
            <body>
              <div class="voucher-container">
                <div>
                  <div class="header">
                    <div class="company-info">
                      <h1>${companyName}</h1>
                      <p>${companyAddress}</p>
                      <p>${companyPhone} | ${companyEmail}</p>
                      <p><strong>${companyGstin}</strong></p>
                    </div>
                    <div class="voucher-title">
                      <h2>FUND TRANSFER VOUCHER</h2>
                      <p>Voucher No: <span style="color:#e53935">${voucher.voucher_number}</span></p>
                      <p>Date: ${new Date(voucher.date).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</p>
                    </div>
                  </div>
                  
                  <div class="details-grid">
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">From Account:</span>
                      <span class="detail-value" style="font-weight: bold;">${voucher.from_account_name} (${voucher.from_account_type})</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">To Account:</span>
                      <span class="detail-value" style="font-weight: bold;">${voucher.to_account_name} (${voucher.to_account_type})</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Reference No:</span>
                      <span class="detail-value">${voucher.reference_number || 'N/A'}</span>
                    </div>
                    <div class="detail-item" style="grid-column: span 2">
                      <span class="detail-label">Narration:</span>
                      <span class="detail-value">${voucher.narration || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <div class="amount-row">
                    <div class="amount-words">
                      <strong>Amount in words:</strong><br/>
                      ${amountInWords}
                    </div>
                    <div class="amount-value">${formattedAmount}</div>
                  </div>
                  
                  <div class="signatures">
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Prepared By</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Verified By</div>
                    </div>
                    <div class="signature-box">
                      <div class="signature-line"></div>
                      <div class="signature-label">Authorized Signatory</div>
                    </div>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;
      }

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();

        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
          }, 1000);
        }, 500);
      }
    } catch (err: any) {
      console.error('Print failed:', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to print voucher.';
      setReversalError(msg);
    }
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const fmtNoCurr = (val: number) => 
    new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val);

  const renderAmount = (val: number, fallback = '—') => {
    if (val === undefined || val === null || val === 0) return fallback;
    return (
      <>
        <span className="print-hidden">{fmt(val)}</span>
        <span className="print-only-inline">{fmtNoCurr(val)}</span>
      </>
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}-${month}-${year}`;
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="space-y-6">

      {reversalError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{reversalError}</span>
        </div>
      )}

      {dateValidationError && (
        <div className="p-4 bg-amber-50 text-amber-800 rounded-xl flex items-start gap-2 text-sm border border-amber-100 print:hidden">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600" />
          <span>{dateValidationError}</span>
        </div>
      )}

      {/* Advanced Filters Card */}
      <div className="card bg-white p-5 border border-[#e2e8e6] shadow-xs space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="label">From Date</label>
            <input 
              type="date" 
              className="input text-xs" 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">To Date</label>
            <input 
              type="date" 
              className="input text-xs" 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Branch</label>
            <select 
              className="input select text-xs bg-white"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Voucher Type</label>
            <select 
              className="input select text-xs bg-white"
              value={voucherType}
              onChange={(e) => setVoucherType(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="RCV">Receipts</option>
              <option value="PAY">Payments</option>
              <option value="EXP">Expenses</option>
              <option value="TRF">Transfers</option>
            </select>
          </div>

          <div>
            <label className="label">Payment Mode</label>
            <select 
              className="input select text-xs bg-white"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
            >
              <option value="">All Modes</option>
              <option value="bank">Bank</option>
              <option value="cash">Cash</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8aa89f]" />
            <input 
              type="text" 
              placeholder="Search by Voucher #, Party name, Reference, or Narration..." 
              className="input pl-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              setFromDate(getTodayStr());
              setToDate(getTodayStr());
              setBranchId('');
              setVoucherType('');
              setPaymentMode('');
              setSearch('');
            }}
            className="btn-outline text-xs px-4 cursor-pointer"
          >
            Clear Filters
          </button>
          <button
            onClick={() => window.print()}
            className="btn-outline text-xs px-4 flex items-center gap-1.5 cursor-pointer bg-[#023020] text-white border-transparent hover:bg-[#034a31] transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Results Register */}
      {isLoading ? (
        <LoadingSkeleton rows={8} cols={6} />
      ) : (
        <div className="card bg-white p-0 border border-[#e2e8e6] shadow-xs overflow-hidden print:border-none print:shadow-none">
          {/* Print Header */}
          <div className="hidden print:block text-center border-b pb-4 mb-6 px-6 pt-6">
            <h1 className="text-2xl font-bold uppercase tracking-wider text-[#023020]">My Ledger</h1>
            <p className="text-xs text-[#8aa89f] tracking-widest mt-1">CHRONOLOGICAL DAYBOOK REGISTER</p>
            <p className="text-[10px] text-[#4a6b62] font-semibold mt-2">
              Period: {fromDate ? formatDate(fromDate) : 'The Beginning'} to {toDate ? formatDate(toDate) : 'Present'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 justify-center text-[10px] text-[#8aa89f] font-semibold">
              {branchId && <span>Branch: {branches.find((b: any) => b.id === branchId)?.name || 'Specified'}</span>}
              {voucherType && <span>Voucher Type: {voucherType}</span>}
              {paymentMode && <span className="capitalize">Mode: {paymentMode}</span>}
              {search && <span>Search: "{search}"</span>}
            </div>
          </div>

          <div className="table-container">
            <table className="data-table daybook-table">
              <thead>
                <tr>
                  <th style={{ width: '9%' }} className="text-center font-bold">Voucher #</th>
                  <th style={{ width: '12%' }} className="text-left font-bold">Date</th>
                  <th style={{ width: '16%' }} className="text-left font-bold">Branch</th>
                  <th style={{ width: '37%' }} className="text-left font-bold">Particulars</th>
                  <th style={{ width: '13%' }} className="text-center font-bold">Received<br />(CR)</th>
                  <th style={{ width: '13%' }} className="text-center font-bold">Paid<br />(DR)</th>
                  <th className="print:hidden text-left" style={{ width: '100px' }}>Reference</th>
                  <th className="print:hidden text-left" style={{ width: '80px' }}>Reversed?</th>
                  <th className="text-right print:hidden" style={{ width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {dateValidationError ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-sm text-amber-700 bg-amber-50/20 font-semibold">
                      {dateValidationError}
                    </td>
                  </tr>
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-sm text-[#8aa89f]">
                      No transactions match the filter criteria.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry: any) => (
                    <tr key={entry.id} className={`${entry.credit > 0 ? 'bg-green-50/20' : 'bg-red-50/10'}`}>
                      <td className="text-center font-bold text-[#023020] uppercase select-all">
                        {(() => {
                          const parts = (entry.voucher_number || '').split('-');
                          if (parts.length === 2) {
                            return (
                              <div>
                                <div>{parts[0]}-</div>
                                <div>{parts[1]}</div>
                              </div>
                            );
                          }
                          return entry.voucher_number;
                        })()}
                      </td>
                      <td className="text-left">
                        <div className="font-semibold text-xs text-[#0d1f1a]">
                          {formatDate(entry.date)}
                        </div>
                        {entry.created_at && (
                          <div className="text-[10px] text-[#8aa89f] font-normal mt-0.5">
                            {formatTime(entry.created_at)}
                          </div>
                        )}
                      </td>
                      <td className="text-left" title={entry.branch_name || (entry.voucher_number?.startsWith('EXP') ? 'Personal' : 'Corp / HQ')}>
                        <span className="text-xs font-semibold text-[#4a6b62]">
                          {entry.branch_name || (entry.voucher_number?.startsWith('EXP') ? 'Personal' : 'Corp / HQ')}
                        </span>
                      </td>
                      <td className="text-left" title={entry.narration ? `${entry.particulars} (${entry.narration})` : entry.particulars}>
                        <div className="font-semibold text-xs text-[#0d1f1a]">
                          {entry.particulars}
                        </div>
                        {entry.narration && (
                          <div className="text-[10px] text-[#8aa89f] italic mt-0.5">
                            {entry.narration}
                          </div>
                        )}
                      </td>
                      <td className="text-right font-semibold text-green-600">
                        {renderAmount(entry.credit)}
                      </td>
                      <td className="text-right font-semibold text-red-600">
                        {renderAmount(entry.debit)}
                      </td>
                      <td className="text-left text-xs text-[#4a6b62] print:hidden" title={entry.reference_number || '—'}>
                        {entry.reference_number || '—'}
                      </td>
                      <td className="text-left print:hidden">
                        {entry.particulars.includes('REVERSAL') || entry.narration?.includes('REVERSAL') ? (
                          <span className="badge badge-red font-semibold text-[10px]">Reversal</span>
                        ) : (
                          <span className="text-[10px] text-[#8aa89f]">—</span>
                        )}
                      </td>
                      <td className="text-right flex items-center justify-end gap-1.5 print:hidden">
                        {!entry.particulars.includes('REVERSAL') && !entry.narration?.includes('REVERSAL') && (
                          <button
                            onClick={() => handlePrint(entry.voucher_id, entry.voucher_type)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                            title="Print transaction"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        )}
                        {!entry.particulars.includes('REVERSAL') && !entry.narration?.includes('REVERSAL') && (
                          <button
                            onClick={() => handleEdit(entry.voucher_id, entry.voucher_type)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit transaction"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {(entry.voucher_type === 'RCV' || entry.voucher_type === 'PAY' || entry.voucher_type === 'EXP') && 
                          !entry.particulars.includes('REVERSAL') && !entry.narration?.includes('REVERSAL') && (
                          <button
                            onClick={() => handleDelete(entry.voucher_id, entry.voucher_type)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot className="border-t-2 border-[#023020] bg-gray-50/70 font-bold text-xs select-none">
                  <tr>
                    <td colSpan={4} className="text-right pr-4 py-3 text-[#0d1f1a]">Total :</td>
                    <td className="text-green-700 py-3 whitespace-nowrap">{renderAmount(totalCredit)}</td>
                    <td className="text-red-700 py-3 whitespace-nowrap">{renderAmount(totalDebit)}</td>
                    <td colSpan={3} className="print:hidden"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {/* Print Footer */}
          <div className="print-footer hidden">
            <span>My Ledger - Daybook</span>
            <span>Printed on: {new Date().toLocaleDateString('en-IN')}</span>
            <span>Page <span className="print-footer-page"></span></span>
          </div>
        </div>
      )}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8e6] flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e2e8e6] bg-[#f8fafb]">
              <div>
                <h3 className="text-base font-bold text-[#0d1f1a]">
                  Edit {editingVoucher.type === 'RCV' ? 'Receipt' : editingVoucher.type === 'EXP' ? 'Expense' : editingVoucher.type === 'PAY' ? 'Payment' : 'Transfer'} Voucher
                </h3>
                <p className="text-xs text-[#8aa89f] font-semibold mt-0.5">
                  Voucher No: {editingVoucher.data.voucher_number}
                </p>
              </div>
              <button 
                onClick={() => setEditingVoucher(null)}
                className="p-2 rounded-lg text-[#4a6b62] hover:bg-[#f1f5f4] hover:text-[#0d1f1a] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Common Fields Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="label text-[11px] font-bold">Voucher Date</label>
                  <input 
                    type="date" 
                    required 
                    value={editDate} 
                    onChange={(e) => setEditDate(e.target.value)} 
                    className="input py-2 text-xs font-semibold" 
                  />
                </div>
                <div>
                  <label className="label text-[11px] font-bold">Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    required 
                    min="0.01" 
                    value={editAmount} 
                    onChange={(e) => setEditAmount(e.target.value)} 
                    className="input py-2 text-xs font-bold text-emerald-950" 
                  />
                </div>
                <div>
                  <label className="label text-[11px] font-bold">Reference Number</label>
                  <input 
                    type="text" 
                    value={editReferenceNumber} 
                    onChange={(e) => setEditReferenceNumber(e.target.value)} 
                    placeholder="Reference/Ref" 
                    className="input py-2 text-xs font-semibold" 
                  />
                </div>
              </div>

              {/* Type specific fields */}
              {editingVoucher.type !== 'TRF' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">Branch</label>
                      <select 
                        value={editBranchId} 
                        onChange={(e) => setEditBranchId(e.target.value)} 
                        className="input select py-2 text-xs bg-white"
                      >
                        <option value="">Corp / HQ</option>
                        {branches.map((b: any) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label text-[11px] font-bold">
                        {editingVoucher.type === 'RCV' ? 'Received From' : 'Paid To'}
                      </label>
                      <input 
                        type="text" 
                        required 
                        value={editParticularName} 
                        onChange={(e) => setEditParticularName(e.target.value)} 
                        placeholder={editingVoucher.type === 'RCV' ? "Sender name" : "Recipient name"} 
                        className="input py-2 text-xs font-semibold" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-[11px] font-bold">Payment Mode</label>
                      <div className="flex gap-4 mt-2">
                        <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editPaymentMode" 
                            value="bank" 
                            checked={editPaymentMode === 'bank'} 
                            onChange={() => setEditPaymentMode('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editPaymentMode" 
                            value="cash" 
                            checked={editPaymentMode === 'cash'} 
                            onChange={() => setEditPaymentMode('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="label text-[11px] font-bold">
                        Select {editPaymentMode === 'bank' ? 'Bank Account' : 'Cash Account'}
                      </label>
                      {editPaymentMode === 'bank' ? (
                        <select 
                          required 
                          value={editBankAccountId} 
                          onChange={(e) => setEditBankAccountId(e.target.value)} 
                          className="input select py-2 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Bank</option>
                          {bankAccounts.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance.toFixed(2)})</option>
                          ))}
                        </select>
                      ) : (
                        <select 
                          required 
                          value={editCashAccountId} 
                          onChange={(e) => setEditCashAccountId(e.target.value)} 
                          className="input select py-2 text-xs bg-white font-semibold"
                        >
                          <option value="">Select Cash Account</option>
                          {cashAccounts.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance.toFixed(2)})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Source */}
                  <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
                    <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Source (From)</span>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editFromType" 
                            value="bank" 
                            checked={editFromAccountType === 'bank'} 
                            onChange={() => setEditFromAccountType('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editFromType" 
                            value="cash" 
                            checked={editFromAccountType === 'cash'} 
                            onChange={() => setEditFromAccountType('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <select 
                        required 
                        value={editFromAccountId} 
                        onChange={(e) => setEditFromAccountId(e.target.value)} 
                        className="input select py-1.5 text-xs bg-white font-semibold"
                      >
                        <option value="">Select Source</option>
                        {editFromAccountType === 'bank'
                          ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance.toFixed(2)})</option>)
                          : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance.toFixed(2)})</option>)
                        }
                      </select>
                    </div>
                  </div>

                  {/* Destination */}
                  <div className="p-3 bg-[#f8fafb] rounded-xl border border-[#e2e8e6] space-y-2">
                    <div className="flex justify-between items-center border-b border-[#e2e8e6] pb-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[#4a6b62]">Destination (To)</span>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editToType" 
                            value="bank" 
                            checked={editToAccountType === 'bank'} 
                            onChange={() => setEditToAccountType('bank')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Bank</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs text-[#4a6b62] cursor-pointer">
                          <input 
                            type="radio" 
                            name="editToType" 
                            value="cash" 
                            checked={editToAccountType === 'cash'} 
                            onChange={() => setEditToAccountType('cash')} 
                            className="accent-[#023020] w-3.5 h-3.5" 
                          />
                          <span>Cash</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <select 
                        required 
                        value={editToAccountId} 
                        onChange={(e) => setEditToAccountId(e.target.value)} 
                        className="input select py-1.5 text-xs bg-white font-semibold"
                      >
                        <option value="">Select Destination</option>
                        {editToAccountType === 'bank'
                          ? bankAccounts.map((b: any) => <option key={b.id} value={b.id}>{b.name} (Bal: ₹{b.current_balance.toFixed(2)})</option>)
                          : cashAccounts.map((c: any) => <option key={c.id} value={c.id}>{c.name} (Bal: ₹{c.current_balance.toFixed(2)})</option>)
                        }
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Narration */}
              <div>
                <label className="label text-[11px] font-bold">Narration</label>
                <textarea 
                  value={editNarration} 
                  onChange={(e) => setEditNarration(e.target.value)} 
                  placeholder="Voucher details..." 
                  className="input h-16 py-1.5 text-xs resize-none font-medium" 
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-[#e2e8e6]">
                <button 
                  type="button" 
                  onClick={() => setEditingVoucher(null)} 
                  className="btn-ghost px-5 py-2 text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={editMutation.isPending}
                  className="btn-primary px-6 py-2 text-xs font-bold flex items-center gap-1.5"
                >
                  {editMutation.isPending && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function numberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (num === 0) return 'Zero';
  
  const parts = num.toString().split('.');
  const rupees = parseInt(parts[0], 10);
  const paise = parts[1] ? parseInt(parts[1].substring(0, 2), 10) : 0;

  const helper = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'and ' + helper(n % 100) : '');
    return '';
  };

  const convertRupees = (n: number): string => {
    if (n === 0) return '';
    let res = '';
    
    if (n >= 10000000) {
      res += convertRupees(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      res += helper(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      res += helper(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n > 0) {
      res += helper(n);
    }
    return res;
  };

  let words = 'Rupees ' + convertRupees(rupees);
  if (paise > 0) {
    words += 'and ' + helper(paise) + 'Paise ';
  }
  return words.trim();
}
