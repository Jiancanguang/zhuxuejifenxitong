import React, { useState, useMemo, useEffect } from 'react';
import { X, Search, Star, Users, Sparkles, Zap } from 'lucide-react';
import { ScoreItem } from '../types';
import { MASTER_ICON_MAP } from '../icons';
import { matchesSearch } from '../utils';

interface ScoreSelectModalProps {
    isOpen: boolean;
    studentName: string;
    scoreItems: ScoreItem[];
    onSelect: (scoreItem: ScoreItem) => void;
    onClose: () => void;
    isBatchMode?: boolean; // 是否为批量模式
}

export const ScoreSelectModal: React.FC<ScoreSelectModalProps> = ({
    isOpen,
    studentName,
    scoreItems,
    onSelect,
    onClose,
    isBatchMode = false,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [inputRef, setInputRef] = useState<HTMLInputElement | null>(null);

    // Reset search when opened
    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
            // Auto focus input
            setTimeout(() => inputRef?.focus(), 100);
        }
    }, [isOpen, inputRef]);

    // 分离加分项和扣分项
    const { addItems, deductItems } = useMemo(() => {
        const filtered = scoreItems.filter(item => matchesSearch(item.name, searchTerm));
        return {
            addItems: filtered.filter(item => item.score > 0),
            deductItems: filtered.filter(item => item.score < 0)
        };
    }, [scoreItems, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh] modal-content">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-white relative">
                    <div className="flex items-center justify-center mb-1">
                        {isBatchMode ? (
                            <div className="flex items-center gap-1.5 text-sm font-bold text-blue-500">
                                <Users size={14} />
                                <span>批量操作模式</span>
                            </div>
                        ) : (
                            <div className="text-sm font-bold text-slate-400">选择项目</div>
                        )}
                    </div>
                    <h3 className="text-2xl font-black text-center text-slate-800">
                        给 <span className={isBatchMode ? "text-blue-600" : "text-indigo-600"}>{studentName}</span> 加分/扣分
                    </h3>
                    <button
                        onClick={onClose}
                        className="absolute right-6 top-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                    >
                        <X size={24} />
                    </button>

                    {/* Decorative background elements */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isBatchMode ? 'from-blue-500 via-cyan-500 to-blue-500' : 'from-emerald-500 via-indigo-500 to-rose-500'}`} />
                </div>

                {/* Sub-Header: Search Bar */}
                <div className="px-6 pt-4 pb-2 bg-slate-50/50">
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                            <Search size={20} />
                        </div>
                        <input
                            ref={setInputRef}
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="🔍 搜索项目 (支持首字母如 'cd' 搜 '迟到')"
                            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100/50 font-bold text-slate-700 transition-all placeholder:font-normal placeholder:text-slate-400 shadow-sm"
                            autoComplete="off"
                            autoCapitalize="off"
                            autoCorrect="off"
                            spellCheck={false}
                            enterKeyHint="search"
                        />
                    </div>
                </div>

                {/* Options List */}
                <div className="p-6 overflow-y-auto bg-slate-50/50 flex-1 space-y-6">
                    {scoreItems.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-4xl grayscale opacity-50">
                                📝
                            </div>
                            <p className="text-lg font-bold text-slate-600 mb-2">暂无项目</p>
                            <p className="text-sm text-slate-400">请前往设置页面添加加分/扣分项目</p>
                        </div>
                    ) : addItems.length === 0 && deductItems.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400">
                                <Search size={32} />
                            </div>
                            <p className="text-lg font-bold text-slate-600 mb-2">未找到匹配项</p>
                            <p className="text-sm text-slate-400">试着换个关键词搜搜看？</p>
                        </div>
                    ) : (
                        <>
                            {/* 加分项区域 */}
                            {addItems.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Sparkles size={16} className="text-emerald-500" />
                                        <span className="text-sm font-bold text-emerald-600">加分项</span>
                                        <div className="flex-1 h-px bg-emerald-200" />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                        {addItems.map((item) => {
                                            const IconComp = MASTER_ICON_MAP[item.icon] || Star;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => onSelect(item)}
                                                    className="relative group p-4 rounded-2xl bg-white border-2 border-emerald-100 hover:border-emerald-400/50 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 flex flex-col items-center text-center active:scale-95"
                                                >
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center mb-3 transition-colors duration-300 shadow-inner text-emerald-500 group-hover:text-emerald-600 group-hover:scale-110 transform">
                                                        <IconComp size={32} strokeWidth={2} />
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-emerald-700 transition-colors line-clamp-1 mb-1 w-full">
                                                        {item.name}
                                                    </span>
                                                    <div className={`
                                                        px-3 py-1 rounded-full text-xs font-black
                                                        ${item.score >= 5 ? 'bg-amber-100 text-amber-600' :
                                                            item.score >= 3 ? 'bg-emerald-100 text-emerald-600' :
                                                                'bg-green-100 text-green-600'}
                                                    `}>
                                                        +{item.score} 🍖
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* 扣分项区域 */}
                            {deductItems.length > 0 && (
                                <div>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap size={16} className="text-rose-500" />
                                        <span className="text-sm font-bold text-rose-600">扣分项</span>
                                        <div className="flex-1 h-px bg-rose-200" />
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                                        {deductItems.map((item) => {
                                            const IconComp = MASTER_ICON_MAP[item.icon] || Star;
                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => onSelect(item)}
                                                    className="relative group p-4 rounded-2xl bg-white border-2 border-rose-100 hover:border-rose-400/50 hover:shadow-xl hover:shadow-rose-500/10 transition-all duration-300 flex flex-col items-center text-center active:scale-95"
                                                >
                                                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-rose-50 group-hover:bg-rose-100 flex items-center justify-center mb-3 transition-colors duration-300 shadow-inner text-rose-500 group-hover:text-rose-600 group-hover:scale-110 transform">
                                                        <IconComp size={32} strokeWidth={2} />
                                                    </div>
                                                    <span className="font-bold text-slate-700 group-hover:text-rose-700 transition-colors line-clamp-1 mb-1 w-full">
                                                        {item.name}
                                                    </span>
                                                    <div className="px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-600">
                                                        {item.score} 🍖
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer - Optional tip or purely decorative */}
                <div className="p-4 bg-white border-t border-slate-100 text-center">
                    <p className="text-xs text-slate-400 font-medium">
                        ✨ 点击项目直接操作
                    </p>
                </div>
            </div>
        </div>
    );
};
