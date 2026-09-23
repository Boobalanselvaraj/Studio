import React from 'react';
import { create } from 'zustand';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';


export const useToastStore = create((set) => ({
  toasts: [],
  addToast: ({ type = 'info', title, message }) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4500);
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

export const toast = {
  success: (message, title) => useToastStore.getState().addToast({ type: 'success', title, message }),
  error: (message, title) => useToastStore.getState().addToast({ type: 'error', title, message }),
  warning: (message, title) => useToastStore.getState().addToast({ type: 'warning', title, message }),
  info: (message, title) => useToastStore.getState().addToast({ type: 'info', title, message }),
};

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';
        const isWarning = t.type === 'warning';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-200 animate-in slide-in-from-bottom-5 ${
              isSuccess
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100 dark:bg-emerald-950/95'
                : isError
                ? 'bg-rose-950/90 border-rose-500/30 text-rose-100 dark:bg-rose-950/95'
                : isWarning
                ? 'bg-amber-950/90 border-amber-500/30 text-amber-100 dark:bg-amber-950/95'
                : 'bg-surface-2/95 border-border text-foreground'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 size={18} className="text-emerald-400" />}
              {isError && <AlertCircle size={18} className="text-rose-400" />}
              {isWarning && <AlertTriangle size={18} className="text-amber-400" />}
              {!isSuccess && !isError && !isWarning && <Info size={18} className="text-brand-primary" />}
            </div>

            <div className="flex-1 min-w-0">
              {t.title && <p className="text-xs font-semibold uppercase tracking-wider mb-0.5">{t.title}</p>}
              <p className="text-sm font-medium leading-snug break-words">{t.message}</p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded-md opacity-60 hover:opacity-100 transition-opacity"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
