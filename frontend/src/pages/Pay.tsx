import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Landmark, Wallet, Edit2, ArrowLeft, MinusCircle, X, Receipt } from 'lucide-react';
import api from '../lib/api';
import { useToastStore } from '../store/toastStore';

export const Pay: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  
  // Wizard Step State (1-8 for inputs, 9 for summary)
  const [step, setStep] = useState(1);
  const [isCheque, setIsCheque] = useState(false);
  
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

  const paySeq = (sequences || []).find((s: any) => s.voucher_type === 'PAY');
  const nextNum = paySeq ? paySeq.current_number + 1 : 1;
  const padding = paySeq ? paySeq.padding : 6;
  const prefix = paySeq ? paySeq.prefix : 'PAY';
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
    const hist = getHistory('myledger_pay_parties');
    const filtered = hist.filter(name => name.toLowerCase().includes(text.toLowerCase()) && name.toLowerCase() !== text.toLowerCase());
    setSuggestions(filtered);
  };

  const handleReferenceChange = (text: string) => {
    setValReferenceNumber(text);
    const hist = getHistory('myledger_pay_references');
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

    const isChequeVoucher = voucher.reference_number?.toLowerCase().includes('cheque');
    const branchName = valBranchId ? branches.find((b: any) => b.id === valBranchId)?.name || valBranchId : 'Main Branch';
    const accountName = voucher.payment_mode === 'bank' 
      ? bankAccounts.find((b: any) => b.id === voucher.bank_account_id)?.name 
      : cashAccounts.find((c: any) => c.id === voucher.cash_account_id)?.name;

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
                  <span class="detail-label">${voucher.payment_mode === 'bank' ? (isChequeVoucher ? 'Cheque Bank:' : 'Bank Account:') : 'Cash Account:'}</span>
                  <span class="detail-value">${accountName || 'N/A'}</span>
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
      const res = await api.post('/payments/', data);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      queryClient.invalidateQueries({ queryKey: ['voucherSequences'] });
      
      // Save suggestions history
      saveToHistory('myledger_pay_parties', valPaidTo);
      if (valReferenceNumber) {
        saveToHistory('myledger_pay_references', valReferenceNumber);
      }

      addToast(`Payment entry posted successfully! Voucher Number: ${data.voucher_number}`, 'success');
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred while posting payment voucher.');
    },
  });

  const submitTransaction = (shouldPrint: boolean = false) => {
    setErrorMessage(null);

    if (!validateBalance()) {
      return;
    }

    const refNum = valReferenceNumber.trim();
    const finalReferenceNumber = isCheque 
      ? (refNum.toLowerCase().startsWith('cheque') ? refNum : `Cheque No: ${refNum}`)
      : (refNum || undefined);

    const payload = {
      date: valDate,
      branch_id: valBranchId,
      paid_to: valPaidTo,
      amount: Number(valAmount),
      payment_mode: valPaymentMode,
      bank_account_id: valPaymentMode === 'bank' ? valBankAccountId : undefined,
      cash_account_id: valPaymentMode === 'cash' ? valCashAccountId : undefined,
      reference_number: finalReferenceNumber,
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

  const isOptionalStep = (step === 7 && !isCheque) || step === 8;

  return (
    <div className="max-w-2xl mx-auto space-y-6 relative min-h-[520px]">
      {/* ─── HEADER (Always visible in page background) ─── */}
      <div className="bg-[#023020] text-white p-5 rounded-2xl shadow-md border border-[#011a12]">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Transaction Mode</span>
            <h2 className="text-xl font-bold mt-0.5">Send Transaction (Payment)</h2>
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

      {/* Page Background dim mockup */}
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
          
          {/* Loading indicator */}
          {mutation.isPending && (
            <div className="absolute inset-0 bg-white/80 z-60 flex flex-col items-center justify-center rounded-3xl">
              <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs text-emerald-950 font-bold mt-3">Posting transaction voucher...</p>
            </div>
          )}

          {/* Popup Header */}
          <div className="px-6 py-4 border-b border-[#e2e8e6] bg-[#f8fafb] flex justify-between items-start relative select-none">
            <div>
              <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider">
                Send Voucher
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
                <h3 className="text-base font-bold text-[#0d1f1a]">Choose Transaction Date</h3>
                <input 
                  type="date" 
                  value={valDate} 
                  onChange={(e) => {
                    setValDate(e.target.value);
                    setTimeout(() => setStep(2), 250);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setStep(2);
                    }
                  }}
                  className="input text-base font-semibold py-2.5"
                />
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full btn-primary py-2.5 font-bold text-sm cursor-pointer shadow-sm"
                >
                  Set Date
                </button>
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
                <h3 className="text-base font-bold text-[#0d1f1a]">Paid To</h3>
                <input
                  type="text"
                  placeholder="Type recipient's name..."
                  value={valPaidTo}
                  onChange={(e) => handlePartyChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (valPaidTo.trim()) {
                        saveToHistory('myledger_pay_parties', valPaidTo);
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
                        saveToHistory('myledger_pay_parties', valPaidTo);
                        setSuggestions([]);
                        setStep(4);
                      }}
                      className="w-full text-left py-2.5 px-4 bg-emerald-50/50 hover:bg-[#f1f5f4] text-xs font-bold text-[#023020] border-b border-[#e2e8e6] flex justify-between items-center cursor-pointer"
                    >
                      <span>Use: "{valPaidTo}"</span>
                      <span className="text-[9px] text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-emerald-100 font-semibold uppercase">New Name</span>
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
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setValPaymentMode('bank');
                      setIsCheque(false);
                      setStep(6);
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      valPaymentMode === 'bank' && !isCheque
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Landmark className="w-6 h-6" />
                    <span className="font-bold text-[10px] text-center">Bank Transfer</span>
                  </button>
                  <button
                    onClick={() => {
                      setValPaymentMode('bank');
                      setIsCheque(true);
                      setStep(6);
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      valPaymentMode === 'bank' && isCheque
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Receipt className="w-6 h-6 text-amber-600" />
                    <span className="font-bold text-[10px] text-center">Cheque</span>
                  </button>
                  <button
                    onClick={() => {
                      setValPaymentMode('cash');
                      setIsCheque(false);
                      setStep(6);
                    }}
                    className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      valPaymentMode === 'cash'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-950 shadow-sm'
                        : 'bg-[#f8fafb] hover:bg-[#f1f5f4] text-[#4a6b62] border-[#e2e8e6]'
                    }`}
                  >
                    <Wallet className="w-6 h-6" />
                    <span className="font-bold text-[10px] text-center">Cash Payment</span>
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
                  {isCheque ? 'Cheque Number' : <>Reference Number <span className="text-[10px] font-semibold text-[#8aa89f]">(Optional)</span></>}
                </h3>
                <input
                  type="text"
                  placeholder={isCheque ? "Enter 6-digit cheque number..." : "Transaction ID, Cheque, or Transfer reference ID..."}
                  value={valReferenceNumber}
                  onChange={(e) => handleReferenceChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (isCheque && !valReferenceNumber.trim()) return;
                      saveToHistory('myledger_pay_references', valReferenceNumber);
                      setRefSuggestions([]);
                      setStep(8);
                    }
                  }}
                  autoFocus
                  className="input text-base font-semibold py-2.5"
                />
                {isCheque && (
                  <button
                    type="button"
                    disabled={!valReferenceNumber.trim()}
                    onClick={() => {
                      saveToHistory('myledger_pay_references', valReferenceNumber);
                      setRefSuggestions([]);
                      setStep(8);
                    }}
                    className="w-full py-2.5 bg-[#023020] text-white rounded-xl font-bold text-sm hover:bg-[#034a31] disabled:opacity-50 cursor-pointer shadow-sm mt-3"
                  >
                    Confirm Cheque Number
                  </button>
                )}
                {valReferenceNumber.trim().length > 0 && (
                  <div className="absolute left-0 right-0 z-55 bg-white border border-[#e2e8e6] rounded-xl shadow-lg mt-1 max-h-[145px] overflow-y-auto">
                    <button
                      onClick={() => {
                        saveToHistory('myledger_pay_references', valReferenceNumber);
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
                  placeholder="Write descriptive details about this outflow payment..."
                  value={valNarration}
                  onChange={(e) => setValNarration(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      setStep(9);
                    }
                  }}
                  className="input h-20 resize-none font-medium text-sm"
                ></textarea>
                <button
                  onClick={() => setStep(9)}
                  className="w-full py-3 bg-emerald-800 text-white rounded-xl font-bold text-sm hover:bg-emerald-950 cursor-pointer shadow-md"
                >
                  Review Summary
                </button>
              </div>
            )}

            {step === 9 && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-[#0d1f1a] uppercase tracking-wider border-b pb-1.5 mb-1.5">Review Summary</h3>
                
                {/* Validation Warnings */}
                {(!valDate || !valBranchId || !valPaidTo || Number(valAmount) <= 0 || (valPaymentMode === 'bank' && !valBankAccountId) || (valPaymentMode === 'cash' && !valCashAccountId)) && (
                  <div className="p-2.5 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-start gap-1">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-bold text-[10px]">Required field(s) missing or invalid:</p>
                      <ul className="list-disc pl-4 mt-0.5 text-[9px] space-y-0.5">
                        {!valDate && <li>Voucher Date</li>}
                        {!valBranchId && <li>Branch Location</li>}
                        {!valPaidTo && <li>Recipient (Paid To)</li>}
                        {Number(valAmount) <= 0 && <li>Transaction Amount</li>}
                        {valPaymentMode === 'bank' && !valBankAccountId && <li>Debit Bank Account</li>}
                        {valPaymentMode === 'cash' && !valCashAccountId && <li>Debit Cash Account</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Summary Grid (Non-scrollable compact layout) */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">DATE</span>
                      <span className="font-semibold text-[#0d1f1a]">{valDate || 'Not set'}</span>
                    </div>
                    <button onClick={() => setStep(1)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">BRANCH</span>
                      <span className="font-semibold text-[#0d1f1a] truncate max-w-[100px]">{branches.find((b: any) => b.id === valBranchId)?.name || 'Not set'}</span>
                    </div>
                    <button onClick={() => setStep(2)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">PAID TO</span>
                      <span className="font-semibold text-[#0d1f1a] truncate max-w-[100px]">{valPaidTo || 'Not set'}</span>
                    </div>
                    <button onClick={() => setStep(3)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">AMOUNT</span>
                      <span className="font-extrabold text-[#023020] text-[13px]">{fmt(Number(valAmount))}</span>
                    </div>
                    <button onClick={() => setStep(4)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">MODE / ACCOUNT</span>
                      <span className="font-semibold text-[#0d1f1a] truncate max-w-[100px]">
                        {valPaymentMode === 'bank' 
                          ? `${bankAccounts.find((b: any) => b.id === valBankAccountId)?.name || ''} (${isCheque ? 'Cheque' : 'Bank'})`
                          : cashAccounts.find((c: any) => c.id === valCashAccountId)?.name || 'Not set'}
                      </span>
                    </div>
                    <button onClick={() => setStep(5)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">{isCheque ? 'CHEQUE NUMBER' : 'REFERENCE #'}</span>
                      <span className="font-semibold text-[#0d1f1a] truncate max-w-[100px]">{valReferenceNumber || '—'}</span>
                    </div>
                    <button onClick={() => setStep(7)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center col-span-2">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">NARRATION</span>
                      <span className="font-semibold text-[#0d1f1a] truncate max-w-[200px]">{valNarration || '—'}</span>
                    </div>
                    <button onClick={() => setStep(8)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="pt-3 flex justify-between items-center border-t border-[#e2e8e6] gap-3">
                  <button onClick={() => setStep(8)} className="w-[20%] btn-ghost py-2.5 text-xs font-bold">Back</button>
                  <div className="flex-1 flex gap-2 justify-end">
                    <button
                      onClick={() => submitTransaction(false)}
                      disabled={
                        !valDate || 
                        !valBranchId || 
                        !valPaidTo || 
                        Number(valAmount) <= 0 || 
                        (valPaymentMode === 'bank' && !valBankAccountId) || 
                        (valPaymentMode === 'cash' && !valCashAccountId) ||
                        mutation.isPending
                      }
                      className="w-[35%] btn-secondary border border-[#e2e8e6] bg-white hover:bg-gray-50 text-gray-700 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => submitTransaction(true)}
                      disabled={
                        !valDate || 
                        !valBranchId || 
                        !valPaidTo || 
                        Number(valAmount) <= 0 || 
                        (valPaymentMode === 'bank' && !valBankAccountId) || 
                        (valPaymentMode === 'cash' && !valCashAccountId) ||
                        mutation.isPending
                      }
                      className="w-[45%] btn-primary py-2.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                    >
                      {mutation.isPending ? 'Saving...' : 'Save & Print'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer Controls (Popup screens 1-8) */}
          {step <= 8 && (
            <div className="px-6 py-4 border-t border-[#e2e8e6] bg-[#f8fafb] flex justify-between gap-4">
              <button
                type="button"
                disabled={step === 1}
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="btn-ghost flex-1 py-2 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                Back
              </button>
              {isOptionalStep && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className="btn-outline flex-1 py-2 text-xs font-bold border-2 border-[#8aa89f]/30 hover:border-[#4a6b62] cursor-pointer"
                >
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </div>
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
