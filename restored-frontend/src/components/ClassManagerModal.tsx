
import React, { useState } from 'react';
import { X, Plus, Trash2, Check, LayoutGrid, Pencil, AlertTriangle } from 'lucide-react';
import { ClassState } from '../types';

interface ClassManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  classes: Record<string, ClassState>;
  currentClassId: string;
  onSwitch: (id: string) => void;
  onAdd: (title: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
}

export const ClassManagerModal: React.FC<ClassManagerModalProps> = ({
  isOpen,
  onClose,
  classes,
  currentClassId,
  onSwitch,
  onAdd,
  onDelete,
  onRename,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newClassTitle, setNewClassTitle] = useState('');
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  // 删除确认弹窗状态
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);

  if (!isOpen) return null;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newClassTitle.trim()) {
      onAdd(newClassTitle.trim());
      setNewClassTitle('');
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (id: string, title: string) => {
    if (Object.keys(classes).length <= 1) {
      // 最后一个班级，显示提示弹窗
      setDeleteConfirm({ id: '', title: '这是最后一个班级，不能删除哦。' });
      return;
    }
    // 显示删除确认弹窗
    setDeleteConfirm({ id, title });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirm && deleteConfirm.id) {
      onDelete(deleteConfirm.id);
    }
    setDeleteConfirm(null);
  };

  const handleEditStart = (id: string, currentTitle: string) => {
    setEditingClassId(id);
    setEditingTitle(currentTitle);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTitle.trim() && editingClassId) {
      onRename(editingClassId, editingTitle.trim());
      setEditingClassId(null);
      setEditingTitle('');
    }
  };

  const handleEditCancel = () => {
    setEditingClassId(null);
    setEditingTitle('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] modal-content">

        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-indigo-600" />
            <h2 className="text-xl font-bold text-slate-800">班级管理</h2>
          </div>
          <button
            onClick={onClose}
            className="touch-target p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
          {Object.values(classes).map((cls: ClassState) => {
            const isCurrent = cls.id === currentClassId;
            const isEditing = editingClassId === cls.id;

            return (
              <div
                key={cls.id}
                className={`
                  relative group flex items-center justify-between p-4 rounded-xl border-2 transition-all
                  ${isCurrent
                    ? 'bg-white border-indigo-500 shadow-md'
                    : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}
                  ${!isEditing && !isCurrent ? 'cursor-pointer' : ''}
                `}
                onClick={() => !isCurrent && !isEditing && onSwitch(cls.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0
                    ${isCurrent ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}
                  `}>
                    {cls.title.charAt(0)}
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleEditSubmit} className="flex-1 flex gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 px-3 py-1 border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm font-bold"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <button
                        type="submit"
                        className="px-3 py-1 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 min-h-[44px]"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditCancel();
                        }}
                        className="px-3 py-1 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-300 min-h-[44px]"
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-bold text-clamp-2 leading-tight ${isCurrent ? 'text-indigo-900' : 'text-slate-700'}`}>
                        {cls.title}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {cls.students.length} 位学生
                      </p>
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isCurrent && (
                      <div className="px-2 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-md flex items-center gap-1">
                        <Check size={12} />
                        当前
                      </div>
                    )}
                    {/* 编辑按钮：所有班级都可以编辑 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditStart(cls.id, cls.title);
                      }}
                      className="touch-target p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"
                      title="编辑班级名称"
                    >
                      <Pencil size={16} />
                    </button>
                    {/* 删除按钮：只有非当前班级才能删除 */}
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(cls.id, cls.title);
                        }}
                        className="touch-target p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="删除班级"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer / Add Action */}
        <div className="p-4 border-t border-slate-100 bg-white">
          {isAdding ? (
            <form onSubmit={handleAddSubmit} className="flex gap-2">
              <input
                autoFocus
                type="text"
                value={newClassTitle}
                onChange={(e) => setNewClassTitle(e.target.value)}
                placeholder="请输入班级名称..."
                className="flex-1 px-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 min-h-[44px]"
              >
                确定
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 min-h-[44px]"
              >
                取消
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full py-3 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
            >
              <Plus size={20} />
              创建一个新班级
            </button>
          )}
        </div>
      </div>

      {/* 删除确认弹窗 */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 modal-content">
            {/* 弹窗头部 */}
            <div className="p-6 pb-4 text-center">
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 ${deleteConfirm.id ? 'bg-red-100' : 'bg-amber-100'}`}>
                <AlertTriangle className={`w-7 h-7 ${deleteConfirm.id ? 'text-red-500' : 'text-amber-500'}`} />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {deleteConfirm.id ? '确认删除班级？' : '无法删除'}
              </h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                {deleteConfirm.id ? (
                  <>
                    确定要删除班级 <span className="font-bold text-slate-700">「{deleteConfirm.title}」</span> 吗？
                    <br />
                    <span className="text-red-500">所有数据将永久丢失且无法恢复！</span>
                  </>
                ) : (
                  deleteConfirm.title
                )}
              </p>
            </div>

            {/* 弹窗按钮 */}
            <div className={`p-4 bg-slate-50 flex gap-3 ${deleteConfirm.id ? '' : 'justify-center'}`}>
              {deleteConfirm.id ? (
                <>
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors min-h-[44px]"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Trash2 size={16} />
                    确认删除
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-8 py-2.5 bg-indigo-500 text-white font-bold rounded-xl hover:bg-indigo-600 transition-colors min-h-[44px]"
                >
                  我知道了
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
