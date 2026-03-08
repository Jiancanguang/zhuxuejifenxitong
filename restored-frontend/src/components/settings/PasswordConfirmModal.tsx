import React, { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  isSubmitting?: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void> | void;
  onClearError?: () => void;
}

export const PasswordConfirmModal: React.FC<PasswordConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = '确认',
  isSubmitting = false,
  errorMessage = '',
  onClose,
  onSubmit,
  onClearError,
}) => {
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPassword('');
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!password || isSubmitting) return;
    await onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden modal-content"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              {description && <p className="text-sm text-slate-500">{description}</p>}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-2 relative">
            <div className="absolute -left-[9999px] top-0 w-px h-px opacity-0 pointer-events-none" aria-hidden="true">
              <input type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
            </div>

            <label className="text-sm font-bold text-slate-700">请输入登录密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (errorMessage && onClearError) onClearError();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              autoComplete="new-password"
              name="reuse-config-password"
              id="reuse-config-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              className={`w-full p-3 rounded-xl border outline-none focus:ring-2 ${
                errorMessage
                  ? 'border-rose-300 focus:ring-rose-300'
                  : 'border-slate-300 focus:ring-blue-400'
              }`}
            />
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-60 transition-colors min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={!password || isSubmitting}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-h-[44px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                提交中...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasswordConfirmModal;
