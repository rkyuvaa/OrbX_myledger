import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Landmark, Wallet, Edit2, ArrowLeft, MinusCircle, X } from 'lucide-react';
import api from '../lib/api';

export const Pay: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Wizard Step State (1-8 for inputs, 9 for summary)
  const [step, setStep] = useState(1);
  
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
        setErrorMessage(`Insufficient balance in ${targetBank.name}. Available: ₹${targetBank.current_balance}`);
        return false;
      }
    } else {
      const targetCash = cashAccounts.find((c: any) => c.id === valCashAccountId);
      if (targetCash && targetCash.current_balance < amountNum) {
        setErrorMessage(`Insufficient cash balance in ${targetCash.name}. Available: ₹${targetCash.current_balance}`);
        return false;
      }
    }
    return true;
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

      setSuccessMessage(`Payment entry posted successfully! Voucher Number: ${data.voucher_number}`);
      
      // Navigate back to dashboard automatically to close the popup view
      setTimeout(() => {
        navigate('/dashboard');
      }, 300);
    },
    onError: (err: any) => {
      setErrorMessage(err.response?.data?.detail || 'An error occurred while posting payment voucher.');
    },
  });

  const submitTransaction = () => {
    setErrorMessage(null);
    setSuccessMessage(null);

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

    mutation.mutate(payload);
  };

  const fmt = (val: number) => 
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(val);

  const isOptionalStep = step === 7 || step === 8;

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
                          <span className="opacity-80">Bal: ₹{bank.current_balance}</span>
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
                          <span className="opacity-80">Bal: ₹{cash.current_balance}</span>
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
                      saveToHistory('myledger_pay_references', valReferenceNumber);
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
                      <span className="font-semibold text-[#0d1f1a] capitalize truncate max-w-[100px]">
                        {valPaymentMode === 'bank' 
                          ? bankAccounts.find((b: any) => b.id === valBankAccountId)?.name 
                          : cashAccounts.find((c: any) => c.id === valCashAccountId)?.name || 'Not set'}
                      </span>
                    </div>
                    <button onClick={() => setStep(5)} className="p-1 hover:bg-[#e2e8e6] rounded text-emerald-800 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                  </div>

                  <div className="bg-[#f8fafb] p-2 rounded-xl border border-[#e2e8e6] flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-[#8aa89f] font-bold block">REFERENCE #</span>
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

                <div className="pt-3 flex gap-3 border-t border-[#e2e8e6]">
                  <button onClick={() => setStep(8)} className="flex-1 btn-ghost py-2.5 text-xs font-bold">Back</button>
                  <button
                    onClick={submitTransaction}
                    disabled={
                      !valDate || 
                      !valBranchId || 
                      !valPaidTo || 
                      Number(valAmount) <= 0 || 
                      (valPaymentMode === 'bank' && !valBankAccountId) || 
                      (valPaymentMode === 'cash' && !valCashAccountId)
                    }
                    className="flex-1 btn-primary py-2.5 cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                  >
                    Save
                  </button>
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
