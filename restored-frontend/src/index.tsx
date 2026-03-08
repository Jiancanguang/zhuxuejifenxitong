import './index.css';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { UpgradeRequired } from './components/UpgradeRequired';

// === Sentry 错误监控初始化 ===
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || '',
  // 仅在生产环境且配置了 DSN 时启用
  enabled: import.meta.env.PROD && !!import.meta.env.VITE_SENTRY_DSN,
  // 采样率：100% 收集错误
  sampleRate: 1.0,
  // 性能监控采样率：20%
  tracesSampleRate: 0.2,
  // 环境标识
  environment: import.meta.env.MODE,
  // 版本号
  release: `class-pet-garden@${__APP_VERSION__}`,
  // 忽略常见的非致命错误
  ignoreErrors: [
    // 浏览器扩展错误
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    // ResizeObserver 错误（非致命）
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // 网络中断（已有友好提示）
    'Failed to fetch',
    'NetworkError',
  ],
  // 在发送前过滤敏感信息
  beforeSend(event) {
    // 移除可能的敏感信息
    if (event.request) {
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});

// 注册 Service Worker（仅在生产环境）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[App] Service Worker 注册成功:', registration.scope);

        // 检查更新
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[App] 新版本已准备，刷新页面即可更新');
              }
            });
          }
        });
      })
      .catch((error) => {
        console.log('[App] Service Worker 注册失败:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

type UpgradeInfo = {
  message?: string;
  minVersion?: string;
  currentVersion?: string;
};

const Root: React.FC = () => {
  const [upgradeInfo, setUpgradeInfo] = useState<UpgradeInfo | null>(null);

  const handleUpgradeReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter(key => key.startsWith('pet-garden-'))
            .map(key => caches.delete(key))
        );
      }
    } catch (error) {
      console.warn('[App] 清理缓存失败，继续强制刷新:', error);
    }

    const url = new URL(window.location.href);
    url.searchParams.set('_v', String(Date.now()));
    window.location.replace(url.toString());
  };

  useEffect(() => {
    const handleUpgrade = (event: Event) => {
      const detail = (event as CustomEvent).detail as UpgradeInfo | undefined;
      const info = detail || { message: '请刷新页面升级到最新版本' };
      // 不再自动强刷，统一由用户确认后刷新，避免首次进入被动重载
      setUpgradeInfo(info);
    };

    window.addEventListener('app-upgrade-required', handleUpgrade as EventListener);
    return () => {
      window.removeEventListener('app-upgrade-required', handleUpgrade as EventListener);
    };
  }, []);

  return (
    <>
      <ErrorBoundary componentName="App">
        <App />
      </ErrorBoundary>
      <UpgradeRequired info={upgradeInfo} onReload={handleUpgradeReload} />
    </>
  );
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
