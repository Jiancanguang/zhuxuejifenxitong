import React, { useEffect, useState } from 'react';
import { Check, Copy, Info, ShieldAlert } from 'lucide-react';
import { ReuseConfigField } from '../../types';

export interface ClassConfigOption {
  id: string;
  title: string;
}

interface ClassConfigReuseModalProps {
  isOpen: boolean;
  targetClassTitle: string;
  sourceClasses: ClassConfigOption[];
  onClose: () => void;
  onConfirm: (sourceClassId: string, applyFields: ReuseConfigField[]) => void;
}

const REUSE_FIELD_OPTIONS: Array<{
  key: ReuseConfigField;
  label: string;
  description: string;
}> = [
    { key: 'scoreItems', label: '积分规则', description: '同步加分与扣分规则' },
    { key: 'storeItems', label: '小卖部商品', description: '同步小卖部商品配置' },
    { key: 'levelConfig', label: '等级配置', description: '同步等级阈值并重算学生等级' },
  ];

const DEFAULT_REUSE_FIELDS: ReuseConfigField[] = REUSE_FIELD_OPTIONS.map(option => option.key);
const KEEP_FIELDS = ['班级名称', '学生名单', '学生分组', '宠物选择与昵称', '食物进度', '徽章', '成长记录', '兑换记录', '界面主题'];

export const ClassConfigReuseModal: React.FC<ClassConfigReuseModalProps> = ({
  isOpen,
  targetClassTitle,
  sourceClasses,
  onClose,
  onConfirm,
}) => {
  const [selectedSourceClassId, setSelectedSourceClassId] = useState('');
  const [selectedReuseFields, setSelectedReuseFields] = useState<ReuseConfigField[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedSourceClassId(sourceClasses[0]?.id || '');
    setSelectedReuseFields(DEFAULT_REUSE_FIELDS);
  }, [isOpen, sourceClasses]);

  const canConfirm = sourceClasses.length > 0 && !!selectedSourceClassId && selectedReuseFields.length > 0;
  const selectedFieldLabels = REUSE_FIELD_OPTIONS
    .filter(option => selectedReuseFields.includes(option.key))
    .map(option => option.label);

  if (!isOpen) return null;

  const toggleReuseField = (field: ReuseConfigField) => {
    setSelectedReuseFields(prev => {
      if (prev.includes(field)) {
        return prev.filter(item => item !== field);
      }
      return [...prev, field];
    });
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden modal-content max-h-[90vh] flex flex-col"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-cyan-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Copy className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">从其他班级复用配置</h3>
              <p className="text-sm text-slate-500">目标班级：{targetClassTitle}</p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">选择来源班级</p>
            {sourceClasses.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-500">
                至少需要 2 个班级才能复用
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sourceClasses.map(sourceClass => {
                  const selected = selectedSourceClassId === sourceClass.id;
                  return (
                    <button
                      key={sourceClass.id}
                      onClick={() => setSelectedSourceClassId(sourceClass.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors min-h-[44px] ${selected
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{sourceClass.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                          {selected ? '已选中' : '可选择'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-bold text-slate-700">选择要复用的内容（可多选）</p>
            <div className="space-y-2">
              {REUSE_FIELD_OPTIONS.map(option => {
                const selected = selectedReuseFields.includes(option.key);
                return (
                  <button
                    key={option.key}
                    onClick={() => toggleReuseField(option.key)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors min-h-[44px] ${selected
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`font-bold ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>{option.label}</p>
                        <p className={`text-xs mt-1 ${selected ? 'text-indigo-600' : 'text-slate-500'}`}>{option.description}</p>
                      </div>
                      <span className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center ${selected ? 'border-indigo-500 bg-indigo-500 text-white' : 'border-slate-300 bg-white text-transparent'
                        }`}>
                        <Check size={12} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedReuseFields.length === 0 && (
              <p className="text-xs text-rose-600">请至少选择一项复用内容</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="p-3 rounded-xl border border-amber-200 bg-amber-50">
              <p className="font-bold text-amber-700 mb-2 flex items-center gap-2">
                <Info size={14} />
                本次将覆盖
              </p>
              <ul className="space-y-1 text-amber-800">
                {selectedFieldLabels.length > 0
                  ? selectedFieldLabels.map(item => <li key={item}>{item}</li>)
                  : <li>请至少选择一项</li>}
              </ul>
            </div>

            <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50">
              <p className="font-bold text-emerald-700 mb-2 flex items-center gap-2">
                <ShieldAlert size={14} />
                不受影响
              </p>
              <ul className="space-y-1 text-emerald-800">
                {KEEP_FIELDS.map(item => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0 safe-area-bottom">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(selectedSourceClassId, selectedReuseFields)}
            disabled={!canConfirm}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors min-h-[44px]"
          >
            确认复用
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClassConfigReuseModal;
