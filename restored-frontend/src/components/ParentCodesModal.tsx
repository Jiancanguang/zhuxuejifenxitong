import React, { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, Loader2, QrCode, RefreshCw, Trash2, Download } from 'lucide-react';
import * as dataService from '../services/data';

interface ParentCodesModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  classTitle: string;
  apiBaseUrl: string;
}

interface CodeDisplay {
  id: string;
  studentId: string;
  studentName: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export function ParentCodesModal({ isOpen, onClose, classId, classTitle, apiBaseUrl }: ParentCodesModalProps) {
  const [codes, setCodes] = useState<CodeDisplay[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCodes = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await dataService.getParentCodes(classId);
      setCodes(result.codes.map(c => ({
        id: c.id,
        studentId: c.student_id,
        studentName: c.student_name,
        code: c.code,
        isActive: c.is_active,
        createdAt: c.created_at,
        lastUsedAt: c.last_used_at,
      })));
    } catch (err: any) {
      setError(err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (isOpen && classId) {
      fetchCodes();
    }
  }, [isOpen, classId, fetchCodes]);

  const handleBatchGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      await dataService.batchGenerateParentCodes(classId);
      await fetchCodes();
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async (codeId: string) => {
    try {
      await dataService.deactivateParentCode(codeId);
      setCodes(prev => prev.filter(c => c.id !== codeId));
    } catch (err: any) {
      setError(err.message || '操作失败');
    }
  };

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = code;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleExportAll = () => {
    const activeCodes = codes.filter(c => c.isActive);
    if (activeCodes.length === 0) return;

    const lines = [
      `${classTitle} - 家长查看码`,
      `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '学生姓名\t查看码',
      ...activeCodes.map(c => `${c.studentName}\t${c.code}`),
      '',
      '使用方式：在微信小程序"助学积分"中输入查看码即可查看孩子的积分情况。',
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${classTitle}-家长查看码.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const activeCodes = codes.filter(c => c.isActive);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <QrCode className="w-5 h-5 text-indigo-500" />
              家长查看码
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              家长在微信小程序中输入查看码即可查看积分
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Actions */}
        <div className="px-5 py-3 border-b border-gray-50 flex gap-2">
          <button
            onClick={handleBatchGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 text-white text-sm font-medium rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {generating ? '生成中...' : '一键生成全班查看码'}
          </button>
          {activeCodes.length > 0 && (
            <button
              onClick={handleExportAll}
              className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              导出
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : activeCodes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <QrCode className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">还没有生成查看码</p>
              <p className="text-xs mt-1">点击上方按钮为全班学生生成</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeCodes.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-gray-800">{item.studentName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-bold text-indigo-600 tracking-wider">
                      {item.code}
                    </span>
                    <button
                      onClick={() => handleCopy(item.code)}
                      className="p-1.5 hover:bg-white rounded-lg transition-colors"
                      title="复制查看码"
                    >
                      {copiedCode === item.code ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeactivate(item.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                      title="停用"
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
        {activeCodes.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400">
            共 {activeCodes.length} 个查看码 · 家长在小程序输入查看码即可
          </div>
        )}
      </div>
    </div>
  );
}
