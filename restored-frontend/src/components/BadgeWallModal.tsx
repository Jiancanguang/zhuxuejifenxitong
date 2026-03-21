import React, { useEffect, useMemo, useState } from 'react';
import { X, Award, ShoppingBag, TrendingUp } from 'lucide-react';
import { Badge, HistoryRecord } from '../types';
import { getPetById, getPetImagePath } from '../constants';

interface BadgeWallModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  badges: Badge[];
  redemptions: HistoryRecord[];
  foodCount?: number;
  spentFood?: number;
  onExportCertificate?: () => void;
  onExportSticker?: () => void;
}

export const BadgeWallModal: React.FC<BadgeWallModalProps> = ({
  isOpen,
  onClose,
  studentName,
  badges,
  redemptions,
  foodCount = 0,
  spentFood = 0,
  onExportCertificate,
  onExportSticker,
}) => {
  const stats = useMemo(() => {
    const totalEarned = foodCount;
    const consumed = spentFood;
    const remaining = Math.max(0, totalEarned - consumed);
    return { totalEarned, consumed, remaining };
  }, [foodCount, spentFood]);

  const sortedRedemptions = useMemo(
    () => [...redemptions].sort((a, b) => b.timestamp - a.timestamp),
    [redemptions]
  );

  const [previewBadge, setPreviewBadge] = useState<{ badge: Badge; index: number } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setPreviewBadge(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!previewBadge) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewBadge(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [previewBadge]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-content">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-amber-400 to-yellow-500">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Award className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{studentName} 的徽章墙</h2>
              <p className="text-yellow-100 text-sm">Badge Wall</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="p-6 bg-gradient-to-b from-amber-50 to-white">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-100 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-amber-100 flex items-center justify-center text-2xl">
                🍖
              </div>
              <div className="text-3xl font-black text-amber-600">{stats.totalEarned}</div>
              <div className="text-xs font-bold text-slate-400 mt-1">累计获得</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-100 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-rose-100 flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-rose-500" />
              </div>
              <div className="text-3xl font-black text-rose-600">{stats.consumed}</div>
              <div className="text-xs font-bold text-slate-400 mt-1">已消耗</div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-emerald-100 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="text-3xl font-black text-emerald-600">{stats.remaining}</div>
              <div className="text-xs font-bold text-slate-400 mt-1">可兑换</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Badges Section */}
          <div className="mb-8">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Award size={16} /> 获得的徽章
            </h3>
            {badges.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <Award size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">还没有获得徽章</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                {badges.map((badge, index) => {
                  const pet = getPetById(badge.petId);
                  const badgeName = badge.petName?.trim() || pet?.name || '未命名宠物';
                  return (
                    <button
                      type="button"
                      key={badge.id}
                      onClick={() => setPreviewBadge({ badge, index })}
                      className="group block text-left bg-gradient-to-br from-amber-50 to-yellow-100 rounded-2xl p-2 border-2 border-amber-200 shadow-sm hover:shadow-md hover:scale-105 transition-all"
                    >
                      <div className="relative aspect-square">
                        <img
                          src={getPetImagePath(badge.petId, 10)}
                          alt={badgeName}
                          className="w-full h-full object-contain"
                          draggable={false}
                        />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-sm">
                          {index + 1}
                        </div>
                      </div>
                      <div className="mt-1 px-1">
                        <p className="text-[11px] sm:text-xs font-bold text-slate-700 truncate text-center" title={badgeName}>
                          {badgeName}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Redemption History Section */}
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShoppingBag size={16} /> 兑换记录
            </h3>
            {redemptions.length === 0 ? (
              <div className="text-center py-8 text-slate-300">
                <ShoppingBag size={48} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">还没有兑换记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedRedemptions.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                        <ShoppingBag size={18} className="text-indigo-500" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-700">{record.rewardName || '已删除商品'}</div>
                        <div className="text-xs text-slate-400">
                          {new Date(record.timestamp).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-rose-500 font-black">
                      <span>🍖</span>
                      <span>-{record.cost || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100">
          {(onExportCertificate || onExportSticker) && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
              {onExportCertificate && (
                <button
                  onClick={onExportCertificate}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition-colors min-h-[44px]"
                >
                  导出证书
                </button>
              )}
              {onExportSticker && (
                <button
                  onClick={onExportSticker}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-colors min-h-[44px]"
                >
                  导出贴纸
                </button>
              )}
            </div>
          )}
          <div className="text-center">
          <p className="text-sm text-slate-400">
            继续努力，获取更多肉来兑换奖品吧！
          </p>
          </div>
        </div>
      </div>

      {previewBadge && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewBadge(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="text-sm font-bold text-slate-500">第 {previewBadge.index + 1} 枚徽章</div>
              <button
                type="button"
                onClick={() => setPreviewBadge(null)}
                className="touch-target p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-5">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-200 p-4">
                <img
                  src={getPetImagePath(previewBadge.badge.petId, 10)}
                  alt={previewBadge.badge.petName || '宠物徽章'}
                  className="w-full h-full object-contain"
                  draggable={false}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-xl font-black text-slate-800">
                  {previewBadge.badge.petName?.trim() || getPetById(previewBadge.badge.petId)?.name || '未命名宠物'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  获得于 {new Date(previewBadge.badge.earnedAt).toLocaleString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeWallModal;
