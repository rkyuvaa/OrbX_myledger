import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

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
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowPopup(false);
      }
    };
    if (showPopup) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  const formattedTotal = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(totalBalance);

  return (
    <div className="relative card min-h-[130px] p-6 bg-gradient-to-br from-[#023020] to-[#011a12] text-white flex items-center justify-between shadow-lg overflow-hidden">
      {/* Decorative background light circles */}
      <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/5 translate-x-12 -translate-y-12 blur-2xl"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 rounded-full bg-white/5 -translate-x-6 translate-y-12 blur-xl"></div>

      <div className="relative z-10">
        <span className="text-xs uppercase tracking-wider text-[#8aa89f] font-medium">
          Total Cash & Bank Balance
        </span>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 flex items-center gap-3">
          {formattedTotal}
        </h2>
      </div>

      <button
        onClick={() => setShowPopup(!showPopup)}
        className="relative z-10 p-3 rounded-full hover:bg-white/10 text-white/90 active:scale-95 transition-transform duration-100 cursor-pointer"
        title="View details"
      >
        {showPopup ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
      </button>

      {showPopup && (
        <div
          ref={popupRef}
          className="absolute z-50 right-6 top-full mt-2 w-72 max-h-[300px] overflow-y-auto card p-4 border border-[#e2e8e6] bg-white text-[#0d1f1a] shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#4a6b62] border-b pb-2 mb-3">
            Account-wise Breakup
          </h4>
          <div className="space-y-3">
            {accounts.length === 0 ? (
              <p className="text-xs text-[#8aa89f]">No accounts configured</p>
            ) : (
              accounts.map((acc) => (
                <div key={acc.id} className="flex justify-between items-center text-sm border-b border-[#f1f5f4] pb-2 last:border-none last:pb-0">
                  <div>
                    <span className="font-semibold text-[#0d1f1a] block truncate max-w-[150px]" title={acc.name}>
                      {acc.name}
                    </span>
                    <span className="text-[10px] text-[#8aa89f] capitalize">{acc.account_type}</span>
                  </div>
                  <span className="font-bold text-[#023020]">
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
      )}
    </div>
  );
};
