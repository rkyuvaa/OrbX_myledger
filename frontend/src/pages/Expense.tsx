import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Landmark, Wallet, ArrowLeft, MinusCircle, X, User, Building } from 'lucide-react';
import api from '../lib/api';
import { useToastStore } from '../store/toastStore';

export const Expense: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  
  // Wizard Step State (1-8 for inputs, 9 for summary)
  const [step, setStep] = useState(1);
  const [expenseCategory, setExpenseCategory] = useState<'personal' | 'branch' | null>(null);
  
  // Form Values
  const [valDate, setValDate] = useState(new Date().toISOString().substring(0, 10));
  const [valBranchId, setValBranchId] = useState('');
  const [valPaidTo, setValPaidTo] = useState('');
  const [valAmount, setValAmount] = useState('');
  const [valPaymentMode, setValPaymentMode] = useState<'bank' | 'cash'>('bank');
  const [valBankAccountId, setValBankAccountId] = useState('');
  const [valCashAccountId, setValCashAccountId] = useState('');
  const [valReferenceNumber, setValReferenceNumber] = useState('');
  const [valNarration, setValNarration] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [refSuggestions, setRefSuggestions] = useState<string[]>([]);

  // Fetch Voucher Sequences to calculate preview
  const { data: sequences = [] } = useQuery({
    queryKey: ['voucherSequences'],
    queryFn: async () => {
      const res = await api.get('/config/voucher-sequences');
      return res.data;
    },
  });

  const expSeq = (sequences || []).find((s: any) => s.voucher_type === 'EXP');
  const nextNum = expSeq ? expSeq.current_number + 1 : 1;
  const padding = expSeq ? expSeq.padding : 6;
  const prefix = expSeq ? expSeq.prefix : 'EXP';
  const voucherPreview = `${prefix}-${String(nextNum).padStart(padding, '0')}`;

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

  // Fetch Company Profile for printing header
  const { data: companyData } = useQuery({
    queryKey: ['companyProfile'],
    queryFn: async () => {
      const res = await api.get('/config/company');
      return res.data;
    },
  });

  // LocalStorage Helpers for Autocomplete Paid To / References
  const getHistory = (key: string): string[] => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  };

  const saveToHistory = (key: string, value: string) => {
    if (!value || value.trim().length < 2) return;
    try {
      const history = getHistory(key);
      const trimmed = value.trim();
      if (!history.includes(trimmed)) {
        history.push(trimmed);
        localStorage.setItem(key, JSON.stringify(history.slice(-30)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePartyChange = (text: string) => {
    setValPaidTo(text);
    const hist = getHistory('myledger_exp_parties');
    const filtered = hist.filter(name => name.toLowerCase().includes(text.toLowerCase()) && name.toLowerCase() !== text.toLowerCase());
    setSuggestions(filtered);
  };

  const handleReferenceChange = (text: string) => {
    setValReferenceNumber(text);
    const hist = getHistory('myledger_exp_references');
    const filtered = hist.filter(ref => ref.toLowerCase().includes(text.toLowerCase()) && ref.toLowerCase() !== text.toLowerCase());
    setRefSuggestions(filtered);
  };

  const handleSkip = () => {
    if (step === 7) {
      setStep(8);
    } else if (step === 8) {
      setStep(9);
    }
  };

  // Local balance validation
  const validateBalance = (): boolean => {
    const amountNum = Number(valAmount);
    if (valPaymentMode === 'bank') {
      const targetBank = bankAccounts.find((b: any) => b.id === valBankAccountId);
      if (targetBank && !targetBank.is_overdraft_allowed && targetBank.current_balance < amountNum) {
        setErrorMessage(`Insufficient balance in ${targetBank.name}. Available: ₹${targetBank.current_balance.toFixed(2)}`);
        return false;
      }
    } else {
      const targetCash = cashAccounts.find((c: any) => c.id === valCashAccountId);
      if (targetCash && targetCash.current_balance < amountNum) {
        setErrorMessage(`Insufficient cash balance in ${targetCash.name}. Available: ₹${targetCash.current_balance.toFixed(2)}`);
        return false;
      }
    }
    return true;
  };

  const handlePrint = (voucher: any) => {
    const companyName = companyData?.name || 'Orbx Corporation';
    const companyGstin = companyData?.gstin ? `GSTIN: ${companyData.gstin}` : '';
    const companyPhone = companyData?.phone ? `Phone: ${companyData.phone}` : '';
    const companyEmail = companyData?.email ? `Email: ${companyData.email}` : '';
    const companyAddress = companyData?.address || '';

    const branchName = expenseCategory === 'personal' ? 'Personal' : (valBranchId ? branches.find((b: any) => b.id === valBranchId)?.name || valBranchId : 'Main Branch');
    const accountName = valPaymentMode === 'bank' 
      ? bankAccounts.find((b: any) => b.id === valBankAccountId)?.name 
      : cashAccounts.find((c: any) => c.id === valCashAccountId)?.name;

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(voucher.amount);

    const amountInWords = numberToWords(voucher.amount) + ' Only';

    const htmlContent = `
      <html>
        <head>
          <title>Print Voucher - ${voucher.voucher_number}</title>
          <style>
            @page {
              size: A5 landscape;
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
              height: 100%;
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
                  <span class="detail-label">${valPaymentMode === 'bank' ? 'Bank Account:' : 'Cash Account:'}</span>
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
  };

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post('/expenses/', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['voucherSequences'] });
      
      // Save suggestions history
      saveToHistory('myledger_exp_parties', valPaidTo);
      if (valReferenceNumber) {
        saveToHistory('myledger_exp_references', valReferenceNumber);
      }

      addToast(`Expense entry posted successfully! Voucher Number: ${data.voucher_number}`, 'success');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred while posting expense voucher.');
    },
  });

  const submitTransaction = (shouldPrint: boolean = false) => {
    setErrorMessage(null);

    if (!validateBalance()) {
      return;
    }

    const payload = {
      date: valDate,
      branch_id: valBranchId,
      paid_to: valPaidTo,
      amount: Number(valAmount),
      payment_mode: valPaymentMode,
      bank_account_id: valPaymentMode === 'bank' ? valBankAccountId : undefined,
      cash_account_id: valPaymentMode === 'cash' ? valCashAccountId : undefined,
      reference_number: valReferenceNumber || undefined,
      narration: valNarration || undefined,
    };

    mutation.mutate(payload, {
      onSuccess: (data) => {
        if (shouldPrint) {
          handlePrint(data);
        }
        setTimeout(() => {
          navigate('/dashboard');
        }, shouldPrint ? 1000 : 150);
      }
    });
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const isOptionalStep = step === 7 || step === 8;

  // Simple number to words function for print preview
  function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if ((num = num.toString() as any) === '') return '';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += Number(n[1]) !== 0 ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
    str += Number(n[2]) !== 0 ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
    str += Number(n[3]) !== 0 ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
    str += Number(n[4]) !== 0 ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
    str += Number(n[5]) !== 0 ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) + 'Rupees ' : 'Rupees ';
    return str;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative min-h-[520px]">
      {/* ─── HEADER ─── */}
      <div className="bg-[#023020] text-white p-5 rounded-2xl shadow-md border border-[#011a12]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Transaction Mode</span>
            <h2 className="text-xl font-bold mt-0.5">Send Transaction (Expense)</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right">
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#8aa89f] font-semibold">Selected Date</span>
              <p className="text-sm font-bold">{valDate ? new Date(valDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Not Selected'}</p>
            </div>
            <div>
              <span className="text-[9px] uppercase tracking-wider text-[#8aa89f] font-semibold">Voucher Number</span>
              <p className="text-sm font-bold text-emerald-400">{voucherPreview}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {errorMessage && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl flex items-start gap-2 text-sm border border-red-100 animate-in fade-in duration-200">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Page Background mock */}
      <div className="bg-white/40 border border-dashed border-[#e2e8e6] rounded-2xl p-12 text-center min-h-[300px] flex flex-col justify-center items-center gap-3">
        <MinusCircle className="w-10 h-10 text-[#8aa89f]/40" />
        <p className="text-sm text-[#8aa89f]">Guided sequential popup flow active in the center overlay.</p>
        <button onClick={() => navigate('/dashboard')} className="btn-outline text-xs flex items-center gap-1.5 px-3 py-1.5">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* ─── GUIDED FLOW POPUP (Wizard Overlay) ─── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#e2e8e6] flex flex-col relative animate-in zoom-in-95 duration-200">
          
          {mutation.isPending && (
            <div className="absolute inset-0 bg-white/80 z-60 flex flex-col items-center justify-center rounded-3xl">
              <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-emerald-950 font-bold mt-3">Posting expense voucher...</p>
            </div>
          )}

          {/* Popup Header */}
          <div className="px-6 py-4 border-b border-[#e2e8e6] bg-[#f8fafb] flex justify-between items-start relative select-none">
            <div>
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider">
                Expense Voucher
              </h3>
              <div className="flex gap-4 mt-1 text-[10px] font-bold text-[#8aa89f]">
                <span>Date: {valDate ? new Date(valDate).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Today'}</span>
                <span>Voucher: {voucherPreview}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="p-1.5 -mr-1 rounded-lg text-[#4a6b62] hover:bg-[#e2e8e6] hover:text-[#0d1f1a] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Content */}
          <div className="p-6 flex-1 min-h-[220px] flex flex-col justify-center">
            {step === 1 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">Choose Expense Date</h3>
                <input 
                  type="date" 
                  value={valDate} 
                  onChange={(e) => {
                    setValDate(e.target.value);
                  }}
                  className="input text-base font-semibold py-2.5"
                />
                
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseCategory('personal');
                      setValBranchId('');
                      setStep(3);
                    }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      expenseCategory === 'personal'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <User className="w-6 h-6" />
                    <span className="font-bold text-xs">Personal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExpenseCategory('branch');
                      setStep(2);
                    }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      expenseCategory === 'branch'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Building className="w-6 h-6" />
                    <span className="font-bold text-xs">Branch</span>
                  </button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">Select Branch</h3>
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {branches.filter((b: any) => b.status === 'active').map((branch: any) => (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setValBranchId(branch.id);
                        setStep(3);
                      }}
                      className={`w-full py-2.5 px-4 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer ${
                        valBranchId === branch.id 
                          ? 'bg-[#023020] text-white border-[#023020]' 
                          : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#0d1f1a] border-[#e2e8e6]'
                      }`}
                    >
                      {branch.name} ({branch.code})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 relative">
                <h3 className="text-base font-bold text-[#0d1f1a]">Paid To / Particulars</h3>
                <input
                  type="text"
                  placeholder="e.g. Office Rent, Electricity Board, Vendor Name..."
                  value={valPaidTo}
                  onChange={(e) => handlePartyChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (valPaidTo.trim()) {
                        saveToHistory('myledger_exp_parties', valPaidTo);
                        setSuggestions([]);
                        setStep(4);
                      }
                    }
                  }}
                  autoFocus
                  className="input text-base font-semibold py-2.5"
                />
                {valPaidTo.trim().length > 0 && (
                  <div className="absolute left-0 right-0 z-55 bg-white border border-[#e2e8e6] rounded-xl shadow-lg mt-1 max-h-[145px] overflow-y-auto">
                    <button
                      onClick={() => {
                        saveToHistory('myledger_exp_parties', valPaidTo);
                        setSuggestions([]);
                        setStep(4);
                      }}
                      className="w-full text-left py-2.5 px-4 bg-emerald-50/50 hover:bg-[#f1f5f4] text-xs font-bold text-[#023020] border-b border-[#e2e8e6] flex justify-between items-center cursor-pointer"
                    >
                      <span>Use: "{valPaidTo}"</span>
                      <span className="text-[9px] text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-100 font-semibold uppercase">Confirm</span>
                    </button>
                    {suggestions.map((name) => (
                      <button
                        key={name}
                        onClick={() => {
                          setValPaidTo(name);
                          setSuggestions([]);
                          setStep(4);
                        }}
                        className="w-full text-left py-2.5 px-4 hover:bg-[#f1f5f4] text-xs font-semibold text-[#0d1f1a] border-b border-[#f1f5f4] last:border-b-0 cursor-pointer"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#8aa89f]">Suggestions list selection triggers the next popup.</p>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">Enter Amount</h3>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-[#4a6b62]">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={valAmount}
                    onChange={(e) => setValAmount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (Number(valAmount) > 0) {
                          setStep(5);
                        }
                      }
                    }}
                    autoFocus
                    className="input pl-9 text-2xl font-extrabold py-2 text-emerald-950"
                  />
                </div>
                <button
                  disabled={Number(valAmount) <= 0}
                  onClick={() => setStep(5)}
                  className="w-full py-2.5 bg-[#023020] text-white rounded-xl font-bold text-sm hover:bg-[#034a31] disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  Confirm Amount
                </button>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">Choose Payment Mode</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      setValPaymentMode('bank');
                      setStep(6);
                    }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      valPaymentMode === 'bank'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Landmark className="w-8 h-8" />
                    <span className="font-bold text-xs">Bank Outflow</span>
                  </button>
                  <button
                    onClick={() => {
                      setValPaymentMode('cash');
                      setStep(6);
                    }}
                    className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      valPaymentMode === 'cash'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Wallet className="w-8 h-8" />
                    <span className="font-bold text-xs">Cash Payment</span>
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">
                  Select {valPaymentMode === 'bank' ? 'Debit Bank Account' : 'Debit Cash Account'}
                </h3>
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {valPaymentMode === 'bank' ? (
                    bankAccounts.map((bank: any) => (
                      <button
                        key={bank.id}
                        onClick={() => {
                          setValBankAccountId(bank.id);
                          setStep(7);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer ${
                          valBankAccountId === bank.id 
                            ? 'bg-[#023020] text-white border-[#023020]' 
                            : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#0d1f1a] border-[#e2e8e6]'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span>{bank.name}</span>
                          <span className="opacity-80">Bal: ₹{bank.current_balance.toFixed(2)}</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    cashAccounts.map((cash: any) => (
                      <button
                        key={cash.id}
                        onClick={() => {
                          setValCashAccountId(cash.id);
                          setStep(7);
                        }}
                        className={`w-full py-2.5 px-4 rounded-xl border text-left font-semibold text-xs transition-all cursor-pointer ${
                          valCashAccountId === cash.id 
                            ? 'bg-[#023020] text-white border-[#023020]' 
                            : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#0d1f1a] border-[#e2e8e6]'
                        }`}
                      >
                        <div className="flex justify-between items-center text-xs">
                          <span>{cash.name}</span>
                          <span className="opacity-80">Bal: ₹{cash.current_balance.toFixed(2)}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4 relative">
                <h3 className="text-base font-bold text-[#0d1f1a]">
                  Reference Number <span className="text-[10px] font-semibold text-[#8aa89f]">(Optional)</span>
                </h3>
                <input
                  type="text"
                  placeholder="Transaction ID, Cheque, or Transfer reference ID..."
                  value={valReferenceNumber}
                  onChange={(e) => handleReferenceChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveToHistory('myledger_exp_references', valReferenceNumber);
                      setRefSuggestions([]);
                      setStep(8);
                    }
                  }}
                  autoFocus
                  className="input text-base font-semibold py-2.5"
                />
                {valReferenceNumber.trim().length > 0 && (
                  <div className="absolute left-0 right-0 z-55 bg-white border border-[#e2e8e6] rounded-xl shadow-lg mt-1 max-h-[145px] overflow-y-auto">
                    <button
                      onClick={() => {
                        saveToHistory('myledger_exp_references', valReferenceNumber);
                        setRefSuggestions([]);
                        setStep(8);
                      }}
                      className="w-full text-left py-2.5 px-4 bg-emerald-50/50 hover:bg-[#f1f5f4] text-xs font-bold text-[#023020] border-b border-[#e2e8e6] flex justify-between items-center cursor-pointer"
                    >
                      <span>Use: "{valReferenceNumber}"</span>
                      <span className="text-[9px] text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-100 font-semibold uppercase">Confirm</span>
                    </button>
                    {refSuggestions.map((ref) => (
                      <button
                        key={ref}
                        onClick={() => {
                          setValReferenceNumber(ref);
                          setRefSuggestions([]);
                          setStep(8);
                        }}
                        className="w-full text-left py-2.5 px-4 hover:bg-[#f1f5f4] text-xs font-semibold text-[#0d1f1a] border-b border-[#f1f5f4] last:border-b-0 cursor-pointer"
                      >
                        {ref}
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-[#8aa89f]">Selecting a suggestion auto-advances. Otherwise tap Skip.</p>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <h3 className="text-base font-bold text-[#0d1f1a]">Narration / Details <span className="text-[10px] font-semibold text-[#8aa89f]">(Optional)</span></h3>
                <textarea
                  placeholder="Write descriptive details about this expense..."
                  value={valNarration}
                  onChange={(e) => setValNarration(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      setStep(9);
                    }
                  }}
                  autoFocus
                  rows={3}
                  className="input text-xs font-semibold py-2.5"
                />
                <button
                  onClick={() => setStep(9)}
                  className="w-full py-2.5 bg-[#023020] text-white rounded-xl font-bold text-sm hover:bg-[#034a31] cursor-pointer shadow-sm"
                >
                  Review Transaction
                </button>
              </div>
            )}

            {step === 9 && (
              <div className="space-y-4 text-xs select-none">
                <h3 className="text-base font-bold text-[#0d1f1a] mb-1">Confirm Expense Outflow</h3>
                
                <div className="bg-[#f8fafb] border border-[#e2e8e6] rounded-2xl p-4 space-y-2.5">
                  <div className="flex justify-between border-b border-[#e2e8e6]/80 pb-2">
                    <span className="text-[#8aa89f] font-semibold">Date</span>
                    <span className="font-bold text-[#0d1f1a]">{valDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#e2e8e6]/80 pb-2">
                    <span className="text-[#8aa89f] font-semibold">Branch</span>
                    <span className="font-bold text-[#0d1f1a]">
                      {expenseCategory === 'personal' ? 'Personal' : (branches.find((b: any) => b.id === valBranchId)?.name || 'Main Branch')}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-[#e2e8e6]/80 pb-2">
                    <span className="text-[#8aa89f] font-semibold">Paid To / Expense Particulars</span>
                    <span className="font-bold text-emerald-900">{valPaidTo}</span>
                  </div>
                  <div className="flex justify-between border-b border-[#e2e8e6]/80 pb-2">
                    <span className="text-[#8aa89f] font-semibold">Source Account</span>
                    <span className="font-bold text-[#0d1f1a]">
                      {valPaymentMode === 'bank' 
                        ? bankAccounts.find((b: any) => b.id === valBankAccountId)?.name 
                        : cashAccounts.find((c: any) => c.id === valCashAccountId)?.name}
                    </span>
                  </div>
                  {valReferenceNumber && (
                    <div className="flex justify-between border-b border-[#e2e8e6]/80 pb-2">
                      <span className="text-[#8aa89f] font-semibold">Reference #</span>
                      <span className="font-bold text-[#0d1f1a]">{valReferenceNumber}</span>
                    </div>
                  )}
                  {valNarration && (
                    <div className="flex flex-col gap-1 border-b border-[#e2e8e6]/80 pb-2 text-left">
                      <span className="text-[#8aa89f] font-semibold">Narration</span>
                      <p className="font-bold text-[#0d1f1a] leading-normal">{valNarration}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1.5">
                    <span className="text-[#8aa89f] font-bold uppercase tracking-wider">Amount</span>
                    <span className="text-xl font-extrabold text-[#023020]">{fmt(Number(valAmount))}</span>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => submitTransaction(false)}
                    className="flex-1 py-3 bg-[#023020] text-white rounded-xl font-bold text-xs hover:bg-[#034a31] cursor-pointer shadow-sm text-center"
                  >
                    Post Entry
                  </button>
                  <button
                    onClick={() => submitTransaction(true)}
                    className="py-3 px-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#023020] rounded-xl font-bold text-xs cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                  >
                    Post & Print
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Popup Footer (Wizard Nav Controls) */}
          <div className="px-6 py-4 border-t border-[#e2e8e6] bg-[#f8fafb] flex justify-between items-center select-none text-xs">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => {
                if (step === 3 && expenseCategory === 'personal') {
                  setStep(1);
                } else {
                  setStep(prev => prev - 1);
                }
              }}
              className="btn-ghost py-1.5 px-3 rounded-lg text-[#4a6b62] hover:bg-[#e2e8e6] hover:text-[#0d1f1a] disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer font-bold"
            >
              Back
            </button>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((s) => (
                <div 
                  key={s} 
                  className={`w-2 h-2 rounded-full transition-all ${
                    s === step 
                      ? 'bg-[#023020] scale-120' 
                      : s < step 
                        ? 'bg-[#8aa89f]' 
                        : 'bg-[#e2e8e6]'
                  }`}
                />
              ))}
            </div>
            {isOptionalStep ? (
              <button
                type="button"
                onClick={handleSkip}
                className="py-1.5 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#023020] font-bold border border-emerald-100 cursor-pointer"
              >
                Skip
              </button>
            ) : (
              <button
                type="button"
                disabled={
                  step === 1 || 
                  step === 9 || 
                  (step === 2 && !valBranchId) || 
                  (step === 3 && !valPaidTo.trim()) || 
                  (step === 4 && Number(valAmount) <= 0) || 
                  (step === 6 && valPaymentMode === 'bank' && !valBankAccountId) || 
                  (step === 6 && valPaymentMode === 'cash' && !valCashAccountId)
                }
                onClick={() => setStep(prev => prev + 1)}
                className="py-1.5 px-4 rounded-lg bg-[#023020] hover:bg-[#034a31] text-white font-bold disabled:opacity-40 disabled:hover:bg-[#023020] cursor-pointer"
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
