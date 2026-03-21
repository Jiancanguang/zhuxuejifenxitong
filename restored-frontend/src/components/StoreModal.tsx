import React, { useState, useMemo } from 'react';
import {
  // UI Essentials
  X, ShoppingBag, Plus, Minus, Package, Coins, Settings2, Trash2, Pencil, Save, Store, Search,
  Gift, Users, Check as CheckIconLucide, History as HistoryIcon
} from 'lucide-react';
import { RewardItem, Student, Badge, HistoryRecord } from '../types';
import { matchesSearch } from '../utils';
import { ConfirmDialog } from './ConfirmDialog';
import { MASTER_ICON_MAP, ICON_CATEGORIES } from '../icons';
import { generateClientId } from '../lib/clientId';

// 3. Soft "Puffy" Theme System (Matches StudentCard)
const THEME_STYLES: Record<string, { bg: string; shadow: string; text: string; subtext: string; ring: string; button: string; buttonText: string; iconBg: string }> = {
  indigo: { bg: 'bg-[#e0e7ff]', shadow: 'shadow-[#c7d2fe]', text: 'text-indigo-900', subtext: 'text-indigo-700/60', ring: 'ring-indigo-300', button: 'bg-indigo-500 hover:bg-indigo-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  purple: { bg: 'bg-[#f3e8ff]', shadow: 'shadow-[#e9d5ff]', text: 'text-purple-900', subtext: 'text-purple-700/60', ring: 'ring-purple-300', button: 'bg-purple-500 hover:bg-purple-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  orange: { bg: 'bg-[#ffedd5]', shadow: 'shadow-[#fed7aa]', text: 'text-orange-900', subtext: 'text-orange-700/60', ring: 'ring-orange-300', button: 'bg-orange-500 hover:bg-orange-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  rose: { bg: 'bg-[#ffe4e6]', shadow: 'shadow-[#fecdd3]', text: 'text-rose-900', subtext: 'text-rose-700/60', ring: 'ring-rose-300', button: 'bg-rose-500 hover:bg-rose-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  sky: { bg: 'bg-[#e0f2fe]', shadow: 'shadow-[#bae6fd]', text: 'text-sky-900', subtext: 'text-sky-700/60', ring: 'ring-sky-300', button: 'bg-sky-500 hover:bg-sky-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  yellow: { bg: 'bg-[#fef9c3]', shadow: 'shadow-[#fde047]', text: 'text-yellow-900', subtext: 'text-yellow-700/60', ring: 'ring-yellow-300', button: 'bg-yellow-500 hover:bg-yellow-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  emerald: { bg: 'bg-[#d1fae5]', shadow: 'shadow-[#6ee7b7]', text: 'text-emerald-900', subtext: 'text-emerald-700/60', ring: 'ring-emerald-300', button: 'bg-emerald-500 hover:bg-emerald-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  pink: { bg: 'bg-[#fce7f3]', shadow: 'shadow-[#fbcfe8]', text: 'text-pink-900', subtext: 'text-pink-700/60', ring: 'ring-pink-300', button: 'bg-pink-500 hover:bg-pink-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  slate: { bg: 'bg-[#f1f5f9]', shadow: 'shadow-[#cbd5e1]', text: 'text-slate-900', subtext: 'text-slate-600', ring: 'ring-slate-300', button: 'bg-slate-500 hover:bg-slate-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
  red: { bg: 'bg-[#fee2e2]', shadow: 'shadow-[#fca5a5]', text: 'text-red-900', subtext: 'text-red-700/60', ring: 'ring-red-300', button: 'bg-red-500 hover:bg-red-600', buttonText: 'text-white', iconBg: 'bg-white/60' },
};

const COLOR_OPTIONS = [
  { label: 'Indigo', value: 'bg-indigo-50 text-indigo-600 border-indigo-200', preview: 'bg-indigo-400' },
  { label: 'Purple', value: 'bg-purple-50 text-purple-600 border-purple-200', preview: 'bg-purple-400' },
  { label: 'Orange', value: 'bg-orange-50 text-orange-600 border-orange-200', preview: 'bg-orange-400' },
  { label: 'Rose', value: 'bg-rose-50 text-rose-600 border-rose-200', preview: 'bg-rose-400' },
  { label: 'Sky', value: 'bg-sky-50 text-sky-600 border-sky-200', preview: 'bg-sky-400' },
  { label: 'Yellow', value: 'bg-yellow-50 text-yellow-600 border-yellow-200', preview: 'bg-yellow-400' },
  { label: 'Emerald', value: 'bg-emerald-50 text-emerald-600 border-emerald-200', preview: 'bg-emerald-400' },
  { label: 'Pink', value: 'bg-pink-50 text-pink-600 border-pink-200', preview: 'bg-pink-400' },
  { label: 'Slate', value: 'bg-slate-50 text-slate-600 border-slate-200', preview: 'bg-slate-400' },
  { label: 'Red', value: 'bg-red-50 text-red-600 border-red-200', preview: 'bg-red-400' },
];

const getTheme = (colorString: string) => {
  if (!colorString) return THEME_STYLES.indigo;
  const match = colorString.match(/bg-(\w+)-/);
  const colorName = match ? match[1] : 'indigo';
  return THEME_STYLES[colorName] || THEME_STYLES.indigo;
};

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewards: RewardItem[];
  inventory: Record<string, number>;
  students: Student[];
  badges: Record<string, Badge[]>;
  history: HistoryRecord[];
  onRedeem: (rewardId: string, studentId: string, cost: number) => void;
  onRestock: (rewardId: string, amount: number) => void;
  onSaveReward: (reward: RewardItem) => void;
  onDeleteReward: (rewardId: string) => void;
}

export const StoreModal: React.FC<StoreModalProps> = ({
  isOpen,
  onClose,
  rewards,
  inventory,
  students,
  badges,
  history,
  onRedeem,
  onRestock,
  onSaveReward,
  onDeleteReward,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<RewardItem> | null>(null);
  const [activeTab, setActiveTab] = useState<keyof typeof ICON_CATEGORIES | 'history'>('food');
  const [selectingReward, setSelectingReward] = useState<RewardItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Dialog state
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'alert';
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, type: 'confirm', title: '', message: '', onConfirm: () => { } });

  // Calculate available food for each student
  const getStudentFoodInfo = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    const totalEarned = student?.foodCount || 0;
    const consumed = student?.spentFood || 0;
    const available = Math.max(0, totalEarned - consumed);
    return { totalEarned, consumed, available };
  };

  // 过滤出兑换记录并按时间倒序排列
  const redeemHistory = useMemo(() => {
    return history
      .filter(h => h.type === 'redeem')
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [history]);

  const displayedIcons = useMemo(() => {
    // 兼容 'history' tab 或其他非图标分类的情况
    const category = ICON_CATEGORIES[activeTab as keyof typeof ICON_CATEGORIES];
    return category ? category.icons : ICON_CATEGORIES['food'].icons;
  }, [activeTab]);

  if (!isOpen) return null;

  const handleEditStart = (item: RewardItem) => {
    setEditingItem({ ...item });
    let foundCat = 'food';
    for (const [cat, data] of Object.entries(ICON_CATEGORIES)) {
      if (data.icons.includes(item.icon)) {
        foundCat = cat;
        break;
      }
    }
    setActiveTab(foundCat as any);
  };

  const handleAddNew = () => {
    setEditingItem({
      id: generateClientId('store_add_reward'),
      name: '',
      description: '',
      cost: 1,
      icon: 'Gift',
      color: COLOR_OPTIONS[Math.floor(Math.random() * COLOR_OPTIONS.length)].value
    });
    setActiveTab('food');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem && editingItem.name && editingItem.id) {
      onSaveReward(editingItem as RewardItem);
      setEditingItem(null);
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    if (window.confirm(`确定要删除商品 "${name}" 吗？`)) {
      onDeleteReward(id);
    }
  };

  // --- Edit Mode Overlay ---
  if (editingItem) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border-4 border-white/50 overflow-hidden flex flex-col max-h-[90vh] modal-content">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
            <h3 className="font-black text-xl text-slate-800">
              {rewards.find(r => r.id === editingItem.id) ? '✏️ 编辑商品' : '✨ 添加新商品'}
            </h3>
            <button
              onClick={() => setEditingItem(null)}
              className="p-2.5 hover:bg-slate-100 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="关闭"
            >
              <X size={24} className="text-slate-400" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex-1 overflow-hidden flex flex-col bg-slate-50">
            <div className="flex-1 overflow-y-auto p-6 space-y-8">

              {/* Name & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">商品名称</label>
                  <input
                    required
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-lg transition-all"
                    value={editingItem.name}
                    onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                    placeholder="例如：免作业卡"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-wider">价格 (🍖)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none font-bold text-lg text-center transition-all"
                    value={editingItem.cost}
                    onChange={e => setEditingItem({ ...editingItem, cost: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">描述说明</label>
                <textarea
                  className="w-full p-4 border-2 border-slate-200 rounded-2xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 outline-none resize-none h-24 text-sm font-medium transition-all"
                  value={editingItem.description}
                  onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
                  placeholder="这个奖品有什么作用..."
                />
              </div>

              {/* Colors */}
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">卡片配色</label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_OPTIONS.map(opt => {
                    const isSelected = editingItem.color === opt.value;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, color: opt.value })}
                        className={`
                                h-10 w-10 rounded-full flex items-center justify-center transition-all shadow-sm
                                ${opt.preview}
                                ${isSelected ? 'ring-4 ring-offset-2 ring-slate-300 scale-110 shadow-md' : 'opacity-60 hover:opacity-100 hover:scale-105'}
                              `}
                      >
                        {isSelected && <div className="w-3 h-3 rounded-full bg-white shadow-sm" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Icons */}
              <div className="space-y-4 pt-4 border-t-2 border-slate-200">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">选择图标</label>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {Object.entries(ICON_CATEGORIES).map(([key, cat]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveTab(key as any)}
                      className={`
                                px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all border-b-4 active:border-b-0 active:translate-y-1
                                ${activeTab === key
                          ? 'bg-indigo-500 border-indigo-700 text-white shadow-indigo-200'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}
                             `}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-5 min-[480px]:grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-3 h-48 overflow-y-auto p-2">
                  {displayedIcons.map(iconKey => {
                    const Icon = MASTER_ICON_MAP[iconKey];
                    if (!Icon) return null;
                    const isSelected = editingItem.icon === iconKey;
                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setEditingItem({ ...editingItem, icon: iconKey })}
                        className={`
                                aspect-square rounded-xl flex items-center justify-center transition-all
                                ${isSelected
                            ? 'bg-indigo-500 text-white shadow-lg scale-110 ring-4 ring-indigo-100'
                            : 'bg-white border-2 border-slate-100 text-slate-400 hover:border-indigo-200 hover:text-indigo-500 hover:shadow-md'}
                              `}
                      >
                        <Icon size={24} />
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 bg-white flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-8 py-3 bg-indigo-600 border-b-4 border-indigo-800 text-white font-black rounded-xl hover:bg-indigo-500 active:border-b-0 active:translate-y-1 transition-all flex items-center gap-2 shadow-lg shadow-indigo-200"
              >
                <Save size={20} /> 保存更改
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- Student Selection Overlay for Redemption ---
  if (selectingReward) {
    const rewardIcon = MASTER_ICON_MAP[selectingReward.icon] || Gift;
    const RewardIcon = rewardIcon;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-in fade-in">
        <div className="w-full max-w-2xl bg-white rounded-[32px] shadow-2xl border-4 border-white/50 overflow-hidden flex flex-col max-h-[90vh] modal-content">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-500">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                <RewardIcon size={28} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-xl text-white">选择兑换学生</h3>
                <p className="text-indigo-100 text-sm">
                  {selectingReward.name} · 需要 🍖×{selectingReward.cost}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectingReward(null)}
              className="p-2.5 hover:bg-white/20 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="关闭"
            >
              <X size={24} className="text-white" />
            </button>
          </div>


          <div className="flex-1 overflow-y-auto p-6">
            {/* Tip: 兑换不影响宠物成长 */}
            <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">💡</span>
              <p className="text-sm text-amber-800 font-medium">
                兑换奖品<strong>不会影响宠物成长</strong>！宠物成长只看累计获得的肉量，花掉的肉不会让宠物变小哦～放心兑换吧！
              </p>
            </div>
            {/* Search Bar */}
            <div className="mb-6 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜索学生姓名..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 font-bold text-slate-700 transition-all placeholder:font-normal min-h-[44px]"
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>

            {students.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-bold">暂无学生</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {students.filter(s => matchesSearch(s.name, searchTerm)).map(student => {
                  const info = getStudentFoodInfo(student.id);
                  const canAfford = info.available >= selectingReward.cost;

                  return (
                    <button
                      key={student.id}
                      type="button"
                      className={`
                        relative p-4 rounded-2xl border-2 transition-all cursor-pointer text-left w-full
                        ${canAfford
                          ? 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-lg group'
                          : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-80'}
                      `}
                      onClick={() => {
                        if (canAfford) {
                          setDialogState({
                            isOpen: true,
                            type: 'confirm',
                            title: '确认兑换',
                            message: `确定要为 ${student.name} 兑换 "${selectingReward.name}" 吗？\n\n🍖 将消耗 ${selectingReward.cost} 块肉\n\n💡 放心，兑换不会影响宠物成长哦！`,
                            onConfirm: () => {
                              onRedeem(selectingReward.id, student.id, selectingReward.cost);
                              setSelectingReward(null);
                              setSearchTerm('');
                              setDialogState(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        } else {
                          setDialogState({
                            isOpen: true,
                            type: 'alert',
                            title: '肉量不足',
                            message: `${student.name} 的肉量不足！\n\n当前可用: ${info.available} 🍖\n兑换需要: ${selectingReward.cost} 🍖\n\n请先通过加分获取更多肉！`,
                            onConfirm: () => setDialogState(prev => ({ ...prev, isOpen: false }))
                          });
                        }
                      }}
                    >
                      <div className="text-center">
                        <div className="font-black text-lg text-slate-700 truncate mb-2">
                          {student.name}
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          <div className={`
                            flex items-center gap-1 px-3 py-1 rounded-full text-sm font-black
                            ${canAfford ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-500'}
                          `}>
                            <span>🍖</span>
                            <span>{info.available}</span>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400 mt-2">
                          累计 🍖{info.totalEarned} · 已用 🍖{info.consumed}
                        </div>
                        {canAfford && (
                          <div className="mt-3 py-1.5 px-3 bg-indigo-500 text-white text-xs font-black rounded-full opacity-0 group-hover:opacity-100 transition-opacity inline-block">
                            点击兑换
                          </div>
                        )}
                        {!canAfford && (
                          <div className="mt-3 text-xs text-rose-400 font-bold">
                            肉量不足
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
            <button
              onClick={() => {
                setSelectingReward(null);
                setSearchTerm('');
              }}
              className="px-6 py-2 text-slate-500 font-bold hover:text-slate-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>

        {/* Custom Confirm Dialog */}
        <ConfirmDialog
          isOpen={dialogState.isOpen}
          title={dialogState.title}
          message={dialogState.message}
          type={dialogState.type}
          onConfirm={dialogState.onConfirm}
          onCancel={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-7xl bg-[#F0F4F8] rounded-[24px] sm:rounded-[40px] shadow-2xl overflow-hidden flex flex-col store-modal-height border-4 sm:border-[8px] border-white modal-content">

        {/* Header - 响应式布局 */}
        <div className="p-4 sm:p-6 border-b border-slate-200/60 bg-white shadow-sm z-20">
          {/* 第一行：标题和关闭按钮 */}
          <div className="flex justify-between items-center mb-3 sm:mb-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg transform rotate-3 transition-colors ${isEditMode ? 'bg-orange-500 text-white' : 'bg-indigo-500 text-white'}`}>
                {isEditMode ? <Settings2 className="w-6 h-6 sm:w-8 sm:h-8" /> : <Store className="w-6 h-6 sm:w-8 sm:h-8" />}
              </div>
              <div>
                <h2 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tighter">
                  {isEditMode ? '货架管理' : '小卖部'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-bold uppercase tracking-widest mt-0.5 sm:mt-1 opacity-60 hidden sm:block">
                  {isEditMode ? 'Store Manager' : '兑换不影响宠物成长，放心花肉吧！'}
                </p>
              </div>
            </div>

            {/* 关闭按钮 - 移动端始终显示在右上角 */}
            <button
              onClick={onClose}
              className="p-2.5 sm:p-3 bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-full transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="关闭"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>

          {/* 第二行：Tab切换和管理按钮 - 移动端水平滚动 */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
            {/* Tab Switcher */}
            <div className="flex bg-slate-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab('food')}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all min-h-[40px] ${activeTab !== 'history'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                商品列表
              </button>
              <button
                onClick={() => setActiveTab('history' as any)}
                className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1 sm:gap-1.5 min-h-[40px] ${activeTab === 'history'
                  ? 'bg-white text-orange-500 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
              >
                <HistoryIcon size={14} />
                <span className="hidden xs:inline">兑换</span>记录
              </button>
            </div>

            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`
                 flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs sm:text-sm border-b-4 active:border-b-0 active:translate-y-1 transition-all shrink-0 min-h-[40px]
                 ${isEditMode
                  ? 'bg-orange-100 border-orange-300 text-orange-600 hover:bg-orange-200'
                  : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200 hover:text-indigo-600'}
               `}
            >
              {isEditMode ? (
                <> <CheckIconLucide className="w-4 h-4" /> <span className="hidden sm:inline">完成</span>编辑 </>
              ) : (
                <> <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">管理</span>商品 </>
              )}
            </button>
          </div>
        </div>

        {/* Content Layout */}
        <div className={`flex-1 overflow-y-auto p-4 sm:p-8 ${isEditMode ? 'bg-orange-50/50' : 'bg-slate-100'}`}>

          {activeTab === 'history' ? (
            /* 兑换记录列表视图 */
            <div className="max-w-4xl mx-auto">
              {redeemHistory.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-4">
                    <HistoryIcon size={40} className="opacity-50" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-600">暂无兑换记录</h3>
                  <p className="text-sm mt-2">快去让同学们兑换奖励吧！</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {redeemHistory.map((record) => {
                    // Find actual reward item to get icon/color if possible (optional fallback)
                    const rewardItem = rewards.find(r => r.name === record.rewardName); // Fuzzy match by name if ID not stored or just use name
                    // Since history stores rewardName, we use that directly.

                    return (
                      <div key={record.id} className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold text-base sm:text-lg shrink-0">
                            {record.studentName.slice(0, 1)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-800 flex flex-wrap items-center gap-1 sm:gap-2 text-sm sm:text-base">
                              <span className="truncate">{record.studentName}</span>
                              <span className="text-slate-400 font-normal text-xs sm:text-sm">兑换了</span>
                              <span className="text-indigo-600 truncate">{record.rewardName || '已删除商品'}</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">
                              {new Date(record.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 bg-slate-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-100 shrink-0 ml-2">
                          <span>🍖</span>
                          <span className="font-black text-slate-600 text-sm">{record.cost}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* 商品网格视图 (默认) - 优化响应式 */
            <div className="grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
              {rewards.map((item: RewardItem) => {
                const Icon = MASTER_ICON_MAP[item.icon] || Gift;
                const currentStock = inventory[item.id] !== undefined ? inventory[item.id] : 0;
                const hasStock = currentStock > 0;
                const theme = getTheme(item.color);

                return (
                  <div
                    key={item.id}
                    className={`
                        relative group flex flex-col rounded-[28px] overflow-hidden transition-all duration-300 ring-4 ring-white
                        ${isEditMode
                        ? 'bg-white border-2 border-dashed border-slate-300 hover:border-orange-400 scale-[0.98]'
                        : `${theme.bg} ${theme.shadow} shadow-lg hover:shadow-xl hover:-translate-y-1`}
                      `}
                  >
                    {/* Visual Body (Top) */}
                    <div className={`relative flex-1 flex flex-col items-center justify-center ${isEditMode ? 'p-4 sm:p-5 min-h-[100px] sm:min-h-[130px]' : 'p-5 min-h-[140px]'}`}>
                      {/* Background Decor */}
                      <div className="absolute inset-0 bg-white/20" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white/40 rounded-full blur-xl pointer-events-none" />

                      {/* Floating Icon */}
                      <div className={`
                          relative z-10 ${isEditMode ? 'w-16 h-16 sm:w-20 sm:h-20' : 'w-20 h-20'} rounded-full flex items-center justify-center shadow-sm backdrop-blur-sm group-hover:scale-110 transition-transform duration-300
                          ${theme.iconBg} ${theme.text}
                        `}>
                        <Icon className={isEditMode ? 'w-8 h-8 sm:w-10 sm:h-10' : 'w-10 h-10'} strokeWidth={2.5} />
                      </div>

                      {/* Price Tag Badge */}
                      <div className={`absolute top-2 right-2 sm:top-3 sm:right-3 bg-gradient-to-br from-amber-400 to-yellow-500 ${isEditMode ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} rounded-full font-black flex items-center gap-1 sm:gap-1.5 shadow-lg shadow-amber-200/50 z-20 text-white`}>
                        <span>🍖</span>
                        <span>{item.cost}</span>
                      </div>
                    </div>

                    {/* Info Body (Bottom) */}
                    <div className={`relative z-10 ${isEditMode ? 'p-3 sm:p-4' : 'p-4'} bg-white/60 backdrop-blur-md border-t border-white/50 flex flex-col gap-1.5 sm:gap-2 rounded-b-[24px]`}>
                      <div className="text-center">
                        <h4 className={`font-black ${isEditMode ? 'text-base' : 'text-lg'} leading-tight truncate ${theme.text}`}>{item.name}</h4>
                        {!isEditMode && (
                          <p className={`text-[10px] font-bold mt-1 line-clamp-1 ${theme.subtext}`}>
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-1 sm:mt-2">
                        {isEditMode ? (
                          <div className="space-y-1.5">
                            {/* 库存管理 */}
                            <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-1.5 border border-slate-200">
                              <Package size={13} className="text-slate-400 shrink-0" />
                              <span className="text-[11px] font-bold text-slate-500 shrink-0">库存</span>
                              <div className="flex items-center ml-auto">
                                <button
                                  onClick={() => onRestock(item.id, -1)}
                                  disabled={!hasStock}
                                  className="w-7 h-7 flex items-center justify-center rounded-l-lg border border-slate-200 bg-white hover:bg-red-50 hover:text-red-600 text-slate-400 disabled:opacity-30 transition-colors"
                                >
                                  <Minus size={13} />
                                </button>
                                <input
                                  type="number"
                                  min="0"
                                  value={currentStock}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value);
                                    if (!isNaN(val) && val >= 0) {
                                      onRestock(item.id, val - currentStock);
                                    }
                                  }}
                                  className="w-10 sm:w-12 h-7 text-center text-xs font-black border-y border-slate-200 bg-white outline-none focus:bg-indigo-50 focus:text-indigo-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  onClick={() => onRestock(item.id, 1)}
                                  className="w-7 h-7 flex items-center justify-center rounded-r-lg border border-slate-200 bg-white hover:bg-green-50 hover:text-green-600 text-slate-400 transition-colors"
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            </div>
                            {/* 编辑和删除按钮 */}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleEditStart(item)}
                                className="flex-1 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white border border-slate-200 text-slate-500 font-bold text-[11px] sm:text-xs hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center gap-1 min-h-[32px] sm:min-h-[40px]"
                              >
                                <Pencil size={11} /> 编辑
                              </button>
                              <button
                                onClick={() => handleDeleteClick(item.id, item.name)}
                                className="w-8 sm:w-10 min-h-[32px] sm:min-h-[40px] flex items-center justify-center rounded-lg sm:rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* 兑换模式：只显示库存状态和兑换按钮 */
                          <div className="flex items-center gap-2">
                            {/* 库存显示（只读） */}
                            <div className="flex items-center gap-1.5 bg-white/50 rounded-lg px-2.5 py-1.5 border border-white/50">
                              <Package size={12} className="text-slate-400" />
                              <span className={`text-xs font-black ${hasStock ? 'text-slate-600' : 'text-red-500'}`}>
                                {hasStock ? currentStock : '缺货'}
                              </span>
                            </div>


                            {/* 兑换按钮 */}
                            <button
                              onClick={() => setSelectingReward(item)}
                              disabled={!hasStock}
                              className={`
                                  flex-1 h-10 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 shadow-sm
                                  active:scale-95
                                  ${hasStock
                                  ? `${theme.button} ${theme.buttonText} hover:shadow-lg hover:-translate-y-0.5`
                                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }
                                `}
                            >
                              {hasStock ? '立即兑换' : '缺货中'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Add New Button Card */}
              {isEditMode && (
                <button
                  onClick={handleAddNew}
                  className="flex flex-col items-center justify-center min-h-[300px] rounded-[28px] border-4 border-dashed border-slate-300 bg-slate-50/50 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/30 transition-all gap-4 group ring-4 ring-transparent"
                >
                  <div className="w-20 h-20 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Plus size={40} className="text-slate-300 group-hover:text-indigo-500" />
                  </div>
                  <span className="font-black text-xl">添加新商品</span>
                </button>
              )}
            </div>
          )}

          {/* Empty State */}
          {!isEditMode && rewards.length === 0 && activeTab !== 'history' && (
            <div className="flex flex-col items-center justify-center h-[50vh] text-slate-400">
              <div className="bg-white p-6 rounded-full shadow-lg mb-6">
                <Package size={64} className="text-indigo-200" />
              </div>
              <h3 className="text-2xl font-black text-slate-700 mb-2">货架空空如也</h3>
              <p className="font-medium text-slate-500 mb-6">老师还没有上架任何奖品哦</p>
              <button onClick={() => setIsEditMode(true)} className="px-8 py-3 bg-indigo-500 text-white font-black rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-600 transition-colors">
                我是老师，去进货
              </button>
            </div>
          )}

          <div className="h-20 safe-area-bottom"></div>
        </div>
      </div>
    </div>
  );
};
