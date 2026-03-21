/**
 * 管理后台 API 服务
 */

import api, { tokenManager } from '../lib/api';

// 管理员登录状态 key
const ADMIN_AUTH_KEY = 'admin_auth';

// 用户信息类型
export interface AdminUser {
  id: string;
  username: string;
  isDisabled: boolean;
  created: string;
  classCount?: number;
  studentCount?: number;
}

// 统计信息类型
export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  todayNewUsers: number;
  totalClasses: number;
  totalStudents: number;
}

// ========== 管理员认证 ==========

// 管理员登录
export async function adminLogin(username: string, password: string): Promise<boolean> {
  try {
    const result = await api.post<{ token: string }>(
      '/api/admin/login',
      { username, password },
      { skipAuth: true }
    );

    tokenManager.setAdminToken(result.token);
    localStorage.setItem(ADMIN_AUTH_KEY, 'true');
    return true;
  } catch (error) {
    return false;
  }
}

// 管理员登出
export function adminLogout(): void {
  localStorage.removeItem(ADMIN_AUTH_KEY);
  tokenManager.clearAdminToken();
}

// 检查管理员登录状态
export function isAdminLoggedIn(): boolean {
  return localStorage.getItem(ADMIN_AUTH_KEY) === 'true' && !!tokenManager.getAdminToken();
}

// ========== 仪表盘 ==========

// 获取仪表盘统计
export async function getDashboardStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>('/api/admin/stats', { useAdminToken: true });
}

// ========== 用户管理 ==========

// 获取用户列表
export async function getUsers(
  page: number = 1,
  perPage: number = 10,
  filter?: string,
  search?: string
): Promise<{ items: AdminUser[]; totalItems: number; totalPages: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
  });

  if (filter) params.set('filter', filter);
  if (search) params.set('search', search);

  return api.get(`/api/admin/users?${params}`, { useAdminToken: true });
}

// 禁用/启用用户
export async function toggleUserDisabled(userId: string, disabled: boolean): Promise<void> {
  await api.put(`/api/admin/users/${userId}/toggle-disable`, { disabled }, { useAdminToken: true });
}

// 重置用户密码
export async function resetUserPassword(userId: string): Promise<void> {
  await api.put(`/api/admin/users/${userId}/reset-password`, {}, { useAdminToken: true });
}

// 删除用户
export async function deleteUser(userId: string): Promise<void> {
  await api.delete(`/api/admin/users/${userId}`, { useAdminToken: true });
}

// 获取用户详情
export async function getUserDetail(userId: string): Promise<AdminUser> {
  return api.get<AdminUser>(`/api/admin/users/${userId}`, { useAdminToken: true });
}

// ========== 审计日志 ==========

export interface AuditLog {
  id: string;
  actorId: string;
  actorUsername: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  summary: string;
  meta?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export async function getAuditLogs(
  page: number = 1,
  perPage: number = 20,
  action?: string,
  search?: string
): Promise<{ items: AuditLog[]; totalItems: number; totalPages: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
  });
  if (action) params.set('action', action);
  if (search) params.set('search', search);

  return api.get(`/api/admin/audit-logs?${params}`, { useAdminToken: true });
}

// ========== 备份管理 ==========

export interface BackupRecord {
  id: string;
  filename: string;
  fileSize: number;
  fileSizeFormatted: string;
  triggerType: string;
  status: string;
  errorMessage?: string;
  createdAt: string;
}

export async function getBackups(
  page: number = 1,
  perPage: number = 20
): Promise<{ items: BackupRecord[]; totalItems: number; totalPages: number }> {
  const params = new URLSearchParams({
    page: page.toString(),
    perPage: perPage.toString(),
  });
  return api.get(`/api/admin/backups?${params}`, { useAdminToken: true });
}

export async function createBackup(): Promise<{ id: string; filename: string; fileSize: number }> {
  return api.post('/api/admin/backups', {}, { useAdminToken: true });
}

export async function deleteBackupRecord(backupId: string): Promise<void> {
  await api.delete(`/api/admin/backups/${backupId}`, { useAdminToken: true });
}
