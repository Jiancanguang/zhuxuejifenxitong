import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Lock, RefreshCw } from 'lucide-react';
import { ApiError } from '../lib/api';
import { verifyLoginPassword } from '../services/auth';
import { resetClassProgress } from '../services/data';

interface ResetProgressFlowModalProps {
  isOpen: boolean;
  classId: string;
  classTitle: string;
  studentCount: number;
  onClose: () => void;
  onToast: (message: string) => void;
  onRefreshData: () => Promise<void>;
  onAuthExpired: () => void;
}

type ModalStage = 'confirm' | 'executing';

const PASSWORD_ERROR_MESSAGE = '登录密码错误';
const VERIFY_NETWORK_ERROR_MESSAGE = '网络异常，请重试';
const RESET_SUCCESS_MESSAGE = '已完成班级学生进度重置';
const RESET_FAILED_MESSAGE = '重置失败，请重试';
const RESET_TIMEOUT_SYNC_MESSAGE = '操作可能已完成，正在同步';

const isPasswordError = (error: unknown): error is ApiError => {
  return error instanceof ApiError
    && error.statusCode === 401
    && error.message === PASSWORD_ERROR_MESSAGE;
};

const isAuthExpiredError = (error: unknown): error is ApiError => {
  return error instanceof ApiError
    && error.statusCode === 401
    && error.message !== PASSWORD_ERROR_MESSAGE;
};

const isResetConflictError = (error: unknown): error is ApiError => {
  return error instanceof ApiError && error.statusCode === 409;
};

const isTimeoutOrNetworkError = (error: unknown): error is ApiError => {
  return error instanceof ApiError && (error.isTimeout || error.isNetworkError);
};

export const ResetProgressFlowModal: React.FC<ResetProgressFlowModalProps> = ({
  isOpen,
  classId,
  classTitle,
  studentCount,
  onClose,
  onToast,
  onRefreshData,
  onAuthExpired,
}) => {
  const [stage, setStage] = useState<ModalStage>('confirm');
  const [password, setPassword] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [isVerifying, setIsVerifying] = useState(false);
  const [executingMessage, setExecutingMessage] = useState('准备重置...');

  const confirmDisabled = useMemo(() => {
    return !password || countdown > 0 || isVerifying;
  }, [password, countdown, isVerifying]);

  useEffect(() => {
    if (!isOpen) return;

    setStage('confirm');
    setPassword('');
    setInlineError('');
    setGeneralError('');
    setCountdown(3);
    setIsVerifying(false);
    setExecutingMessage('准备重置...');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || stage !== 'confirm') return;

    setCountdown(3);
    const timer = window.setInterval(() => {
      setCountdown(prev => (prev <= 0 ? 0 : prev - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [isOpen, stage]);

  useEffect(() => {
    if (!isOpen || stage !== 'confirm') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, stage, onClose]);

  if (!isOpen) return null;

  const handleBackToConfirm = (message?: string) => {
    setStage('confirm');
    setGeneralError('');
    if (message) {
      setInlineError(message);
    }
  };

  const handleConfirm = async () => {
    if (confirmDisabled) return;

    setIsVerifying(true);
    setInlineError('');
    setGeneralError('');

    try {
      await verifyLoginPassword(password);
    } catch (error) {
      if (isPasswordError(error)) {
        setInlineError(PASSWORD_ERROR_MESSAGE);
      } else if (isTimeoutOrNetworkError(error)) {
        setGeneralError(VERIFY_NETWORK_ERROR_MESSAGE);
      } else if (isAuthExpiredError(error)) {
        onClose();
        onAuthExpired();
      } else {
        setGeneralError((error as Error)?.message || VERIFY_NETWORK_ERROR_MESSAGE);
      }
      setIsVerifying(false);
      return;
    }

    setIsVerifying(false);
    setStage('executing');
    setExecutingMessage('准备重置...');
    const phaseTimer = window.setTimeout(() => {
      setExecutingMessage('正在重置...');
    }, 300);

    try {
      await resetClassProgress(classId, password);
      onClose();
      onToast(RESET_SUCCESS_MESSAGE);
      await onRefreshData();
    } catch (error) {
      if (isPasswordError(error)) {
        handleBackToConfirm(PASSWORD_ERROR_MESSAGE);
      } else if (isAuthExpiredError(error)) {
        onClose();
        onAuthExpired();
      } else if (isResetConflictError(error)) {
        onClose();
      } else if (isTimeoutOrNetworkError(error)) {
        onClose();
        onToast(RESET_TIMEOUT_SYNC_MESSAGE);
        await onRefreshData();
      } else {
        onClose();
        onToast(RESET_FAILED_MESSAGE);
      }
    } finally {
      window.clearTimeout(phaseTimer);
    }
  };

  if (stage === 'executing') {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden modal-content">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">重置班级所有学生进度</h3>
                <p className="text-sm text-slate-500">{classTitle}</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
              <span>{executingMessage}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-1/3 bg-gradient-to-r from-blue-400 to-indigo-500 animate-pulse" />
            </div>
            <p className="text-sm text-slate-500">请勿关闭页面，系统正在执行全量重置。</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden modal-content"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-progress-title"
      >
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-rose-50 to-amber-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 id="reset-progress-title" className="text-lg font-bold text-slate-800">重置班级所有学生进度</h3>
              <p className="text-sm text-slate-500">{classTitle} · {studentCount} 名学生</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50">
              <p className="font-bold text-rose-700 mb-2">会被清空</p>
              <ul className="space-y-1 text-rose-700/90">
                <li>积分</li>
                <li>宠物选择</li>
                <li>宠物阶段</li>
                <li>徽章</li>
                <li>成长记录</li>
                <li>兑换记录</li>
              </ul>
            </div>
            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
              <p className="font-bold text-emerald-700 mb-2">会被保留</p>
              <ul className="space-y-1 text-emerald-700/90">
                <li>积分规则</li>
                <li>等级规则</li>
                <li>班级名称</li>
                <li>分组</li>
                <li>商店配置</li>
              </ul>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-sm text-amber-800">
            <p className="font-bold">本操作不可撤销，将清空成长记录与兑换记录。若需留档，请先导出 CSV 备份。</p>
          </div>

          {generalError && (
            <div className="p-3 rounded-lg border border-rose-200 bg-rose-50 text-sm text-rose-700">
              {generalError}
            </div>
          )}

          <div className="space-y-2 relative">
            {/* 诱导浏览器自动填充到非业务字段，降低误填到页面其他输入框的概率 */}
            <div className="absolute -left-[9999px] top-0 w-px h-px opacity-0 pointer-events-none" aria-hidden="true">
              <input type="text" name="username" autoComplete="username" tabIndex={-1} />
              <input type="password" name="password" autoComplete="current-password" tabIndex={-1} />
            </div>
            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500" />
              请输入登录密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (inlineError) setInlineError('');
              }}
              placeholder="请输入登录密码以确认"
              autoComplete="new-password"
              name="reset-progress-password"
              id="reset-progress-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              className={`w-full p-3 rounded-xl border outline-none focus:ring-2 ${
                inlineError
                  ? 'border-rose-300 focus:ring-rose-300'
                  : 'border-slate-300 focus:ring-blue-400'
              }`}
            />
            {inlineError && (
              <p className="text-sm text-rose-600">{inlineError}</p>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 safe-area-bottom">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="px-5 py-2.5 rounded-lg font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2 min-h-[44px]"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                校验中...
              </>
            ) : (
              <>
                确认重置
                {countdown > 0 ? `（${countdown}s）` : ''}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetProgressFlowModal;
