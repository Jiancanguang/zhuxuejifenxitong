import React, { useEffect, useState, useCallback } from 'react';
import {
  Database, Plus, Trash2, ChevronLeft, ChevronRight, Loader2,
  CheckCircle2, XCircle, Clock as ClockIcon, HardDrive, Timer
} from 'lucide-react';
import { getBackups, createBackup, deleteBackupRecord, BackupRecord } from '../../services/admin';

const formatTime = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const AdminBackups: React.FC = () => {
  const [records, setRecords] = useState<BackupRecord[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getBackups(page, 20);
      setRecords(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleCreate = async () => {
    if (creating) return;
    setCreating(true);
    setMessage('');
    setError('');
    try {
      const result = await createBackup();
      setMessage(`备份创建成功: ${result.filename}`);
      loadRecords();
    } catch (err: any) {
      setError(err.message || '备份创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (record: BackupRecord) => {
    if (!window.confirm(`确定删除备份 ${record.filename}？此操作不可恢复。`)) return;
    setDeletingId(record.id);
    try {
      await deleteBackupRecord(record.id);
      setMessage('备份已删除');
      loadRecords();
    } catch (err: any) {
      setError(err.message || '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">数据备份</h1>
          <p className="text-slate-500 mt-1">
            自动每 24 小时备份一次，保留最近 30 份 · 共 {totalItems} 条记录
          </p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 disabled:opacity-60 transition-colors"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          立即备份
        </button>
      </div>

      {/* Messages */}
      {message && (
        <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" />
          {error}
          <button onClick={loadRecords} className="ml-auto px-3 py-1 bg-red-100 hover:bg-red-200 rounded-lg text-xs font-medium transition-colors">
            重试
          </button>
        </div>
      )}

      {/* Info Card */}
      <div className="bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl p-5 text-white">
        <h3 className="font-bold text-lg mb-2">备份说明</h3>
        <ul className="space-y-1 text-sm text-white/90">
          <li>• 系统每 24 小时自动创建一次数据库完整备份</li>
          <li>• 备份文件保存在服务器本地，自动清理超过 30 份的旧备份</li>
          <li>• 你也可以随时点击「立即备份」手动创建备份</li>
          <li>• 建议定期下载备份文件到其他存储位置，以防数据丢失</li>
        </ul>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
          <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">暂无备份记录</p>
          <button
            onClick={handleCreate}
            className="mt-4 px-5 py-2 bg-pink-500 text-white rounded-xl text-sm font-medium hover:bg-pink-600 transition-colors"
          >
            创建第一个备份
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500">
                  <th className="text-left px-5 py-3 font-medium">文件名</th>
                  <th className="text-left px-5 py-3 font-medium">大小</th>
                  <th className="text-left px-5 py-3 font-medium">触发方式</th>
                  <th className="text-left px-5 py-3 font-medium">状态</th>
                  <th className="text-left px-5 py-3 font-medium">时间</th>
                  <th className="text-right px-5 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span className="font-mono text-xs text-slate-700 truncate max-w-[220px]">{record.filename}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <HardDrive className="w-3.5 h-3.5" />
                        {record.fileSizeFormatted}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        record.triggerType === 'scheduled'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-purple-50 text-purple-700'
                      }`}>
                        {record.triggerType === 'scheduled' ? <Timer className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {record.triggerType === 'scheduled' ? '定时' : '手动'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {record.status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          成功
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs" title={record.errorMessage}>
                          <XCircle className="w-3.5 h-3.5" />
                          失败
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-slate-500 text-xs">
                        <ClockIcon className="w-3.5 h-3.5" />
                        {formatTime(record.createdAt)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => handleDelete(record)}
                        disabled={deletingId === record.id}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        title="删除备份"
                      >
                        {deletingId === record.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />
                        }
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
