import type { ToastState } from '../types/ui';

interface ToastProps {
  toast: ToastState;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  return (
    <div className={`toast ${toast.tone === 'danger' ? 'toast-danger' : ''}`}>
      <span>{toast.message}</span>
      {toast.action && toast.actionLabel ? (
        <button
          className="toast-action"
          onClick={() => {
            toast.action?.();
            onDismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
    </div>
  );
}