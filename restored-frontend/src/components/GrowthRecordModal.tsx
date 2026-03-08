
import React, { useMemo, useState } from 'react';
import { X, Calendar, CheckCircle2, Medal, Sparkles, ShoppingBag, Download, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Zap, Undo2 } from 'lucide-react';
import { HistoryRecord } from '../types';
import { getPetById } from '../constants';

interface GrowthRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryRecord[];
  onClearAll: () => void;
  onClearFirst: (count: number) => void;
}

const RECORDS_PER_PAGE = 50; // 每页显示50条记录

export const GrowthRecordModal: React.FC<GrowthRecordModalProps> = ({
  isOpen,
  onClose,
  history,
  onClearAll,
  onClearFirst,
}) => {
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearCount, setClearCount] = useState('100');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  // 优化：先排序，再分页，避免一次性渲染所有记录
  const { sortedHistory, totalPages, paginatedHistory } = useMemo(() => {
    // Sort descending first
    const sorted = [...history].sort((a, b) => b.timestamp - a.timestamp);
    const total = Math.ceil(sorted.length / RECORDS_PER_PAGE);
    const start = (currentPage - 1) * RECORDS_PER_PAGE;
    const end = start + RECORDS_PER_PAGE;
    const paginated = sorted.slice(start, end);

    return {
      sortedHistory: sorted,
      totalPages: total,
      paginatedHistory: paginated
    };
  }, [history, currentPage]);

  // Group only the paginated history
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryRecord[]> = {};
    paginatedHistory.forEach(record => {
      const date = new Date(record.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(record);
    });
    return groups;
  }, [paginatedHistory]);

  const dates = Object.keys(groupedHistory);

  const handleExport = () => {
    // 导出所有记录，而非仅当前页
    const exportData = sortedHistory.map(record => {
      const scoreValue = record.scoreValue ?? 1;
      const scoreDisplay = scoreValue > 0 ? `+${scoreValue}` : `${scoreValue}`;

      let type = '加分';
      let detail = '';

      if (record.type === 'graduate') {
        type = '毕业';
        detail = '完成养成';
      } else if (record.type === 'rename') {
        type = '改名';
        const petName = getPetById(record.petId)?.name || '宠物';
        const fromName = record.renameFrom || petName;
        detail = `${petName}改名「${fromName}」->「${record.renameTo || ''}」`;
      } else if (record.type === 'redeem') {
        type = '兑换';
        detail = `兑换${record.rewardName || '已删除商品'}(-${record.cost}徽章)`;
      } else if (record.type === 'revoke') {
        type = '撤回';
        const revokedValue = record.revokedScoreValue ?? 1;
        detail = `撤回: ${record.revokedScoreItemName || '操作'}(${revokedValue > 0 ? '-' : '+'}${Math.abs(revokedValue)}🍖)`;
      } else {
        type = scoreValue < 0 ? '扣分' : '加分';
        detail = `${record.scoreItemName || '打卡'}(${scoreDisplay}🍖)`;
      }

      return {
        时间: new Date(record.timestamp).toLocaleString(),
        学生: record.studentName,
        类型: type,
        详情: detail,
      };
    });

    if (exportData.length === 0) return;

    const csv = [
      Object.keys(exportData[0]).join(','),
      ...exportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `成长记录_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const handleClearFirst = () => {
    const count = parseInt(clearCount);
    if (isNaN(count) || count <= 0) {
      alert('请输入有效的数字');
      return;
    }
    if (count > history.length) {
      alert(`当前只有 ${history.length} 条记录`);
      return;
    }
    setConfirmDialog({
      show: true,
      title: '确认删除',
      message: `确定要删除最早的 ${count} 条记录吗？此操作不可撤销。`,
      onConfirm: () => {
        onClearFirst(count);
        setCurrentPage(1);
        setShowClearDialog(false);
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
      },
    });
  };

  const handleClearAll = () => {
    setConfirmDialog({
      show: true,
      title: '确认清空',
      message: `确定要清空全部 ${history.length} 条记录吗？此操作不可撤销！`,
      onConfirm: () => {
        onClearAll();
        setCurrentPage(1);
        setShowClearDialog(false);
        setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
      },
    });
  };

  const getRecordIcon = (type: string, scoreValue?: number) => {
    switch (type) {
      case 'graduate': return <Medal size={16} />;
      case 'rename': return <Sparkles size={16} />;
      case 'redeem': return <ShoppingBag size={16} />;
      case 'revoke': return <Undo2 size={16} />;
      default:
        // 加分/扣分显示不同图标
        return scoreValue && scoreValue < 0 ? <Zap size={16} /> : <CheckCircle2 size={16} />;
    }
  };

  const getRecordStyles = (type: string, scoreValue?: number) => {
    switch (type) {
      case 'graduate': return 'bg-yellow-100 text-yellow-600';
      case 'rename': return 'bg-violet-100 text-violet-600';
      case 'redeem': return 'bg-indigo-100 text-indigo-600';
      case 'revoke': return 'bg-slate-200 text-slate-500';
      default:
        // 加分/扣分显示不同颜色
        return scoreValue && scoreValue < 0
          ? 'bg-rose-100 text-rose-600'
          : 'bg-emerald-100 text-emerald-600';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] modal-content">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">成长记录</h2>
              <p className="text-xs text-slate-500">
                {history.length}/10000 条记录
                {history.length >= 10000 && <span className="text-red-500 ml-1">已满！</span>}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-b border-slate-100 flex gap-2 bg-white">
          <button
            onClick={handleExport}
            disabled={history.length === 0}
            className="flex-1 px-3 py-2 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            <Download size={16} />
            导出CSV
          </button>
          <button
            onClick={() => setShowClearDialog(true)}
            disabled={history.length === 0}
            className="flex-1 px-3 py-2 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
          >
            <Trash2 size={16} />
            清理记录
          </button>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
            <div className="text-xs text-slate-500">
              第 {currentPage}/{totalPages} 页 · 共 {history.length} 条记录
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="touch-target p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} className="text-slate-600" />
              </button>
              <div className="text-xs font-bold text-slate-700 min-w-[60px] text-center">
                {currentPage} / {totalPages}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="touch-target p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} className="text-slate-600" />
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Calendar className="w-12 h-12 mb-3 opacity-20" />
              <p>还没有记录哦，快去打卡吧！</p>
            </div>
          ) : (
            dates.map(date => (
              <div key={date} className="animate-in slide-in-from-bottom-2 duration-500">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <div className="h-px flex-1 bg-slate-200"></div>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-slate-200"></div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  {groupedHistory[date].map((record, index) => {
                    const time = new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const isLast = index === groupedHistory[date].length - 1;

                    return (
                      <div
                        key={record.id}
                        className={`flex items-center gap-2.5 sm:gap-4 p-3 sm:p-4 ${!isLast ? 'border-b border-slate-100' : ''}`}
                      >
                        <div className="w-10 sm:w-12 text-[11px] sm:text-xs font-mono text-slate-400 text-right shrink-0">
                          {time}
                        </div>

                        <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center shrink-0
                            ${getRecordStyles(record.type, record.scoreValue)}
                          `}>
                          {getRecordIcon(record.type, record.scoreValue)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800">
                            <span className="font-bold text-slate-900">{record.studentName}</span>
                            {record.type === 'graduate' && (
                              <span className="ml-1 text-yellow-600 font-medium">完成了养成！🎉</span>
                            )}
                            {record.type === 'rename' && (
                              <span className="ml-1 text-violet-600 font-medium">
                                {`${getPetById(record.petId)?.name || '宠物'}改名「${record.renameFrom || getPetById(record.petId)?.name || '宠物'}」->「${record.renameTo || ''}」`}
                              </span>
                            )}
                            {record.type === 'redeem' && (
                              <span className="ml-1 text-indigo-600 font-medium">
                                兑换: {record.rewardName || '已删除商品'}
                                <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded ml-1 text-slate-500">
                                  -{record.cost || 0}徽章
                                </span>
                              </span>
                            )}
                            {record.type === 'revoke' && (
                              <span className="ml-1 text-slate-500 font-medium">
                                <span className="text-slate-400">撤回了</span>
                                <span className="ml-1">{record.revokedScoreItemName || '操作'}</span>
                                {record.revokedScoreValue != null && (
                                  <span className="ml-1 font-bold px-1.5 rounded text-slate-500 bg-slate-100">
                                    {record.revokedScoreValue > 0 ? '-' : '+'}{Math.abs(record.revokedScoreValue)}🍖
                                  </span>
                                )}
                              </span>
                            )}
                            {record.type === 'checkin' && (
                              <>
                                {record.scoreItemName ? (
                                  <>
                                    <span className="ml-1 text-slate-500">{record.scoreItemName}</span>
                                    <span className={`ml-1 font-bold px-1.5 rounded ${(record.scoreValue ?? 1) < 0
                                        ? 'text-rose-600 bg-rose-100'
                                        : 'text-emerald-600 bg-emerald-100'
                                      }`}>
                                      {(record.scoreValue ?? 1) > 0 ? '+' : ''}{record.scoreValue ?? 1}🍖
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="ml-1 text-slate-500">完成了</span>
                                    <span className="ml-1 font-bold text-slate-600 bg-slate-100 px-1.5 rounded">{record.taskName || '打卡'}</span>
                                  </>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Clear Dialog */}
      {showClearDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">清理记录</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  删除前 X 条记录：
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={clearCount}
                    onChange={(e) => setClearCount(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                    placeholder="输入数量"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClearFirst();
                    }}
                    className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700"
                  >
                    删除
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">将删除最早的记录</p>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleClearAll();
                  }}
                  className="w-full px-4 py-3 bg-red-50 text-red-600 font-bold rounded-lg hover:bg-red-100 border-2 border-red-200 transition-colors"
                >
                  清空全部记录
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowClearDialog(false)}
                className="w-full px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">{confirmDialog.title}</h3>
            </div>

            <p className="text-slate-600 mb-6">{confirmDialog.message}</p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog({ show: false, title: '', message: '', onConfirm: () => { } });
                }}
                className="flex-1 px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-lg hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => confirmDialog.onConfirm()}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-colors"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
