import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Users, RefreshCw, Trash2, Download, KeyRound, Eye, EyeOff } from 'lucide-react';
import * as dataService from '../services/data';

interface ParentCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  classTitle: string;
  apiBaseUrl: string;
}

interface AccountDisplay {
  id: string;
  studentId: string;
  studentName: string;
  username: string;
  isEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export function ParentCodesModal({ isOpen, onClose, classId, classTitle }: ParentCodesModalProps) {
  const [accounts, setAccounts] = useState<AccountDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [defaultPassword, setDefaultPassword] = useState('123456');
  const [showPassword, setShowPassword] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await dataService.getParentAccounts(classId);
      setAccounts(result.accounts);
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (isOpen && classId) {
      fetchAccounts();
    }
  }, [isOpen, classId, fetchAccounts]);

  const handleBatchCreate = async () => {
    if (!defaultPassword || defaultPassword.length < 4) {
      setError('密码至少4位');
      return;
    }
    setCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await dataService.batchCreateParentAccounts(classId, defaultPassword);
      const newCount = result.accounts.filter(a => !a.existed).length;
      const existCount = result.accounts.filter(a => a.existed).length;
      let msg = '';
      if (newCount > 0) msg += `成功创建 ${newCount} 个家长账号`;
      if (existCount > 0) msg += `${newCount > 0 ? '，' : ''}${existCount} 个已存在`;
      setSuccessMsg(msg || '操作完成');
      await fetchAccounts();
    } catch (err: any) {
      setError(err.message || '创建失败');
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (accountId: string, studentName: string) => {
    try {
      const result = await dataService.resetParentPassword(accountId);
      setSuccessMsg(`${studentName} 的密码已重置为 ${result.password}`);
    } catch (err: any) {
      setError(err.message || '重置失败');
    }
  };

  const handleDelete = async (accountId: string) => {
    try {
      await dataService.deleteParentAccount(accountId);
      setAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (err: any) {
      setError(err.message || '删除失败');
    }
  };

  const handleExportAll = () => {
    if (accounts.length === 0) return;

    const lines = [
      `${classTitle} - 家长账号信息`,
      `导出时间: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '学生姓名（即登录账号）\t初始密码',
      ...accounts.map(a => `${a.username}\t${defaultPassword}`),
      '',
      '登录方式：',
      '1. 打开微信小程序「助学积分」',
      '2. 搜索并选择班级',
      '3. 输入学生姓名和密码登录',
      '4. 登录后可修改密码',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classTitle}-家长账号.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" />
              家长账号管理
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              家长用学生姓名 + 密码登录小程序查看积分
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-b border-gray-50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 whitespace-nowrap">统一密码：</span>
            <div className="relative flex-1 max-w-[160px]">
              <input
                type={showPassword ? 'text' : 'password'}
                value={defaultPassword}
                onChange={e => setDefaultPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg pr-8"
                placeholder="初始密码"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleBatchCreate}
              disabled={creating}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {creating ? '创建中...' : '一键开通全班账号'}
            </button>
            {accounts.length > 0 && (
              <button
                onClick={handleExportAll}
                className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                导出
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 px-3 py-2 bg-green-50 text-green-600 text-sm rounded-lg">
            {successMsg}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">还没有开通家长账号</p>
              <p className="text-xs mt-1">设置统一密码后，点击上方按钮一键开通</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{item.studentName}</span>
                    {item.lastLoginAt && (
                      <span className="ml-2 text-[10px] text-green-500 bg-green-50 px-1.5 py-0.5 rounded">
                        已登录
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleResetPassword(item.id, item.studentName)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors"
                      title="重置密码"
                    >
                      <KeyRound className="w-4 h-4 text-gray-400 hover:text-indigo-500" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="删除账号"
                    >
                      <Trash2 className="w-4 h-4 text-gray-300 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {accounts.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            共 {accounts.length} 个账号 · 账号 = 学生姓名 · 家长在小程序登录即可
          </div>
        )}
      </div>
    </div>
  );
}
