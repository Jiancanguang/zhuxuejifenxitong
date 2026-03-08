import { useState, useEffect, useCallback, useRef } from 'react';
import { GlobalState, ClassState, Student, Group, HistoryRecord, ScoreItem, Badge, ReuseConfigField, StudentSortMode } from '../types';
import { REWARDS, DEFAULT_SCORE_ITEMS, DEFAULT_STAGE_THRESHOLDS, DEFAULT_SYSTEM_TITLE, calculateStageFromFood } from '../constants';
import * as dataService from '../services/data';
import * as authService from '../services/auth';
import { tokenManager } from '../lib/api';

// 创建默认库存
const createDefaultInventory = (): Record<string, number> => {
  const inventory: Record<string, number> = {};
  REWARDS.forEach(r => inventory[r.id] = 10);
  return inventory;
};

// 创建默认班级
const createDefaultClass = (id: string): ClassState => ({
  id,
  title: '默认班级',
  students: [],
  groups: [],
  progress: {},
  petSelections: {},
  petStages: {},
  badges: {},
  history: [],
  redemptions: [],
  inventory: createDefaultInventory(),
  rewards: REWARDS,
  scoreItems: DEFAULT_SCORE_ITEMS,
  targetCount: 100,
  stageThresholds: DEFAULT_STAGE_THRESHOLDS,
  studentSortMode: 'manual',
  themeId: 'pink',
});

const isStudentSortMode = (value: unknown): value is StudentSortMode => {
  return value === 'manual' || value === 'name' || value === 'leaderboard' || value === 'progress';
};

const normalizeClassState = (cls: ClassState): ClassState => ({
  ...cls,
  studentSortMode: isStudentSortMode((cls as any).studentSortMode) ? (cls as any).studentSortMode : 'manual',
  groups: Array.isArray(cls.groups) ? cls.groups : [],
  students: (cls.students || []).map(student => ({
    ...student,
    groupId: student.groupId ?? null,
    petNickname: student.petNickname ?? null,
  })),
});

export interface CloudDataState {
  store: GlobalState | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastSaved: Date | null;
}

export interface CloudDataActions {
  // 班级操作
  addClass: (title: string) => Promise<void>;
  switchClass: (classId: string) => Promise<void>;
  deleteClass: (classId: string) => Promise<void>;
  renameClass: (classId: string, newTitle: string) => Promise<void>;
  updateClassSettings: (classId: string, settings: Partial<ClassState>) => Promise<void>;
  reuseClassConfig: (classId: string, sourceClassId: string, password: string, applyFields: ReuseConfigField[]) => Promise<{
    targetClassId: string;
    sourceClassId: string;
    sourceClassTitle: string;
    recomputedStudentCount: number;
    appliedFields: ReuseConfigField[];
  }>;

  // 学生操作
  addStudent: (classId: string, name: string) => Promise<Student>;
  updateStudent: (studentId: string, data: Partial<Student & { petId?: string; petStage?: number; foodCount?: number; badges?: Badge[]; groupId?: string | null; petNickname?: string | null }>) => Promise<void>;
  deleteStudent: (studentId: string) => Promise<void>;
  addStudentsBatch: (classId: string, names: string[]) => Promise<Student[]>;
  renamePet: (studentId: string, nickname: string) => Promise<{ studentId: string; petNickname: string; history: HistoryRecord }>;

  // 分组操作
  createGroup: (classId: string, name: string) => Promise<Group>;
  updateGroup: (groupId: string, data: { name?: string }) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<{ affectedStudents: number }>;
  reorderGroups: (classId: string, orderedGroupIds: string[]) => Promise<Group[]>;
  randomGroup: (classId: string, groupCount: number) => Promise<void>;
  batchAssignStudents: (classId: string, studentIds: string[], groupId: string | null) => Promise<void>;

