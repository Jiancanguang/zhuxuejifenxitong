/**
 * API 客户端封装
 * 统一处理 HTTP 请求、Token 管理、错误处理
 * v1.1.9: 添加超时、重试、友好错误提示
 */

// Token 存储 key
const TOKEN_KEY = 'zhuxue-jifen-token';
const ADMIN_TOKEN_KEY = 'zhuxue-jifen-admin-token';

// === 网络配置常量 ===
const REQUEST_TIMEOUT = 20000; // 20秒超时
const MAX_RETRIES = 2; // 最多重试2次（共3次请求）
const RETRY_DELAY = 1000; // 重试间隔1秒

// 版本升级提示事件
export const UPGRADE_EVENT = 'app-upgrade-required';
export const CLASS_RESET_CONFLICT_EVENT = 'class-reset-conflict';
const CLASS_RESET_CONFLICT_MESSAGES = new Set([
  '班级正在重置，请稍后重试',
  '班级写请求排空超时，请稍后重试',
]);

const normalizeBaseUrl = (value?: string): string => {
  const trimmed = (value || '').trim();
  return trimmed.replace(/\/+$/, '');
};

// 获取 API 基础 URL
const getBaseUrl = (): string => {
  const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL);
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }
  // 开发环境默认走相对路径，由 Vite 转发到本地代理服务
  if (import.meta.env.DEV) {
    return '';
  }
  // 生产环境使用相对路径（通过 Nginx 代理）
  return '';
};

// Token 管理
export const tokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },

  getAdminToken: (): string | null => {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  },

  setAdminToken: (token: string): void => {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  },

  clearAdminToken: (): void => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  },
};

// API 响应类型
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

// API 错误类型
export class ApiError extends Error {
  statusCode: number;
  isTimeout: boolean;
  isNetworkError: boolean;
  isSecurityBlocked: boolean;

  constructor(
    message: string,
    statusCode: number = 400,
    options: { isTimeout?: boolean; isNetworkError?: boolean; isSecurityBlocked?: boolean } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isTimeout = options.isTimeout || false;
    this.isNetworkError = options.isNetworkError || false;
    this.isSecurityBlocked = options.isSecurityBlocked || false;
  }
}

// 请求配置
interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  useAdminToken?: boolean;
  skipRetry?: boolean; // 跳过重试（用于登录等一次性请求）
}

/**
 * 延迟函数
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 获取友好的中文错误提示
 */
function getFriendlyErrorMessage(error: any, statusCode?: number): string {
  // 超时错误
  if (error.name === 'AbortError' || error.name === 'TimeoutError') {
    return '网络请求超时，请检查网络连接后重试';
  }

  // 网络错误（通常是 fetch 失败）
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return '无法连接到服务器，请检查网络连接';
  }

  // status=0 通常是被安全软件拦截
  if (statusCode === 0) {
    return '请求被拦截，请检查360安全卫士、电脑管家等安全软件是否阻止了访问';
  }

  // HTTP 状态码错误
  if (statusCode) {
    switch (statusCode) {
      case 401:
        return '登录已过期，请重新登录';
      case 403:
        return '没有权限执行此操作';
      case 404:
        return '请求的资源不存在';
      case 429:
        return '操作过于频繁，请稍后再试';
      case 500:
      case 502:
      case 503:
        return '服务器繁忙，请稍后再试';
      default:
        if (statusCode >= 500) {
          return '服务器错误，请稍后再试';
        }
    }
  }

  // 默认错误信息
  return error.message || '网络请求失败，请重试';
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 发起 API 请求（带超时和重试）
 */
async function request<T = any>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuth = false, useAdminToken = false, skipRetry = false, ...fetchOptions } = options;
  const baseUrl = getBaseUrl();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  // 添加版本号（用于强制升级检查）
  if (typeof __APP_VERSION__ !== 'undefined') {
    headers['X-App-Version'] = __APP_VERSION__;
  }

  // 添加认证 Token
  if (!skipAuth) {
    const token = useAdminToken
      ? tokenManager.getAdminToken()
      : tokenManager.getToken();

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const requestUrl = `${baseUrl}${path}`;
  const requestConfig: RequestInit = {
    ...fetchOptions,
    headers,
  };

  let lastError: any = null;
  const maxAttempts = skipRetry ? 1 : MAX_RETRIES + 1;

  // 重试循环
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetchWithTimeout(requestUrl, requestConfig, REQUEST_TIMEOUT);

      // 检测被安全软件拦截的情况（status=0）
      if (response.status === 0) {
        throw new ApiError(
          getFriendlyErrorMessage(null, 0),
          0,
          { isSecurityBlocked: true }
        );
      }

      // 处理空响应
      if (response.status === 204) {
        return {} as T;
      }

      const data: ApiResponse<T> = await response.json();

      if (response.status === 426 && typeof window !== 'undefined') {
        const detail = {
          message: data.message || '请刷新页面升级到最新版本',
          minVersion: (data as any).minVersion,
          currentVersion: (data as any).currentVersion,
        };
        window.dispatchEvent(new CustomEvent(UPGRADE_EVENT, { detail }));
      }

      if (
        response.status === 409
        && typeof window !== 'undefined'
        && data.message
        && CLASS_RESET_CONFLICT_MESSAGES.has(data.message)
      ) {
        window.dispatchEvent(new CustomEvent(CLASS_RESET_CONFLICT_EVENT, {
          detail: { message: data.message },
        }));
      }

      if (!response.ok || !data.success) {
        throw new ApiError(
          data.message || getFriendlyErrorMessage(null, response.status),
          response.status
        );
      }

      return data.data as T;

    } catch (error: any) {
      lastError = error;

      // 如果是 ApiError 且不是网络/超时错误，不重试
      if (error instanceof ApiError && !error.isNetworkError && !error.isTimeout) {
        throw error;
      }

      // 超时错误
      if (error.name === 'AbortError') {
        lastError = new ApiError(
          getFriendlyErrorMessage(error),
          0,
          { isTimeout: true }
        );
      }

      // 网络错误
      if (error.name === 'TypeError') {
        lastError = new ApiError(
          getFriendlyErrorMessage(error),
          0,
          { isNetworkError: true }
        );
      }

      // 如果还有重试机会，等待后重试
      if (attempt < maxAttempts) {
        console.warn(`[API] 请求失败，${RETRY_DELAY}ms 后进行第 ${attempt + 1}/${maxAttempts} 次尝试...`);
        await delay(RETRY_DELAY);
      }
    }
  }

  // 所有重试都失败了
  throw lastError;
}

// 导出便捷方法
export const api = {
  get: <T = any>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T = any>(path: string, body?: any, options?: RequestOptions) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T = any>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};

export default api;
