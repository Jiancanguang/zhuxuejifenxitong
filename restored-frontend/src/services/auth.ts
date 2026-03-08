/**
 * 认证服务
 * 处理用户注册、登录和密码管理
 */

import api, { tokenManager, ApiError } from '../lib/api';
import { User } from '../types';
import { USERNAME_MIN_LENGTH, USERNAME_PATTERN, PASSWORD_MIN_LENGTH } from '../lib/constants';

// 认证状态变化回调列表
let authChangeCallbacks: ((user: User | null) => void)[] = [];

// 当前用户缓存
let currentUserCache: User | null = null;

// 验证用户名格式
export function validateUsername(username: string): string | null {
  const trimmed = username.trim();
  if (!trimmed) return '请输入用户名';
  if (trimmed.length < USERNAME_MIN_LENGTH) return `用户名至少需要${USERNAME_MIN_LENGTH}个字符`;
  if (!USERNAME_PATTERN.test(trimmed)) return '用户名只能包含字母、数字和下划线';
  return null;
}

// 验证密码格式
export function validatePassword(password: string): string | null {
  if (!password) return '请输入密码';
  if (password.length < PASSWORD_MIN_LENGTH) return `密码至少需要${PASSWORD_MIN_LENGTH}个字符`;
  return null;
}

// 通知认证状态变化
function notifyAuthChange(user: User | null) {
  currentUserCache = user;
  authChangeCallbacks.forEach(cb => cb(user));
}

// 注册
export async function register(username: string, password: string): Promise<User> {
  const usernameError = validateUsername(username);
  if (usernameError) throw new Error(usernameError);

  const passwordError = validatePassword(password);
  if (passwordError) throw new Error(passwordError);

  try {
    const result = await api.post<{ user: User; token: string }>(
      '/api/auth/register',
      { username: username.trim(), password },
      { skipAuth: true }
    );

    tokenManager.setToken(result.token);
    notifyAuthChange(result.user);

    return result.user;
  } catch (error: any) {
    throw new Error(error.message || '注册失败，请稍后重试');
  }
}

// 登录
export async function login(username: string, password: string): Promise<User> {
  if (!username.trim()) throw new Error('请输入用户名');
  if (!password) throw new Error('请输入密码');

  try {
    const result = await api.post<{ user: User; token: string }>(
      '/api/auth/login',
      { username: username.trim(), password },
      { skipAuth: true }
    );

    tokenManager.setToken(result.token);
    notifyAuthChange(result.user);

    return result.user;
  } catch (error: any) {
    throw new Error(error.message || '登录失败');
  }
}

// 登出
export function logout(): void {
  // 尝试调用后端登出 API（不等待结果）
  api.post('/api/auth/logout').catch(() => {});

  tokenManager.clearToken();
  notifyAuthChange(null);
}

// 获取当前用户（从缓存）
export function getCurrentUser(): User | null {
  return currentUserCache;
}

// 刷新用户信息（从服务器）
export async function refreshUser(): Promise<User | null> {
  const token = tokenManager.getToken();
  if (!token) {
    currentUserCache = null;
    return null;
  }

  try {
    const result = await api.get<{ user: User }>('/api/auth/me');
    currentUserCache = result.user;
    return result.user;
  } catch (error) {
    tokenManager.clearToken();
    currentUserCache = null;
    return null;
  }
}

// 修改密码
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new Error(passwordError);

  try {
    await api.post('/api/auth/change-password', {
      oldPassword,
      newPassword,
    });

    // 改密成功后后端会吊销全部会话，前端立即登出避免等待轮询。
    tokenManager.clearToken();
    notifyAuthChange(null);
  } catch (error: any) {
    throw new Error(error.message || '修改密码失败');
  }
}

// 验证当前登录密码（用于高风险操作前校验）
export async function verifyLoginPassword(password: string): Promise<void> {
  if (!password) {
    throw new Error('请输入登录密码');
  }

  await api.post(
    '/api/auth/verify-password',
    { password },
    { skipRetry: true }
  );
}

// 检查登录状态是否有效
export type AuthCheckResult = 'valid' | 'disabled' | 'kicked' | 'invalid';

export async function checkAuthValid(): Promise<AuthCheckResult> {
  const token = tokenManager.getToken();
  if (!token) {
    return 'invalid';
  }

  try {
    await api.get<{ status: string }>('/api/auth/check');
    return 'valid';
  } catch (error: any) {
    if (error instanceof ApiError) {
      if (error.message.includes('禁用')) {
        tokenManager.clearToken();
        notifyAuthChange(null);
        return 'disabled';
      }
      if (error.message.includes('其他设备')) {
        tokenManager.clearToken();
        notifyAuthChange(null);
        return 'kicked';
      }
    }
    return 'invalid';
  }
}

// 监听认证状态变化
export function onAuthChange(callback: (user: User | null) => void): () => void {
  authChangeCallbacks.push(callback);

  // 返回取消订阅函数
  return () => {
    authChangeCallbacks = authChangeCallbacks.filter(cb => cb !== callback);
  };
}

// 更新用户设置
export async function updateUserSettings(settings: {
  systemTitle?: string;
  currentClassId?: string;
}): Promise<void> {
  try {
    await api.put('/api/auth/settings', settings);

    // 更新本地缓存
    if (currentUserCache) {
      if (settings.systemTitle !== undefined) {
        currentUserCache = { ...currentUserCache, systemTitle: settings.systemTitle };
      }
      if (settings.currentClassId !== undefined) {
        currentUserCache = { ...currentUserCache, currentClassId: settings.currentClassId };
      }
    }
  } catch (error: any) {
    throw new Error(error.message || '更新设置失败');
  }
}