  // 历史记录操作
  checkinStudent: (classId: string, data: {
    studentId: string;
    scoreItemName: string;
    scoreValue: number;
    batchId?: string;
    petId?: string;
  }) => Promise<dataService.CheckinResult>;
  checkinStudentsBatch: (classId: string, data: {
    scoreItemName: string;
    scoreValue: number;
    batchId?: string;
    items: Array<{
      studentId: string;
      petId?: string;
    }>;
  }) => Promise<dataService.BatchCheckinResult>;
  deleteHistory: (recordId: string) => Promise<void>;
  deleteHistoryBatch: (recordIds: string[]) => Promise<void>;
  clearClassHistory: (classId: string) => Promise<void>;

  // 系统设置
  updateSystemTitle: (title: string) => Promise<void>;

  // 刷新数据
  refreshData: () => Promise<void>;

  // 本地更新（用于即时 UI 反馈）
  updateLocalStore: (updater: (prev: GlobalState) => GlobalState) => void;
}

export function useCloudData(): CloudDataState & CloudDataActions {
  const [store, setStore] = useState<GlobalState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // 防抖保存计时器
  const saveTimerRef = useRef<number | null>(null);
  // 待保存的数据队列
  const pendingSaveRef = useRef<{
    type: 'class' | 'student' | 'history';
    data: any;
  }[]>([]);
  // 防止 StrictMode 下重复初始化
  const isInitializingRef = useRef(false);
  // SSE 同步流与刷新节流状态
  const syncEventSourceRef = useRef<EventSource | null>(null);
  const syncRefreshTimerRef = useRef<number | null>(null);
  const syncRefreshRunningRef = useRef(false);
  const currentSessionIdRef = useRef<string | null>(null);

  // 初始化加载数据
  useEffect(() => {
    // 防止并发初始化（React StrictMode 会双重调用 effect）
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    loadInitialData();
  }, []);

  // 加载初始数据
  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 从云端加载班级数据
      const remoteClasses = await dataService.fetchClasses();
      const classes: Record<string, ClassState> = {};
      Object.entries(remoteClasses).forEach(([classId, cls]) => {
        classes[classId] = normalizeClassState(cls);
      });

      // 获取用户设置
      const user = authService.getCurrentUser();
      const systemTitle = user?.systemTitle || DEFAULT_SYSTEM_TITLE;
      let currentClassId = user?.currentClassId || '';

      // 如果没有班级，创建默认班级
      if (Object.keys(classes).length === 0) {
        const defaultClass = normalizeClassState(await dataService.createClass('默认班级'));
        classes[defaultClass.id] = defaultClass;
        currentClassId = defaultClass.id;

        // 更新用户的当前班级 ID
        await authService.updateUserSettings({ currentClassId });
      } else if (!currentClassId || !classes[currentClassId]) {
        // 如果当前班级 ID 无效，使用第一个班级
        currentClassId = Object.keys(classes)[0];
        await authService.updateUserSettings({ currentClassId });
      }

      setStore({
        systemTitle,
        currentClassId,
        classes,
      });
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('加载数据失败，请刷新页面重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 刷新数据
  const refreshData = useCallback(async () => {
    try {
      const classes = await dataService.fetchClasses();
      const normalizedClasses: Record<string, ClassState> = {};
      Object.entries(classes).forEach(([classId, cls]) => {
        normalizedClasses[classId] = normalizeClassState(cls);
      });
      const user = authService.getCurrentUser();

      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          systemTitle: user?.systemTitle || prev.systemTitle,
          currentClassId: user?.currentClassId || prev.currentClassId,
          classes: normalizedClasses,
        };
      });
    } catch (err) {
      console.error('Failed to refresh data:', err);
    }
  }, []);

  const scheduleSyncRefresh = useCallback(() => {
    if (syncRefreshRunningRef.current || syncRefreshTimerRef.current !== null) {
      return;
    }

    syncRefreshTimerRef.current = window.setTimeout(async () => {
      syncRefreshTimerRef.current = null;
      syncRefreshRunningRef.current = true;
      try {
        await refreshData();
      } finally {
        syncRefreshRunningRef.current = false;
      }
    }, 250);
  }, [refreshData]);

  // 建立 SSE 实时同步：其他设备写入后自动触发 refreshData
  useEffect(() => {
    const token = tokenManager.getToken();
    if (!token) {
      return;
    }

    currentSessionIdRef.current = dataService.parseSessionIdFromToken(token);
    const stream = dataService.openSyncStream(token);
    syncEventSourceRef.current = stream;

    const handleSyncEvent = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as dataService.SyncStreamEvent;
        if (!payload || typeof payload !== 'object') return;
        if (
          payload.sourceSessionId
          && currentSessionIdRef.current
          && payload.sourceSessionId === currentSessionIdRef.current
        ) {
          return;
        }
        scheduleSyncRefresh();
      } catch (error) {
        console.warn('[Sync] Failed to parse sync payload:', error);
      }
    };

    stream.addEventListener('sync', handleSyncEvent as EventListener);

    return () => {
      stream.removeEventListener('sync', handleSyncEvent as EventListener);
      stream.close();
      if (syncEventSourceRef.current === stream) {
        syncEventSourceRef.current = null;
      }
      if (syncRefreshTimerRef.current !== null) {
        window.clearTimeout(syncRefreshTimerRef.current);
        syncRefreshTimerRef.current = null;
      }
      syncRefreshRunningRef.current = false;
    };
  }, [scheduleSyncRefresh]);

  // 本地更新（用于即时 UI 反馈）
  const updateLocalStore = useCallback((updater: (prev: GlobalState) => GlobalState) => {
    setStore(prev => {
      if (!prev) return prev;
      return updater(prev);
    });
  }, []);

  // ========== 班级操作 ==========

  const addClass = useCallback(async (title: string) => {
    setIsSaving(true);
    try {
      const newClass = normalizeClassState(await dataService.createClass(title));

      // 更新当前班级
      await authService.updateUserSettings({ currentClassId: newClass.id });

      setStore(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentClassId: newClass.id,
          classes: { ...prev.classes, [newClass.id]: newClass },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to add class:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const switchClass = useCallback(async (classId: string) => {
    if (!store?.classes[classId]) return;

    try {
      await authService.updateUserSettings({ currentClassId: classId });

      setStore(prev => {
        if (!prev) return prev;
        return { ...prev, currentClassId: classId };
      });
    } catch (err) {
      console.error('Failed to switch class:', err);
    }
  }, [store]);

  const deleteClass = useCallback(async (classId: string) => {
    if (!store) return;

    setIsSaving(true);
    try {
      await dataService.deleteClass(classId);

      setStore(prev => {
        if (!prev) return prev;
        const newClasses = { ...prev.classes };
        delete newClasses[classId];

        let newCurrentId = prev.currentClassId;
        if (classId === prev.currentClassId) {
          newCurrentId = Object.keys(newClasses)[0] || '';
        }

        return {
          ...prev,
          currentClassId: newCurrentId,
          classes: newClasses,
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete class:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [store]);

  const renameClass = useCallback(async (classId: string, newTitle: string) => {
    setIsSaving(true);
    try {
      await dataService.updateClass(classId, { title: newTitle });

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: { ...cls, title: newTitle },
          },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to rename class:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateClassSettings = useCallback(async (classId: string, settings: Partial<ClassState>) => {
    setIsSaving(true);
    try {
      await dataService.updateClass(classId, settings);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;

        let nextPetStages = cls.petStages;
        if (Array.isArray(settings.stageThresholds) && settings.stageThresholds.length >= 10) {
          const recomputedPetStages: Record<string, number> = {};
          for (const student of cls.students) {
            recomputedPetStages[student.id] = calculateStageFromFood(
              cls.progress[student.id] || 0,
              settings.stageThresholds
            );
          }
          nextPetStages = recomputedPetStages;
        }

        const nextClass: ClassState = { ...cls, ...settings, petStages: nextPetStages };
        if (Array.isArray(settings.stageThresholds) && settings.stageThresholds.length >= 10) {
          nextClass.targetCount = settings.stageThresholds[9];
        }

        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: nextClass,
          },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to update class settings:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ========== 学生操作 ==========

  const addStudent = useCallback(async (classId: string, name: string): Promise<Student> => {
    setIsSaving(true);
    try {
      const student = await dataService.addStudent(classId, name);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              students: [...cls.students, student],
            },
          },
        };
      });

      setLastSaved(new Date());
      return student;
    } catch (err) {
      console.error('Failed to add student:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateStudent = useCallback(async (studentId: string, data: any) => {
    setIsSaving(true);
    try {
      await dataService.updateStudent(studentId, data);

      setStore(prev => {
        if (!prev) return prev;

        // 找到学生所在的班级
        let updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const studentIndex = cls.students.findIndex(s => s.id === studentId);
          if (studentIndex !== -1) {
            const updatedStudents = [...cls.students];
            if (data.name !== undefined) {
              updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], name: data.name };
            }
            if (data.sortOrder !== undefined) {
              updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], sortOrder: data.sortOrder };
            }
            if (data.groupId !== undefined) {
              updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], groupId: data.groupId };
            }
            if (data.petNickname !== undefined) {
              updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], petNickname: data.petNickname };
            }
            if (data.petId !== undefined && data.petId !== (cls.petSelections[studentId] || '')) {
              updatedStudents[studentIndex] = { ...updatedStudents[studentIndex], petNickname: null };
            }

            const updatedProgress = { ...cls.progress };
            const updatedPetSelections = { ...cls.petSelections };
            const updatedPetStages = { ...cls.petStages };
            const updatedBadges = { ...cls.badges };

            if (data.foodCount !== undefined) updatedProgress[studentId] = data.foodCount;
            if (data.petId !== undefined) updatedPetSelections[studentId] = data.petId;
            if (data.petStage !== undefined) updatedPetStages[studentId] = data.petStage;
            if (data.badges !== undefined) updatedBadges[studentId] = data.badges;

            updatedClasses[classId] = {
              ...cls,
              students: updatedStudents,
              progress: updatedProgress,
              petSelections: updatedPetSelections,
              petStages: updatedPetStages,
              badges: updatedBadges,
            };
            break;
          }
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to update student:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteStudent = useCallback(async (studentId: string) => {
    setIsSaving(true);
    try {
      await dataService.deleteStudent(studentId);

      setStore(prev => {
        if (!prev) return prev;

        let updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const studentIndex = cls.students.findIndex(s => s.id === studentId);
          if (studentIndex !== -1) {
            const newProgress = { ...cls.progress };
            const newPetSelections = { ...cls.petSelections };
            const newPetStages = { ...cls.petStages };
            const newBadges = { ...cls.badges };

            delete newProgress[studentId];
            delete newPetSelections[studentId];
            delete newPetStages[studentId];
            delete newBadges[studentId];

            updatedClasses[classId] = {
              ...cls,
              students: cls.students.filter(s => s.id !== studentId),
              progress: newProgress,
              petSelections: newPetSelections,
              petStages: newPetStages,
              badges: newBadges,
              history: cls.history.filter(h => h.studentId !== studentId),
            };
            break;
          }
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete student:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const addStudentsBatch = useCallback(async (classId: string, names: string[]): Promise<Student[]> => {
    setIsSaving(true);
    try {
      const students: Student[] = [];
      for (const name of names) {
        const student = await dataService.addStudent(classId, name);
        students.push(student);
      }

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              students: [...cls.students, ...students],
            },
          },
        };
      });

      setLastSaved(new Date());
      return students;
    } catch (err) {
      console.error('Failed to add students batch:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const renamePet = useCallback(async (
    studentId: string,
    nickname: string
  ): Promise<{ studentId: string; petNickname: string; history: HistoryRecord }> => {
    setIsSaving(true);
    try {
      const result = await dataService.renamePet(studentId, nickname);

      setStore(prev => {
        if (!prev) return prev;

        const updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const studentIndex = cls.students.findIndex(s => s.id === studentId);
          if (studentIndex === -1) continue;

          const students = [...cls.students];
          students[studentIndex] = {
            ...students[studentIndex],
            petNickname: result.petNickname,
          };

          updatedClasses[classId] = {
            ...cls,
            students,
            history: [...cls.history, result.history],
          };
          break;
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
      return result;
    } catch (err) {
      console.error('Failed to rename pet:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reuseClassConfig = useCallback(async (
    classId: string,
    sourceClassId: string,
    password: string,
    applyFields: ReuseConfigField[]
  ) => {
    setIsSaving(true);
    try {
      const result = await dataService.reuseClassConfig(classId, sourceClassId, password, applyFields);
      setLastSaved(new Date());
      return result;
    } catch (err) {
      console.error('Failed to reuse class config:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ========== 分组操作 ==========

  const createGroup = useCallback(async (classId: string, name: string): Promise<Group> => {
    setIsSaving(true);
    try {
      const group = await dataService.createGroup(classId, { name });

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              groups: [...cls.groups, group].sort((a, b) => a.sortOrder - b.sortOrder),
            },
          },
        };
      });

      setLastSaved(new Date());
      return group;
    } catch (err) {
      console.error('Failed to create group:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updateGroup = useCallback(async (groupId: string, data: { name?: string }): Promise<Group> => {
    setIsSaving(true);
    try {
      const group = await dataService.updateGroup(groupId, data);

      setStore(prev => {
        if (!prev) return prev;

        const updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const idx = cls.groups.findIndex(g => g.id === groupId);
          if (idx !== -1) {
            const groups = [...cls.groups];
            groups[idx] = group;
            updatedClasses[classId] = {
              ...cls,
              groups: groups.sort((a, b) => a.sortOrder - b.sortOrder),
            };
            break;
          }
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
      return group;
    } catch (err) {
      console.error('Failed to update group:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteGroup = useCallback(async (groupId: string): Promise<{ affectedStudents: number }> => {
    setIsSaving(true);
    try {
      const result = await dataService.deleteGroup(groupId);

      setStore(prev => {
        if (!prev) return prev;

        const updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const hasGroup = cls.groups.some(g => g.id === groupId);
          if (!hasGroup) continue;

          updatedClasses[classId] = {
            ...cls,
            groups: cls.groups.filter(g => g.id !== groupId),
            students: cls.students.map(student =>
              student.groupId === groupId ? { ...student, groupId: null } : student
            ),
          };
          break;
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
      return result;
    } catch (err) {
      console.error('Failed to delete group:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const reorderGroups = useCallback(async (classId: string, orderedGroupIds: string[]): Promise<Group[]> => {
    setIsSaving(true);
    try {
      const groups = await dataService.reorderGroups(classId, orderedGroupIds);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              groups,
            },
          },
        };
      });

      setLastSaved(new Date());
      return groups;
    } catch (err) {
      console.error('Failed to reorder groups:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const randomGroup = useCallback(async (classId: string, groupCount: number): Promise<void> => {
    setIsSaving(true);
    try {
      const result = await dataService.randomGroup(classId, groupCount);
      const assignmentMap = new Map(result.assignments.map(item => [item.studentId, item.groupId]));

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              groups: result.groups,
              students: cls.students.map(student => ({
                ...student,
                groupId: assignmentMap.get(student.id) ?? null,
              })),
            },
          },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to random group:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const batchAssignStudents = useCallback(async (classId: string, studentIds: string[], groupId: string | null): Promise<void> => {
    setIsSaving(true);
    try {
      const result = await dataService.batchAssignStudents(classId, studentIds, groupId);
      const idSet = new Set(result.studentIds);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              students: cls.students.map(student =>
                idSet.has(student.id)
                  ? { ...student, groupId: result.groupId }
                  : student
              ),
            },
          },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to batch assign students:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ========== 历史记录操作 ==========

  const checkinStudent = useCallback(async (
    classId: string,
    data: {
      studentId: string;
      scoreItemName: string;
      scoreValue: number;
      batchId?: string;
      petId?: string;
    }
  ): Promise<dataService.CheckinResult> => {
    setIsSaving(true);
    try {
      const result = await dataService.checkinStudent(classId, data);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;

        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              history: [...cls.history, result.history],
              progress: { ...cls.progress, [result.student.id]: result.student.foodCount },
              petStages: { ...cls.petStages, [result.student.id]: result.student.petStage },
              petSelections: { ...cls.petSelections, [result.student.id]: result.student.petId || '' },
            },
          },
        };
      });

      setLastSaved(new Date());
      return result;
    } catch (err) {
      console.error('Failed to checkin student:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const checkinStudentsBatch = useCallback(async (
    classId: string,
    data: {
      scoreItemName: string;
      scoreValue: number;
      batchId?: string;
      items: Array<{
        studentId: string;
        petId?: string;
      }>;
    }
  ): Promise<dataService.BatchCheckinResult> => {
    setIsSaving(true);
    try {
      const result = await dataService.checkinStudentsBatch(classId, data);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;

        const nextProgress = { ...cls.progress };
        const nextPetStages = { ...cls.petStages };
        const nextPetSelections = { ...cls.petSelections };

        for (const student of result.students) {
          nextProgress[student.id] = student.foodCount;
          nextPetStages[student.id] = student.petStage;
          nextPetSelections[student.id] = student.petId || '';
        }

        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              history: [...cls.history, ...result.histories],
              progress: nextProgress,
              petStages: nextPetStages,
              petSelections: nextPetSelections,
            },
          },
        };
      });

      setLastSaved(new Date());
      return result;
    } catch (err) {
      console.error('Failed to checkin students batch:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteHistory = useCallback(async (recordId: string) => {
    setIsSaving(true);
    try {
      await dataService.deleteHistory(recordId);

      setStore(prev => {
        if (!prev) return prev;

        let updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          if (cls.history.some(h => h.id === recordId)) {
            updatedClasses[classId] = {
              ...cls,
              history: cls.history.filter(h => h.id !== recordId),
            };
            break;
          }
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete history:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const deleteHistoryBatch = useCallback(async (recordIds: string[]) => {
    setIsSaving(true);
    try {
      await dataService.deleteHistoryBatch(recordIds);

      setStore(prev => {
        if (!prev) return prev;

        let updatedClasses = { ...prev.classes };
        for (const classId of Object.keys(updatedClasses)) {
          const cls = updatedClasses[classId];
          const hasRecords = cls.history.some(h => recordIds.includes(h.id));
          if (hasRecords) {
            updatedClasses[classId] = {
              ...cls,
              history: cls.history.filter(h => !recordIds.includes(h.id)),
            };
          }
        }

        return { ...prev, classes: updatedClasses };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to delete history batch:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearClassHistory = useCallback(async (classId: string) => {
    setIsSaving(true);
    try {
      await dataService.clearClassHistory(classId);

      setStore(prev => {
        if (!prev) return prev;
        const cls = prev.classes[classId];
        if (!cls) return prev;
        return {
          ...prev,
          classes: {
            ...prev.classes,
            [classId]: {
              ...cls,
              history: [],
            },
          },
        };
      });

      setLastSaved(new Date());
    } catch (err) {
      console.error('Failed to clear class history:', err);
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // ========== 系统设置 ==========

  const updateSystemTitle = useCallback(async (title: string) => {
    try {
      await authService.updateUserSettings({ systemTitle: title });

      setStore(prev => {
        if (!prev) return prev;
        return { ...prev, systemTitle: title };
      });
    } catch (err) {
      console.error('Failed to update system title:', err);
      throw err;
    }
  }, []);

  return {
    store,
    isLoading,
    isSaving,
    error,
    lastSaved,
    addClass,
    switchClass,
    deleteClass,
    renameClass,
    updateClassSettings,
    reuseClassConfig,
    addStudent,
    updateStudent,
    deleteStudent,
    addStudentsBatch,
    renamePet,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    randomGroup,
    batchAssignStudents,
    checkinStudent,
    checkinStudentsBatch,
    deleteHistory,
    deleteHistoryBatch,
    clearClassHistory,
    updateSystemTitle,
    refreshData,
    updateLocalStore,
  };
}
