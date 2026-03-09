
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Save, Palette, PenTool, LayoutGrid, Drumstick, Plus, Minus, Trash2, Edit3, AlertTriangle, Check, Users, Target, Star, Search, User, KeyRound, LogOut, Shield, Shuffle, RefreshCw, FileText, FlaskConical, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { THEMES, DEFAULT_SYSTEM_TITLE, DEFAULT_STAGE_THRESHOLDS, DEFAULT_SCORE_ITEMS, ALL_PETS, getPetById } from '../constants';
import { Student, ScoreItem, User as UserType, ReuseConfigField } from '../types';
import { MASTER_ICON_MAP, ICON_CATEGORIES } from '../icons';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ClassConfigReuseModal, ClassConfigOption } from './settings/ClassConfigReuseModal';
import { PasswordConfirmModal } from './settings/PasswordConfirmModal';
import { useDraftSave, formatDraftTime } from '../hooks/useDraftSave';
import { generateClientId } from '../lib/clientId';

// 草稿数据结构
interface SettingsDraftData {
  students: Student[];
  scoreItems: ScoreItem[];
  stageThresholds: number[];
  selectedThemeId: string;
  systemTitle: string;
  classTitle: string;
  draftClassTitle: string; // 草稿保存时的班级名称（用于恢复提示）
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClassId: string; // 当前班级ID（用于草稿隔离）
  currentStudents: Student[];
  currentScoreItems: ScoreItem[];
  currentTarget: number;
  currentStageThresholds: number[];
  currentThemeId: string;
  currentSystemTitle: string;
  currentClassTitle: string;
  classOptions: ClassConfigOption[];
  studentProgress: Record<string, number>;
  studentBadges: Record<string, any[]>;
  petSelections: Record<string, string>;
  // 认证相关
  user?: UserType | null;
  onLogout?: () => void;
  onSave: (
    updatedStudents: Student[],
    deletedStudentIds: string[],
    updatedScoreItems: ScoreItem[],
    newTarget: number,
    newStageThresholds: number[],
    newThemeId: string,
    newSystemTitle: string,
    newClassTitle: string
  ) => void;
  onGenerateTestData: () => Promise<void>;
  onBatchAssignPets: (assignments: Array<{ studentId: string; petId: string }>) => Promise<void>;
  onOpenGroupManager?: () => void;
  onOpenResetProgress?: () => void;
  onReuseClassConfig?: (sourceClassId: string, password: string, applyFields: ReuseConfigField[]) => Promise<void>;
}

// 姓名最大长度（支持英文名）
const MAX_NAME_LENGTH = 50;

// 积分项目名称最大长度
const MAX_SCORE_ITEM_NAME_LENGTH = 50;

// 积分配置相关常量
const MIN_SCORE = -999;
const MAX_SCORE = 999;
const DEFAULT_SCORE = 1;
const SYSTEM_GUIDE_URL = '/system-guide.html';

const normalizeScoreInputValue = (raw: string): number => {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed === 0) return DEFAULT_SCORE;
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, parsed));
};

const scoreSign = (score: number): -1 | 1 => (score < 0 ? -1 : 1);

// 开发者用户名白名单（可以看到"生成测试数据"按钮）
const DEVELOPER_USERNAMES = [
  '12161216',
  'cyy1216',
  'wl88488848',
  // cszh001 到 cszh010
  ...Array.from({ length: 10 }, (_, i) => `cszh${String(i + 1).padStart(3, '0')}`),
];

// === StudentRow 子组件（使用 React.memo 优化渲染）===
interface StudentRowProps {
  student: Student;
  index: number;
  studentsCount: number;
  dataSummary: string;
  petName: string | null;
  isEditing: boolean;
  editingName: string;
  isConfirmingDelete: boolean;
  editInputRef: React.RefObject<HTMLInputElement>;
  onEditingNameChange: (value: string) => void;
  onSaveEditing: () => void;
  onCancelEditing: () => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onStartEditing: (student: Student) => void;
  onDelete: (studentId: string) => void;
  onCancelDelete: () => void;
}

