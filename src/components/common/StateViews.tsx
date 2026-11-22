import React from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-400" role="status">
      <Loader2 className="h-6 w-6 animate-spin text-indigo-400" aria-hidden="true" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-500/20 bg-[#101524] px-6 py-12 text-center"
      role="alert"
    >
      <AlertTriangle className="h-7 w-7 text-rose-400" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-slate-100">{title}</h3>
        <p className="max-w-md text-sm text-slate-400">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-lg border border-white/10 bg-[#161D31] px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#101524] px-6 py-12 text-center">
      <Inbox className="h-7 w-7 text-slate-500" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="font-display text-base font-semibold text-slate-100">{title}</h3>
        <p className="max-w-md text-sm text-slate-400">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#101524] p-6">
        <h2 id="confirm-dialog-title" className="font-display text-lg font-semibold text-slate-100">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{description}</p>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 ${
              destructive
                ? 'bg-rose-600 hover:bg-rose-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
