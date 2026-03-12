/**
 * 数据服务
 * 处理班级、学生、历史记录的 CRUD 操作
 */

import api from '../lib/api';
import { ClassState, Student, Group, HistoryRecord, Badge, RedemptionRecord, RevokeResult, RevokeBatchResult, CreateHistoryRecord, ResetClassProgressResult, ReuseConfigField } from '../types';
import { REWARDS, DEFAULT_SCORE_ITEMS, DEFAULT_STAGE_THRESHOLDS } from '../constants';

export interface RenamePetResult {
  studentId: string;
  petNickname: string;
  history: HistoryRecord;
}

export interface ReuseClassConfigResult {
  targetClassId: string;
  sourceClassId: string;
  sourceClassTitle: string;
  recomputedStudentCount: number;
  appliedFields: ReuseConfigField[];
}

export interface CheckinResult {
  history: HistoryRecord;
  student: {
    id: string;
    foodCount: number;
    petStage: number;
    petId: string;
  };
}
export interface BatchCheckinResult {
  histories: HistoryRecord[];
  students: Array<{
    id: string;
    foodCount: number;
    petStage: number;
    petId: string;
  }>;
}

export interface RedeemResult {
  history: HistoryRecord;
  inventory: Record<string, number>;
  redemptions: RedemptionRecord[];
  studentName: string;
  rewardName: string;
  cost: number;
}

export interface GraduateResult {
  history: HistoryRecord;
  student: {
    id: string;
    foodCount: number;
    petStage: number;
    petId: string;
    badges: Badge[];
  };
  badge: Badge;
}

export interface SyncStreamEvent {
  id: string;
  userId: string;
  classId?: string;
  scope: 'class' | 'student' | 'history' | 'group';
  reason: string;
  sourceSessionId?: string;
  timestamp: number;
}

const normalizeBaseUrl = (value?: string): string => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/\/+$/, '');
};

const getApiBaseUrl = (): string => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }
  if (import.meta.env.DEV) {
    return '';
  }
  return '';
};

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return window.atob(padded);
};

// 从 JWT 里读取 sessionId（仅用于本地忽略自己触发的同步事件）
export function parseSessionIdFromToken(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { sessionId?: unknown };
    return typeof payload.sessionId === 'string' ? payload.sessionId : null;
  } catch {
    return null;
  }
}

