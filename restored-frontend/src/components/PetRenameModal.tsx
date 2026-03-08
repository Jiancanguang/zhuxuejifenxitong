import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, PenLine } from 'lucide-react';

interface PetRenameModalProps {
  isOpen: boolean;
  studentName: string;
  petName: string;
  currentNickname?: string | null;
  theme?: {
    colors: {
      leaderboardHeader: string;
    };
  };
  onClose: () => void;
  onSubmit: (nickname: string) => Promise<void>;
}

const NICKNAME_REGEX = /^[\u4e00-\u9fa5A-Za-z0-9]{1,12}$/;

export const PetRenameModal: React.FC<PetRenameModalProps> = ({
  isOpen,
  studentName,
  petName,
  currentNickname,
  theme,
  onClose,
  onSubmit,
}) => {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setNickname(currentNickname || '');
    setError('');
    setIsSubmitting(false);
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen, currentNickname]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmed = nickname.trim();
    if (!NICKNAME_REGEX.test(trimmed)) {
      setError('昵称仅支持1-12位中文/英文/数字');
      return;
    }

    const current = (currentNickname || '').trim();
    if (current && trimmed === current) {
      setError('昵称未变化');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || '保存失败，请重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden modal-content">
        <div className={`p-5 border-b border-slate-100 flex items-center justify-between ${theme?.colors.leaderboardHeader || 'bg-gradient-to-r from-sky-500 to-indigo-500'}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center">
              <PenLine size={18} />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">给宠物起名</h2>
              <p className="text-xs text-white/80">{studentName} · {petName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target p-2 rounded-full text-white hover:bg-white/20 transition-colors"
            aria-label="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">宠物昵称</label>
            <input
              ref={inputRef}
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              disabled={isSubmitting}
              maxLength={12}
              placeholder="请输入昵称"
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="mt-2 text-xs text-slate-500">仅支持 1-12 位中文/英文/数字</p>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 text-rose-600 text-sm border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-indigo-300 inline-flex items-center gap-2 min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PetRenameModal;
