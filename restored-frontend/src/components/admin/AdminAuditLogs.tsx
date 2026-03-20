import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Search, ChevronLeft, ChevronRight, Loader2, Shield, User, Clock, Globe } from 'lucide-react';
import { getAuditLogs, AuditLog } from '../../services/admin';

const ACTION_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  'user.disable': { label: '禁用用户', color: 'text-red-700', bg: 'bg-red-50' },
  'user.enable': { label: '启用用户', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  'user.reset-password': { label: '重置密码', color: 'text-amber-700', bg: 'bg-amber-50' },
  'user.delete': { label: '删除用户', color: 'text-red-700', bg: 'bg-red-50' },
  'license.generate': { label: '生成激活码', color: 'text-blue-700', bg: 'bg-blue-50' },
  'class.delete': { label: '删除班级', color: 'text-red-700', bg: 'bg-red-50' },
  'class.reset-progress': { label: '重置进度', color: 'text-orange-700', bg: 'bg-orange-50' },
  'backup.create': { label: '创建备份', color: 'text-indigo-700', bg: 'bg-indigo-50' },
  'backup.delete': { label: '删除备份', color: 'text-red-700', bg: 'bg-red-50' },
};

const ACTION_FILTER_OPTIONS = [
  { value: '', label: '全部操作' },
  { value: 'user.disable', label: '禁用用户' },
  { value: 'user.enable', label: '启用用户' },
  { value: 'user.reset-password', label: '重置密码' },
  { value: 'user.delete', label: '删除用户' },
  { value: 'license.generate', label: '生成激活码' },
  { value: 'class.delete', label: '删除班级' },
  { value: 'class.reset-progress', label: '重置进度' },
  { value: 'backup.create', label: '创建备份' },
];

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const AdminAuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAuditLogs(page, 20, actionFilter || undefined, searchTerm || undefined);
      setLogs(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, searchTerm]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearch = () => {
    setPage(1);
    setSearchTerm(searchInput.trim());
  };

  const handleActionFilterChange = (value: string) => {
    setPage(1);
    setActionFilter(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">操作审计日志</h1>
        <p className="text-slate-500 mt-1">记录管理员和用户的关键操作，共 {totalItems} 条</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索操作内容或用户名..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400"
          />
        </div>
        <select
          value={actionFilter}
          onChange={(e) => handleActionFilterChange(e.target.value)}
          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/20 focus:border-pink-400"
        >
          {ACTION_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={handleSearch}
          className="px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
        >
          搜索
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center">
          <p>{error}</p>
          <button onClick={loadLogs} className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-sm font-medium transition-colors">
            重试
          </button>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无审计日志</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: 'text-slate-700', bg: 'bg-slate-50' };
            return (
              <div key={log.id} className="bg-white rounded-xl p-4 border border-slate-100 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionInfo.color} ${actionInfo.bg}`}>
                        {actionInfo.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        {log.actorRole === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                        {log.actorUsername}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{log.summary}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(log.createdAt)}
                      </span>
                      {log.ipAddress && (
                        <span className="inline-flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ipAddress}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm text-slate-600 px-3">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};
