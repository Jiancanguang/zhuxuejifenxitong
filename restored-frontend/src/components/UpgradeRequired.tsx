import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface UpgradeInfo {
  message?: string;
  minVersion?: string;
  currentVersion?: string;
}

interface UpgradeRequiredProps {
  info?: UpgradeInfo | null;
  onReload?: () => void;
}

export const UpgradeRequired: React.FC<UpgradeRequiredProps> = ({ info, onReload }) => {
  if (!info) return null;

  const handleReload = () => {
    if (onReload) {
      onReload();
      return;
    }
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-rose-50 p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-amber-100 p-8 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-100 text-amber-600 mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">需要升级</h2>
        <p className="text-slate-600 mb-6">
          {info.message || '当前版本过旧，请刷新页面升级到最新版本。'}
        </p>
        {(info.minVersion || info.currentVersion) && (
          <div className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3 mb-6">
            {info.currentVersion && (
              <div>当前版本：{info.currentVersion}</div>
            )}
            {info.minVersion && (
              <div>最低版本：{info.minVersion}</div>
            )}
          </div>
        )}
        <button
          onClick={handleReload}
          className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold rounded-xl shadow-lg shadow-amber-200 hover:shadow-xl hover:scale-[1.01] transition-all"
        >
          <RefreshCw className="w-5 h-5" />
          刷新升级
        </button>
      </div>
    </div>
  );
};
