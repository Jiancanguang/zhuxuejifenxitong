import React from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
    onCancel: () => void;
    type?: 'confirm' | 'alert' | 'danger';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmText = '确定',
    cancelText = '取消',
    onConfirm,
    onCancel,
    type = 'confirm',
}) => {
    if (!isOpen) return null;

    const isAlert = type === 'alert';
    const isDanger = type === 'danger';
    const headerBgClass = isAlert
        ? 'bg-amber-50'
        : isDanger
            ? 'bg-rose-50'
            : 'bg-indigo-50';
    const iconBgClass = isAlert
        ? 'bg-amber-100'
        : isDanger
            ? 'bg-rose-100'
            : 'bg-indigo-100';
    const iconClass = isAlert
        ? 'text-amber-600'
        : isDanger
            ? 'text-rose-600'
            : 'text-indigo-600';
    const confirmBtnClass = isAlert
        ? 'bg-amber-500 hover:bg-amber-600 text-white'
        : isDanger
            ? 'bg-white border-[0.5px] border-rose-200/80 text-rose-600 hover:bg-rose-50 shadow-none'
            : 'bg-indigo-500 hover:bg-indigo-600 text-white';

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            aria-describedby="dialog-description"
        >
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className={`p-6 flex items-center gap-4 ${headerBgClass}`}>
                    <div className={`p-3 rounded-full ${iconBgClass}`}>
                        {isAlert || isDanger ? (
                            <AlertTriangle className={`w-6 h-6 ${iconClass}`} aria-hidden="true" />
                        ) : (
                            <CheckCircle className={`w-6 h-6 ${iconClass}`} aria-hidden="true" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h3 id="dialog-title" className="font-black text-lg text-slate-800">{title}</h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="p-2.5 hover:bg-white/50 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                        aria-label="关闭"
                    >
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p id="dialog-description" className="text-slate-600 whitespace-pre-line">{message}</p>
                </div>

                {/* Footer */}
                <div className="px-5 pt-4 pb-6 bg-slate-50 flex justify-end gap-3 safe-area-bottom">
                    {type !== 'alert' && (
                        <button
                            onClick={onCancel}
                            className="px-5 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors min-h-[44px] active:scale-95"
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        onClick={onConfirm}
                        className={`px-6 py-3 font-bold rounded-xl transition-colors shadow-sm min-h-[44px] active:scale-95 ${confirmBtnClass}`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
