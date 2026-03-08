import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, AuthStatus, AuthContextType, KickReason } from '../types';
import * as authService from '../services/auth';

// 创建认证上下文
const AuthContext = createContext<AuthContextType | null>(null);

// 被踢出或禁用时的消息
const KICK_MESSAGES = {
  disabled: '您的账号已被禁用，请联系客服',
  kicked: '您的账号已在其他设备登录，当前设备已退出',
};

// 认证初始化超时时间（毫秒）- 防止网络问题导致永久 Loading
const AUTH_INIT_TIMEOUT = 15000;

const normalizeAuthenticatedUser = (user: User): User => ({
  ...user,
  isActivated: true,
});

// 认证提供者组件
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [kickReason, setKickReason] = useState<KickReason>(null);

  // 清除被踢出原因
  const clearKickReason = useCallback(() => {
    setKickReason(null);
  }, []);

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      // 超时保护：防止网络问题导致永久 Loading
      let isTimedOut = false;
      const timeoutId = window.setTimeout(() => {
        isTimedOut = true;
        console.warn('[Auth] 认证初始化超时，跳转到登录页');
        setStatus('unauthenticated');
      }, AUTH_INIT_TIMEOUT);

      try {
        // 先检查 token 是否有效（包括被踢检测）
        const checkResult = await authService.checkAuthValid();

        // 如果已超时，不再处理结果
        if (isTimedOut) return;
        clearTimeout(timeoutId);

        if (checkResult === 'disabled') {
          setKickReason('disabled');
          setStatus('unauthenticated');
          return;
        }

        if (checkResult === 'kicked') {
          setKickReason('kicked');
          setStatus('unauthenticated');
          return;
        }

        if (checkResult === 'invalid') {
          setStatus('unauthenticated');
          return;
        }

        // Token 有效，获取用户信息
        const currentUser = await authService.refreshUser();

        // 再次检查是否已超时
        if (isTimedOut) return;

        if (currentUser) {
          setUser(normalizeAuthenticatedUser(currentUser));
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (error) {
        clearTimeout(timeoutId);
        if (isTimedOut) return;
        console.error('Auth init error:', error);
        setStatus('unauthenticated');
      }
    };

    initAuth();

    // 监听认证状态变化
    const unsubscribe = authService.onAuthChange((newUser) => {
      if (newUser) {
        setUser(normalizeAuthenticatedUser(newUser));
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    });

    return unsubscribe;
  }, []);

  // 定期检查认证状态（检测被踢下线或禁用）
  useEffect(() => {
    if (status !== 'authenticated') return;

    const checkInterval = setInterval(async () => {
      const result = await authService.checkAuthValid();

      if (result === 'disabled') {
        setKickReason('disabled');
        setUser(null);
        setStatus('unauthenticated');
      } else if (result === 'kicked') {
        setKickReason('kicked');
        setUser(null);
        setStatus('unauthenticated');
      } else if (result === 'invalid' && user) {
        setUser(null);
        setStatus('unauthenticated');
      }
    }, 30000); // 每30秒检查一次

    return () => clearInterval(checkInterval);
  }, [status, user]);

  // 登录
  const login = useCallback(async (username: string, password: string) => {
    // 不要在这里设置 loading 状态，否则会导致 AuthPage 被卸载
    try {
      const loggedInUser = await authService.login(username, password);
      setUser(normalizeAuthenticatedUser(loggedInUser));
      setStatus('authenticated');
    } catch (error) {
      // 登录失败时不改变状态，让错误传递给调用者处理
      throw error;
    }
  }, []);

  // 注册
  const register = useCallback(async (username: string, password: string) => {
    // 不要在这里设置 loading 状态，否则会导致 AuthPage 被卸载
    try {
      const newUser = await authService.register(username, password);
      setUser(normalizeAuthenticatedUser(newUser));
      setStatus('authenticated');
    } catch (error) {
      // 注册失败时不改变状态，让错误传递给调用者处理
      throw error;
    }
  }, []);

  // 登出
  const logout = useCallback(() => {
    authService.logout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  // 修改密码
  const changePassword = useCallback(async (oldPassword: string, newPassword: string) => {
    await authService.changePassword(oldPassword, newPassword);
  }, []);

  // 刷新认证状态
  const refreshAuth = useCallback(async () => {
    try {
      const currentUser = await authService.refreshUser();
      if (currentUser) {
        setUser(normalizeAuthenticatedUser(currentUser));
        setStatus('authenticated');
      } else {
        setUser(null);
        setStatus('unauthenticated');
      }
    } catch (error) {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value: AuthContextType = {
    user,
    status,
    kickReason,
    login,
    register,
    logout,
    changePassword,
    refreshAuth,
    clearKickReason,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// 使用认证上下文的 Hook
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
