import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isSubmitting?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Post Entry',
  cancelText = 'Cancel',
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md card bg-white text-[#0d1f1a] shadow-2xl p-6 transform animate-in zoom-in-95 duration-200">
        <h3 className="text-lg font-bold text-[#0d1f1a] mb-2">{title}</h3>
        <p className="text-sm text-[#4a6b62] leading-relaxed mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="btn-ghost text-sm px-4 py-2 border border-[#e2e8e6]"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isSubmitting}
            className="btn-primary text-sm px-4 py-2"
          >
            {isSubmitting ? 'Posting...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
