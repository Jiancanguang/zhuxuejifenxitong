import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Pencil, Trash2, GripVertical, Shuffle, ArrowUp, ArrowDown, Check, UserPlus } from 'lucide-react';
import { Group, Student } from '../../types';
import { getGroupColorStyle } from '../../lib/group';
import { ConfirmDialog } from '../ConfirmDialog';

interface GroupManagerModalProps {
  isOpen: boolean;
  groups: Group[];
  students: Student[];
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (groupId: string, data: { name?: string }) => Promise<void>;
  onDelete: (groupId: string) => Promise<{ affectedStudents: number }>;
  onReorder: (orderedGroupIds: string[]) => Promise<void>;
  onRandom: (groupCount: number) => Promise<void>;
  onAssignStudents: (groupId: string, studentIds: string[]) => Promise<void>;
}

const MAX_GROUPS = 50;
type ConfirmAction =
  | { type: 'delete'; group: Group; affectedStudents: number }
  | { type: 'random'; groupCount: number }
  | null;

export const GroupManagerModal: React.FC<GroupManagerModalProps> = ({
  isOpen,
  groups,
  students,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onReorder,
  onRandom,
  onAssignStudents,
}) => {
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.sortOrder - b.sortOrder),
    [groups]
  );
  const groupsById = useMemo(
    () =>
      groups.reduce<Record<string, Group>>((map, group) => {
        map[group.id] = group;
        return map;
      }, {}),
    [groups]
  );
  const studentCountByGroup = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach(student => {
      if (!student.groupId) return;
      map[student.groupId] = (map[student.groupId] || 0) + 1;
    });
    return map;
  }, [students]);

  const [orderedGroups, setOrderedGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [groupCountInput, setGroupCountInput] = useState('2');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [assigningGroupId, setAssigningGroupId] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignOnlyUngrouped, setAssignOnlyUngrouped] = useState(false);
  const [selectedAssignStudentIds, setSelectedAssignStudentIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setOrderedGroups(sortedGroups);
    setError('');
    setConfirmAction(null);
    setAssigningGroupId(null);
    setAssignSearch('');
    setAssignOnlyUngrouped(false);
    setSelectedAssignStudentIds(new Set());
    const safeCount = Math.min(Math.max(2, sortedGroups.length || 2), Math.max(2, students.length));
    setGroupCountInput(String(safeCount));
  }, [isOpen, sortedGroups, students.length]);

  const assignTargetGroup = useMemo(
    () => orderedGroups.find(group => group.id === assigningGroupId) || null,
    [orderedGroups, assigningGroupId]
  );

  const assignCandidates = useMemo(() => {
    if (!assigningGroupId) return [] as Student[];
    const searchTerm = assignSearch.trim().toLowerCase();

    return students
      .filter(student => {
        if (student.groupId === assigningGroupId) return false;
        if (assignOnlyUngrouped && !!student.groupId) return false;
        if (!searchTerm) return true;
        return student.name.toLowerCase().includes(searchTerm);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [students, assigningGroupId, assignOnlyUngrouped, assignSearch]);

  useEffect(() => {
    setSelectedAssignStudentIds(new Set());
    setAssignSearch('');
  }, [assigningGroupId]);

  const toggleAssignStudent = (studentId: string) => {
    setSelectedAssignStudentIds(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleSelectAllAssignCandidates = () => {
    if (assignCandidates.length === 0) return;
    setSelectedAssignStudentIds(prev => {
      const next = new Set(prev);
      const allSelected = assignCandidates.every(student => next.has(student.id));
      if (allSelected) {
        assignCandidates.forEach(student => next.delete(student.id));
      } else {
        assignCandidates.forEach(student => next.add(student.id));
      }
      return next;
    });
  };

  const handleAssignStudentsSubmit = async () => {
    if (!assigningGroupId || !assignTargetGroup) {
      setError('请先选择目标分组');
      return;
    }
    const studentIds = [...selectedAssignStudentIds];
    if (studentIds.length === 0) {
      setError('请先勾选至少 1 位学生');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onAssignStudents(assigningGroupId, studentIds);
      setSelectedAssignStudentIds(new Set());
      setAssignSearch('');
      setAssignOnlyUngrouped(false);
      setAssigningGroupId(null);
    } catch (err: any) {
      setError(err?.message || '添加学生失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const applyReorder = async (nextGroups: Group[]) => {
    const previous = orderedGroups;
    setOrderedGroups(nextGroups);
    setIsSaving(true);
    setError('');
    try {
      await onReorder(nextGroups.map(group => group.id));
    } catch (err: any) {
      setOrderedGroups(previous);
      setError(err?.message || '保存排序失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const moveGroup = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedGroups.length) return;
    const next = [...orderedGroups];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await applyReorder(next);
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      setError('请输入分组名称');
      return;
    }
    if (name.length > 20) {
      setError('分组名称最多 20 个字符');
      return;
    }
    if (groups.length >= MAX_GROUPS) {
      setError(`每个班级最多 ${MAX_GROUPS} 个分组`);
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onCreate(name);
      setNewName('');
    } catch (err: any) {
      setError(err?.message || '创建分组失败');
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (group: Group) => {
    setEditingId(group.id);
    setEditingName(group.name);
    setError('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const name = editingName.trim();
    if (!name) {
      setError('分组名称不能为空');
      return;
    }
    if (name.length > 20) {
      setError('分组名称最多 20 个字符');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await onUpdate(editingId, { name });
      setEditingId(null);
      setEditingName('');
    } catch (err: any) {
      setError(err?.message || '更新分组失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (group: Group) => {
    const affected = studentCountByGroup[group.id] || 0;
    setConfirmAction({ type: 'delete', group, affectedStudents: affected });
  };

  const executeDelete = async (group: Group) => {
    setIsSaving(true);
    setError('');
    try {
      await onDelete(group.id);
      setOrderedGroups(prev => prev.filter(item => item.id !== group.id));
      setConfirmAction(null);
    } catch (err: any) {
      setError(err?.message || '删除分组失败');
    } finally {
      setIsSaving(false);
    }
  };

  const executeRandomGroup = async (groupCount: number) => {
    setIsSaving(true);
    setError('');
    try {
      await onRandom(groupCount);
      setConfirmAction(null);
    } catch (err: any) {
      setError(err?.message || '随机分组失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomGroup = async () => {
    const groupCount = Number(groupCountInput);
    if (!Number.isInteger(groupCount) || groupCount < 2 || groupCount > MAX_GROUPS) {
      setError(`分组数量需要在 2 到 ${MAX_GROUPS} 之间`);
      return;
    }
    if (students.length === 0) {
      setError('当前班级暂无学生');
      return;
    }
    if (students.length < 2) {
      setError('至少需要 2 名学生才能随机分组');
      return;
    }
    if (groupCount > students.length) {
      setError('分组数量不能超过学生总数');
      return;
    }
    if (groups.length > 0) {
      setConfirmAction({ type: 'random', groupCount });
      return;
    }
    await executeRandomGroup(groupCount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col modal-content">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-xl font-black text-slate-800">分组管理</h2>
            <p className="text-xs text-slate-500 mt-1">共 {groups.length} 个分组，最多 {MAX_GROUPS} 个</p>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
            disabled={isSaving}
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-700">
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">新建分组</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入分组名称（1-20字）"
                className="flex-1 min-w-[140px] sm:min-w-[220px] px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={isSaving || groups.length >= MAX_GROUPS}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <span className="inline-flex items-center gap-1">
                  <Plus size={16} />
                  添加
                </span>
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">分组列表</h3>
              <p className="text-xs text-slate-400 hidden sm:block">拖动左侧手柄或使用上下按钮</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {orderedGroups.length === 0 && (
                <div className="p-8 text-center text-slate-400">暂无分组，请先创建</div>
              )}

              {orderedGroups.map((group, index) => {
                const style = getGroupColorStyle(group.colorToken);
                const memberCount = studentCountByGroup[group.id] || 0;
                const isEditing = editingId === group.id;

                return (
                  <div
                    key={group.id}
                    className={`p-3 bg-white ${draggingId === group.id ? 'opacity-60' : ''}`}
                    draggable={!isSaving}
                    onDragStart={() => setDraggingId(group.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={async () => {
                      if (!draggingId || draggingId === group.id) return;
                      const fromIndex = orderedGroups.findIndex(item => item.id === draggingId);
                      const toIndex = orderedGroups.findIndex(item => item.id === group.id);
                      if (fromIndex === -1 || toIndex === -1) return;
                      const next = [...orderedGroups];
                      const [moved] = next.splice(fromIndex, 1);
                      next.splice(toIndex, 0, moved);
                      setDraggingId(null);
                      await applyReorder(next);
                    }}
                    onDragEnd={() => setDraggingId(null)}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 min-w-[120px] px-3 py-2 border border-indigo-300 rounded-lg outline-none"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={saveEdit}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold min-h-[44px]"
                          >
                            完成
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold min-h-[44px]"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button className="p-1 rounded text-slate-400 hover:text-slate-600 cursor-grab active:cursor-grabbing shrink-0">
                          <GripVertical size={16} />
                        </button>
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dotClass}`} />
                          <p className="font-bold text-slate-700 truncate text-sm">{group.name}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${style.badgeClass}`}>
                            {memberCount}人
                          </span>
                        </div>
                        <div className="flex items-center shrink-0">
                          <button
                            onClick={() => setAssigningGroupId(group.id)}
                            disabled={isSaving}
                            className={`p-1.5 rounded transition-colors ${
                              assigningGroupId === group.id
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'hover:bg-indigo-50 text-slate-500 hover:text-indigo-600'
                            }`}
                            title="添加学生"
                          >
                            <UserPlus size={15} />
                          </button>
                          <button
                            onClick={() => moveGroup(index, -1)}
                            disabled={isSaving || index === 0}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                            title="上移"
                          >
                            <ArrowUp size={15} />
                          </button>
                          <button
                            onClick={() => moveGroup(index, 1)}
                            disabled={isSaving || index === orderedGroups.length - 1}
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                            title="下移"
                          >
                            <ArrowDown size={15} />
                          </button>
                          <button
                            onClick={() => startEdit(group)}
                            disabled={isSaving}
                            className="p-1.5 rounded hover:bg-blue-50 text-slate-500 hover:text-blue-600"
                            title="编辑"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(group)}
                            disabled={isSaving}
                            className="p-1.5 rounded hover:bg-rose-50 text-slate-500 hover:text-rose-600"
                            title="删除"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {assignTargetGroup && (
            <section className="space-y-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/60">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider">
                  添加学生到「{assignTargetGroup.name}」
                </h3>
                <button
                  onClick={() => setAssigningGroupId(null)}
                  disabled={isSaving}
                  className="text-xs text-indigo-700 hover:text-indigo-900 font-bold"
                >
                  收起
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="搜索学生姓名"
                  className="flex-1 min-w-[160px] px-3 py-2 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <label className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-medium select-none">
                  <input
                    type="checkbox"
                    checked={assignOnlyUngrouped}
                    onChange={(e) => setAssignOnlyUngrouped(e.target.checked)}
                    className="w-4 h-4 rounded border-indigo-300"
                  />
                  仅未分组
                </label>
              </div>

              <div className="flex items-center justify-between text-xs text-indigo-700">
                <span>可选 {assignCandidates.length} 人，已选 {selectedAssignStudentIds.size} 人</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAllAssignCandidates}
                    disabled={isSaving || assignCandidates.length === 0}
                    className="font-bold hover:text-indigo-900 disabled:opacity-40"
                  >
                    全选/反选
                  </button>
                  <button
                    onClick={() => setSelectedAssignStudentIds(new Set())}
                    disabled={isSaving || selectedAssignStudentIds.size === 0}
                    className="font-bold hover:text-indigo-900 disabled:opacity-40"
                  >
                    清空
                  </button>
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto border border-indigo-100 rounded-lg bg-white divide-y divide-indigo-50">
                {assignCandidates.length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-400">
                    {assignOnlyUngrouped ? '暂无未分组学生，可取消“仅未分组”查看全部' : '暂无可添加学生'}
                  </div>
                )}

                {assignCandidates.map(student => {
                  const checked = selectedAssignStudentIds.has(student.id);
                  const sourceGroupName = student.groupId ? (groupsById[student.groupId]?.name || '未知分组') : '未分组';

                  return (
                    <label
                      key={student.id}
                      className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer ${
                        checked ? 'bg-indigo-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-700 truncate">{student.name}</p>
                        <p className="text-[11px] text-slate-500">当前：{sourceGroupName}</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAssignStudent(student.id)}
                        className="w-4 h-4 rounded border-indigo-300 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleAssignStudentsSubmit}
                  disabled={isSaving || selectedAssignStudentIds.size === 0}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {isSaving ? '处理中...' : `确认添加 ${selectedAssignStudentIds.size} 人`}
                </button>
              </div>
            </section>
          )}

          <section className="space-y-3 p-4 rounded-xl border border-indigo-100 bg-indigo-50/60">
            <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-wider">随机分组</h3>
            <p className="text-xs text-indigo-700">学生总数：{students.length}，至少需要 2 名学生</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                min={2}
                max={Math.min(MAX_GROUPS, Math.max(2, students.length))}
                value={groupCountInput}
                onChange={(e) => setGroupCountInput(e.target.value)}
                className="w-24 px-3 py-2 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-sm text-indigo-700">组</span>
              <button
                onClick={handleRandomGroup}
                disabled={isSaving || students.length < 2}
                className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors disabled:opacity-50 min-h-[44px]"
              >
                <span className="inline-flex items-center gap-1">
                  <Shuffle size={16} />
                  重新随机分组
                </span>
              </button>
            </div>
          </section>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end safe-area-bottom">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-1 min-h-[44px]"
          >
            <Check size={16} />
            完成
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!confirmAction}
        title={confirmAction?.type === 'delete' ? '确认删除分组' : '确认随机分组'}
        message={
          confirmAction?.type === 'delete'
            ? `确定删除「${confirmAction.group.name}」吗？\n该组内 ${confirmAction.affectedStudents} 名学生将变为未分组。`
            : `将清除现有分组并按 ${confirmAction?.type === 'random' ? confirmAction.groupCount : ''} 组重新分配，是否继续？`
        }
        confirmText={confirmAction?.type === 'delete' ? '删除' : '继续'}
        cancelText="取消"
        onCancel={() => {
          if (isSaving) return;
          setConfirmAction(null);
        }}
        onConfirm={() => {
          if (!confirmAction || isSaving) return;
          if (confirmAction.type === 'delete') {
            void executeDelete(confirmAction.group);
            return;
          }
          void executeRandomGroup(confirmAction.groupCount);
        }}
        type={confirmAction?.type === 'delete' ? 'danger' : 'confirm'}
      />
    </div>
  );
};

export default GroupManagerModal;
