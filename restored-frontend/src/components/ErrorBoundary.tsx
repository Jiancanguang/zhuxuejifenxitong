import React, { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  // 可选：自定义回退UI
  fallback?: ReactNode;
  // 可选：错误发生时的回调
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  // 可选：组件级别标识（用于日志）
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary 错误边界组件
 *
 * 功能：
 * 1. 捕获子组件树中的 JavaScript 错误
 * 2. 防止整页白屏，显示友好的错误提示
 * 3. 自动上报错误到 Sentry
 * 4. 提供重试功能
 */
export class ErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  declare state: State;
  declare setState: (
    state:
      | State
      | Partial<State>
      | null
      | ((prevState: Readonly<State>, props: Readonly<Props>) => State | Partial<State> | null),
    callback?: () => void
  ) => void;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 上报到 Sentry
    Sentry.withScope((scope) => {
      scope.setTag('errorBoundary', this.props.componentName || 'unknown');
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });

    // 调用自定义回调
    this.props.onError?.(error, errorInfo);

    // 控制台输出（开发调试用）
    console.error('[ErrorBoundary] 捕获到错误:', error);
    console.error('[ErrorBoundary] 组件栈:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义回退UI，使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[200px] p-6 bg-rose-50 rounded-2xl border border-rose-200">
          <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>

          <h3 className="text-lg font-bold text-rose-800 mb-2">
            哎呀，出了点问题
          </h3>

          <p className="text-sm text-rose-600 text-center mb-4 max-w-sm">
            这个区域加载时遇到了错误，但不用担心，其他功能仍然可以正常使用。
          </p>

          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              重试
            </button>

            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-white hover:bg-rose-100 text-rose-600 font-bold rounded-lg border border-rose-300 transition-colors"
            >
              刷新页面
            </button>
          </div>

          {/* 开发环境显示错误详情 */}
          {import.meta.env.DEV && this.state.error && (
            <details className="mt-4 w-full max-w-md">
              <summary className="text-xs text-rose-400 cursor-pointer hover:text-rose-500">
                查看错误详情（仅开发环境可见）
              </summary>
              <pre className="mt-2 p-3 bg-rose-100 rounded-lg text-xs text-rose-700 overflow-auto max-h-32">
                {this.state.error.message}
                {'\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 卡片级别的 ErrorBoundary
 * 用于包裹单个卡片组件，防止单个卡片崩溃影响整个列表
 */
export const CardErrorBoundary: React.FC<{ children: ReactNode; cardName?: string }> = ({
  children,
  cardName
}) => {
  return (
    <ErrorBoundary
      componentName={`Card:${cardName || 'unknown'}`}
      fallback={
        <div className="flex flex-col items-center justify-center p-4 bg-slate-100 rounded-2xl min-h-[200px]">
          <div className="text-4xl mb-2">😢</div>
          <p className="text-sm text-slate-500 font-bold">加载出错</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-bold"
          >
            点击刷新
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

/**
 * 模态框级别的 ErrorBoundary
 */
export const ModalErrorBoundary: React.FC<{ children: ReactNode; modalName?: string }> = ({
  children,
  modalName
}) => {
  return (
    <ErrorBoundary
      componentName={`Modal:${modalName || 'unknown'}`}
      fallback={
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">弹窗加载失败</h3>
            <p className="text-sm text-slate-500 mb-4">请刷新页面后重试</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
