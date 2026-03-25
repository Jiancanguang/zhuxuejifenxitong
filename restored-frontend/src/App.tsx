import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Settings, Trophy, LayoutGrid, Undo2, CheckCircle2, Eraser, ShoppingBag, Cloud, Search, Sparkles, Users, X, Loader2, WifiOff, AlertTriangle, Download, ArrowUpDown, ChevronDown } from 'lucide-react';
import { StudentCard } from './components/StudentCard';
import { SettingsModal } from './components/SettingsModal';
import { PetSelectionModal } from './components/PetSelectionModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { GraduationModal } from './components/GraduationModal';
import { ClassManagerModal } from './components/ClassManagerModal';
import { GrowthRecordModal } from './components/GrowthRecordModal';
import { StoreModal } from './components/StoreModal';
import { BadgeWallModal } from './components/BadgeWallModal';
import { CertificateExportModal } from './components/CertificateExportModal';
import { ScoreSelectModal } from './components/ScoreSelectModal';
import { RecordLimitWarning } from './components/RecordLimitWarning';
import { ResetProgressFlowModal } from './components/ResetProgressFlowModal';
import { GroupManagerModal } from './components/groups/GroupManagerModal';
import { GroupFilterBar, GroupFilterValue } from './components/groups/GroupFilterBar';
import { GroupAssignModal } from './components/groups/GroupAssignModal';
import { PetRenameModal } from './components/PetRenameModal';
import { AuthPage } from './components/AuthPage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useCloudData } from './hooks/useCloudData';
import { AdminLoginPage } from './components/admin/AdminLoginPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminUsers } from './components/admin/AdminUsers';
import { AdminAuditLogs } from './components/admin/AdminAuditLogs';
import { AdminBackups } from './components/admin/AdminBackups';
import { THEMES, ALL_PETS, DEFAULT_SYSTEM_TITLE, REWARDS, DEFAULT_STAGE_THRESHOLDS, DEFAULT_SCORE_ITEMS, calculateStageFromFood, canGraduate, getPetById } from './constants';
import { GlobalState, ClassState, Badge, PetBreed, HistoryRecord, Student, Group, RewardItem, ScoreItem, ReuseConfigField, StudentSortMode } from './types';
import { matchesSearch, generateTestStudentNames } from './utils';
import * as dataService from './services/data';
import { ApiError, CLASS_RESET_CONFLICT_EVENT } from './lib/api';
import { generateClientId } from './lib/clientId';
import { sortStudentsByMode } from './lib/studentSort';
import { useDeviceDetect, useSafeArea, useScrollLock } from './hooks/useMobile';

// 自动分配宠物ID（如果没有选择宠物，则根据名字hash分配）
const getOrAssignPetId = (
  studentName: string,
  existingPetId: string | undefined,
  allPets: typeof ALL_PETS
): string => {
  if (existingPetId) return getPetById(existingPetId)?.id || existingPetId;
  const hash = studentName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return allPets[hash % allPets.length].id;
};

type ExportDialogState = {
  mode: 'single' | 'batch';
  templateType: 'certificate' | 'sticker';
  studentId?: string;
} | null;

type InteractionMode = 'normal' | 'revoke' | 'batch';
const STUDENT_SORT_OPTIONS: Array<{ value: StudentSortMode; label: string }> = [
  { value: 'manual', label: '默认排序' },
  { value: 'name', label: '名称首字母' },
  { value: 'leaderboard', label: '排行榜' },
  { value: 'progress', label: '进度' },
];
const EMPTY_BADGES: Badge[] = [];

function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  return useCallback(((...args: Parameters<T>) => fnRef.current(...args)) as T, []);
}

