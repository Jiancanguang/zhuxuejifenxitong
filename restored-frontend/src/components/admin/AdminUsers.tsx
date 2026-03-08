import React, { useEffect, useState } from 'react';
import { Search, ChevronLeft, ChevronRight, Loader2, UserX, Trash2, X, AlertTriangle, Check, RefreshCw, Copy } from 'lucide-react';
import { getUsers, toggleUserDisabled, resetUserPassword, deleteUser, getUserDetail, AdminUser } from '../../services/admin';
import { useScrollLock } from '../../hooks/useMobile';

type FilterType = 'all' | 'active' | 'disabled';

const filterOptions: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '正常账号' },
  { value: 'disabled', label: '已禁用' },
];

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'reset' | 'toggle' | 'delete'; user: AdminUser } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useScrollLock(!!selectedUser || !!confirmAction);

  useEffect(() => {
    loadUsers();
  }, [page, filter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const result = await getUsers(page, 10, filter === 'all' ? undefined : filter, search || undefined);
      setUsers(result.items);
      setTotalPages(result.totalPages);
      setTotalItems(result.totalItems);
    } catch {
      showToast('加载失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    loadUsers();
  };

  const handleSelectUser = async (user: AdminUser) => {
    setSelectedUser(user);
    setDetailLoading(true);
    try {
      const detail = await getUserDetail(user.id);
      setSelectedUser(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast(`已复制${label}`, 'success');
  };

  const handleResetPassword = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      await resetUserPassword(user.id);
      showToast(`已重置 ${user.username} 的密码为 123456`, 'success');
      setConfirmAction(null);
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleDisabled = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      await toggleUserDisabled(user.id, !user.isDisabled);
      showToast(`已${user.isDisabled ? '启用' : '禁用'} ${user.username}`, 'success');
      setConfirmAction(null);
      setSelectedUser(null);
      loadUsers();
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user: AdminUser) => {
    setActionLoading(true);
    try {
      await deleteUser(user.id);
      showToast(`已删除用户 ${user.username}`, 'success');
      setConfirmAction(null);
      setSelectedUser(null);
      loadUsers();
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">用户管理</h1>
        <p className="text-slate-500 mt-1">共 {totalItems} 个工作室账号</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索用户名..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value as FilterType); setPage(1); }}
            className="px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-500 min-h-[44px]"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            className="px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-medium rounded-xl transition-colors min-h-[44px]"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            暂无用户
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 sm:px-6 py-4 text-left text-sm font-bold text-slate-600">用户名</th>
                  <th className="px-4 sm:px-6 py-4 text-left text-sm font-bold text-slate-600">状态</th>
                  <th className="px-4 sm:px-6 py-4 text-left text-sm font-bold text-slate-600">班级 / 学生</th>
                  <th className="px-4 sm:px-6 py-4 text-left text-sm font-bold text-slate-600">注册时间</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <span className="font-medium text-slate-800">{user.username}</span>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                      {user.isDisabled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-600 text-sm font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                          已禁用
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-600 text-sm font-medium rounded-full">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                          正常
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-600">
                      {user.classCount || 0} / {user.studentCount || 0}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-sm text-slate-500">
                      {formatDate(user.created)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-slate-100">
            <button
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <span className="text-sm text-slate-500">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden modal-content">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">用户详情</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="touch-target p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60dvh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500">用户名</p>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-800">{selectedUser.username}</p>
                    <button
                      onClick={() => copyToClipboard(selectedUser.username, '用户名')}
                      className="p-1 hover:bg-slate-100 rounded transition-colors"
                      title="复制用户名"
                    >
                      <Copy className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-slate-500">账号状态</p>
                  <p className="font-bold">
                    {selectedUser.isDisabled ? (
                      <span className="text-red-600">已禁用</span>
                    ) : (
                      <span className="text-emerald-600">正常</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">注册时间</p>
                  <p className="font-medium text-slate-700">{formatDate(selectedUser.created)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">班级 / 学生</p>
                  <p className="font-medium text-slate-700">
                    {detailLoading ? (
                      <span className="text-slate-400">加载中...</span>
                    ) : (
                      <>{selectedUser.classCount || 0} 个班级，{selectedUser.studentCount || 0} 名学生</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-3 safe-area-bottom">
              <button
                onClick={() => setConfirmAction({ type: 'reset', user: selectedUser })}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors min-h-[44px]"
              >
                <RefreshCw className="w-4 h-4" />
                重置密码
              </button>
              <button
                onClick={() => setConfirmAction({ type: 'toggle', user: selectedUser })}
                className={`flex items-center gap-2 px-4 py-2 font-medium rounded-lg transition-colors min-h-[44px] ${selectedUser.isDisabled
                  ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                  : 'bg-slate-500 hover:bg-slate-600 text-white'
                }`}
              >
                <UserX className="w-4 h-4" />
                {selectedUser.isDisabled ? '启用账号' : '禁用账号'}
              </button>
              <button
                onClick={() => setConfirmAction({ type: 'delete', user: selectedUser })}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors min-h-[44px]"
              >
                <Trash2 className="w-4 h-4" />
                删除用户
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden modal-content">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">
                {confirmAction.type === 'reset' && '确认重置密码？'}
                {confirmAction.type === 'toggle' && (confirmAction.user.isDisabled ? '确认启用账号？' : '确认禁用账号？')}
                {confirmAction.type === 'delete' && '确认删除用户？'}
              </h3>
              <p className="text-slate-500 text-sm">
                {confirmAction.type === 'reset' && `用户 ${confirmAction.user.username} 的密码将重置为 123456`}
                {confirmAction.type === 'toggle' && (confirmAction.user.isDisabled
                  ? `用户 ${confirmAction.user.username} 将恢复登录权限`
                  : `用户 ${confirmAction.user.username} 将无法登录`)}
                {confirmAction.type === 'delete' && `用户 ${confirmAction.user.username} 的所有数据将被删除，无法恢复`}
              </p>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={actionLoading}
                className="flex-1 px-6 py-4 text-slate-600 font-medium hover:bg-slate-50 transition-colors min-h-[44px]"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'reset') handleResetPassword(confirmAction.user);
                  if (confirmAction.type === 'toggle') handleToggleDisabled(confirmAction.user);
                  if (confirmAction.type === 'delete') handleDeleteUser(confirmAction.user);
                }}
                disabled={actionLoading}
                className="flex-1 px-6 py-4 bg-pink-500 text-white font-medium hover:bg-pink-600 transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                {actionLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <Check className="w-5 h-5" />
                    确认
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-[70] px-6 py-3 rounded-full shadow-lg font-medium ${toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}
          style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
