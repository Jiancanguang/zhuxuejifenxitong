import React, { useMemo } from 'react';
import { Group } from '../../types';
import { getGroupColorStyle } from '../../lib/group';

export type GroupFilterValue = 'all' | 'ungrouped' | string;

interface GroupFilterBarProps {
  groups: Group[];
  activeFilter: GroupFilterValue;
  isBatchMode: boolean;
  showUngrouped: boolean;
  getCountByGroupId: (groupId: string | null) => number;
  isBatchSelected: (filterKey: GroupFilterValue) => boolean;
  onFilterClick: (filterKey: GroupFilterValue) => void;
  onBatchClick: (filterKey: GroupFilterValue) => void;
}

export const GroupFilterBar: React.FC<GroupFilterBarProps> = ({
  groups,
  activeFilter,
  isBatchMode,
  showUngrouped,
  getCountByGroupId,
  isBatchSelected,
  onFilterClick,
  onBatchClick,
}) => {
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups]
  );

  const renderButton = (
    key: GroupFilterValue,
    label: string,
    count: number,
    colorDotClass?: string
  ) => {
    const active = isBatchMode ? isBatchSelected(key) : activeFilter === key;
    return (
      <button
        key={key}
        onClick={() => (isBatchMode ? onBatchClick(key) : onFilterClick(key))}
        className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full border text-[11px] sm:text-xs font-semibold transition-colors flex items-center gap-1 sm:gap-1.5 whitespace-nowrap snap-start ${active
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 active:bg-slate-100'
          }`}
      >
        {colorDotClass && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : colorDotClass}`} />}
        <span>{label}</span>
        <span className={`hidden min-[360px]:inline-flex px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-xs font-bold text-slate-500">
          {isBatchMode ? (
            <><span className="sm:hidden">批量选择</span><span className="hidden sm:inline">按组批量选择（当前筛选保持不变）</span></>
          ) : '按分组筛选'}
        </p>
      </div>
      <div className="relative">
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-proximity -mx-1 px-1">
          {renderButton('all', '全部', getCountByGroupId(null) + sortedGroups.reduce((sum, g) => sum + getCountByGroupId(g.id), 0))}
          {sortedGroups.map(group => {
            const style = getGroupColorStyle(group.colorToken);
            return renderButton(group.id, group.name, getCountByGroupId(group.id), style.dotClass);
          })}
          {showUngrouped && renderButton('ungrouped', '未分组', getCountByGroupId(null))}
        </div>
        {/* 右侧渐变遮罩提示：当分组较多时暗示可以横向滚动 */}
        {sortedGroups.length > 3 && (
          <div className="absolute right-0 top-0 bottom-2 w-6 bg-gradient-to-l from-white/80 to-transparent pointer-events-none sm:hidden" />
        )}
      </div>
    </div>
  );
};

export default GroupFilterBar;
