import React, { useState, useEffect, useCallback, useRef } from 'react';

// ===============================================
// 设备检测 Hook
// ===============================================
export function useDeviceDetect() {
  const [deviceInfo, setDeviceInfo] = useState({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isTouchDevice: false,
    screenWidth: typeof window !== 'undefined' ? window.innerWidth : 1024,
    screenHeight: typeof window !== 'undefined' ? window.innerHeight : 768,
    orientation: 'portrait' as 'portrait' | 'landscape',
  });

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const userAgent = navigator.userAgent.toLowerCase();

      const isMobile = width < 640;
      const isTablet = width >= 640 && width < 1024;
      const isDesktop = width >= 1024;
      const isIOS = /iphone|ipad|ipod/.test(userAgent);
      const isAndroid = /android/.test(userAgent);
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const orientation = width > height ? 'landscape' : 'portrait';

      setDeviceInfo({
        isMobile,
        isTablet,
        isDesktop,
        isIOS,
        isAndroid,
        isTouchDevice,
        screenWidth: width,
        screenHeight: height,
        orientation,
      });
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    window.addEventListener('orientationchange', checkDevice);

    return () => {
      window.removeEventListener('resize', checkDevice);
      window.removeEventListener('orientationchange', checkDevice);
    };
  }, []);

  return deviceInfo;
}

// ===============================================
// 触摸手势 Hook
// ===============================================
interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
}

interface SwipeOptions {
  threshold?: number; // 滑动触发阈值 (px)
  longPressDelay?: number; // 长按触发延迟 (ms)
  doubleTapDelay?: number; // 双击间隔 (ms)
}

export function useTouchGestures(
  handlers: SwipeHandlers,
  options: SwipeOptions = {}
) {
  const {
    threshold = 50,
    longPressDelay = 500,
    doubleTapDelay = 300,
  } = options;

  const touchStart = useRef({ x: 0, y: 0, time: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTime = useRef(0);
  const isLongPressing = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    isLongPressing.current = false;

    // 长按检测
    if (handlers.onLongPress) {
      longPressTimer.current = setTimeout(() => {
        isLongPressing.current = true;
        handlers.onLongPress?.();
      }, longPressDelay);
    }
  }, [handlers, longPressDelay]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    // 只有移动超过10px才取消长按，避免手指抖动误触发
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStart.current.x);
    const deltaY = Math.abs(touch.clientY - touchStart.current.y);

    if ((deltaX > 10 || deltaY > 10) && longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    // 清除长按计时器
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }

    // 如果是长按，不触发其他事件
    if (isLongPressing.current) {
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStart.current.x;
    const deltaY = touch.clientY - touchStart.current.y;
    const deltaTime = Date.now() - touchStart.current.time;

    // 双击检测
    const now = Date.now();
    if (handlers.onDoubleTap && deltaTime < 200 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
      if (now - lastTapTime.current < doubleTapDelay) {
        handlers.onDoubleTap();
        lastTapTime.current = 0;
        return;
      }
      lastTapTime.current = now;
    }

    // 滑动检测 - 只在快速滑动时触发
    if (deltaTime < 300) {
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // 水平滑动
      if (absX > threshold && absX > absY) {
        if (deltaX > 0) {
          handlers.onSwipeRight?.();
        } else {
          handlers.onSwipeLeft?.();
        }
      }
      // 垂直滑动
      else if (absY > threshold && absY > absX) {
        if (deltaY > 0) {
          handlers.onSwipeDown?.();
        } else {
          handlers.onSwipeUp?.();
        }
      }
    }
  }, [handlers, threshold, doubleTapDelay]);

  const onTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  };
}

// ===============================================
// 虚拟键盘检测 Hook
// ===============================================
export function useVirtualKeyboard() {
  const [keyboardState, setKeyboardState] = useState({
    isOpen: false,
    height: 0,
  });

  useEffect(() => {
    // SSR 安全检查
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // 使用 visualViewport API 检测键盘
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        const heightDiff = windowHeight - viewportHeight;

        // 高度差超过 150px 认为键盘打开
        setKeyboardState({
          isOpen: heightDiff > 150,
          height: heightDiff > 150 ? heightDiff : 0,
        });
      }
    };

    window.visualViewport?.addEventListener('resize', handleResize);
    window.visualViewport?.addEventListener('scroll', handleResize);

    return () => {
      window.visualViewport?.removeEventListener('resize', handleResize);
      window.visualViewport?.removeEventListener('scroll', handleResize);
    };
  }, []);

  return keyboardState;
}

// ===============================================
// 滚动锁定 Hook (模态框打开时使用)
// ===============================================
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      const scrollY = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isLocked]);
}

// ===============================================
// 网络状态检测 Hook
// ===============================================
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // 检测连接类型
    const updateConnectionType = () => {
      const connection = (navigator as any).connection ||
        (navigator as any).mozConnection ||
        (navigator as any).webkitConnection;
      if (connection) {
        setConnectionType(connection.effectiveType || 'unknown');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    updateConnectionType();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, connectionType };
}

// ===============================================
// 安全区域 Hook
// ===============================================
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  });

  useEffect(() => {
    // SSR 安全检查
    if (typeof window === 'undefined') return;

    // 创建一个隐藏的测量元素来获取实际的安全区域值
    const measureSafeArea = (position: 'top' | 'bottom' | 'left' | 'right'): number => {
      const testEl = document.createElement('div');
      testEl.style.position = 'fixed';
      testEl.style.visibility = 'hidden';
      testEl.style.pointerEvents = 'none';

      // 根据方向设置对应的 env() 值
      switch (position) {
        case 'top':
          testEl.style.top = '0';
          testEl.style.height = 'env(safe-area-inset-top, 0px)';
          break;
        case 'bottom':
          testEl.style.bottom = '0';
          testEl.style.height = 'env(safe-area-inset-bottom, 0px)';
          break;
        case 'left':
          testEl.style.left = '0';
          testEl.style.width = 'env(safe-area-inset-left, 0px)';
          break;
        case 'right':
          testEl.style.right = '0';
          testEl.style.width = 'env(safe-area-inset-right, 0px)';
          break;
      }

      document.body.appendChild(testEl);
      const computed = getComputedStyle(testEl);
      const value = position === 'top' || position === 'bottom'
        ? parseInt(computed.height, 10) || 0
        : parseInt(computed.width, 10) || 0;
      document.body.removeChild(testEl);

      return value;
    };

    const updateSafeArea = () => {
      setSafeArea({
        top: measureSafeArea('top'),
        bottom: measureSafeArea('bottom'),
        left: measureSafeArea('left'),
        right: measureSafeArea('right'),
      });
    };

    updateSafeArea();
    window.addEventListener('resize', updateSafeArea);
    window.addEventListener('orientationchange', updateSafeArea);

    return () => {
      window.removeEventListener('resize', updateSafeArea);
      window.removeEventListener('orientationchange', updateSafeArea);
    };
  }, []);

  return safeArea;
}