const StudentRow = React.memo<StudentRowProps>(({
  student,
  index,
  studentsCount,
  dataSummary,
  petName,
  isEditing,
  editingName,
  isConfirmingDelete,
  editInputRef,
  onEditingNameChange,
  onSaveEditing,
  onCancelEditing,
  onMoveUp,
  onMoveDown,
  onStartEditing,
  onDelete,
  onCancelDelete,
}) => {
  const canMoveUp = index > 0;
  const canMoveDown = index < studentsCount - 1;
  const hasDataSummary = Boolean(dataSummary);

  return (
    <div
      className={`flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-3 hover:bg-slate-50 transition-colors ${isConfirmingDelete ? 'bg-red-50' : ''}`}
    >
      {/* 序号 */}
      <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-400 shrink-0">
        {index + 1}
      </span>

      {/* 姓名（编辑模式或显示模式） */}
      {isEditing ? (
        <div className="flex-1 min-w-0 flex gap-2 flex-wrap">
          <input
            ref={editInputRef}
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value.slice(0, MAX_NAME_LENGTH))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEditing();
              if (e.key === 'Escape') onCancelEditing();
            }}
            className="flex-1 px-3 py-1.5 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button onClick={onSaveEditing} className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600">
            <Check size={18} />
          </button>
          <button onClick={onCancelEditing} className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
            <X size={18} />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 min-w-[120px] sm:min-w-0 font-bold text-slate-700 text-clamp-2 leading-tight flex items-center gap-2">
            {student.name}
            {/* 宠物状态标识 */}
            {petName ? (
              <span className="text-xs px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                {petName}
              </span>
            ) : (
              <span className="text-xs px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                未分配
              </span>
            )}
          </span>
          {/* 数据标签 */}
          {hasDataSummary && (
            <span className="hidden sm:inline-flex text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full shrink-0">
              {dataSummary}
            </span>
          )}
        </>
      )}

      {/* 操作按钮 */}
      {!isEditing && (
        <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto justify-end sm:justify-start">
          <button
            onClick={() => onMoveUp(index)}
            disabled={!canMoveUp || isConfirmingDelete}
            className="w-8 h-8 sm:touch-target p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="上移"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={!canMoveDown || isConfirmingDelete}
            className="w-8 h-8 sm:touch-target p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="下移"
          >
            <ChevronDown size={16} />
          </button>
          {isConfirmingDelete ? (
            <>
              <span className="text-xs text-red-600 font-medium mr-2">确认删除?</span>
              <button
                onClick={() => onDelete(student.id)}
                className="px-2 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded transition-colors min-h-[40px]"
              >
                删除
              </button>
              <button
                onClick={onCancelDelete}
                className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors min-h-[40px]"
              >
                取消
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onStartEditing(student)}
                className="w-8 h-8 sm:touch-target p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors"
                title="编辑姓名"
              >
                <Edit3 size={16} />
              </button>
              <button
                onClick={() => onDelete(student.id)}
                className="w-8 h-8 sm:touch-target p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                title="删除学生"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
});

StudentRow.displayName = 'StudentRow';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentClassId,
  currentStudents,
  currentScoreItems,
  currentTarget,
  currentStageThresholds,
  currentThemeId,
  currentSystemTitle,
  currentClassTitle,
  classOptions,
  studentProgress,
  studentBadges,
  petSelections,
  user,
  onLogout,
  onSave,
  onGenerateTestData,
  onBatchAssignPets,
  onOpenGroupManager,
  onOpenResetProgress,
  onReuseClassConfig,
}) => {
  // 学生列表状态（包含id和name）
  const [students, setStudents] = useState<Student[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [target, setTarget] = useState(100);
  const [stageThresholds, setStageThresholds] = useState<number[]>(DEFAULT_STAGE_THRESHOLDS);
  const [selectedThemeId, setSelectedThemeId] = useState(currentThemeId);
  const [systemTitle, setSystemTitle] = useState(currentSystemTitle);
  const [classTitle, setClassTitle] = useState(currentClassTitle);

  // 修改密码弹窗
  const [showChangePassword, setShowChangePassword] = useState(false);

  // 复用配置流程状态
  const [showReuseConfigModal, setShowReuseConfigModal] = useState(false);
  const [showReusePasswordModal, setShowReusePasswordModal] = useState(false);
  const [selectedReuseSourceClassId, setSelectedReuseSourceClassId] = useState('');
  const [selectedReuseFields, setSelectedReuseFields] = useState<ReuseConfigField[]>([]);
  const [reusePasswordError, setReusePasswordError] = useState('');
  const [isReusingConfig, setIsReusingConfig] = useState(false);

  // 加分项目状态
  const [scoreItems, setScoreItems] = useState<ScoreItem[]>([]);
  const [newScoreItemName, setNewScoreItemName] = useState('');
  const [newScoreItemIcon, setNewScoreItemIcon] = useState('Star');
  const [newScoreItemScore, setNewScoreItemScore] = useState(1);
  const [editingScoreItemId, setEditingScoreItemId] = useState<string | null>(null);
  const [editingScoreItem, setEditingScoreItem] = useState<ScoreItem | null>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [iconPickerFor, setIconPickerFor] = useState<'new' | 'edit'>('new');
  const [activeIconTab, setActiveIconTab] = useState<keyof typeof ICON_CATEGORIES>('school'); // icon picker tab
  // 数值输入框的字符串状态（用于支持清空后输入新值）
  const [newScoreInputValue, setNewScoreInputValue] = useState('1');
  const [editScoreInputValue, setEditScoreInputValue] = useState('');

  // 编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [showBatchInput, setShowBatchInput] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // 一键分配宠物相关状态
  const [showPetAssignModal, setShowPetAssignModal] = useState(false);
  const [petAssignments, setPetAssignments] = useState<Array<{ studentId: string; studentName: string; petId: string; petName: string }>>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [petAssignError, setPetAssignError] = useState(''); // 分配弹窗专用的错误提示

  // 错误提示（Toast 模式）
  const [error, setError] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 显示错误提示（自动3秒后消失）
  const showError = useCallback((message: string) => {
    setError(message);
    setShowErrorToast(true);
    // 清除之前的定时器
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
    // 3秒后自动消失
    errorTimeoutRef.current = setTimeout(() => {
      setShowErrorToast(false);
    }, 3000);
  }, []);

  // 关闭错误提示
  const hideError = useCallback(() => {
    setShowErrorToast(false);
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
    }
  }, []);
  const noop = useCallback(() => {}, []);
  const noopString = useCallback((_: string) => {}, []);

  // 生成测试数据相关状态
  const [showTestDataModal, setShowTestDataModal] = useState(false);
  const [isGeneratingTestData, setIsGeneratingTestData] = useState(false);
  const [initialStudentCount, setInitialStudentCount] = useState(0); // 记住弹窗打开时的学生数量

  const editInputRef = useRef<HTMLInputElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  // 标记是否完成初始化（防止打开时立即保存草稿）
  const isInitializedRef = useRef(false);
  // 记录上次 isOpen 状态，用于检测"打开"动作
  const prevIsOpenRef = useRef(false);

  // === 草稿保存 Hook ===
  // storageKey 格式: settings-draft-{userId}-{classId}，确保不同账号和班级的草稿独立
  const draftStorageKey = `settings-draft-${user?.id || 'anonymous'}-${currentClassId}`;

  // 专用的草稿比较函数（高效比较关键字段，避免 JSON.stringify）
  const draftIsEqual = useCallback((a: SettingsDraftData, b: SettingsDraftData): boolean => {
    // 比较简单字段
    if (a.selectedThemeId !== b.selectedThemeId) return false;
    if (a.systemTitle !== b.systemTitle) return false;
    if (a.classTitle !== b.classTitle) return false;
    if (a.draftClassTitle !== b.draftClassTitle) return false;

    // 比较 students：长度 + 逐项 id 和 name
    if (a.students.length !== b.students.length) return false;
    for (let i = 0; i < a.students.length; i++) {
      if (a.students[i].id !== b.students[i].id || a.students[i].name !== b.students[i].name) return false;
    }

    // 比较 scoreItems：长度 + 逐项关键字段
    if (a.scoreItems.length !== b.scoreItems.length) return false;
    for (let i = 0; i < a.scoreItems.length; i++) {
      const ai = a.scoreItems[i], bi = b.scoreItems[i];
      if (ai.id !== bi.id || ai.name !== bi.name || ai.icon !== bi.icon || ai.score !== bi.score) return false;
    }

    // 比较 stageThresholds：逐项
    if (a.stageThresholds.length !== b.stageThresholds.length) return false;
    for (let i = 0; i < a.stageThresholds.length; i++) {
      if (a.stageThresholds[i] !== b.stageThresholds[i]) return false;
    }

    return true;
  }, []);

  const {
    hasDraft,
    draftSavedAt,
    saveStatus,
    getDraftData,
    restoreDraft,
    discardDraft,
    autoSave,
    clearDraft,
  } = useDraftSave<SettingsDraftData>({
    storageKey: draftStorageKey,
    debounceMs: 3000, // 延长到3秒，减少频繁保存
    version: '1.1', // 升级版本号，自动忽略旧版本草稿
    expireMs: 7 * 24 * 60 * 60 * 1000, // 7天过期
    enabled: isOpen && !!currentClassId && !!user?.id, // 只有当班级ID和用户ID都存在时才启用
    isEqual: draftIsEqual, // 使用专用比较函数
  });

  // 草稿恢复提示状态
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  // 存储草稿中的班级名称（用于提示显示）
  const [draftClassTitle, setDraftClassTitle] = useState('');

  // Sync local state with props when modal opens
  useEffect(() => {
    // 检测是否是"打开"动作（从 false 变为 true）
    const isOpening = isOpen && !prevIsOpenRef.current;
    prevIsOpenRef.current = isOpen;

    if (isOpening) {
      // 重置初始化标记
      isInitializedRef.current = false;

      // 直接调用 getDraftData() 检查是否有草稿（不依赖 hasDraft 状态，避免异步时机问题）
      const existingDraft = getDraftData();

      if (existingDraft) {
        setDraftClassTitle(existingDraft.draftClassTitle || '');
        setShowDraftPrompt(true);
      } else {
        setDraftClassTitle('');
        setShowDraftPrompt(false);
      }

      setStudents([...currentStudents]);
      setDeletedIds([]);
      setScoreItems([...(currentScoreItems || DEFAULT_SCORE_ITEMS)]);
      setTarget(currentTarget);
      setStageThresholds(currentStageThresholds || DEFAULT_STAGE_THRESHOLDS);
      setSelectedThemeId(currentThemeId);
      setSystemTitle(currentSystemTitle || DEFAULT_SYSTEM_TITLE);
      setClassTitle(currentClassTitle || '默认班级');
      setEditingId(null);
      setNewStudentName('');
      setBatchInput('');
      setShowBatchInput(false);
      hideError();
      setPendingDeleteId(null);
      // 重置加分项目编辑状态
      setNewScoreItemName('');
      setNewScoreItemIcon('Star');
      setNewScoreItemScore(1);
      setNewScoreInputValue(String(DEFAULT_SCORE));
      setEditingScoreItemId(null);
      setEditingScoreItem(null);
      setShowIconPicker(false);
      setShowReuseConfigModal(false);
      setShowReusePasswordModal(false);
      setSelectedReuseSourceClassId('');
      setSelectedReuseFields([]);
      setReusePasswordError('');
      setIsReusingConfig(false);

      // 延迟标记初始化完成，避免初始化过程中触发自动保存
      setTimeout(() => {
        isInitializedRef.current = true;
      }, 100);
    }

    if (!isOpen) {
      // 关闭时重置标记
      isInitializedRef.current = false;
      setShowReuseConfigModal(false);
      setShowReusePasswordModal(false);
      setSelectedReuseSourceClassId('');
      setSelectedReuseFields([]);
      setReusePasswordError('');
      setIsReusingConfig(false);
    }
  }, [isOpen, currentStudents, currentScoreItems, currentTarget, currentStageThresholds, currentThemeId, currentSystemTitle, currentClassTitle, getDraftData]);

  // 自动保存草稿
  useEffect(() => {
    // 未打开、正在显示草稿提示、或尚未完成初始化时，不保存
    if (!isOpen || showDraftPrompt || !isInitializedRef.current) return;

    const draftData: SettingsDraftData = {
      students,
      scoreItems,
      stageThresholds,
      selectedThemeId,
      systemTitle,
      classTitle,
      draftClassTitle: currentClassTitle, // 保存当前班级名称，用于恢复提示
    };
    autoSave(draftData);
  }, [isOpen, showDraftPrompt, students, scoreItems, stageThresholds, selectedThemeId, systemTitle, classTitle, currentClassTitle, autoSave]);

  // 恢复草稿
  const handleRestoreDraft = useCallback(() => {
    const draft = restoreDraft();
    if (draft) {
      setStudents(draft.students);
      setScoreItems(draft.scoreItems);
      setStageThresholds(draft.stageThresholds);
      setSelectedThemeId(draft.selectedThemeId);
      setSystemTitle(draft.systemTitle);
      setClassTitle(draft.classTitle);
    }
    setShowDraftPrompt(false);
  }, [restoreDraft]);

  // 放弃草稿
  const handleDiscardDraft = useCallback(() => {
    discardDraft();
    setShowDraftPrompt(false);
  }, [discardDraft]);

  // 聚焦编辑输入框
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const displayedIcons = useMemo(() => {
    return ICON_CATEGORIES[activeIconTab].icons;
  }, [activeIconTab]);

  // 获取未分配宠物的学生列表（基于当前编辑中的students列表和实时petSelections）
  const unassignedStudents = useMemo(() => {
    return students.filter(student => !petSelections[student.id]);
  }, [students, petSelections]);

  // 获取已分配宠物的学生数量
  const assignedCount = useMemo(() => {
    return students.filter(student => petSelections[student.id]).length;
  }, [students, petSelections]);

  // 检测未保存的新学生（存在于本地编辑列表，但不存在于已保存的学生列表中）
  const unsavedNewStudents = useMemo(() => {
    const existingIds = new Set(currentStudents.map(s => s.id));
    return students.filter(s => !existingIds.has(s.id));
  }, [students, currentStudents]);

  const hasUnsavedStudents = unsavedNewStudents.length > 0;

  const reusableSourceClasses = useMemo(
    () => classOptions.filter(cls => cls.id !== currentClassId),
    [classOptions, currentClassId]
  );
  const canReuseClassConfig = reusableSourceClasses.length > 0;

  // 缓存学生数据摘要（使用 Map，避免每次渲染重复计算）
  const studentDataSummaries = useMemo(() => {
    const summaries = new Map<string, string>();
    students.forEach(student => {
      const progress = studentProgress[student.id] || 0;
      const badges = studentBadges[student.id] || [];
      const parts: string[] = [];
      if (progress > 0) parts.push(`${progress}份食物`);
      if (badges.length > 0) parts.push(`${badges.length}枚徽章`);
      summaries.set(student.id, parts.length > 0 ? parts.join('、') : '');
    });
    return summaries;
  }, [students, studentProgress, studentBadges]);

  // 尽量不重复的随机分配算法
  const generateRandomAssignments = useCallback(() => {
    const unassigned = students.filter(student => !petSelections[student.id]);
    if (unassigned.length === 0) return [];

    // 打乱宠物列表
    const shuffledPets = [...ALL_PETS].sort(() => Math.random() - 0.5);

    // 分配宠物，轮流使用打乱后的宠物列表
    const assignments: Array<{ studentId: string; studentName: string; petId: string; petName: string }> = [];
    unassigned.forEach((student, index) => {
      const pet = shuffledPets[index % shuffledPets.length];
      assignments.push({
        studentId: student.id,
        studentName: student.name,
        petId: pet.id,
        petName: pet.name,
      });
    });

    return assignments;
  }, [students, petSelections]);

  // 打开分配确认弹窗
  const handleOpenPetAssignModal = useCallback(() => {
    const assignments = generateRandomAssignments();
    if (assignments.length === 0) return;
    setPetAssignments(assignments);
    setShowPetAssignModal(true);
  }, [generateRandomAssignments]);

  // 重新随机分配
  const handleReRandomize = useCallback(() => {
    const assignments = generateRandomAssignments();
    setPetAssignments(assignments);
  }, [generateRandomAssignments]);

  // 确认分配
  const handleConfirmAssign = useCallback(async () => {
    if (petAssignments.length === 0) return;

    setIsAssigning(true);
    setPetAssignError(''); // 清除之前的错误
    try {
      await onBatchAssignPets(petAssignments.map(a => ({ studentId: a.studentId, petId: a.petId })));
      setShowPetAssignModal(false);
      setPetAssignments([]);
    } catch (err) {
      console.error('Failed to assign pets:', err);
      // 在弹窗内显示错误
      setPetAssignError('分配失败，请先点击「保存设置」保存学生后再试');
    } finally {
      setIsAssigning(false);
    }
  }, [petAssignments, onBatchAssignPets]);

  // 关闭分配弹窗
  const handleClosePetAssignModal = useCallback(() => {
    setShowPetAssignModal(false);
    setPetAssignments([]);
    setPetAssignError(''); // 清除错误状态
  }, []);

  // 验证姓名
  const validateName = (name: string, excludeId?: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return '姓名不能为空';
    if (trimmed.length > MAX_NAME_LENGTH) return `姓名最多${MAX_NAME_LENGTH}个字符`;

    // 检查重复（排除自己）
    const duplicate = students.find(s => s.name === trimmed && s.id !== excludeId);
    if (duplicate) return `已存在同名学生"${trimmed}"`;

    return null;
  };

  // 添加单个学生
  const handleAddStudent = () => {
    const trimmed = newStudentName.trim();
    const validationError = validateName(trimmed);
    if (validationError) {
      showError(validationError);
      return;
    }

    const newStudent: Student = {
      id: generateClientId('settings_add_student'),
      name: trimmed
    };
    setStudents([...students, newStudent]);
    setNewStudentName('');
    hideError();
    newInputRef.current?.focus();
  };

  // 批量添加学生
  const handleBatchAdd = () => {
    const names = batchInput.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    if (names.length === 0) {
      showError('请输入至少一个学生姓名');
      return;
    }

    const errors: string[] = [];
    const newStudents: Student[] = [];
    const allNames = new Set(students.map(s => s.name));

    names.forEach((name, index) => {
      if (name.length > MAX_NAME_LENGTH) {
        errors.push(`第${index + 1}行"${name.substring(0, 15)}..."超过${MAX_NAME_LENGTH}个字符`);
        return;
      }
      if (allNames.has(name)) {
        errors.push(`"${name}"已存在，已跳过`);
        return;
      }
      allNames.add(name);
      newStudents.push({ id: generateClientId('settings_batch_add_student'), name });
    });

    if (errors.length > 0 && newStudents.length === 0) {
      showError(errors.join('\n'));
      return;
    }

    setStudents([...students, ...newStudents]);
    setBatchInput('');
    setShowBatchInput(false);

    if (errors.length > 0) {
      showError(`已添加${newStudents.length}人，但有问题：\n${errors.join('\n')}`);
    } else {
      hideError();
    }
  };

  // 开始编辑学生姓名
  const handleStartEditing = useCallback((student: Student) => {
    setEditingId(student.id);
    setEditingName(student.name);
    hideError();
  }, [hideError]);

  // 保存编辑
  const saveEditing = () => {
    if (!editingId) return;

    const trimmed = editingName.trim();
    const validationError = validateName(trimmed, editingId);
    if (validationError) {
      showError(validationError);
      return;
    }

    setStudents(students.map(s =>
      s.id === editingId ? { ...s, name: trimmed } : s
    ));
    setEditingId(null);
    setEditingName('');
    hideError();
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    hideError();
  };

  // 调整学生顺序（使用函数式更新）
  const handleMoveStudentUp = useCallback((index: number) => {
    if (index <= 0) return;
    setStudents(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(index - 1, 0, moved);
      return updated;
    });
    setPendingDeleteId(null);
  }, []);

  const handleMoveStudentDown = useCallback((index: number) => {
    setStudents(prev => {
      if (index >= prev.length - 1) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(index, 1);
      updated.splice(index + 1, 0, moved);
      return updated;
    });
    setPendingDeleteId(null);
  }, []);

  // 调整积分项目顺序
  const moveScoreItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= scoreItems.length) return;
    const updated = [...scoreItems];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    setScoreItems(updated);
  };

  // 检查学生是否有数据
  const hasStudentData = useCallback((studentId: string): boolean => {
    const hasProgress = (studentProgress[studentId] || 0) > 0;
    const hasBadges = (studentBadges[studentId] || []).length > 0;
    return hasProgress || hasBadges;
  }, [studentProgress, studentBadges]);

  // 删除学生（使用函数式更新）
  const handleDeleteStudentCallback = useCallback((studentId: string) => {
    // 如果有数据，需要确认
    if (hasStudentData(studentId) && pendingDeleteId !== studentId) {
      setPendingDeleteId(studentId);
      return;
    }

    // 执行删除
    setStudents(prevStudents => prevStudents.filter(s => s.id !== studentId));
    setDeletedIds(prevIds => {
      if (currentStudents.find(s => s.id === studentId)) {
        return [...prevIds, studentId];
      }
      return prevIds;
    });
    setPendingDeleteId(null);
  }, [currentStudents, hasStudentData, pendingDeleteId]);

  // 取消删除确认
  const handleCancelDelete = useCallback(() => {
    setPendingDeleteId(null);
  }, []);

  const handleSave = () => {
    // 检查是否有重复姓名
    const nameCount: Record<string, number> = {};
    students.forEach(s => {
      nameCount[s.name] = (nameCount[s.name] || 0) + 1;
    });
    const duplicates = Object.entries(nameCount).filter(([_, count]) => count > 1).map(([name]) => name);
    if (duplicates.length > 0) {
      showError(`存在重复姓名：${duplicates.join('、')}`);
      return;
    }

    // 检查是否有加分项目
    if (scoreItems.length === 0) {
      showError('请至少添加一个加分项目');
      return;
    }

    // Ensure thresholds are sorted and valid
    const validThresholds = stageThresholds.map((v, i) => {
      if (i === 0) return 0; // Stage 1 always starts at 0
      return Math.max(stageThresholds[i - 1] + 1, v);
    });

    onSave(students, deletedIds, scoreItems, validThresholds[9], validThresholds, selectedThemeId, systemTitle, classTitle);
    clearDraft(); // 保存成功后清除草稿
    onClose();
  };

  const handleOpenReuseConfigModal = () => {
    if (!canReuseClassConfig) {
      showError('至少需要 2 个班级才能复用');
      return;
    }
    setReusePasswordError('');
    setShowReuseConfigModal(true);
  };

  const handleConfirmReuseSource = (sourceClassId: string, applyFields: ReuseConfigField[]) => {
    if (sourceClassId === currentClassId) {
      showError('来源班级不能是当前班级');
      return;
    }
    if (applyFields.length === 0) {
      showError('请至少选择一项复用内容');
      return;
    }
    setSelectedReuseSourceClassId(sourceClassId);
    setSelectedReuseFields(applyFields);
    setReusePasswordError('');
    setShowReusePasswordModal(true);
  };

  const handleSubmitReusePassword = async (password: string) => {
    if (!onReuseClassConfig || !selectedReuseSourceClassId || selectedReuseFields.length === 0 || isReusingConfig) return;

    setIsReusingConfig(true);
    setReusePasswordError('');
    try {
      await onReuseClassConfig(selectedReuseSourceClassId, password, selectedReuseFields);
      clearDraft(); // 复用成功后清除设置草稿，避免恢复旧配置
      setShowReusePasswordModal(false);
      setShowReuseConfigModal(false);
      setSelectedReuseSourceClassId('');
      setSelectedReuseFields([]);
      onClose();
    } catch (error: any) {
      setReusePasswordError(error?.message || '复用配置失败，请稍后重试');
    } finally {
      setIsReusingConfig(false);
    }
  };

  const handleGenerateTestDataClick = async () => {
    setInitialStudentCount(currentStudents.length); // 保存弹窗打开时的学生数量
    setShowTestDataModal(true);
  };

  const handleConfirmGenerateTestData = async () => {
    setIsGeneratingTestData(true);
    try {
      await onGenerateTestData();
      setShowTestDataModal(false);
      onClose();
    } catch (err) {
      console.error('生成测试数据失败:', err);
      showError('生成测试数据失败，请重试');
    } finally {
      setIsGeneratingTestData(false);
    }
  };

  // === 加分项目管理函数 ===

  // 添加新加分项目
  const handleAddScoreItem = () => {
    const trimmed = newScoreItemName.trim();
    const resolvedScore = normalizeScoreInputValue(newScoreInputValue);
    if (!trimmed) {
      showError('请输入项目名称');
      return;
    }
    if (trimmed.length > MAX_SCORE_ITEM_NAME_LENGTH) {
      showError(`项目名称最多${MAX_SCORE_ITEM_NAME_LENGTH}个字符`);
      return;
    }
    if (scoreItems.some(item => item.name === trimmed)) {
      showError('已存在同名项目');
      return;
    }
    if (resolvedScore === 0) {
      showError('分值不能为0');
      return;
    }
    if (resolvedScore < MIN_SCORE || resolvedScore > MAX_SCORE) {
      showError(`分值范围为 ${MIN_SCORE} 到 ${MAX_SCORE}`);
      return;
    }

    const newItem: ScoreItem = {
      id: generateClientId('settings_add_score_item'),
      name: trimmed,
      icon: newScoreItemIcon,
      score: resolvedScore
    };
    setScoreItems([...scoreItems, newItem]);
    setNewScoreItemName('');
    setNewScoreItemIcon('Star');
    setNewScoreItemScore(DEFAULT_SCORE);
    setNewScoreInputValue(String(DEFAULT_SCORE)); // 重置输入状态
    hideError();
  };

  // 开始编辑加分项目
  const startEditScoreItem = (item: ScoreItem) => {
    setEditingScoreItemId(item.id);
    setEditingScoreItem({ ...item });
    setEditScoreInputValue(String(item.score)); // 设置编辑输入状态
  };

  // 保存编辑加分项目
  const saveEditScoreItem = () => {
    if (!editingScoreItem) return;
    const trimmed = editingScoreItem.name.trim();
    if (!trimmed) {
      showError('项目名称不能为空');
      return;
    }
    if (trimmed.length > MAX_SCORE_ITEM_NAME_LENGTH) {
      showError(`项目名称最多${MAX_SCORE_ITEM_NAME_LENGTH}个字符`);
      return;
    }
    if (scoreItems.some(item => item.name === trimmed && item.id !== editingScoreItem.id)) {
      showError('已存在同名项目');
      return;
    }
    if (editingScoreItem.score === 0) {
      showError('分值不能为0');
      return;
    }
    if (editingScoreItem.score < MIN_SCORE || editingScoreItem.score > MAX_SCORE) {
      showError(`分值范围为 ${MIN_SCORE} 到 ${MAX_SCORE}`);
      return;
    }

    const originalItem = scoreItems.find(item => item.id === editingScoreItem.id);
    if (!originalItem) {
      setEditingScoreItemId(null);
      setEditingScoreItem(null);
      hideError();
      return;
    }

    const nextItem: ScoreItem = {
      ...editingScoreItem,
      name: trimmed,
    };

    const signChanged = scoreSign(originalItem.score) !== scoreSign(nextItem.score);

    setScoreItems(prevItems => {
      if (!signChanged) {
        return prevItems.map(item => (item.id === nextItem.id ? nextItem : item));
      }

      const withoutCurrent = prevItems.filter(item => item.id !== nextItem.id);
      const targetSign = scoreSign(nextItem.score);

      // 正负号变化时，移动到目标分类末尾，避免底层顺序与分组展示语义不一致
      let insertAt = withoutCurrent.length;
      for (let i = withoutCurrent.length - 1; i >= 0; i--) {
        if (scoreSign(withoutCurrent[i].score) === targetSign) {
          insertAt = i + 1;
          break;
        }
      }

      const reordered = [...withoutCurrent];
      reordered.splice(insertAt, 0, nextItem);
      return reordered;
    });
    setEditingScoreItemId(null);
    setEditingScoreItem(null);
    hideError();
  };

  // 取消编辑加分项目
  const cancelEditScoreItem = () => {
    setEditingScoreItemId(null);
    setEditingScoreItem(null);
    hideError();
  };

  // 删除加分项目
  const handleDeleteScoreItem = (id: string) => {
    setScoreItems(scoreItems.filter(item => item.id !== id));
  };

  const positiveScoreItems = useMemo(
    () => scoreItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.score > 0),
    [scoreItems]
  );

  const negativeScoreItems = useMemo(
    () => scoreItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.score < 0),
    [scoreItems]
  );

  const moveScoreItemByCategory = (itemId: string, direction: 'up' | 'down') => {
    const currentIndex = scoreItems.findIndex(item => item.id === itemId);
    if (currentIndex < 0) return;

    const currentItem = scoreItems[currentIndex];
    const isPositive = currentItem.score > 0;
    const categoryIndexes = scoreItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => (isPositive ? item.score > 0 : item.score < 0))
      .map(({ index }) => index);

    const categoryPosition = categoryIndexes.indexOf(currentIndex);
    if (categoryPosition < 0) return;

    const targetPosition = direction === 'up' ? categoryPosition - 1 : categoryPosition + 1;
    if (targetPosition < 0 || targetPosition >= categoryIndexes.length) return;

    moveScoreItem(currentIndex, categoryIndexes[targetPosition]);
  };

  const renderScoreItems = (items: Array<{ item: ScoreItem; index: number }>) => {
    if (items.length === 0) {
      return null;
    }

    return items.map(({ item }, categoryIndex) => {
      const IconComp = MASTER_ICON_MAP[item.icon] || Star;
      const canMoveUp = categoryIndex > 0;
      const canMoveDown = categoryIndex < items.length - 1;

      return (
        <div
          key={item.id}
          className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 p-3 hover:bg-slate-50 transition-colors"
        >
          <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-bold text-slate-400">{categoryIndex + 1}</span>

          {editingScoreItemId === item.id && editingScoreItem ? (
            // 编辑模式
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => { setIconPickerFor('edit'); setShowIconPicker(true); }}
                className="w-10 h-10 flex items-center justify-center text-xl bg-slate-100 rounded-lg hover:bg-slate-200 hover:text-indigo-600 transition-colors border border-slate-200"
              >
                {(() => {
                  const EditIcon = MASTER_ICON_MAP[editingScoreItem.icon] || Star;
                  return <EditIcon size={20} />;
                })()}
              </button>
              <input
                type="text"
                value={editingScoreItem.name}
                onChange={(e) => setEditingScoreItem({ ...editingScoreItem, name: e.target.value.slice(0, MAX_SCORE_ITEM_NAME_LENGTH) })}
                className="flex-1 min-w-[100px] px-3 py-1.5 border border-blue-400 rounded-lg outline-none"
                placeholder="项目名称"
              />
              {/* 数值控制器 */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.max(MIN_SCORE, editingScoreItem.score - 1);
                    setEditingScoreItem({ ...editingScoreItem, score: newVal });
                    setEditScoreInputValue(String(newVal));
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="减少"
                >
                  <Minus size={14} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={editScoreInputValue}
                  onChange={(e) => setEditScoreInputValue(e.target.value)}
                  onBlur={() => {
                    const parsed = parseInt(editScoreInputValue);
                    if (isNaN(parsed) || parsed === 0) {
                      setEditingScoreItem({ ...editingScoreItem, score: DEFAULT_SCORE });
                      setEditScoreInputValue(String(DEFAULT_SCORE));
                    } else {
                      const clamped = Math.max(MIN_SCORE, Math.min(MAX_SCORE, parsed));
                      setEditingScoreItem({ ...editingScoreItem, score: clamped });
                      setEditScoreInputValue(String(clamped));
                    }
                  }}
                  placeholder="0"
                  className={`w-12 px-1 py-1.5 border rounded-lg text-center outline-none font-bold ${editingScoreItem.score < 0 ? 'border-rose-400 text-rose-600' : 'border-blue-400 text-emerald-600'}`}
                />
                <span className="text-sm">🍖</span>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(MAX_SCORE, editingScoreItem.score + 1);
                    setEditingScoreItem({ ...editingScoreItem, score: newVal });
                    setEditScoreInputValue(String(newVal));
                  }}
                  className="w-7 h-7 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded text-slate-600 transition-colors"
                  title="增加"
                >
                  <Plus size={14} />
                </button>
              </div>
              <button onClick={saveEditScoreItem} className="p-1.5 hover:bg-emerald-100 rounded text-emerald-600">
                <Check size={18} />
              </button>
              <button onClick={cancelEditScoreItem} className="p-1.5 hover:bg-slate-100 rounded text-slate-500">
                <X size={18} />
              </button>
            </div>
          ) : (
            // 显示模式
            <>
              <div className={`w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg ${item.score < 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <IconComp size={20} />
              </div>
              <span className="flex-1 min-w-[120px] sm:min-w-0 font-bold text-slate-700 text-clamp-2 leading-tight">{item.name}</span>
              <span className={`px-2 py-1 text-xs sm:text-sm font-bold rounded-full ${item.score < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                {item.score > 0 ? '+' : ''}{item.score} 🍖
              </span>
              <div className="flex items-center gap-1 ml-auto w-full sm:w-auto justify-end sm:justify-start">
                {/* 排序按钮（仅在各自分类内移动） */}
                <button
                  onClick={() => moveScoreItemByCategory(item.id, 'up')}
                  disabled={!canMoveUp}
                  className="hidden sm:inline-flex p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="分类内上移"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => moveScoreItemByCategory(item.id, 'down')}
                  disabled={!canMoveDown}
                  className="hidden sm:inline-flex p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title="分类内下移"
                >
                  <ChevronDown size={16} />
                </button>
                {/* 编辑删除按钮 */}
                <button
                  onClick={() => startEditScoreItem(item)}
                  className="w-8 h-8 sm:w-auto sm:h-auto p-1.5 hover:bg-blue-50 rounded text-slate-400 hover:text-blue-600 transition-colors"
                  title="编辑"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteScoreItem(item.id)}
                  className="w-8 h-8 sm:w-auto sm:h-auto p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors"
                  title="删除"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] modal-content">

        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-slate-800">⚙️ 老师设置</h2>
            {/* 草稿保存状态指示器 */}
            {saveStatus === 'saving' && (
              <span className="text-xs text-slate-400 flex items-center gap-1">
                <RefreshCw size={12} className="animate-spin" />
                保存中...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <Check size={12} />
                草稿已保存
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Toast 错误提示 */}
        {showErrorToast && error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700 animate-in slide-in-from-top-2 duration-200 shadow-lg">
            <div className="p-1.5 bg-red-100 rounded-lg shrink-0">
              <AlertTriangle size={18} className="text-red-600" />
            </div>
            <p className="text-sm font-medium flex-1 whitespace-pre-wrap">{error}</p>
            <button
              onClick={hideError}
              className="p-1.5 hover:bg-red-100 rounded-lg text-red-400 hover:text-red-600 transition-colors shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 草稿恢复提示 */}
        {showDraftPrompt && (
          <div className="mx-6 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl animate-in slide-in-from-top-2">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                <FileText className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-amber-800 mb-1">发现「{draftClassTitle || '此班级'}」的未保存草稿</h4>
                <p className="text-sm text-amber-600 mb-3">
                  上次编辑于 {formatDraftTime(draftSavedAt)}，是否恢复？
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRestoreDraft}
                    className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    恢复草稿
                  </button>
                  <button
                    onClick={handleDiscardDraft}
                    className="px-4 py-1.5 bg-white hover:bg-amber-100 text-amber-700 text-sm font-bold rounded-lg border border-amber-300 transition-colors"
                  >
                    放弃草稿
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-8">

          {/* Section: Account Management */}
          {user && (
            <div className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <User size={18} className="text-slate-600" />
                <h3 className="font-bold text-slate-700">账号管理</h3>
              </div>

              <div className="space-y-4">
                {/* User Info */}
                <div className="flex items-center gap-4 p-3 bg-white rounded-lg border border-slate-100">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-rose-400 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-sm">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{user.username}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Shield size={14} className="text-green-500" />
                      <span>永久授权</span>
                      <span className="text-green-500">✓</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => window.open(SYSTEM_GUIDE_URL, '_blank', 'noopener,noreferrer')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg font-bold text-amber-700 hover:bg-amber-100 hover:border-amber-300 transition-all min-h-[44px]"
                  >
                    <FileText size={16} />
                    系统说明
                  </button>
                  <button
                    onClick={() => setShowChangePassword(true)}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all min-h-[44px]"
                  >
                    <KeyRound size={16} />
                    修改密码
                  </button>
                  <button
                    onClick={() => {
                      onClose(); // 先关闭设置弹窗
                      onLogout?.(); // 再执行退出登录
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-rose-200 rounded-lg font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-all min-h-[44px]"
                  >
                    <LogOut size={16} />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Section 0: Titles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <PenTool size={16} />
                系统名称 (全局)
              </label>
              <input
                type="text"
                value={systemTitle}
                onChange={(e) => setSystemTitle(e.target.value)}
                placeholder="例如：快乐小学晨读"
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-slate-700"
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>

            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <LayoutGrid size={16} />
                当前班级名称
              </label>
              <input
                type="text"
                value={classTitle}
                onChange={(e) => setClassTitle(e.target.value)}
                placeholder="例如：三年二班"
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-bold text-slate-700"
                autoComplete="off"
                enterKeyHint="done"
              />
            </div>
          </div>

          {/* Section 1: Stage Thresholds Configuration */}
          <div className="space-y-4">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Drumstick size={16} />
              成长阶段配置 (食物数量)
            </label>
            <p className="text-sm text-slate-400 mb-2">
              设置每个阶段所需的累计食物数量。宠物从1级成长到10级（10级可毕业）。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {stageThresholds.map((threshold, index) => (
                <div key={index} className="relative">
                  <label className="block text-xs font-bold text-center text-slate-400 mb-1">
                    {index + 1}级
                  </label>
                  <input
                    type="number"
                    min={index === 0 ? 0 : stageThresholds[index - 1] + 1}
                    value={threshold}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0;
                      setStageThresholds(prev => {
                        const newThresholds = [...prev];
                        newThresholds[index] = newValue;
                        return newThresholds;
                      });
                    }}
                    disabled={index === 0}
                    className={`
                      w-full p-2 text-center border rounded-lg font-bold text-sm
                      ${index === 0
                        ? 'bg-slate-100 border-slate-200 text-slate-400'
                        : 'border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                      }
                      ${index === 9 ? 'bg-amber-50 border-amber-300 text-amber-700' : ''}
                    `}
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                <strong>💡 示例：</strong> 阶段配置为 [0, 5, 12, 20, 30, 40, 52, 65, 80, 100] 时：
                学生积累5份食物升到2级，积累100份食物达到10级可毕业。
              </p>
            </div>
          </div>

          {/* Section 2: Theme Settings */}
          <div className="space-y-3">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Palette size={16} />
              界面主题
            </label>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedThemeId(theme.id)}
                  className={`
                    relative group flex flex-col items-center gap-2 p-2 rounded-xl border-2 transition-all
                    ${selectedThemeId === theme.id
                      ? 'border-slate-800 bg-slate-50 shadow-md transform scale-105'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200'}
                  `}
                >
                  <div className={`w-8 h-8 rounded-full shadow-sm ${theme.colors.accent} border-2 border-white`} />
                  <span className={`text-xs font-bold ${selectedThemeId === theme.id ? 'text-slate-800' : 'text-slate-500'}`}>
                    {theme.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Section 2.5: Score Items Configuration */}
          <div className="space-y-4 relative">
            <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Target size={16} />
              加分/扣分项目配置 ({scoreItems.length}个)
            </label>
            <p className="text-sm text-slate-400">
              设置老师可以给学生操作的项目。正数为加分，负数为扣分。
            </p>

            {/* Icon Picker Modal */}
            {showIconPicker && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={() => setShowIconPicker(false)}
              >
                <div
                  className="bg-white rounded-2xl shadow-2xl border-2 border-indigo-100 p-4 w-full max-w-md max-h-[80vh] overflow-hidden animate-in zoom-in-95 duration-200 modal-content"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-indigo-800 flex items-center gap-2">
                      <Search size={16} /> 选择图标
                    </h4>
                    <button
                      onClick={() => setShowIconPicker(false)}
                      className="p-1 hover:bg-indigo-50 rounded-full text-indigo-400 hover:text-indigo-600"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* Categories */}
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
                    {Object.entries(ICON_CATEGORIES).map(([key, cat]) => (
                      <button
                        key={key}
                        onClick={() => setActiveIconTab(key as any)}
                        className={`
                          px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border
                          ${activeIconTab === key
                            ? 'bg-indigo-500 border-indigo-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}
                        `}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Icons Grid */}
                  <div className="grid grid-cols-6 sm:grid-cols-8 gap-3 max-h-60 overflow-y-auto p-1">
                    {displayedIcons.map(iconKey => {
                      const Icon = MASTER_ICON_MAP[iconKey];
                      if (!Icon) return null;
                      const isSelected = iconPickerFor === 'new'
                        ? newScoreItemIcon === iconKey
                        : editingScoreItem?.icon === iconKey;

                      return (
                        <button
                          key={iconKey}
                          onClick={() => {
                            if (iconPickerFor === 'new') {
                              setNewScoreItemIcon(iconKey);
                            } else if (editingScoreItem) {
                              setEditingScoreItem({ ...editingScoreItem, icon: iconKey });
                            }
                            setShowIconPicker(false);
                          }}
                          className={`
                            aspect-square rounded-xl flex items-center justify-center transition-all
                            ${isSelected
                              ? 'bg-indigo-500 text-white shadow-md scale-110 ring-2 ring-indigo-200'
                              : 'bg-slate-50 text-slate-400 hover:bg-white hover:text-indigo-500 hover:shadow-sm hover:scale-105 border border-slate-100'}
                          `}
                        >
                          <Icon size={24} strokeWidth={2} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Score Items List */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {scoreItems.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  <Target size={28} className="mx-auto mb-2 opacity-50" />
                  <p>暂无项目，请在下方添加</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-700">加分项目（{positiveScoreItems.length}）</span>
                    <span className="text-[11px] text-emerald-600">分值 &gt; 0</span>
                  </div>
                  {positiveScoreItems.length > 0 ? (
                    renderScoreItems(positiveScoreItems)
                  ) : (
                    <div className="px-3 py-2 text-xs text-slate-400">暂无加分项目</div>
                  )}

                  <div className="px-3 py-2 bg-rose-50 border-y border-rose-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-700">扣分项目（{negativeScoreItems.length}）</span>
                    <span className="text-[11px] text-rose-600">分值 &lt; 0</span>
                  </div>
                  {negativeScoreItems.length > 0 ? (
                    renderScoreItems(negativeScoreItems)
                  ) : (
                    <div className="px-3 py-2 text-xs text-slate-400">暂无扣分项目</div>
                  )}
                </div>
              )}
            </div>

            {/* Add New Score Item */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap p-3 bg-slate-50 rounded-xl">
              <button
                onClick={() => { setIconPickerFor('new'); setShowIconPicker(true); }}
                className="w-10 h-10 flex items-center justify-center text-xl bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-indigo-600 transition-colors touch-target"
                title="选择图标"
              >
                {(() => {
                  const NewIcon = MASTER_ICON_MAP[newScoreItemIcon] || Star;
                  return <NewIcon size={20} />;
                })()}
              </button>
              <input
                type="text"
                value={newScoreItemName}
                onChange={(e) => setNewScoreItemName(e.target.value.slice(0, MAX_SCORE_ITEM_NAME_LENGTH))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddScoreItem(); }}
                placeholder="项目名称（如：早读、迟到）"
                className="flex-1 min-w-[120px] px-3 py-2 border border-slate-200 rounded-lg outline-none focus:border-blue-400"
              />
              {/* 数值控制器 */}
              <div className="flex items-center gap-1 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.max(MIN_SCORE, newScoreItemScore - 1);
                    setNewScoreItemScore(newVal);
                    setNewScoreInputValue(String(newVal));
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors touch-target"
                  title="减少"
                >
                  <Minus size={16} />
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newScoreInputValue}
                  onChange={(e) => setNewScoreInputValue(e.target.value)}
                  onBlur={() => {
                    const normalized = normalizeScoreInputValue(newScoreInputValue);
                    setNewScoreItemScore(normalized);
                    setNewScoreInputValue(String(normalized));
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddScoreItem(); }}
                  placeholder="0"
                  className={`w-14 px-1 py-2 border rounded-lg text-center outline-none focus:border-blue-400 font-bold ${newScoreItemScore < 0 ? 'text-rose-600 border-rose-200' : 'text-emerald-600 border-slate-200'}`}
                />
                <span className="text-sm">🍖</span>
                <button
                  type="button"
                  onClick={() => {
                    const newVal = Math.min(MAX_SCORE, newScoreItemScore + 1);
                    setNewScoreItemScore(newVal);
                    setNewScoreInputValue(String(newVal));
                  }}
                  className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors touch-target"
                  title="增加"
                >
                  <Plus size={16} />
                </button>
              </div>
              <button
                onClick={handleAddScoreItem}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1 min-h-[44px]"
              >
                <Plus size={16} />
                添加
              </button>
            </div>
          </div>

          {/* Section 3: Student List - 可视化管理 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Users size={16} />
                学生名单 ({students.length}人)
              </label>
              <button
                onClick={() => setShowBatchInput(!showBatchInput)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                {showBatchInput ? '取消批量添加' : '📋 批量添加'}
              </button>
            </div>



            {/* 批量添加框 */}
            {showBatchInput && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
                <p className="text-sm text-blue-700 font-medium">
                  每行输入一个学生姓名（最多{MAX_NAME_LENGTH}字），可直接从Excel粘贴：
                </p>
                <textarea
                  value={batchInput}
                  onChange={(e) => {
                    const normalized = e.target.value
                      .split(/\r?\n/)
                      .map(line => line.slice(0, MAX_NAME_LENGTH))
                      .join('\n');
                    setBatchInput(normalized);
                  }}
                  placeholder="张三&#10;李四&#10;王五"
                  className="w-full h-32 p-3 border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none font-mono"
                />
                <div className="flex flex-col sm:flex-row justify-end gap-2">
                  <button
                    onClick={() => { setShowBatchInput(false); setBatchInput(''); }}
                    className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors min-h-[44px]"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleBatchAdd}
                    className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Plus size={16} />
                    添加全部
                  </button>
                </div>
              </div>
            )}

            {/* 单个添加框 */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={newInputRef}
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value.slice(0, MAX_NAME_LENGTH))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddStudent(); }}
                placeholder={`输入学生姓名（最多${MAX_NAME_LENGTH}字）`}
                className="flex-1 p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <button
                onClick={handleAddStudent}
                disabled={!newStudentName.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <Plus size={18} />
                添加
              </button>
            </div>

            {/* 学生列表 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              {students.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Users size={32} className="mx-auto mb-2 opacity-50" />
                  <p>暂无学生，请在上方添加</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {students.map((student, index) => {
                    const isEditing = editingId === student.id;
                    return (
                      <StudentRow
                        key={student.id}
                        student={student}
                        index={index}
                        studentsCount={students.length}
                        dataSummary={studentDataSummaries.get(student.id) || ''}
                        petName={petSelections[student.id] ? (getPetById(petSelections[student.id])?.name || '宠物') : null}
                        isEditing={isEditing}
                        editingName={isEditing ? editingName : ''}
                        isConfirmingDelete={pendingDeleteId === student.id}
                        editInputRef={editInputRef}
                        onEditingNameChange={isEditing ? setEditingName : noopString}
                        onSaveEditing={isEditing ? saveEditing : noop}
                        onCancelEditing={isEditing ? cancelEditing : noop}
                        onMoveUp={handleMoveStudentUp}
                        onMoveDown={handleMoveStudentDown}
                        onStartEditing={handleStartEditing}
                        onDelete={handleDeleteStudentCallback}
                        onCancelDelete={handleCancelDelete}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 一键分配宠物按钮 */}
            <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Shuffle className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-indigo-900">一键分配宠物</h4>
                    <p className={`text-xs ${hasUnsavedStudents ? 'text-amber-600' : 'text-indigo-600'}`}>
                      {hasUnsavedStudents
                        ? `⚠️ 有 ${unsavedNewStudents.length} 位新学生尚未保存，请先点击「保存设置」后再分配宠物`
                        : unassignedStudents.length > 0
                          ? `为 ${unassignedStudents.length} 位未分配的学生随机分配宠物`
                          : students.length > 0
                            ? '所有学生都已分配宠物'
                            : '请先添加学生'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleOpenPetAssignModal}
                  disabled={unassignedStudents.length === 0 || students.length === 0 || hasUnsavedStudents}
                  className={`
                    w-full sm:w-auto px-4 py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-2 min-h-[44px]
                    ${unassignedStudents.length > 0 && students.length > 0 && !hasUnsavedStudents
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm hover:shadow-md'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'}
                  `}
                >
                  <Shuffle size={16} />
                  分配
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              💡 提示：修改学生姓名不会丢失已有的进度和徽章数据。删除有数据的学生会需要二次确认。
            </p>

            {/* Section 3.5: Group Management */}
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Users size={16} />
                分组管理
              </label>
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-indigo-900">创建、编辑、排序、随机分组</p>
                  <p className="text-xs text-indigo-700 mt-1">建议先完成学生名单维护，再进入分组管理进行分组操作。</p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenGroupManager?.();
                  }}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors shrink-0 min-h-[44px]"
                >
                  打开分组管理
                </button>
              </div>
            </div>

            {/* Section 3.6: Dangerous Operation */}
            <div className="space-y-3">
              <label className="text-sm font-bold uppercase tracking-wider text-rose-600 flex items-center gap-2">
                <AlertTriangle size={16} />
                危险操作
              </label>
              <div className="p-4 rounded-xl border border-orange-200 bg-orange-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-orange-800">从其他班级复用配置</p>
                  <p className="text-xs text-orange-700 mt-1">
                    覆盖积分规则、小卖部商品与等级配置；不影响学生成长数据。
                  </p>
                </div>
                <button
                  onClick={handleOpenReuseConfigModal}
                  disabled={!canReuseClassConfig || !onReuseClassConfig}
                  title={!canReuseClassConfig ? '至少需要 2 个班级才能复用' : undefined}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-bold transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 min-h-[44px]"
                >
                  从其他班级复用配置
                </button>
              </div>
              {!canReuseClassConfig && (
                <p className="text-xs text-slate-500">至少需要 2 个班级才能复用</p>
              )}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="font-bold text-rose-800">重置班级所有学生进度</p>
                  <p className="text-xs text-rose-700 mt-1">
                    将清空积分、宠物、徽章、成长记录与兑换记录，且不可撤销。
                  </p>
                </div>
                <button
                  onClick={() => {
                    onClose();
                    onOpenResetProgress?.();
                  }}
                  disabled={currentStudents.length === 0}
                  className="w-full sm:w-auto px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0 min-h-[44px]"
                >
                  重置班级所有学生进度
                </button>
              </div>
              {currentStudents.length === 0 && (
                <p className="text-xs text-slate-500">当前班级暂无学生，暂不可执行重置。</p>
              )}
            </div>
          </div>

          {/* Section 4: Generate Test Data (仅开发者可见) */}
          {user?.username && DEVELOPER_USERNAMES.includes(user.username) && (
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <FlaskConical className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-emerald-900">生成测试数据</h3>
                  <p className="text-sm text-emerald-700/80">添加50个随机学生用于功能测试</p>
                </div>
              </div>
              <button
                onClick={handleGenerateTestDataClick}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap min-h-[44px]"
              >
                生成测试数据
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 safe-area-bottom">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition-colors min-h-[44px]"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 shadow-lg transition-colors flex items-center justify-center gap-2 min-h-[44px]"
          >
            <Save className="w-5 h-5" />
            保存设置
          </button>
        </div>

      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ClassConfigReuseModal
        isOpen={showReuseConfigModal}
        targetClassTitle={currentClassTitle}
        sourceClasses={reusableSourceClasses}
        onClose={() => {
          if (isReusingConfig) return;
          setShowReuseConfigModal(false);
          setShowReusePasswordModal(false);
          setSelectedReuseSourceClassId('');
          setSelectedReuseFields([]);
          setReusePasswordError('');
        }}
        onConfirm={handleConfirmReuseSource}
      />

      <PasswordConfirmModal
        isOpen={showReusePasswordModal}
        title="确认复用配置"
        description={`将配置复用到「${currentClassTitle}」`}
        confirmText="确认复用"
        isSubmitting={isReusingConfig}
        errorMessage={reusePasswordError}
        onClose={() => {
          if (isReusingConfig) return;
          setShowReusePasswordModal(false);
          setReusePasswordError('');
        }}
        onSubmit={handleSubmitReusePassword}
        onClearError={() => setReusePasswordError('')}
      />

      {/* 一键分配宠物确认弹窗 */}
      {showPetAssignModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 modal-content">
            {/* 弹窗头部 */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-xl">
                  <Shuffle className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-indigo-900">一键分配宠物</h3>
                  <p className="text-sm text-indigo-600">
                    即将为 {petAssignments.length} 位学生分配宠物
                  </p>
                </div>
              </div>
            </div>

            {/* 分配预览列表 */}
            <div className="p-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {petAssignments.map((assignment) => (
                  <div
                    key={assignment.studentId}
                    className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg"
                  >
                    <span className="font-bold text-slate-700 flex-1 min-w-0 text-clamp-2 leading-tight">
                      {assignment.studentName}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                      {assignment.petName}
                    </span>
                  </div>
                ))}
              </div>

              {assignedCount > 0 && (
                <p className="mt-3 text-xs text-slate-400 text-center">
                  已有 {assignedCount} 位学生分配了宠物，将保持不变
                </p>
              )}
            </div>

            {/* 错误提示 */}
            {petAssignError && (
              <div className="mx-4 mb-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <p className="text-sm font-medium">{petAssignError}</p>
              </div>
            )}

            {/* 操作按钮 */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between gap-3">
              <button
                onClick={handleReRandomize}
                disabled={isAssigning}
                className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                <RefreshCw size={16} className={isAssigning ? 'animate-spin' : ''} />
                重新随机
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleClosePetAssignModal}
                  disabled={isAssigning}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmAssign}
                  disabled={isAssigning}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
                >
                  {isAssigning ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      分配中...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      确认分配
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 生成测试数据确认弹窗 */}
      {showTestDataModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 modal-content">
            {/* 弹窗头部 */}
            <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-xl">
                  <FlaskConical className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-900">生成测试数据</h3>
                  <p className="text-sm text-emerald-600">
                    为开发调试创建模拟数据
                  </p>
                </div>
              </div>
            </div>

            {/* 弹窗内容 */}
            <div className="p-5 space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">当前学生数量</span>
                  <span className="font-bold text-slate-700">{initialStudentCount} 人</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">将要添加</span>
                  <span className="font-bold text-emerald-600">+50 人</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between text-sm">
                  <span className="text-slate-500">添加后总数</span>
                  <span className="font-bold text-slate-900">{initialStudentCount + 50} 人</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-xs text-amber-700">
                  <strong>📌 每个测试学生将包含：</strong>
                </p>
                <ul className="mt-1 text-xs text-amber-600 space-y-0.5">
                  <li>• 随机宠物（21种之一）</li>
                  <li>• 随机食物数（0~100份）</li>
                  <li>• 随机徽章数（0~10枚）</li>
                </ul>
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
              <button
                onClick={() => setShowTestDataModal(false)}
                disabled={isGeneratingTestData}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={handleConfirmGenerateTestData}
                disabled={isGeneratingTestData}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingTestData ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    确认生成
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
