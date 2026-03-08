
import React from 'react';
import { AlertTriangle, ArrowRight } from 'lucide-react';

interface RecordLimitWarningProps {
    isOpen: boolean;
    currentCount: number;
    maxCount: number;
    onOpenRecordModal: () => void;
    onClose: () => void;
}

export const RecordLimitWarning: React.FC<RecordLimitWarningProps> = ({
    isOpen,
    currentCount,
    maxCount,
    onOpenRecordModal,
    onClose,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full animate-in zoom-in-95 duration-300 modal-content">

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="p-4 bg-red-100 rounded-full">
                        <AlertTriangle className="w-12 h-12 text-red-600" />
                    </div>
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">
                    成长记录空间已满
                </h2>

                {/* Message */}
                <div className="text-center mb-6">
                    <p className="text-slate-600 mb-2">
                        当前记录数已达到上限
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 rounded-lg">
                        <span className="text-3xl font-bold text-red-600">{currentCount}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-lg text-slate-500">{maxCount}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-3">
                        请前往"成长记录"清理旧数据后再继续操作
                    </p>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <button
                        onClick={() => {
                            onClose();
                            onOpenRecordModal();
                        }}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 min-h-[44px]"
                    >
                        前往清理记录
                        <ArrowRight size={20} />
                    </button>
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition-colors min-h-[44px]"
                    >
                        稍后处理
                    </button>
                </div>
            </div>
        </div>
    );
};
