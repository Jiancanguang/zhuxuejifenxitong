import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 草稿数据结构
 */
interface DraftData<T> {
  data: T;
  savedAt: number;
  version: string;
}

/**
 * useDraftSave Hook 配置
 */
interface UseDraftSaveOptions<T> {
  /** localStorage 存储键 */
  storageKey: string;
  /** 自动保存延迟（毫秒），默认 2000ms */
  debounceMs?: number;
  /** 数据版本号（用于判断草稿是否过期） */
  version?: string;
  /** 草稿过期时间（毫秒），默认 24 小时 */
  expireMs?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
  /** 数据比较函数，用于判断是否需要保存 */
  isEqual?: (a: T, b: T) => boolean;
}

/**
 * useDraftSave Hook 返回值
 */
interface UseDraftSaveReturn<T> {
  /** 是否有可恢复的草稿 */
  hasDraft: boolean;
  /** 草稿保存时间 */
  draftSavedAt: number | null;
  /** 最后保存状态消息 */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  /** 获取草稿数据（只读取，不影响状态） */
  getDraftData: () => T | null;
  /** 恢复草稿（读取并标记为已恢复） */
  restoreDraft: () => T | null;
  /** 放弃草稿 */
  discardDraft: () => void;
  /** 保存草稿（手动触发） */
  saveDraft: (data: T) => void;
  /** 自动保存（带防抖） */
  autoSave: (data: T) => void;
  /** 清除草稿（保存成功后调用） */
  clearDraft: () => void;
}

/**
 * 默认的浅比较函数
 */
function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * useDraftSave - 草稿自动保存 Hook
 *
 * 功能：
 * 1. 自动保存表单数据到 localStorage（带防抖）
 * 2. 检测并恢复未保存的草稿
 * 3. 显示保存状态
 * 4. 支持草稿过期
 *
 * @example
 * ```tsx
 * const {
 *   hasDraft,
 *   draftSavedAt,
 *   saveStatus,
 *   restoreDraft,
 *   discardDraft,
 *   autoSave,
 *   clearDraft
 * } = useDraftSave<FormData>({
 *   storageKey: 'settings-draft',
 *   debounceMs: 2000,
 * });
 *
 * // 表单变化时自动保存
 * useEffect(() => {
 *   autoSave(formData);
 * }, [formData, autoSave]);
 *
 * // 保存成功后清除草稿
 * const handleSave = () => {
 *   saveToServer(formData);
 *   clearDraft();
 * };
 * ```
 */
export function useDraftSave<T>(options: UseDraftSaveOptions<T>): UseDraftSaveReturn<T> {
  const {
    storageKey,
    debounceMs = 2000,
    version = '1.0',
    expireMs = 24 * 60 * 60 * 1000, // 24小时
    enabled = true,
    isEqual = defaultIsEqual,
  } = options;

  const [hasDraft, setHasDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const debounceTimerRef = useRef<number | null>(null);
  const lastSavedDataRef = useRef<T | null>(null);

  /**
   * 从 localStorage 读取草稿
   */
  const readDraft = useCallback((): DraftData<T> | null => {
    if (!enabled) return null;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;

      const draft: DraftData<T> = JSON.parse(raw);

      // 检查版本
      if (draft.version !== version) {
        return null;
      }

      // 检查过期
      if (Date.now() - draft.savedAt > expireMs) {
        localStorage.removeItem(storageKey);
        return null;
      }

      return draft;
    } catch (err) {
      console.error('[DraftSave] 读取草稿失败:', err);
      return null;
    }
  }, [storageKey, version, expireMs, enabled]);

  /**
   * 保存草稿到 localStorage
   */
  const saveDraft = useCallback((data: T) => {
    if (!enabled) return;

    // 检查数据是否有变化
    if (lastSavedDataRef.current && isEqual(lastSavedDataRef.current, data)) {
      return;
    }

    setSaveStatus('saving');

    try {
      const draft: DraftData<T> = {
        data,
        savedAt: Date.now(),
        version,
      };
      localStorage.setItem(storageKey, JSON.stringify(draft));
      lastSavedDataRef.current = data;
      setDraftSavedAt(draft.savedAt);
      setHasDraft(true);
      setSaveStatus('saved');

      // 3秒后重置状态
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('[DraftSave] 保存草稿失败:', err);
      setSaveStatus('error');
    }
  }, [storageKey, version, enabled, isEqual]);

  /**
   * 自动保存（带防抖）
   */
  const autoSave = useCallback((data: T) => {
    if (!enabled) return;

    // 清除之前的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 设置新的定时器
    debounceTimerRef.current = window.setTimeout(() => {
      saveDraft(data);
    }, debounceMs);
  }, [saveDraft, debounceMs, enabled]);

  /**
   * 获取草稿数据（只读取，不影响 lastSavedDataRef）
   * 用于在提示中显示草稿信息（如班级名称）
   */
  const getDraftData = useCallback((): T | null => {
    const draft = readDraft();
    return draft ? draft.data : null;
  }, [readDraft]);

  /**
   * 恢复草稿（读取并标记为已恢复）
   */
  const restoreDraft = useCallback((): T | null => {
    const draft = readDraft();
    if (draft) {
      lastSavedDataRef.current = draft.data;
      return draft.data;
    }
    return null;
  }, [readDraft]);

  /**
   * 放弃草稿
   */
  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftSavedAt(null);
      lastSavedDataRef.current = null;
    } catch (err) {
      console.error('[DraftSave] 删除草稿失败:', err);
    }
  }, [storageKey]);

  /**
   * 清除草稿（保存成功后调用）
   */
  const clearDraft = useCallback(() => {
    discardDraft();
    setSaveStatus('idle');
  }, [discardDraft]);

  /**
   * 初始化：检查是否有草稿
   * 当 storageKey 变化时（如切换班级），会重新检查
   */
  useEffect(() => {
    if (!enabled) {
      // 禁用时重置状态
      setHasDraft(false);
      setDraftSavedAt(null);
      return;
    }

    const draft = readDraft();
    if (draft) {
      setHasDraft(true);
      setDraftSavedAt(draft.savedAt);
    } else {
      // 重要：没有草稿时也要重置状态（修复切换班级时状态残留问题）
      setHasDraft(false);
      setDraftSavedAt(null);
    }

    // 清理函数
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [readDraft, enabled]);

  return {
    hasDraft,
    draftSavedAt,
    saveStatus,
    getDraftData,
    restoreDraft,
    discardDraft,
    saveDraft,
    autoSave,
    clearDraft,
  };
}

/**
 * 格式化草稿保存时间
 */
export function formatDraftTime(timestamp: number | null): string {
  if (!timestamp) return '';

  const now = Date.now();
  const diff = now - timestamp;

  // 1分钟内
  if (diff < 60 * 1000) {
    return '刚刚';
  }

  // 1小时内
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return `${minutes}分钟前`;
  }

  // 24小时内
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours}小时前`;
  }

  // 超过24小时显示具体时间
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default useDraftSave;
