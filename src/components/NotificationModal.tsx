import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, HelpCircle, X } from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface NotificationState {
  isOpen: boolean;
  type: NotificationType;
  title: string;
  message: string;
  isConfirm?: boolean;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

// Global listener map for triggering modal anywhere without React prop drilling
type Listener = (state: NotificationState) => void;
let globalListener: Listener | null = null;

export const notify = {
  alert: (message: string, title = 'Notice', type: NotificationType = 'info') => {
    if (globalListener) {
      globalListener({
        isOpen: true,
        type,
        title,
        message,
        isConfirm: false,
      });
    } else {
      console.log(`[Alert] ${title}: ${message}`);
    }
  },
  success: (message: string, title = 'Success') => {
    notify.alert(message, title, 'success');
  },
  error: (message: string, title = 'Error') => {
    notify.alert(message, title, 'error');
  },
  confirm: (
    message: string,
    titleOrOnConfirm?: string | (() => void),
    title = 'Please Confirm',
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ): Promise<boolean> => {
    let cb: (() => void) | undefined;
    let actualTitle = title;
    if (typeof titleOrOnConfirm === 'function') {
      cb = titleOrOnConfirm;
    } else if (typeof titleOrOnConfirm === 'string') {
      actualTitle = titleOrOnConfirm;
    }

    return new Promise((resolve) => {
      if (globalListener) {
        globalListener({
          isOpen: true,
          type: 'warning',
          title: actualTitle,
          message,
          isConfirm: true,
          confirmText,
          cancelText,
          onConfirm: () => {
            if (cb) cb();
            resolve(true);
          },
          onCancel: () => {
            resolve(false);
          },
        });
      } else {
        const res = false;
        resolve(res);
      }
    });
  },
};

export const NotificationContainer: React.FC = () => {
  const [modal, setModal] = useState<NotificationState>({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
  });

  useEffect(() => {
    globalListener = setModal;
    return () => {
      globalListener = null;
    };
  }, []);

  if (!modal.isOpen) return null;

  const handleClose = () => {
    if (modal.isConfirm && modal.onCancel) {
      modal.onCancel();
    }
    setModal((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    if (modal.onConfirm) {
      modal.onConfirm();
    }
    setModal((prev) => ({ ...prev, isOpen: false }));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-6 shadow-2xl relative text-slate-100 my-auto space-y-4">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              modal.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-400'
                : modal.type === 'error'
                ? 'bg-rose-500/20 text-rose-400'
                : modal.type === 'warning'
                ? 'bg-amber-500/20 text-amber-400'
                : 'bg-indigo-500/20 text-indigo-400'
            }`}
          >
            {modal.type === 'success' && <CheckCircle className="w-6 h-6" />}
            {modal.type === 'error' && <AlertCircle className="w-6 h-6" />}
            {modal.type === 'warning' && (modal.isConfirm ? <HelpCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />)}
            {modal.type === 'info' && <Info className="w-6 h-6" />}
          </div>

          <div>
            <h3 className="text-base font-bold text-slate-100">{modal.title}</h3>
            <p className="text-xs text-slate-300 mt-1 whitespace-pre-line leading-relaxed">
              {modal.message}
            </p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2.5">
          {modal.isConfirm ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                {modal.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition"
              >
                {modal.confirmText || 'Confirm'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition text-center"
            >
              OK
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