// 主应用组件
function MainApp() {
  const { user, status, logout, kickReason, clearKickReason } = useAuth();

  // 使用云端数据 hook
  const cloudData = useCloudData();
  const {
    store,
    isLoading: isDataLoading,
    isSaving,
    error: dataError,
    addClass,
    switchClass,
    deleteClass: cloudDeleteClass,
    renameClass,
    updateClassSettings,
    reuseClassConfig: cloudReuseClassConfig,
    addStudent: cloudAddStudent,
    updateStudent: cloudUpdateStudent,
    deleteStudent: cloudDeleteStudent,
    renamePet: cloudRenamePet,
    createGroup: cloudCreateGroup,
    updateGroup: cloudUpdateGroup,
    deleteGroup: cloudDeleteGroup,
    reorderGroups: cloudReorderGroups,
    randomGroup: cloudRandomGroup,
    batchAssignStudents: cloudBatchAssignStudents,
    checkinStudent: cloudCheckinStudent,
    checkinStudentsBatch: cloudCheckinStudentsBatch,
    deleteHistory: cloudDeleteHistory,
    deleteHistoryBatch: cloudDeleteHistoryBatch,
    clearClassHistory,
    updateSystemTitle,
    refreshData,
    updateLocalStore,
  } = cloudData;

  // 当前班级和主题
  const currentClass = useMemo(() => {
    if (!store) return null;
    return store.classes[store.currentClassId] || Object.values(store.classes)[0];
  }, [store]);

  const currentTheme = useMemo(() => {
    if (!currentClass) return THEMES[0];
    return THEMES.find(t => t.id === currentClass.themeId) || THEMES[0];
  }, [currentClass?.themeId]);

  const classOptions = useMemo(() => {
    if (!store) return [] as Array<{ id: string; title: string }>;
    return Object.values(store.classes).map(cls => ({
      id: cls.id,
      title: cls.title,
    }));
  }, [store]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isClassManagerOpen, setIsClassManagerOpen] = useState(false);
  const [isGroupManagerOpen, setIsGroupManagerOpen] = useState(false);
  const [isResetProgressOpen, setIsResetProgressOpen] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectingStudent, setSelectingStudent] = useState<string | null>(null);
  const [graduatingStudent, setGraduatingStudent] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('normal');
  const [pendingRevokedIds, setPendingRevokedIds] = useState<Set<string>>(new Set());
  const [badgeWallStudent, setBadgeWallStudent] = useState<string | null>(null);
  const [scoringStudent, setScoringStudent] = useState<string | null>(null); // 正在选择加分项的学生
  const [showRecordLimitWarning, setShowRecordLimitWarning] = useState(false);
  const [showCollectOrb, setShowCollectOrb] = useState(false); // 光团收集动画
  const [collectingStudentId, setCollectingStudentId] = useState<string | null>(null); // 正在收集徽章的学生
  const [orbTargetPos, setOrbTargetPos] = useState({ x: 0, y: 0 }); // 光团目标位置
  const [petRenameStudentId, setPetRenameStudentId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ id: string; message: string; visible: boolean; batchId?: string; classId?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const resetConflictSyncTimerRef = useRef<number | null>(null);
  const clearBatchEffectsTimerRef = useRef<number | null>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupFilterValue>('all');
  const [groupAssignStudentId, setGroupAssignStudentId] = useState<string | null>(null);
  const [isBatchGroupAssignOpen, setIsBatchGroupAssignOpen] = useState(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [batchEffectStudentIds, setBatchEffectStudentIds] = useState<Set<string> | null>(null);
  const studentGridContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportRafRef = useRef<number | null>(null);
  const [viewportInfo, setViewportInfo] = useState(() => {
    if (typeof window === 'undefined') {
      return { width: 1280, height: 800, scrollY: 0 };
    }
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollY: window.scrollY,
    };
  });
  const [gridTopY, setGridTopY] = useState(0);
  const [virtualRowHeight, setVirtualRowHeight] = useState(360);

  // 批量模式状态
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [exportDialogState, setExportDialogState] = useState<ExportDialogState>(null);
  const isRevokeMode = interactionMode === 'revoke';
  const isBatchMode = interactionMode === 'batch';
  const { isMobile } = useDeviceDetect();
  const safeArea = useSafeArea();
  const isIOSDevice = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const maxTouchPoints = navigator.maxTouchPoints || 0;
    return /iPad|iPhone|iPod/i.test(ua) || (platform === 'MacIntel' && maxTouchPoints > 1);
  }, []);

  // 更新页面标题
  useEffect(() => {
    if (store && currentClass) {
      document.title = `${store.systemTitle} - ${currentClass.title}`;
    }
  }, [currentClass?.title, store?.systemTitle]);

  const isAnyModalOpen = useMemo(
    () => (
      isSettingsOpen
      || isLeaderboardOpen
      || isClassManagerOpen
      || isGroupManagerOpen
      || isResetProgressOpen
      || isStoreOpen
      || isHistoryOpen
      || selectingStudent !== null
      || graduatingStudent !== null
      || badgeWallStudent !== null
      || scoringStudent !== null
      || showRecordLimitWarning
      || petRenameStudentId !== null
      || groupAssignStudentId !== null
      || isBatchGroupAssignOpen
      || exportDialogState !== null
    ),
    [
      isSettingsOpen,
      isLeaderboardOpen,
      isClassManagerOpen,
      isGroupManagerOpen,
      isResetProgressOpen,
      isStoreOpen,
      isHistoryOpen,
      selectingStudent,
      graduatingStudent,
      badgeWallStudent,
      scoringStudent,
      showRecordLimitWarning,
      petRenameStudentId,
      groupAssignStudentId,
      isBatchGroupAssignOpen,
      exportDialogState,
    ]
  );
  useScrollLock(isAnyModalOpen);

  const toastBottomOffset = `${(isMobile ? 72 : 40) + safeArea.bottom}px`;

  useEffect(() => {
    return () => {
      if (clearBatchEffectsTimerRef.current !== null) {
        window.clearTimeout(clearBatchEffectsTimerRef.current);
        clearBatchEffectsTimerRef.current = null;
      }
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
        viewportRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewport = () => {
      setViewportInfo({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
      });
    };

    const scheduleViewportUpdate = () => {
      if (viewportRafRef.current !== null) return;
      viewportRafRef.current = window.requestAnimationFrame(() => {
        viewportRafRef.current = null;
        updateViewport();
      });
    };

    updateViewport();
    window.addEventListener('scroll', scheduleViewportUpdate, { passive: true });
    window.addEventListener('resize', scheduleViewportUpdate);
    return () => {
      window.removeEventListener('scroll', scheduleViewportUpdate);
      window.removeEventListener('resize', scheduleViewportUpdate);
    };
  }, []);

  // 本地更新当前班级（用于即时 UI 反馈）
  const updateCurrentClass = (updater: (prev: ClassState) => Partial<ClassState>) => {
    updateLocalStore(prevStore => {
      const cls = prevStore.classes[prevStore.currentClassId];
      if (!cls) return prevStore;
      const updates = updater(cls);
      return { ...prevStore, classes: { ...prevStore.classes, [cls.id]: { ...cls, ...updates } } };
    });
  };

  // 按班级 ID 更新（用于跨班级异步回调，避免误写当前班级）
  const updateClassById = (classId: string, updater: (prev: ClassState) => Partial<ClassState>) => {
    updateLocalStore(prevStore => {
      const cls = prevStore.classes[classId];
      if (!cls) return prevStore;
      const updates = updater(cls);
      return { ...prevStore, classes: { ...prevStore.classes, [cls.id]: { ...cls, ...updates } } };
    });
  };

  // 当前分组筛选值无效时回退到“全部”
  useEffect(() => {
    if (!currentClass) return;
    if (groupFilter === 'all') return;

    if (groupFilter === 'ungrouped') {
      const hasUngrouped = currentClass.students.some(student => !student.groupId);
      if (!hasUngrouped) {
        setGroupFilter('all');
      }
      return;
    }

    const exists = currentClass.groups.some(group => group.id === groupFilter);
    if (!exists) {
      setGroupFilter('all');
    }
  }, [currentClass, groupFilter]);

  const groupsById = useMemo(() => {
    const map = new Map<string, Group>();
    currentClass?.groups.forEach(group => map.set(group.id, group));
    return map;
  }, [currentClass?.groups]);

  const searchMatchedStudents = useMemo(() => {
    if (!currentClass) return [] as Student[];
    return currentClass.students.filter(student => matchesSearch(student.name, searchQuery));
  }, [currentClass, searchQuery]);

  const filteredStudents = useMemo(() => {
    if (!currentClass) return [] as Student[];
    return searchMatchedStudents.filter(student => {
      if (groupFilter === 'all') return true;
      if (groupFilter === 'ungrouped') return !student.groupId;
      return student.groupId === groupFilter;
    });
  }, [currentClass, searchMatchedStudents, groupFilter]);

  const activeStudentSortMode: StudentSortMode = currentClass?.studentSortMode || 'manual';
  const activeStudentSortOption = useMemo(
    () => STUDENT_SORT_OPTIONS.find(option => option.value === activeStudentSortMode) || STUDENT_SORT_OPTIONS[0],
    [activeStudentSortMode]
  );

  const displayedStudents = useMemo(() => {
    if (!currentClass) return [] as Student[];
    return sortStudentsByMode(filteredStudents, activeStudentSortMode, {
      progress: currentClass.progress,
      badges: currentClass.badges,
      history: currentClass.history,
    });
  }, [currentClass, filteredStudents, activeStudentSortMode]);
  const isIOSStressMode = isIOSDevice && displayedStudents.length >= 100;
  const isLiteCardMode = isIOSStressMode;
  const shouldVirtualizeStudents = isIOSDevice && displayedStudents.length >= 120;

  const gridColumnCount = useMemo(() => {
    if (viewportInfo.width >= 1280) return 6;
    if (viewportInfo.width >= 1024) return 5;
    if (viewportInfo.width >= 768) return 4;
    if (viewportInfo.width >= 640) return 3;
    return 2;
  }, [viewportInfo.width]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const measure = () => {
      const container = studentGridContainerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      setGridTopY(window.scrollY + rect.top);

      const firstCard = container.querySelector('[data-student-id]') as HTMLElement | null;
      if (firstCard) {
        const gapPx = viewportInfo.width >= 768 ? 32 : 24;
        const measuredRowHeight = Math.round(firstCard.getBoundingClientRect().height + gapPx);
        const nextHeight = Math.max(280, Math.min(520, measuredRowHeight));
        setVirtualRowHeight(prev => (Math.abs(prev - nextHeight) >= 6 ? nextHeight : prev));
      }
    };

    const rafId = window.requestAnimationFrame(measure);
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [
    displayedStudents.length,
    viewportInfo.width,
    isBatchMode,
    isRevokeMode,
    searchQuery,
    groupFilter,
    shouldVirtualizeStudents,
  ]);

  const virtualRange = useMemo(() => {
    if (!shouldVirtualizeStudents) {
      return {
        startIndex: 0,
        endIndex: displayedStudents.length,
        paddingTop: 0,
        paddingBottom: 0,
      };
    }

    const totalRows = Math.max(1, Math.ceil(displayedStudents.length / gridColumnCount));
    const viewportStartY = viewportInfo.scrollY - gridTopY;
    const viewportEndY = viewportStartY + viewportInfo.height;
    const overscanRows = 3;

    const startRow = Math.max(0, Math.floor(viewportStartY / virtualRowHeight) - overscanRows);
    const endRow = Math.min(
      totalRows - 1,
      Math.ceil(viewportEndY / virtualRowHeight) + overscanRows
    );

    const startIndex = Math.max(0, startRow * gridColumnCount);
    const endIndex = Math.min(displayedStudents.length, (endRow + 1) * gridColumnCount);
    const paddingTop = startRow * virtualRowHeight;
    const paddingBottom = Math.max(0, (totalRows - endRow - 1) * virtualRowHeight);

    return { startIndex, endIndex, paddingTop, paddingBottom };
  }, [
    shouldVirtualizeStudents,
    displayedStudents.length,
    gridColumnCount,
    viewportInfo.scrollY,
    viewportInfo.height,
    gridTopY,
    virtualRowHeight,
  ]);

  const studentsToRender = useMemo(() => {
    if (!shouldVirtualizeStudents) return displayedStudents;
    return displayedStudents.slice(virtualRange.startIndex, virtualRange.endIndex);
  }, [shouldVirtualizeStudents, displayedStudents, virtualRange.startIndex, virtualRange.endIndex]);

  const batchExportStudents = useMemo(() => {
    if (!currentClass) return [] as Array<{ id: string; name: string; badges: Badge[] }>;
    return currentClass.students
      .filter(student => selectedStudentIds.has(student.id))
      .map(student => ({
        id: student.id,
        name: student.name,
        badges: currentClass.badges[student.id] || [],
      }));
  }, [currentClass, selectedStudentIds]);

  const singleExportStudents = useMemo(() => {
    if (!currentClass || !exportDialogState || exportDialogState.mode !== 'single' || !exportDialogState.studentId) {
      return [] as Array<{ id: string; name: string; badges: Badge[] }>;
    }
    const targetStudent = currentClass.students.find(student => student.id === exportDialogState.studentId);
    if (!targetStudent) {
      return [] as Array<{ id: string; name: string; badges: Badge[] }>;
    }
    return [{
      id: targetStudent.id,
      name: targetStudent.name,
      badges: currentClass.badges[targetStudent.id] || [],
    }];
  }, [currentClass, exportDialogState]);

  const getGroupCountById = useCallback((groupId: string | null) => {
    if (!currentClass) return 0;
    return searchMatchedStudents.filter(student => {
      if (groupId === null) return !student.groupId;
      return student.groupId === groupId;
    }).length;
  }, [currentClass, searchMatchedStudents]);

  const getBatchSubsetByFilter = useCallback((filterKey: GroupFilterValue) => {
    if (filterKey === 'all') return displayedStudents;
    if (filterKey === 'ungrouped') return displayedStudents.filter(student => !student.groupId);
    return displayedStudents.filter(student => student.groupId === filterKey);
  }, [displayedStudents]);

  const isBatchGroupSelected = useCallback((filterKey: GroupFilterValue) => {
    const subset = getBatchSubsetByFilter(filterKey);
    if (subset.length === 0) return false;
    return subset.every(student => selectedStudentIds.has(student.id));
  }, [getBatchSubsetByFilter, selectedStudentIds]);

  const toggleRevokeMode = () => {
    const enableRevoke = interactionMode !== 'revoke';
    setInteractionMode(enableRevoke ? 'revoke' : 'normal');
    if (enableRevoke) {
      setSelectedStudentIds(new Set());
      setIsBatchGroupAssignOpen(false);
    }
  };

  const toggleBatchMode = () => {
    const enableBatch = interactionMode !== 'batch';
    setInteractionMode(enableBatch ? 'batch' : 'normal');
    if (!enableBatch) {
      setSelectedStudentIds(new Set());
      setIsBatchGroupAssignOpen(false);
    }
  };

  const showUndoToast = (recordId: string | null, message: string, batchId?: string, classId?: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ id: recordId || '', message, visible: true, batchId, classId });
    toastTimerRef.current = window.setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 3000);
  };

  const scheduleClearBatchEffects = () => {
    if (clearBatchEffectsTimerRef.current !== null) {
      window.clearTimeout(clearBatchEffectsTimerRef.current);
    }
    const clearDelay = isIOSStressMode ? 1200 : 2200;
    clearBatchEffectsTimerRef.current = window.setTimeout(() => {
      setBatchEffectStudentIds(null);
      clearBatchEffectsTimerRef.current = null;
    }, clearDelay);
  };

  // 处理班级重置并发拦截：提示后立即同步，并在 3 秒后再次同步
  useEffect(() => {
    const handleResetConflict = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      const message = detail?.message || '班级正在重置，请稍后重试';

      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      setToast({ id: '', message, visible: true });
      toastTimerRef.current = window.setTimeout(() => setToast(prev => prev ? { ...prev, visible: false } : null), 3000);

      void refreshData();

      if (resetConflictSyncTimerRef.current) {
        window.clearTimeout(resetConflictSyncTimerRef.current);
      }
      resetConflictSyncTimerRef.current = window.setTimeout(() => {
        void refreshData();
        resetConflictSyncTimerRef.current = null;
      }, 3000);
    };

    window.addEventListener(CLASS_RESET_CONFLICT_EVENT, handleResetConflict as EventListener);

    return () => {
      window.removeEventListener(CLASS_RESET_CONFLICT_EVENT, handleResetConflict as EventListener);
      if (resetConflictSyncTimerRef.current) {
        window.clearTimeout(resetConflictSyncTimerRef.current);
        resetConflictSyncTimerRef.current = null;
      }
    };
  }, [refreshData]);

  const handleUndoToast = () => {
    if (toast) {
      if (toast.batchId) {
        // 批量撤回
        handleRevokeBatch(toast.classId || currentClass.id, toast.batchId);
      } else if (toast.id) {
        // 单个撤回
        handleRevokeHistory(toast.id, toast.classId || currentClass.id);
      }
      setToast(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    }
  };

  const handleClassAdd = async (title: string) => {
    try {
      await addClass(title);
      setIsClassManagerOpen(false);
    } catch (err) {
      showUndoToast(null, '创建班级失败，请重试');
    }
  };

  const handleClassSwitch = async (id: string) => {
    if (store?.classes[id]) {
      await switchClass(id);
      setIsClassManagerOpen(false);
      setIsSortMenuOpen(false);
      setInteractionMode(prev => (prev === 'batch' ? 'normal' : prev));
      setSelectedStudentIds(new Set());
      setIsBatchGroupAssignOpen(false);
      setGroupAssignStudentId(null);
      setGroupFilter('all');
      setScoringStudent(null);
    }
  };

  const handleClassDelete = async (id: string) => {
    try {
      await cloudDeleteClass(id);
    } catch (err) {
      showUndoToast(null, '删除班级失败，请重试');
    }
  };

  const handleClassRename = async (id: string, newTitle: string) => {
    try {
      await renameClass(id, newTitle);
    } catch (err) {
      showUndoToast(null, '重命名失败，请重试');
    }
  };

  const handleStudentSortModeChange = async (mode: StudentSortMode) => {
    if (!currentClass || mode === (currentClass.studentSortMode || 'manual')) return;
    try {
      await updateClassSettings(currentClass.id, { studentSortMode: mode });
    } catch (err) {
      showUndoToast(null, '切换排序失败，请重试');
    }
  };

  useEffect(() => {
    if (!isSortMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setIsSortMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSortMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isSortMenuOpen]);

  const handleStudentAction = (studentId: string) => {
    if (isRevokeMode) {
      // 获取已被撤回的记录ID集合
      const revokedRecordIds = new Set(
        currentClass.history
          .filter(h => h.type === 'revoke' && h.revokedRecordId)
          .map(h => h.revokedRecordId)
      );

      // 过滤掉撤回记录、已被撤回的记录、兑换记录、正在处理的记录
      const studentHistory = currentClass.history
        .filter(h =>
          h.studentId === studentId &&
          h.type !== 'revoke' &&
          h.type !== 'redeem' &&
          h.type !== 'rename' &&
          !revokedRecordIds.has(h.id)
          && !pendingRevokedIds.has(h.id)
        )
        .sort((a, b) => b.timestamp - a.timestamp);

      if (studentHistory.length === 0) {
        return showUndoToast(null, `该同学没有可撤回的记录`);
      }
      handleRevokeHistory(studentHistory[0].id);
      return;
    }

    // 如果只有一个加分项，直接应用，不弹窗
    const scoreItems = currentClass.scoreItems || [];
    if (scoreItems.length === 1) {
      handleScoreSelect(studentId, scoreItems[0]);
      return;
    }

    // 如果没有加分项，提示去设置
    if (scoreItems.length === 0) {
      showUndoToast(null, `请先在设置中添加加分项目`);
      return;
    }

    // 多个加分项时打开选择弹窗
    setScoringStudent(studentId);
  };

  // 智能检测记录数量，提前提醒用户清理
  useEffect(() => {
    if (!currentClass) return;
    const recordCount = currentClass.history.length;
    // 当记录数超过 8000 条时提醒（留有缓冲）
    if (recordCount >= 8000 && recordCount < 10000 && recordCount % 100 === 0) {
      showUndoToast(null, `📊 已有 ${recordCount} 条记录，建议清理旧记录`);
    }
  }, [currentClass?.history?.length]);

  // 处理加分项选择
  const handleScoreSelect = async (studentId: string, scoreItem: ScoreItem) => {
    // 检查历史记录数量
    if (currentClass.history.length >= 10000) {
      setShowRecordLimitWarning(true);
      return;
    }

    setScoringStudent(null);

    // 获取学生信息
    const student = currentClass.students.find(s => s.id === studentId);
    const studentName = student ? student.name : 'Unknown';

    // 计算当前食物数量（用于满级校验）
    const currentFood = currentClass.progress[studentId] || 0;

    // 检查满级状态：如果已满级且是加分操作，则不允许
    if (scoreItem.score > 0 && canGraduate(currentFood, currentClass.stageThresholds)) {
      showUndoToast(null, `⚠️ ${studentName} 已满级，请先收获徽章`);
      return;
    }

    // 自动分配宠物（如果没有）
    const petId = getOrAssignPetId(studentName, currentClass.petSelections[studentId], ALL_PETS);

    try {
      // 原子加分：后端事务内同时更新学生进度和历史
      const result = await cloudCheckinStudent(currentClass.id, {
        studentId,
        scoreItemName: scoreItem.name,
        scoreValue: scoreItem.score,
        petId,
      });

      if (studentName) {
        const scoreDisplay = scoreItem.score > 0 ? `+${scoreItem.score}` : `${scoreItem.score}`;
        showUndoToast(result.history.id, `${scoreItem.score > 0 ? '✨' : '⚡'} ${studentName} ${scoreItem.name} ${scoreDisplay}🍖`, undefined, currentClass.id);
      }
    } catch (err) {
      console.error('Failed to save score:', err);
      showUndoToast(null, '⚠️ 保存失败，请重试');
    }
  };

  // 批量加分处理
  const handleBatchScoreSelect = async (scoreItem: ScoreItem) => {
    if (selectedStudentIds.size === 0) return;
    setBatchEffectStudentIds(null);

    // 检查历史记录数量
    if (currentClass.history.length + selectedStudentIds.size >= 10000) {
      setShowRecordLimitWarning(true);
      return;
    }

    const batchId = generateClientId('batch_score');

    // 过滤掉已满级的学生（如果是加分操作）
    let validStudentIds = [...selectedStudentIds];
    if (scoreItem.score > 0) {
      validStudentIds = validStudentIds.filter(studentId => {
        const currentFood = currentClass.progress[studentId] || 0;
        return !canGraduate(currentFood, currentClass.stageThresholds);
      });

      if (validStudentIds.length === 0) {
        setBatchEffectStudentIds(null);
        showUndoToast(null, '⚠️ 所有选中的学生都已满级');
        return;
      }

      if (validStudentIds.length < selectedStudentIds.size) {
        const skippedCount = selectedStudentIds.size - validStudentIds.length;
        showUndoToast(null, `⚠️ 已跳过 ${skippedCount} 位满级学生`);
      }
    }

    if (validStudentIds.length >= 40) {
      const maxAnimatedStudents = isIOSStressMode ? 4 : (isIOSDevice ? 10 : 18);
      setBatchEffectStudentIds(new Set(validStudentIds.slice(0, maxAnimatedStudents)));
    }

    // 退出批量模式
    setInteractionMode(prev => (prev === 'batch' ? 'normal' : prev));
    setSelectedStudentIds(new Set());
    setScoringStudent(null);

    const batchItems = validStudentIds
      .map(studentId => {
        const student = currentClass.students.find(s => s.id === studentId);
        if (!student) return null;
        return {
          studentId,
          petId: getOrAssignPetId(student.name, currentClass.petSelections[studentId], ALL_PETS),
        };
      })
      .filter((item): item is { studentId: string; petId: string } => !!item);

    if (batchItems.length === 0) {
      setBatchEffectStudentIds(null);
      showUndoToast(null, '⚠️ 未找到可提交的学生');
      return;
    }

    try {
      const result = await cloudCheckinStudentsBatch(currentClass.id, {
        scoreItemName: scoreItem.name,
        scoreValue: scoreItem.score,
        batchId,
        items: batchItems,
      });

      const successCount = result.students.length;
      const scoreDisplay = scoreItem.score > 0 ? `+${scoreItem.score}` : `${scoreItem.score}`;
      showUndoToast(
        null,
        `${scoreItem.score > 0 ? '✨' : '⚡'} 已为 ${successCount} 位同学完成 ${scoreItem.name} ${scoreDisplay}🍖`,
        batchId,
        currentClass.id
      );
      scheduleClearBatchEffects();
    } catch (err: any) {
      console.error('Failed to save batch score:', err);
      showUndoToast(null, err?.message || '⚠️ 批量提交失败，请重试');
      scheduleClearBatchEffects();
    }
  };

  // 切换学生选中状态
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    const visibleStudents = displayedStudents;
    const allSelected = visibleStudents.length > 0 && visibleStudents.every(student => selectedStudentIds.has(student.id));

    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        visibleStudents.forEach(student => next.delete(student.id));
      } else {
        visibleStudents.forEach(student => next.add(student.id));
      }
      return next;
    });
  };

  // 退出批量模式
  const exitBatchMode = () => {
    setInteractionMode(prev => (prev === 'batch' ? 'normal' : prev));
    setSelectedStudentIds(new Set());
    setIsBatchGroupAssignOpen(false);
  };

  const handleGroupFilterClick = (filterKey: GroupFilterValue) => {
    setGroupFilter(filterKey);
  };

  const handleBatchGroupClick = (filterKey: GroupFilterValue) => {
    const subset = getBatchSubsetByFilter(filterKey);
    if (subset.length === 0) {
      showUndoToast(null, '当前视图下该组无可选学生');
      return;
    }

    setSelectedStudentIds(prev => {
      const next = new Set(prev);
      const allSelected = subset.every(student => next.has(student.id));

      if (allSelected) {
        subset.forEach(student => next.delete(student.id));
      } else {
        subset.forEach(student => next.add(student.id));
      }

      return next;
    });
  };

  const handleCreateGroup = async (name: string) => {
    await cloudCreateGroup(currentClass.id, name);
    showUndoToast(null, `✅ 已创建分组「${name}」`);
  };

  const handleUpdateGroup = async (groupId: string, data: { name?: string }) => {
    await cloudUpdateGroup(groupId, data);
    showUndoToast(null, '✅ 分组已更新');
  };

  const handleDeleteGroup = async (groupId: string) => {
    const result = await cloudDeleteGroup(groupId);
    showUndoToast(null, `✅ 分组已删除，${result.affectedStudents} 名学生已设为未分组`);
    return result;
  };

  const handleReorderGroups = async (orderedGroupIds: string[]) => {
    await cloudReorderGroups(currentClass.id, orderedGroupIds);
  };

  const handleRandomGroup = async (groupCount: number) => {
    await cloudRandomGroup(currentClass.id, groupCount);
    showUndoToast(null, `✅ 已随机分为 ${groupCount} 组`);
  };

  const handleAssignStudentGroup = async (studentId: string, groupId: string | null) => {
    try {
      await cloudUpdateStudent(studentId, { groupId });
      const groupName = groupId ? (groupsById.get(groupId)?.name || '分组') : '未分组';
      showUndoToast(null, `✅ 已更新分组：${groupName}`);
    } catch (err: any) {
      showUndoToast(null, err?.message || '⚠️ 更新分组失败');
      throw err;
    }
  };

  const handleOpenPetRename = (studentId: string) => {
    if (isBatchMode || isRevokeMode) return;
    const petId = currentClass.petSelections[studentId];
    if (!petId) {
      showUndoToast(null, '请先领养宠物后再起名');
      return;
    }
    setPetRenameStudentId(studentId);
  };

  const handleOpenSingleExport = (templateType: 'certificate' | 'sticker') => {
    if (!badgeWallStudent) return;
    setExportDialogState({
      mode: 'single',
      templateType,
      studentId: badgeWallStudent,
    });
  };

  const handleSubmitPetRename = async (nickname: string) => {
    if (!petRenameStudentId) return;
    const result = await cloudRenamePet(petRenameStudentId, nickname);
    showUndoToast(null, `已将宠物改名为「${result.petNickname}」`);
  };

  const handleBatchAssignGroup = async (groupId: string | null) => {
    const ids = [...selectedStudentIds];
    if (ids.length === 0) return;
    try {
      await cloudBatchAssignStudents(currentClass.id, ids, groupId);
      const groupName = groupId ? (groupsById.get(groupId)?.name || '分组') : '未分组';
      showUndoToast(null, `✅ 已为 ${ids.length} 位同学设置为「${groupName}」`);
      setIsBatchGroupAssignOpen(false);
      setSelectedStudentIds(new Set());
    } catch (err: any) {
      showUndoToast(null, err?.message || '⚠️ 批量分组失败');
      throw err;
    }
  };

  const handleAssignStudentsFromGroupManager = async (groupId: string, studentIds: string[]) => {
    if (studentIds.length === 0) return;
    try {
      await cloudBatchAssignStudents(currentClass.id, studentIds, groupId);
      const groupName = groupsById.get(groupId)?.name || '分组';
      showUndoToast(null, `✅ 已添加 ${studentIds.length} 位同学到「${groupName}」`);
    } catch (err: any) {
      showUndoToast(null, err?.message || '⚠️ 添加学生失败');
      throw err;
    }
  };

  // --- Other Handlers ---

  const handleRedeemReward = async (rewardId: string, studentId: string, cost: number) => {
    const reward = currentClass.rewards.find(r => r.id === rewardId);
    const student = currentClass.students.find(s => s.id === studentId);
    const currentStock = currentClass.inventory[rewardId] || 0;

    if (currentStock <= 0) return;

    try {
      const result = await dataService.redeemReward(currentClass.id, {
        studentId,
        rewardId,
      });

      updateCurrentClass(prev => {
        // 更新学生的 spentFood
        const updatedStudents = prev.students.map(s =>
          s.id === studentId
            ? { ...s, spentFood: result.spentFood ?? ((s.spentFood || 0) + cost) }
            : s
        );
        return {
          inventory: result.inventory,
          redemptions: result.redemptions,
          history: [...prev.history, result.history],
          students: updatedStudents,
        };
      });

      showUndoToast(
        null,
        `🎁 ${result.studentName || student?.name || studentId} 兑换了 ${result.rewardName || reward?.name || '商品'}`
      );
    } catch (err: any) {
      console.error('Failed to redeem reward:', err);
      showUndoToast(null, err?.message || '⚠️ 兑换失败，请重试');
    }
  };

  const handleRestock = async (rewardId: string, amount: number) => {
    // 保存回滚状态
    const prevInventory = { ...currentClass.inventory };
    const newInventory = { ...currentClass.inventory, [rewardId]: Math.max(0, (currentClass.inventory[rewardId] || 0) + amount) };

    // 先更新本地状态（乐观更新）
    updateCurrentClass(prev => ({ inventory: newInventory }));

    try {
      // 保存到云端
      await updateClassSettings(currentClass.id, { inventory: newInventory });
    } catch (err) {
      console.error('Failed to save inventory:', err);
      // 回滚本地状态
      updateCurrentClass(prev => ({ inventory: prevInventory }));
      showUndoToast(null, '⚠️ 保存库存失败，已自动撤销');
    }
  };

  const handleSaveReward = async (reward: RewardItem) => {
    // 保存回滚状态
    const prevRewards = [...currentClass.rewards];
    const prevInventory = { ...currentClass.inventory };

    const idx = currentClass.rewards.findIndex(r => r.id === reward.id);
    let newRewards = [...currentClass.rewards];
    let newInventory = { ...currentClass.inventory };

    if (idx >= 0) {
      newRewards[idx] = reward;
    } else {
      newRewards.push(reward);
      if (newInventory[reward.id] === undefined) {
        newInventory[reward.id] = 0;
      }
    }

    // 先更新本地状态（乐观更新）
    updateCurrentClass(prev => ({
      rewards: newRewards,
      inventory: newInventory,
    }));

    try {
      // 保存到云端
      await updateClassSettings(currentClass.id, {
        rewards: newRewards,
        inventory: newInventory,
      });
    } catch (err) {
      console.error('Failed to save reward:', err);
      // 回滚本地状态
      updateCurrentClass(prev => ({
        rewards: prevRewards,
        inventory: prevInventory,
      }));
      showUndoToast(null, '⚠️ 保存商品失败，已自动撤销');
    }
  };

  const handleDeleteReward = async (id: string) => {
    // 保存回滚状态
    const prevRewards = [...currentClass.rewards];

    const newRewards = currentClass.rewards.filter(r => r.id !== id);

    // 先更新本地状态（乐观更新）
    updateCurrentClass(prev => ({ rewards: newRewards }));

    try {
      // 保存到云端
      await updateClassSettings(currentClass.id, { rewards: newRewards });
    } catch (err) {
      console.error('Failed to delete reward:', err);
      // 回滚本地状态
      updateCurrentClass(prev => ({ rewards: prevRewards }));
      showUndoToast(null, '⚠️ 删除商品失败，已自动撤销');
    }
  };

  const handleRevokeHistory = async (recordId: string, classId: string = currentClass.id) => {
    const targetClass = store?.classes[classId];
    if (!targetClass) {
      showUndoToast(null, '⚠️ 班级不存在，无法撤回');
      return;
    }

    const record = targetClass.history.find(r => r.id === recordId);

    if (!record) {
      showUndoToast(null, '⚠️ 记录不存在或已被删除，无法撤回');
      return;
    }

    if (record.type === 'revoke') {
      showUndoToast(null, '⚠️ 无法撤回：这已经是一条撤回记录');
      return;
    }

    // redeem 类型现在支持撤回（退还肉量）

    if (record.type === 'rename') {
      showUndoToast(null, '⚠️ 改名记录不支持撤回');
      return;
    }

    const alreadyRevoked = targetClass.history.some(
      h => h.type === 'revoke' && h.revokedRecordId === recordId
    );
    if (alreadyRevoked) {
      showUndoToast(null, '⚠️ 无法撤回：该记录已被撤回过');
      return;
    }

    if (pendingRevokedIds.has(recordId)) {
      showUndoToast(null, '⚠️ 正在处理中，请稍候');
      return;
    }

    setPendingRevokedIds(prev => new Set([...prev, recordId]));

    try {
      const result = await dataService.revokeHistory(recordId);

      if (result.alreadyRevoked) {
        showUndoToast(null, '该记录已被其他设备撤回，正在同步...');
        await refreshData();
        return;
      }

      updateClassById(classId, prev => {
        const updates: Partial<ClassState> = {
          history: [...prev.history, result.revokeRecord],
        };

        if (result.student) {
          updates.progress = { ...prev.progress, [result.student.id]: result.student.foodCount };
          updates.petStages = { ...prev.petStages, [result.student.id]: result.student.petStage };
          if (result.student.petId !== undefined) {
            updates.petSelections = { ...prev.petSelections, [result.student.id]: result.student.petId || '' };
          }
          if (result.student.badges) {
            updates.badges = { ...prev.badges, [result.student.id]: result.student.badges };
          }
          // 同步 spentFood 到 students 数组
          if (result.student.spentFood !== undefined) {
            updates.students = prev.students.map(s =>
              s.id === result.student!.id ? { ...s, spentFood: result.student!.spentFood } : s
            );
          }
        }

        return { ...prev, ...updates };
      });

      showUndoToast(null, `✅ 已撤销 ${record.studentName} 的上一步操作`);
    } catch (err: any) {
      console.error('Failed to revoke history:', err);
      showUndoToast(null, err.message || '⚠️ 撤销失败，请重试');
    } finally {
      setPendingRevokedIds(prev => {
        const next = new Set(prev);
        next.delete(recordId);
        return next;
      });
    }
  };

  // 批量撤回
  const handleRevokeBatch = async (classId: string, batchId: string) => {
    try {
      const result = await dataService.revokeBatch(classId, batchId);

      if (result.revokeRecords.length === 0) {
        if (result.skippedCount > 0) {
          showUndoToast(null, '记录已被其他设备撤回，正在同步...');
          await refreshData();
        } else {
          showUndoToast(null, '没有可撤回的记录');
        }
        return;
      }

      updateClassById(classId, prev => {
        const newProgress = { ...prev.progress };
        const newPetStages = { ...prev.petStages };

        result.students.forEach(s => {
          newProgress[s.id] = s.foodCount;
          newPetStages[s.id] = s.petStage;
        });

        return {
          ...prev,
          history: [...prev.history, ...result.revokeRecords],
          progress: newProgress,
          petStages: newPetStages,
        };
      });

      if (result.skippedCount > 0) {
        showUndoToast(null, `已撤回 ${result.revokeRecords.length} 条记录（${result.skippedCount} 条已被其他设备撤回）`);
        await refreshData();
      } else {
        showUndoToast(null, `已撤回 ${result.revokeRecords.length} 条记录`);
      }
    } catch (err: any) {
      console.error('Failed to revoke batch:', err);
      showUndoToast(null, err.message || '⚠️ 批量撤销失败，请重试');
    }
  };

  const handleClearAllHistory = async () => {
    // 保留兑换记录（type='redeem'），只删除其他类型
    const redeemRecords = currentClass.history.filter(h => h.type === 'redeem');
    const nonRedeemRecords = currentClass.history.filter(h => h.type !== 'redeem');

    if (nonRedeemRecords.length === 0) {
      showUndoToast(null, '没有可清空的记录');
      return;
    }

    // 保存回滚状态
    const prevHistory = [...currentClass.history];

    // 先更新本地状态（乐观更新）
    updateCurrentClass(prev => ({ ...prev, history: redeemRecords }));

    try {
      // 批量删除非兑换类型的历史记录
      const recordIds = nonRedeemRecords.map(r => r.id);
      await cloudDeleteHistoryBatch(recordIds);
      showUndoToast(null, `✅ 已清空 ${nonRedeemRecords.length} 条记录（保留兑换记录）`);
    } catch (err) {
      console.error('Failed to clear history:', err);
      // 回滚本地状态
      updateCurrentClass(prev => ({ ...prev, history: prevHistory }));
      showUndoToast(null, '⚠️ 清空历史失败，已自动撤销');
    }
  };

  const handleClearFirstHistory = async (count: number) => {
    // 按时间排序，获取最早的记录（排除兑换记录）
    const nonRedeemRecords = currentClass.history
      .filter(h => h.type !== 'redeem')
      .sort((a, b) => a.timestamp - b.timestamp);

    // 只删除最早的 count 条非兑换记录
    const toDelete = nonRedeemRecords.slice(0, count);
    const toDeleteIds = new Set(toDelete.map(r => r.id));

    if (toDelete.length === 0) {
      showUndoToast(null, '没有可清空的记录');
      return;
    }

    // 保存回滚状态
    const prevHistory = [...currentClass.history];

    // 先更新本地状态（乐观更新）
    updateCurrentClass(prev => ({
      ...prev,
      history: prev.history.filter(r => !toDeleteIds.has(r.id)),
    }));

    try {
      // 批量删除
      await cloudDeleteHistoryBatch(toDelete.map(r => r.id));
      showUndoToast(null, `✅ 已清空 ${toDelete.length} 条记录`);
    } catch (err) {
      console.error('Failed to clear first history:', err);
      // 回滚本地状态
      updateCurrentClass(prev => ({ ...prev, history: prevHistory }));
      showUndoToast(null, '⚠️ 清空历史失败，已自动撤销');
    }
  };


  const handleSaveSettings = async (
    updatedStudents: Student[],
    deletedStudentIds: string[],
    updatedScoreItems: ScoreItem[],
    newTarget: number,
    newStageThresholds: number[],
    newThemeId: string,
    newSystemTitle: string,
    newClassTitle: string
  ) => {
    try {
      const existingById = new Map<string, Student>(
        currentClass.students.map((s): [string, Student] => [s.id, s])
      );
      const existingIds = new Set(existingById.keys());
      const deletedIdSet = new Set(deletedStudentIds);

      // 更新系统标题
      if (newSystemTitle !== store.systemTitle) {
        await updateSystemTitle(newSystemTitle);
      }

      // 更新班级设置
      await updateClassSettings(currentClass.id, {
        title: newClassTitle,
        scoreItems: updatedScoreItems,
        targetCount: newTarget,
        stageThresholds: newStageThresholds,
        themeId: newThemeId,
      });

      // 删除学生（及其关联数据）
      for (const studentId of deletedStudentIds) {
        await cloudDeleteStudent(studentId);
      }

      // 添加新学生
      const createdStudents: Student[] = [];
      for (const student of updatedStudents) {
        if (!existingIds.has(student.id)) {
          const created = await cloudAddStudent(currentClass.id, student.name);
          createdStudents.push(created);
        }
      }

      // 更新现有学生名称
      const renamedStudents = updatedStudents.filter(student => {
        const existing = existingById.get(student.id);
        return existing && existing.name !== student.name;
      });
      for (const student of renamedStudents) {
        await cloudUpdateStudent(student.id, { name: student.name });
      }

      // 按当前顺序写入 sortOrder，保证顺序永久保存
      const nameToId = new Map<string, string>();
      for (const [id, student] of existingById) {
        if (deletedIdSet.has(id)) continue;
        nameToId.set(student.name, id);
      }
      for (const student of renamedStudents) {
        const oldName = existingById.get(student.id)?.name;
        if (oldName) nameToId.delete(oldName);
        nameToId.set(student.name, student.id);
      }
      for (const student of createdStudents) {
        nameToId.set(student.name, student.id);
      }

      const orderedIds = updatedStudents
        .map(student => nameToId.get(student.name))
        .filter((id): id is string => !!id);

      await Promise.all(
        orderedIds.map((id, index) => cloudUpdateStudent(id, { sortOrder: index + 1 }))
      );

      updateCurrentClass(prev => {
        const studentById = new Map(prev.students.map(s => [s.id, s]));
        createdStudents.forEach(student => studentById.set(student.id, student));
        renamedStudents.forEach(student => {
          const existing = studentById.get(student.id);
          if (existing) {
            studentById.set(student.id, { ...existing, name: student.name });
          }
        });

        const orderedStudents = orderedIds
          .map(id => studentById.get(id))
          .filter((student): student is Student => !!student);

        return { students: orderedStudents };
      });

      showUndoToast(null, '✅ 设置已保存');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showUndoToast(null, '⚠️ 保存设置失败，请重试');
    }
  };

  const mapReuseConfigErrorMessage = (error: unknown): string => {
    if (error instanceof ApiError) {
      if (error.statusCode === 401) {
        if (error.message === '密码错误，请重试') return error.message;
        if (error.message.includes('登录已过期')) return error.message;
        if (error.message.includes('登录已失效')) return error.message;
        if (error.message.includes('请先登录')) return error.message;
        if (error.message.includes('无效的登录凭证')) return error.message;
        return '复用配置失败，请稍后重试';
      }
      if (error.statusCode === 409) return '班级忙，请稍后重试';
    }

    const message = (error as { message?: string } | undefined)?.message || '';
    if (message === '来源班级不能是当前班级') return message;
    if (message === '请至少选择一项复用内容') return message;
    if (message === '密码错误，请重试' || message === '班级忙，请稍后重试') return message;

    return '复用配置失败，请稍后重试';
  };

  const handleReuseClassConfig = async (
    sourceClassId: string,
    password: string,
    applyFields: ReuseConfigField[]
  ): Promise<void> => {
    try {
      const result = await cloudReuseClassConfig(currentClass.id, sourceClassId, password, applyFields);
      const recomputeSuffix = result.appliedFields.includes('levelConfig')
        ? `，已重算 ${result.recomputedStudentCount} 位学生等级`
        : '';
      showUndoToast(
        null,
        `已从「${result.sourceClassTitle}」复用配置到当前班级${recomputeSuffix}`
      );
      void refreshData().catch((refreshError) => {
        console.error('Failed to refresh after reuse class config:', refreshError);
      });
    } catch (error) {
      console.error('Failed to reuse class config:', error);
      throw new Error(mapReuseConfigErrorMessage(error));
    }
  };

  // 生成测试数据（分批处理，避免服务器压力）
  const handleGenerateTestData = async () => {
    const TEST_COUNT = 50;
    const BATCH_SIZE = 10; // 每批处理10个请求
    const names = generateTestStudentNames(TEST_COUNT);

    try {
      // 第一步：分批添加学生
      const students: Student[] = [];
      for (let i = 0; i < names.length; i += BATCH_SIZE) {
        const batch = names.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(name => cloudAddStudent(currentClass.id, name))
        );
        students.push(...batchResults);
      }

      // 第二步：分批更新学生数据
      for (let i = 0; i < students.length; i += BATCH_SIZE) {
        const batch = students.slice(i, i + BATCH_SIZE);
        await Promise.all(
          batch.map(student => {
            const randomPetId = ALL_PETS[Math.floor(Math.random() * ALL_PETS.length)].id;
            const randomFoodCount = Math.floor(Math.random() * 101); // 0-100
            const randomBadgeCount = Math.floor(Math.random() * 11); // 0-10
            const petStage = calculateStageFromFood(randomFoodCount, currentClass.stageThresholds);

            // 生成随机徽章
            const badges: Badge[] = [];
            for (let j = 0; j < randomBadgeCount; j++) {
              const randomPet = ALL_PETS[Math.floor(Math.random() * ALL_PETS.length)];
              badges.push({
                id: generateClientId('test_badge_seed'),
                petId: randomPet.id,
                petName: randomPet.name,
                earnedAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
              });
            }

            return cloudUpdateStudent(student.id, {
              petId: randomPetId,
              petStage,
              foodCount: randomFoodCount,
              badges,
            });
          })
        );
      }

      showUndoToast(null, `✅ 已生成 ${TEST_COUNT} 个测试学生`);
    } catch (err) {
      console.error('Failed to generate test data:', err);
      throw err;
    }
  };

  const handlePetSelect = async (petId: string) => {
    if (selectingStudent) {
      try {
        await cloudUpdateStudent(selectingStudent, { petId });
        setSelectingStudent(null);
      } catch (err: any) {
        console.error('Failed to save pet selection:', err);
        showUndoToast(null, err?.message || '⚠️ 保存宠物选择失败');
      }
    }
  };

  // 批量分配宠物
  const handleBatchAssignPets = async (assignments: Array<{ studentId: string; petId: string }>) => {
    try {
      for (const { studentId, petId } of assignments) {
        await cloudUpdateStudent(studentId, { petId, petStage: 1 });
      }
      showUndoToast(null, `✅ 已为 ${assignments.length} 位学生分配宠物`);
    } catch (err) {
      console.error('Failed to batch assign pets:', err);
      throw err;
    }
  };

  const getGraduatingPet = (): PetBreed => {
    if (!graduatingStudent) return ALL_PETS[0];
    const selectedId = currentClass.petSelections[graduatingStudent];
    return getPetById(selectedId) || ALL_PETS[0];
  };

  const handleCollectBadge = async () => {
    if (!graduatingStudent) return;

    const studentId = graduatingStudent;
    const student = currentClass.students.find(s => s.id === studentId);
    const studentName = student?.name || studentId;
    const petObj = getGraduatingPet();

    // 立即计算目标位置（在弹窗关闭前，DOM还可见）
    const badgeEl = document.querySelector(`[data-badge-target="${studentId}"]`);
    const studentCard = document.querySelector(`[data-student-id="${studentId}"]`);

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;

    if (badgeEl) {
      const badgeRect = badgeEl.getBoundingClientRect();
      targetX = badgeRect.left + badgeRect.width / 2;
      targetY = badgeRect.top + badgeRect.height / 2;
    } else if (studentCard) {
      const cardRect = studentCard.getBoundingClientRect();
      targetX = cardRect.right - 40;
      targetY = cardRect.bottom - 40;
    }

    const centerOffsetX = targetX - window.innerWidth / 2;
    const centerOffsetY = targetY - window.innerHeight / 2;

    // 立即设置目标位置和显示光团
    setOrbTargetPos({ x: centerOffsetX, y: centerOffsetY });
    setCollectingStudentId(studentId);
    setShowCollectOrb(true);

    // 同时关闭弹窗（并行执行）
    setGraduatingStudent(null);

    // 光团动画完成后执行实际收集
    const collectDelay = isIOSStressMode ? 650 : 1000;
    setTimeout(async () => {
      // 创建新徽章
      const badgePetName = student?.petNickname?.trim() || petObj.name;
      const newBadge = { id: generateClientId('graduate_collect_badge'), petId: petObj.id, petName: badgePetName, earnedAt: Date.now() };
      const currentBadges = currentClass.badges[studentId] || [];
      const updatedBadges = [...currentBadges, newBadge];
      const prevProgress = currentClass.progress[studentId] || 0;
      const prevPetSelection = currentClass.petSelections[studentId];
      const prevPetStage = currentClass.petStages?.[studentId] || calculateStageFromFood(prevProgress, currentClass.stageThresholds);

      // 先更新本地状态（乐观更新）- 保留 food_count，只重置宠物
      updateCurrentClass(prev => {
        const newPetSelections = { ...prev.petSelections };
        delete newPetSelections[studentId]; // 毕业后宠物归零变回蛋

        return {
          badges: { ...prev.badges, [studentId]: updatedBadges },
          progress: prev.progress, // food_count 不再重置
          petStages: { ...prev.petStages, [studentId]: 1 },
          petSelections: newPetSelections,
        };
      });

      try {
        const result = await dataService.graduateStudent(currentClass.id, {
          studentId,
          petId: petObj.id,
          petName: badgePetName,
        });

        updateCurrentClass(prev => {
          const syncedPetSelections = { ...prev.petSelections };
          if (result.student.petId) {
            syncedPetSelections[studentId] = result.student.petId;
          } else {
            delete syncedPetSelections[studentId];
          }

          return {
            badges: { ...prev.badges, [studentId]: result.student.badges || updatedBadges },
            progress: { ...prev.progress, [studentId]: result.student.foodCount },
            petStages: { ...prev.petStages, [studentId]: result.student.petStage },
            petSelections: syncedPetSelections,
            history: [...prev.history, result.history],
          };
        });

        showUndoToast(result.history.id, `🎉 ${studentName} 完成了养成！`, undefined, currentClass.id);
      } catch (err: any) {
        console.error('Failed to save graduation:', err);
        updateCurrentClass(prev => {
          const restoredPetSelections = { ...prev.petSelections };
          if (prevPetSelection) {
            restoredPetSelections[studentId] = prevPetSelection;
          } else {
            delete restoredPetSelections[studentId];
          }

          return {
            badges: { ...prev.badges, [studentId]: currentBadges },
            progress: { ...prev.progress, [studentId]: prevProgress },
            petStages: { ...prev.petStages, [studentId]: prevPetStage },
            petSelections: restoredPetSelections,
          };
        });
        showUndoToast(null, err?.message || '⚠️ 保存毕业记录失败，已回滚本地状态');
      }

      // 清除光团
      setShowCollectOrb(false);
      setCollectingStudentId(null);
    }, collectDelay);
  };

  const handleStudentActionEvent = useEventCallback((studentId: string) => {
    handleStudentAction(studentId);
  });
  const openGraduateEvent = useEventCallback((studentId: string) => {
    setGraduatingStudent(studentId);
  });
  const openSelectionEvent = useEventCallback((studentId: string) => {
    setSelectingStudent(studentId);
  });
  const openBadgeWallEvent = useEventCallback((studentId: string) => {
    setBadgeWallStudent(studentId);
  });
  const toggleStudentSelectionEvent = useEventCallback((studentId: string) => {
    toggleStudentSelection(studentId);
  });
  const openPetRenameEvent = useEventCallback((studentId: string) => {
    handleOpenPetRename(studentId);
  });
  const openGroupAssignEvent = useEventCallback((studentId: string) => {
    setGroupAssignStudentId(studentId);
  });

  // 加载中状态
  if (isDataLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4 animate-pulse">
            <span className="text-4xl">🐱</span>
          </div>
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="font-bold">加载数据中...</span>
          </div>
        </div>
      </div>
    );
  }

  // 加载失败状态
  if (dataError || !store || !currentClass) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <WifiOff className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">加载失败</h2>
          <p className="text-slate-500 mb-4">{dataError || '无法加载数据，请检查网络连接'}</p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg transition-colors"
            >
              重新加载
            </button>
            <button
              onClick={() => { logout(); }}
              className="px-6 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg transition-colors"
            >
              退出登录
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 被踢出登录提示
  if (kickReason) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            {kickReason === 'disabled' ? '账号已被禁用' : '登录已失效'}
          </h2>
          <p className="text-slate-500 mb-4">
            {kickReason === 'disabled'
              ? '您的账号已被管理员禁用，请联系客服了解详情'
              : '当前登录已失效，请重新登录'}
          </p>
          <button
            onClick={() => {
              clearKickReason();
              logout();
            }}
            className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg transition-colors"
          >
            重新登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col font-sans text-slate-700 safe-area-left safe-area-right"
      data-performance-mode={isLiteCardMode ? 'lite' : 'full'}
      data-ios-stress={isIOSStressMode ? '1' : '0'}
    >

      {/* Soft Floating Header */}
      <header className="sticky top-0 z-40 w-full flex justify-center pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] sm:pt-3 pb-1.5 sm:pb-2 px-2 sm:px-4 pointer-events-none">
        <div className={`backdrop-blur-xl rounded-2xl sm:rounded-full shadow-lg ring-1 ring-white/50 p-1.5 pl-2.5 sm:p-2 sm:pl-6 pr-2 sm:pr-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0 pointer-events-auto max-w-5xl w-full transition-all hover:opacity-100 bg-white/90 ${currentTheme.colors.headerShadow}`}>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
            {/* Logo / History Trigger */}
            <button
              type="button"
              className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white shadow-md hover:scale-105 transition-transform shrink-0 ${currentTheme.colors.logoBg}`}
              onClick={() => setIsHistoryOpen(true)}
              aria-label="打开成长记录"
            >
              <Cloud size={16} className="sm:w-5 sm:h-5" fill="currentColor" />
            </button>

            {/* Context Group: Keep class/batch/sort in one mobile row, search in second row */}
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={() => setIsClassManagerOpen(true)}
                  className={`flex items-center gap-1 text-xs sm:text-sm font-black hover:opacity-70 transition-colors min-w-0 flex-1 sm:flex-initial sm:max-w-[14rem] ${currentTheme.colors.text}`}
                >
                  <LayoutGrid size={14} className="opacity-50 shrink-0" />
                  <span className="truncate">{currentClass.title}</span>
                </button>

                <button
                  onClick={isBatchMode ? exitBatchMode : toggleBatchMode}
                  aria-label={isBatchMode ? '退出批量模式' : '进入批量模式'}
                  aria-pressed={isBatchMode}
                  className={`
                    flex items-center justify-center gap-1.5 px-3 py-2 rounded-full border transition-all duration-200 shadow-sm
                    active:scale-95 shrink-0 text-xs font-bold
                    ${isBatchMode
                      ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-200'
                      : `${currentTheme.colors.light} ${currentTheme.colors.border} ${currentTheme.colors.text}`}
                  `}
                >
                  {isBatchMode
                    ? <X size={16} />
                    : <Users size={16} />
                  }
                  <span className="leading-none">
                    {isBatchMode ? '退出' : '批量'}
                  </span>
                </button>

                {/* Student Sort Mode */}
                <div ref={sortMenuRef} className="relative shrink-0">
                  <button
                    onClick={() => setIsSortMenuOpen(prev => !prev)}
                    className={`group flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 sm:px-2.5 text-xs font-bold shadow-sm transition-all hover:-translate-y-[1px] ${currentTheme.colors.light} ${currentTheme.colors.border} ${currentTheme.colors.text}`}
                    aria-haspopup="menu"
                    aria-expanded={isSortMenuOpen}
                    aria-label="切换学生排序方式"
                  >
                    <ArrowUpDown size={12} className="opacity-70 shrink-0" />
                    <span className="sm:hidden">排序</span>
                    <span className="hidden sm:inline max-w-[7.5rem] truncate">{activeStudentSortOption.label}</span>
                    <ChevronDown
                      size={12}
                      className={`text-slate-400 transition-transform duration-200 ${isSortMenuOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isSortMenuOpen && (
                    <div className="absolute right-0 sm:right-auto sm:left-0 top-[calc(100%+8px)] z-[70] min-w-[190px] rounded-2xl border border-slate-200 bg-white/95 backdrop-blur-xl p-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="px-2 pb-1.5 text-[11px] font-bold text-slate-400">学生排序方式</div>
                      <div className="space-y-1">
                        {STUDENT_SORT_OPTIONS.map(option => {
                          const isActive = option.value === activeStudentSortMode;
                          return (
                            <button
                              key={option.value}
                              onClick={() => {
                                setIsSortMenuOpen(false);
                                void handleStudentSortModeChange(option.value);
                              }}
                              className={`w-full flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl text-sm font-bold transition-colors ${isActive
                                ? `${currentTheme.colors.light} ${currentTheme.colors.text}`
                                : 'text-slate-600 hover:bg-slate-50'
                                }`}
                              role="menuitemradio"
                              aria-checked={isActive}
                            >
                              <span>{option.label}</span>
                              {isActive && <span className="text-[11px] font-bold text-emerald-600">当前</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative group flex-1 min-w-0 max-w-none sm:max-w-[320px] sm:ml-auto">
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${currentTheme.colors.accentText}`}>
                  <Search size={16} />
                </div>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  readOnly={isResetProgressOpen}
                  className={`w-full bg-slate-100/60 hover:bg-white focus:bg-white border border-transparent rounded-full py-1.5 sm:py-2 pl-9 sm:pl-10 pr-3 sm:pr-4 text-sm font-bold placeholder-slate-400/60 outline-none transition-all shadow-inner focus:shadow-md focus:ring-2 ${currentTheme.colors.inputFocus} ${currentTheme.colors.inputText}`}
                  placeholder="🔍 搜索学生..."
                  autoComplete={isResetProgressOpen ? "new-password" : "off"}
                  name="student-search-keyword"
                  id="student-search-keyword"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore="true"
                  data-bwignore="true"
                  data-form-type="other"
                  enterKeyHint="search"
                />
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 shrink-0 ml-2">
            <NavButton icon={<ShoppingBag size={18} />} label="小卖部" onClick={() => setIsStoreOpen(true)} theme={currentTheme} />
            <NavButton icon={<Trophy size={18} />} label="光荣榜" onClick={() => setIsLeaderboardOpen(true)} theme={currentTheme} />
            <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />
            <NavButton
              icon={isRevokeMode ? <Eraser size={18} /> : <Undo2 size={18} />}
              label="撤回"
              onClick={toggleRevokeMode}
              theme={currentTheme}
              isRevoke
              active={isRevokeMode}
            />
            <NavButton icon={<Settings size={18} />} label="设置" onClick={() => setIsSettingsOpen(true)} theme={currentTheme} />
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main
        className="flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full pt-6 pb-[72px] sm:pb-6 md:pb-8"
      >

        {/* Revoke Mode Banner */}
        {isRevokeMode && (
          <div className="flex justify-center mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="bg-rose-500 text-white px-6 py-2 rounded-full shadow-lg shadow-rose-200 flex items-center gap-2 cursor-pointer hover:bg-rose-600 transition-colors" onClick={toggleRevokeMode}>
              <Eraser size={16} className="animate-pulse" />
              <span className="text-sm font-bold">点击卡片撤销最后一次操作</span>
            </div>
          </div>
        )}

        {/* Batch Mode Banner + Actions */}
        {isBatchMode && (
          <div className="mb-6 space-y-3 animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-center">
              <div className="bg-blue-500 text-white px-6 py-2 rounded-full shadow-lg shadow-blue-200 flex items-center gap-2">
                <Users size={16} className="animate-pulse" />
                <span className="text-sm font-bold">点击卡片选择学生，然后批量操作</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <div className="px-3 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold bg-blue-50 border border-blue-200 text-blue-700 min-h-[44px] inline-flex items-center">
                已选 <span className="mx-1 text-base leading-none">{selectedStudentIds.size}</span> 人
              </div>
              <button
                onClick={toggleSelectAll}
                className="px-3 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                {displayedStudents.length > 0 && displayedStudents.every(student => selectedStudentIds.has(student.id)) ? '取消全选' : '全选'}
              </button>
              <button
                onClick={() => setSelectedStudentIds(new Set())}
                className="px-3 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                清空
              </button>
              <button
                onClick={() => {
                  if (selectedStudentIds.size > 0) {
                    setExportDialogState({
                      mode: 'batch',
                      templateType: 'certificate',
                    });
                  }
                }}
                disabled={selectedStudentIds.size === 0}
                className={`
                  px-3 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all min-h-[44px]
                  ${selectedStudentIds.size > 0
                    ? 'bg-white border border-cyan-200 text-cyan-600 hover:bg-cyan-50'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <Download size={16} />
                批量导出
              </button>
              <button
                onClick={() => setIsBatchGroupAssignOpen(true)}
                disabled={selectedStudentIds.size === 0}
                className={`
                  px-3 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all min-h-[44px]
                  ${selectedStudentIds.size > 0
                    ? 'bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <Users size={16} />
                批量分组
              </button>
              <button
                onClick={() => {
                  if (selectedStudentIds.size > 0) {
                    setScoringStudent('batch');
                  }
                }}
                disabled={selectedStudentIds.size === 0}
                className={`
                  px-4 py-2 rounded-xl sm:rounded-full text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all min-h-[44px]
                  ${selectedStudentIds.size > 0
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-200 hover:shadow-xl hover:scale-105'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }
                `}
              >
                <Sparkles size={16} />
                批量喂养
              </button>
            </div>
          </div>
        )}

        <GroupFilterBar
          groups={currentClass.groups}
          activeFilter={groupFilter}
          isBatchMode={isBatchMode}
          showUngrouped={currentClass.students.some(student => !student.groupId)}
          getCountByGroupId={getGroupCountById}
          isBatchSelected={isBatchGroupSelected}
          onFilterClick={handleGroupFilterClick}
          onBatchClick={handleBatchGroupClick}
        />

        <div
          ref={studentGridContainerRef}
          style={shouldVirtualizeStudents
            ? {
              paddingTop: `${virtualRange.paddingTop}px`,
              paddingBottom: `${virtualRange.paddingBottom}px`,
            }
            : undefined
          }
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 md:gap-8">
            {studentsToRender.map((student) => {
            // Resolve Pet ID
            const petId = currentClass.petSelections[student.id];
            // 移除随机分配逻辑，允许 petId 为 undefined（蛋状态）

            // 获取当前食物数量和阶段
            const currentFood = currentClass.progress[student.id] || 0;
            const petStage = currentClass.petStages?.[student.id] ||
              calculateStageFromFood(currentFood, currentClass.stageThresholds);

            // 检查是否可以毕业
            const isReadyToGraduate = canGraduate(currentFood, currentClass.stageThresholds);
            const group = student.groupId ? groupsById.get(student.groupId) : undefined;

              return (
                <StudentCard
                  key={student.id}
                  studentId={student.id}
                  name={student.name}
                  currentCount={currentFood}
                  targetCount={currentClass.stageThresholds[9]} // 毕业所需总食物
                  badges={currentClass.badges[student.id] ?? EMPTY_BADGES}
                  selectedPetId={petId}
                  petStage={petStage}
                  stageThresholds={currentClass.stageThresholds}
                  onIncrement={handleStudentActionEvent}
                  onGraduate={openGraduateEvent}
                  onOpenSelection={openSelectionEvent}
                  onOpenBadgeWall={openBadgeWallEvent}
                  theme={currentTheme}
                  isRevokeMode={isRevokeMode}
                  isCollectingBadge={collectingStudentId === student.id}
                  isBatchMode={isBatchMode}
                  isSelected={selectedStudentIds.has(student.id)}
                  onToggleSelect={toggleStudentSelectionEvent}
                  petNickname={student.petNickname ?? null}
                  onOpenPetRename={openPetRenameEvent}
                  groupName={group?.name || null}
                  onOpenGroupAssign={openGroupAssignEvent}
                  performanceMode={isLiteCardMode ? 'lite' : 'full'}
                  allowTransientEffects={!batchEffectStudentIds || batchEffectStudentIds.has(student.id)}
                />
              )
            })}

            {displayedStudents.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center min-h-[50vh] text-slate-300">
                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 shadow-sm ${currentTheme.colors.light}`}>
                  <span className="text-4xl">{currentClass.students.length === 0 ? '📝' : '🔍'}</span>
                </div>
                {currentClass.students.length === 0 ? (
                  <>
                    <p className="text-lg font-medium text-slate-400">暂无学生名单</p>
                    <button onClick={() => setIsSettingsOpen(true)} className={`mt-4 font-bold hover:underline ${currentTheme.colors.accentText}`}>
                      去设置添加学生
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-medium text-slate-400">当前筛选条件下暂无学生</p>
                    <p className="text-sm text-slate-400 mt-1">可尝试清除搜索词或切换分组筛选</p>
                    {(searchQuery.trim() || groupFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setGroupFilter('all');
                        }}
                        className={`mt-4 font-bold hover:underline ${currentTheme.colors.accentText}`}
                      >
                        清除筛选条件
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 sm:hidden">
        <div className="bg-white/90 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] safe-area-bottom">
          <div className="grid grid-cols-4 gap-1 px-2 pt-1.5 pb-1">
            <button
              onClick={() => setIsStoreOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${currentTheme.colors.accentText}`}
            >
              <ShoppingBag size={20} />
              <span className="text-[10px] font-bold leading-none">小卖部</span>
            </button>
            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${currentTheme.colors.accentText}`}
            >
              <Trophy size={20} />
              <span className="text-[10px] font-bold leading-none">光荣榜</span>
            </button>
            <button
              onClick={toggleRevokeMode}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${isRevokeMode
                ? 'bg-rose-500 text-white shadow-sm'
                : 'text-rose-500'
                }`}
            >
              {isRevokeMode ? <Eraser size={20} /> : <Undo2 size={20} />}
              <span className="text-[10px] font-bold leading-none">撤回</span>
            </button>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl transition-colors ${currentTheme.colors.accentText}`}
            >
              <Settings size={20} />
              <span className="text-[10px] font-bold leading-none">设置</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Toast Notification */}
      {toast && toast.visible && (
        <div
          className="fixed left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300"
          style={{ bottom: toastBottomOffset }}
        >
          <div className={`bg-white/90 backdrop-blur-md pl-2 pr-6 py-2 rounded-full shadow-xl flex items-center gap-3 border border-white ${currentTheme.colors.headerShadow}`}>
            {(toast.id || toast.batchId) ? (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentTheme.colors.light} ${currentTheme.colors.text}`}>
                <CheckCircle2 size={18} />
              </div>
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentTheme.colors.light} ${currentTheme.colors.text}`}>
                <ShoppingBag size={18} />
              </div>
            )}
            <span className="text-sm font-bold text-slate-700">{toast.message}</span>
            {(toast.id || toast.batchId) && (
              <button onClick={handleUndoToast} className="text-xs font-bold text-slate-400 hover:text-rose-500 ml-2 px-2 py-1 bg-slate-50 rounded-md hover:bg-rose-50 transition-colors">
                撤回
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <RecordLimitWarning
        isOpen={showRecordLimitWarning}
        currentCount={currentClass.history.length}
        maxCount={10000}
        onOpenRecordModal={() => {
          setScoringStudent(null); // 先关闭加分模态框
          setIsHistoryOpen(true);   // 再打开成长记录
        }}
        onClose={() => setShowRecordLimitWarning(false)}
      />
      <StoreModal isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} rewards={currentClass.rewards} inventory={currentClass.inventory} students={currentClass.students.map(s => ({ ...s, foodCount: currentClass.progress[s.id] ?? s.foodCount ?? 0 }))} badges={currentClass.badges} history={currentClass.history} onRedeem={handleRedeemReward} onRestock={handleRestock} onSaveReward={handleSaveReward} onDeleteReward={handleDeleteReward} />
      <BadgeWallModal
        isOpen={!!badgeWallStudent}
        onClose={() => setBadgeWallStudent(null)}
        studentName={currentClass.students.find(s => s.id === badgeWallStudent)?.name || ''}
        badges={badgeWallStudent ? (currentClass.badges[badgeWallStudent] || []) : []}
        redemptions={currentClass.history.filter(h => h.studentId === badgeWallStudent && h.type === 'redeem')}
        foodCount={badgeWallStudent ? (currentClass.progress[badgeWallStudent] ?? currentClass.students.find(s => s.id === badgeWallStudent)?.foodCount ?? 0) : 0}
        spentFood={badgeWallStudent ? (currentClass.students.find(s => s.id === badgeWallStudent)?.spentFood ?? 0) : 0}
        onExportCertificate={() => handleOpenSingleExport('certificate')}
        onExportSticker={() => handleOpenSingleExport('sticker')}
      />
      <CertificateExportModal
        isOpen={!!exportDialogState}
        mode={exportDialogState?.mode || 'single'}
        classTitle={currentClass.title}
        students={exportDialogState?.mode === 'single' ? singleExportStudents : batchExportStudents}
        defaultTemplateType={exportDialogState?.templateType || 'certificate'}
        onClose={() => setExportDialogState(null)}
        onCompleted={(message) => showUndoToast(null, message)}
      />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} currentClassId={currentClass.id} currentStudents={currentClass.students} currentScoreItems={currentClass.scoreItems || []} currentTarget={currentClass.targetCount} currentStageThresholds={currentClass.stageThresholds} currentThemeId={currentClass.themeId} currentSystemTitle={store.systemTitle} currentClassTitle={currentClass.title} classOptions={classOptions} studentProgress={currentClass.progress} studentBadges={currentClass.badges} petSelections={currentClass.petSelections} user={user} onLogout={logout} onSave={handleSaveSettings} onGenerateTestData={handleGenerateTestData} onBatchAssignPets={handleBatchAssignPets} onOpenGroupManager={() => setIsGroupManagerOpen(true)} onOpenResetProgress={() => setIsResetProgressOpen(true)} onReuseClassConfig={handleReuseClassConfig} />
      <ResetProgressFlowModal
        isOpen={isResetProgressOpen}
        classId={currentClass.id}
        classTitle={currentClass.title}
        studentCount={currentClass.students.length}
        onClose={() => setIsResetProgressOpen(false)}
        onToast={(message) => showUndoToast(null, message)}
        onRefreshData={refreshData}
        onAuthExpired={logout}
      />
      <GroupManagerModal
        isOpen={isGroupManagerOpen}
        onClose={() => setIsGroupManagerOpen(false)}
        groups={currentClass.groups}
        students={currentClass.students}
        onCreate={handleCreateGroup}
        onUpdate={handleUpdateGroup}
        onDelete={handleDeleteGroup}
        onReorder={handleReorderGroups}
        onRandom={handleRandomGroup}
        onAssignStudents={handleAssignStudentsFromGroupManager}
      />
      <GroupAssignModal
        isOpen={!!groupAssignStudentId}
        title={currentClass.students.find(student => student.id === groupAssignStudentId)?.name || ''}
        groups={currentClass.groups}
        currentGroupId={currentClass.students.find(student => student.id === groupAssignStudentId)?.groupId || null}
        onClose={() => setGroupAssignStudentId(null)}
        onSubmit={async (groupId) => {
          if (!groupAssignStudentId) return;
          await handleAssignStudentGroup(groupAssignStudentId, groupId);
          setGroupAssignStudentId(null);
        }}
      />
      <GroupAssignModal
        isOpen={isBatchGroupAssignOpen}
        title={`${selectedStudentIds.size} 位同学`}
        groups={currentClass.groups}
        currentGroupId={null}
        allowNoChangeOption={true}
        onClose={() => setIsBatchGroupAssignOpen(false)}
        onSubmit={handleBatchAssignGroup}
      />
      <PetRenameModal
        isOpen={!!petRenameStudentId}
        studentName={currentClass.students.find(student => student.id === petRenameStudentId)?.name || ''}
        petName={getPetById(currentClass.petSelections[petRenameStudentId || ''])?.name || '宠物'}
        currentNickname={currentClass.students.find(student => student.id === petRenameStudentId)?.petNickname || null}
        theme={currentTheme}
        onClose={() => setPetRenameStudentId(null)}
        onSubmit={handleSubmitPetRename}
      />
      <PetSelectionModal isOpen={!!selectingStudent} studentName={currentClass.students.find(s => s.id === selectingStudent)?.name || ''} onClose={() => setSelectingStudent(null)} onSelect={handlePetSelect} />
      <LeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} students={currentClass.students} groups={currentClass.groups} progress={currentClass.progress} petSelections={currentClass.petSelections} badges={currentClass.badges} targetCount={currentClass.targetCount} stageThresholds={currentClass.stageThresholds} history={currentClass.history} theme={currentTheme} />
      <GraduationModal isOpen={!!graduatingStudent} studentName={currentClass.students.find(s => s.id === graduatingStudent)?.name || ''} pet={getGraduatingPet()} onCollect={handleCollectBadge} onClose={() => setGraduatingStudent(null)} studentId={graduatingStudent || undefined} />
      <ClassManagerModal isOpen={isClassManagerOpen} onClose={() => setIsClassManagerOpen(false)} classes={store.classes} currentClassId={store.currentClassId} onSwitch={handleClassSwitch} onAdd={handleClassAdd} onDelete={handleClassDelete} onRename={handleClassRename} />
      <GrowthRecordModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={currentClass.history} onClearAll={handleClearAllHistory} onClearFirst={handleClearFirstHistory} />
      <ScoreSelectModal
        isOpen={!!scoringStudent}
        studentName={scoringStudent === 'batch' ? `${selectedStudentIds.size} 位同学` : (currentClass.students.find(s => s.id === scoringStudent)?.name || '')}
        scoreItems={currentClass.scoreItems || []}
        onSelect={(item) => {
          if (scoringStudent === 'batch') {
            handleBatchScoreSelect(item);
          } else if (scoringStudent) {
            handleScoreSelect(scoringStudent, item);
          }
        }}
        onClose={() => setScoringStudent(null)}
        isBatchMode={scoringStudent === 'batch'}
      />

      {/* 独立的光团收集动画 - 性能优化版 */}
      {showCollectOrb && collectingStudentId && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div
            className="relative w-32 h-32 collect-orb-animation"
            style={{
              '--orb-target-x': `${orbTargetPos.x}px`,
              '--orb-target-y': `${orbTargetPos.y}px`,
            } as React.CSSProperties}
          >
            {isIOSStressMode ? (
              <>
                <div className="absolute -inset-4 rounded-full orb-glow-outer opacity-70" />
                <div className="absolute inset-2 rounded-full bg-white/85" />
                <Sparkles className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 text-yellow-300 animate-pulse" />
              </>
            ) : (
              <>
                {/* 外层光晕 - 使用radial-gradient代替多层blur */}
                <div className="absolute -inset-8 rounded-full orb-glow-outer orb-pulse" />

                {/* 核心发光 - 单层radial-gradient */}
                <div className="absolute inset-0 rounded-full orb-glow-core" />

                {/* 中心白点 */}
                <div className="absolute inset-6 bg-white rounded-full opacity-90" />

                {/* 单层旋转光环 */}
                <div className="absolute inset-0 border-3 border-yellow-300/60 rounded-full animate-spin-slow" />

                {/* 精简星星粒子 - 仅保留3个 */}
                <Sparkles className="absolute -top-6 left-1/2 -translate-x-1/2 w-8 h-8 text-yellow-300 animate-bounce" />
                <Sparkles className="absolute top-1/2 -right-6 w-6 h-6 text-amber-400 animate-pulse" />
                <Sparkles className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-6 h-6 text-orange-300 animate-bounce delay-150" />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const NavButton = ({ icon, label, onClick, theme, active, isRevoke }: any) => {
  const baseStyle = isRevoke
    ? (active ? 'bg-rose-500 text-white shadow-md shadow-rose-200' : 'text-rose-500 hover:bg-rose-50')
    : `${theme.colors.accentText} ${theme.colors.buttonHover}`;

  const activeClass = active && isRevoke
    ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
    : baseStyle;

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={`
          flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2 sm:px-4 rounded-xl sm:rounded-full transition-all duration-200
          active:scale-95 min-w-[44px] min-h-[44px]
          ${activeClass}
        `}
    >
      {(active && isRevoke) ? React.cloneElement(icon, { className: 'text-white w-5 h-5 sm:w-[18px] sm:h-[18px]' }) : React.cloneElement(icon, { className: 'w-5 h-5 sm:w-[18px] sm:h-[18px]' })}
      <span className="text-[11px] sm:text-sm font-bold leading-none">{label}</span>
    </button>
  )
}

// 加载中页面
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4 animate-pulse">
          <span className="text-4xl">🐱</span>
        </div>
        <div className="flex items-center justify-center gap-2 text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-bold">加载中...</span>
        </div>
      </div>
    </div>
  );
}

// 被踢下线提示页
function KickNoticeScreen({ kickReason, onConfirm }: { kickReason: 'disabled' | 'kicked'; onConfirm: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-purple-50 to-blue-100 flex items-center justify-center p-4">
      <div className="text-center bg-white rounded-2xl shadow-xl p-8 max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full mb-4">
          <AlertTriangle className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">
          {kickReason === 'disabled' ? '账号已被禁用' : '登录已失效'}
        </h2>
        <p className="text-slate-500 mb-6">
          {kickReason === 'disabled'
            ? '您的账号已被管理员禁用，请联系客服了解详情'
            : '当前登录已失效，请重新登录'}
        </p>
        <button
          onClick={onConfirm}
          className="px-6 py-2 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-lg transition-colors"
        >
          重新登录
        </button>
      </div>
    </div>
  );
}

// 应用路由组件
function AppRouter() {
  const { status, kickReason, clearKickReason } = useAuth();

  // 加载中
  if (status === 'loading') {
    return <LoadingScreen />;
  }

  // 被踢下线时，先显示提示页面，用户确认后再跳转登录页
  if (status === 'unauthenticated' && kickReason) {
    return <KickNoticeScreen kickReason={kickReason} onConfirm={clearKickReason} />;
  }

  // 未登录
  if (status === 'unauthenticated') {
    return <AuthPage />;
  }

  // 已认证，显示主应用
  return <MainApp />;
}

// 根组件：包含 AuthProvider 和路由
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
          <Route path="backups" element={<AdminBackups />} />
        </Route>

        {/* Main App Routes */}
        <Route path="/*" element={
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
