'use client';

import { X, CheckCircle, XCircle, Info } from 'lucide-react';
import { useToastStore } from '../../hooks/useToast';
import { cn } from '../../lib/utils';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const COLORS = {
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
};

export function ToastContainer() {
  const { toasts, remove } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 border rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm',
              COLORS[t.type],
            )}
          >
            <Icon size={16} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{t.message}</p>
            <button onClick={() => remove(t.id)} className="flex-shrink-0 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
