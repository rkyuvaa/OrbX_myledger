import React from 'react';
import { useToastStore } from '../store/toastStore';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed top-5 right-5 z-9999 space-y-2 pointer-events-none w-full max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 bg-white text-gray-900 border-[#e2e8e6] animate-in slide-in-from-right duration-250`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />}
          {toast.type === 'info' && <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />}
          
          <div className="flex-1 text-xs font-semibold leading-relaxed text-gray-800">
            {toast.message}
          </div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="p-0.5 -mt-1 -mr-1 rounded hover:bg-black/5 text-gray-500 hover:text-gray-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
