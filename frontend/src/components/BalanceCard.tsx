import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

interface AccountTile {
  id: string;
  name: string;
  balance: number;
  account_type: 'bank' | 'cash';
}

interface BalanceCardProps {
  totalBalance: number;
  accounts: AccountTile[];
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ totalBalance, accounts }) => {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (showPopup) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showPopup]);

  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(totalBalance);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      setShowPopup(false);
    }
  };

  return (
    <div className="relative card min-h-[130px] p-6 bg-gradient-to-br from-[#023020] to-[#011a12] text-white flex items-center justify-between shadow-lg overflow-hidden">
      {/* Decorative background light circles */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 translate-x-12 -translate-y-12 blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -translate-x-6 translate-y-12 blur-xl"></div>

      <div className="relative z-10">
        <span className="text-xs uppercase tracking-wider text-[#8aa89f] font-semibold">
          Total Cash & Bank Balance
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 flex items-center gap-3">
          ₹ ••••••
        </h2>
      </div>

      <button
        onClick={() => setShowPopup(true)}
        className="relative z-10 flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 active:scale-95 transition-all rounded-xl text-white font-bold text-base border border-white/20 cursor-pointer shadow-sm select-none"
        title="View details"
      >
        <Eye className="w-5 h-5 text-emerald-400" />
        <span>Show Balance</span>
      </button>

      {showPopup && (
        <div 
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
        >
          <div 
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#e2e8e6] flex flex-col animate-in zoom-in-95 duration-200"
          >
            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e2e8e6] bg-[#f8fafb]">
              <h3 className="text-lg font-bold text-[#0d1f1a]">
                Your Account Balances
              </h3>
              <button 
                onClick={() => setShowPopup(false)}
                className="p-2 rounded-lg text-[#4a6b62] hover:bg-[#f1f5f4] hover:text-[#0d1f1a] transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[50vh] space-y-6">
              {/* Total Balance Card (Combined) */}
              <div className="p-5 bg-gradient-to-br from-[#023020] to-[#011a12] text-white rounded-xl shadow-md">
                <span className="text-xs uppercase tracking-wider text-[#8aa89f] font-semibold block mb-1">
                  Total Combined Balance
                </span>
                <span className="text-3xl font-extrabold tracking-tight block">
                  {formattedTotal}
                </span>
              </div>

              {/* Account Breakup List */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a6b62] mb-3">
                  Account-wise Breakup
                </h4>
                <div className="space-y-3">
                  {accounts.length === 0 ? (
                    <p className="text-sm text-[#8aa89f] py-2">No accounts configured</p>
                  ) : (
                    accounts.map((acc) => (
                      <div 
                        key={acc.id} 
                        className="flex justify-between items-center p-4 bg-[#f8fafb] rounded-xl border border-[#e2e8e6]"
                      >
                        <div>
                          <span className="font-bold text-base text-[#0d1f1a] block truncate max-w-[200px]" title={acc.name}>
                            {acc.name}
                          </span>
                          <span className="text-xs text-[#8aa89f] capitalize font-medium">
                            {acc.account_type} Account
                          </span>
                        </div>
                        <span className="font-bold text-lg text-[#023020]">
                          {new Intl.NumberFormat('en-IN', {
                            style: 'currency',
                            currency: 'INR',
                          }).format(acc.balance)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#e2e8e6] bg-[#f8fafb]">
              <button
                onClick={() => setShowPopup(false)}
                className="w-full py-3.5 bg-[#023020] hover:bg-[#034a31] text-white rounded-xl font-bold text-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <EyeOff className="w-5 h-5" />
                <span>Hide & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