// 打开 SSE 同步流
export function openSyncStream(token: string): EventSource {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/sync/stream?token=${encodeURIComponent(token)}`;
  return new EventSource(url);
}

// 获取用户的所有班级
export async function fetchClasses(): Promise<Record<string, ClassState>> {
  try {
    const classes = await api.get<Record<string, ClassState>>('/api/classes');
    return classes || {};
  } catch (error) {
    console.error('Failed to fetch classes:', error);
    throw error;
  }
}

// 创建新班级
export async function createClass(title: string): Promise<ClassState> {
  const cls = await api.post<ClassState>('/api/classes', { title });

  // 后端默认值可能过时，用前端最新默认值覆盖
  await api.put(`/api/classes/${cls.id}`, {
    rewards: REWARDS,
    scoreItems: DEFAULT_SCORE_ITEMS,
  });

  return {
    ...cls,
    rewards: REWARDS,
    scoreItems: DEFAULT_SCORE_ITEMS,
  };
}

// 更新班级
export async function updateClass(classId: string, data: Partial<ClassState>): Promise<void> {
  const updateData: any = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.rewards !== undefined) updateData.rewards = data.rewards;
  if (data.scoreItems !== undefined) updateData.scoreItems = data.scoreItems;
  if (data.targetCount !== undefined) updateData.targetCount = data.targetCount;
  if (data.stageThresholds !== undefined) updateData.stageThresholds = data.stageThresholds;
  if (data.studentSortMode !== undefined) updateData.studentSortMode = data.studentSortMode;
  if (data.themeId !== undefined) updateData.themeId = data.themeId;
  if (data.inventory !== undefined) updateData.inventory = data.inventory;
  if (data.redemptions !== undefined) updateData.redemptions = data.redemptions;

  if (Object.keys(updateData).length > 0) {
    await api.put(`/api/classes/${classId}`, updateData);
  }
}

// 删除班级
export async function deleteClass(classId: string): Promise<void> {
  await api.delete(`/api/classes/${classId}`);
}

// 重置班级所有学生进度
export async function resetClassProgress(classId: string, password: string): Promise<ResetClassProgressResult> {
  return api.post<ResetClassProgressResult>(
    `/api/classes/${classId}/reset-progress`,
    { password },
    { skipRetry: true }
  );
}

// 从其他班级复用配置
export async function reuseClassConfig(
  classId: string,
  sourceClassId: string,
  password: string,
  applyFields: ReuseConfigField[]
): Promise<ReuseClassConfigResult> {
  return api.post<ReuseClassConfigResult>(
    `/api/classes/${classId}/reuse-config`,
    { sourceClassId, password, applyFields },
    { skipRetry: true }
  );
}

// 添加学生
export async function addStudent(classId: string, name: string): Promise<Student> {
  const student = await api.post<Student>(`/api/students/class/${classId}`, { name });
  return student;
}

// 更新学生
export async function updateStudent(studentId: string, data: {
  name?: string;
  petId?: string;
  sortOrder?: number;
  petStage?: number;
  foodCount?: number;
  badges?: Badge[];
  groupId?: string | null;
  petNickname?: string | null;
}): Promise<void> {
  const updateData: any = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.petId !== undefined) updateData.petId = data.petId;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
  if (data.petStage !== undefined) updateData.petStage = data.petStage;
  if (data.foodCount !== undefined) updateData.foodCount = data.foodCount;
  if (data.badges !== undefined) updateData.badges = data.badges;
  if (data.groupId !== undefined) updateData.groupId = data.groupId;
  // petNickname 由专用 rename 接口写入，这里仅允许本地状态使用，不透传到后端

  if (Object.keys(updateData).length > 0) {
    await api.put(`/api/students/${studentId}`, updateData);
  }
}

// 删除学生
export async function deleteStudent(studentId: string): Promise<void> {
  await api.delete(`/api/students/${studentId}`);
}

// 添加历史记录
export async function addHistory(classId: string, record: CreateHistoryRecord): Promise<HistoryRecord> {
  const history = await api.post<HistoryRecord>(`/api/history/class/${classId}`, {
    studentId: record.studentId,
    studentName: record.studentName,
    type: record.type,
    scoreItemName: record.scoreItemName,
    scoreValue: record.scoreValue,
    rewardName: record.rewardName,
    cost: record.cost,
    batchId: record.batchId,
    petId: record.petId,
  });

  return history;
}

// 删除历史记录
export async function deleteHistory(recordId: string): Promise<void> {
  await api.delete(`/api/history/${recordId}`);
}

// 批量删除历史记录
export async function deleteHistoryBatch(recordIds: string[]): Promise<void> {
  await api.post('/api/history/batch-delete', { ids: recordIds });
}

// 清空班级历史记录
export async function clearClassHistory(classId: string): Promise<void> {
  await api.delete(`/api/history/class/${classId}`);
}

// 事务撤回单条记录
export async function revokeHistory(recordId: string): Promise<RevokeResult> {
  return api.post<RevokeResult>('/api/history/revoke', { recordId });
}

// 事务批量撤回
export async function revokeBatch(classId: string, batchId: string): Promise<RevokeBatchResult> {
  return api.post<RevokeBatchResult>('/api/history/revoke-batch', { classId, batchId });
}

// 创建分组
export async function createGroup(classId: string, data: { name: string }): Promise<Group> {
  return api.post<Group>(`/api/groups/class/${classId}`, data);
}

// 更新分组
export async function updateGroup(groupId: string, data: { name?: string }): Promise<Group> {
  return api.put<Group>(`/api/groups/${groupId}`, data);
}

// 删除分组
export async function deleteGroup(groupId: string): Promise<{ affectedStudents: number }> {
  return api.delete<{ affectedStudents: number }>(`/api/groups/${groupId}`);
}

// 重排分组
export async function reorderGroups(classId: string, orderedGroupIds: string[]): Promise<Group[]> {
  return api.put<Group[]>(`/api/groups/class/${classId}/reorder`, { orderedGroupIds });
}

// 随机分组
export async function randomGroup(classId: string, groupCount: number): Promise<{
  groups: Group[];
  assignments: Array<{ studentId: string; groupId: string }>;
}> {
  return api.post(`/api/groups/class/${classId}/random`, { groupCount });
}

// 批量分配学生到分组
export async function batchAssignStudents(classId: string, studentIds: string[], groupId: string | null): Promise<{
  updatedCount: number;
  studentIds: string[];
  groupId: string | null;
}> {
  return api.put(`/api/groups/class/${classId}/batch-assign`, { studentIds, groupId });
}

// 原子加分/扣分：在后端一次事务内完成学生进度和历史记录写入
export async function checkinStudent(classId: string, data: {
  studentId: string;
  scoreItemName: string;
  scoreValue: number;
  batchId?: string;
  petId?: string;
}): Promise<CheckinResult> {
  return api.post<CheckinResult>(`/api/history/class/${classId}/checkin`, data);
}

// 原子批量加分/扣分：后端单次事务提交，降低高人数场景下前端崩溃风险
export async function checkinStudentsBatch(classId: string, data: {
  scoreItemName: string;
  scoreValue: number;
  batchId?: string;
  items: Array<{
    studentId: string;
    petId?: string;
  }>;
}): Promise<BatchCheckinResult> {
  return api.post<BatchCheckinResult>(
    `/api/history/class/${classId}/checkin-batch`,
    data,
    { skipRetry: true }
  );
}

// 原子兑换：一次事务内完成库存、兑换流水、历史记录写入
export async function redeemReward(classId: string, data: {
  studentId: string;
  rewardId: string;
}): Promise<RedeemResult> {
  return api.post<RedeemResult>(
    `/api/history/class/${classId}/redeem`,
    data,
    { skipRetry: true }
  );
}

// 原子毕业：一次事务内完成学生重置、徽章写入、毕业历史写入
export async function graduateStudent(classId: string, data: {
  studentId: string;
  petId: string;
  petName: string;
}): Promise<GraduateResult> {
  return api.post<GraduateResult>(
    `/api/history/class/${classId}/graduate`,
    data,
    { skipRetry: true }
  );
}

// 宠物起名/改名
export async function renamePet(studentId: string, nickname: string): Promise<RenamePetResult> {
  return api.post<RenamePetResult>(`/api/students/${studentId}/rename-pet`, { nickname });
}
