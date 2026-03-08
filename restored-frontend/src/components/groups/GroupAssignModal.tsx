import React, { useEffect, useMemo, useState } from 'react';
import { X, Check } from 'lucide-react';
import { Group } from '../../types';
import { getGroupColorStyle } from '../../lib/group';

interface GroupAssignModalProps {
  isOpen: boolean;
  title: string;
  groups: Group[];
  currentGroupId: string | null;
  allowNoChangeOption?: boolean;
  onClose: () => void;
  onSubmit: (groupId: string | null) => Promise<void> | void;
}

const NO_CHANGE_VALUE = '__no_change__';

export const GroupAssignModal: React.FC<GroupAssignModalProps> = ({
  isOpen,
  title,
  groups,
  currentGroupId,
  allowNoChangeOption = false,
  onClose,
  onSubmit,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null | typeof NO_CHANGE_VALUE>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setSelectedGroupId(allowNoChangeOption ? NO_CHANGE_VALUE : (currentGroupId ?? null));
    setError('');
  }, [isOpen, currentGroupId, allowNoChangeOption]);

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden modal-content">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800">设置所属分组</h3>
            <p className="text-xs text-slate-500 mt-1">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors"
            disabled={isSaving}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {error && (
            <div className="mb-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
              {error}
            </div>
          )}
          {allowNoChangeOption && (
            <button
              onClick={() => setSelectedGroupId(NO_CHANGE_VALUE)}
              className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors min-h-[44px] ${
                selectedGroupId === NO_CHANGE_VALUE
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <div className="text-left">
                <p className="font-bold text-slate-700">保持不变</p>
                <p className="text-xs text-slate-500">不修改已选学生当前分组</p>
              </div>
              {selectedGroupId === NO_CHANGE_VALUE && <Check size={18} className="text-indigo-600" />}
            </button>
          )}
          <button
            onClick={() => setSelectedGroupId(null)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors min-h-[44px] ${
              selectedGroupId === null
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="text-left">
              <p className="font-bold text-slate-700">无分组</p>
              <p className="text-xs text-slate-500">移出当前分组</p>
            </div>
            {selectedGroupId === null && <Check size={18} className="text-indigo-600" />}
          </button>

          {sortedGroups.map(group => {
            const color = getGroupColorStyle(group.colorToken);
            const selected = selectedGroupId === group.id;
            return (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors min-h-[44px] ${
                  selected
                    ? 'border-indigo-400 bg-indigo-50'
                    : `border-slate-200 hover:bg-slate-50`
                }`}
              >
                <div className="text-left flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${color.dotClass}`} />
                  <p className="font-bold text-slate-700">{group.name}</p>
                </div>
                {selected && <Check size={18} className="text-indigo-600" />}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 safe-area-bottom">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={async () => {
              if (allowNoChangeOption && selectedGroupId === NO_CHANGE_VALUE) {
                setError('请选择目标分组后再保存');
                return;
              }
              setIsSaving(true);
              setError('');
              try {
                await onSubmit(selectedGroupId as string | null);
                onClose();
              } catch (err: any) {
                setError(err?.message || '保存失败，请重试');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving || (allowNoChangeOption && selectedGroupId === NO_CHANGE_VALUE)}
            className="px-4 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {isSaving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupAssignModal;
