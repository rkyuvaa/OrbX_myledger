import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center border-2 border-dashed border-[#e2e8e6] rounded-xl bg-white">
      <div className="p-4 rounded-full bg-[#f1f5f4] text-[#023020] mb-4">
        <Database className="w-8 h-8" />
      </div>
      <h3 className="text-lg font-bold text-[#0d1f1a] mb-1">{title}</h3>
      <p className="text-sm text-[#8aa89f] max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="btn-primary text-xs py-2 px-4">
          {actionText}
        </button>
      )}
    </div>
  );
};
