import React, { useEffect, useMemo, useState } from 'react';
import { X, FileImage, FileText, CalendarDays, Download, Loader2, CheckSquare, Square } from 'lucide-react';
import { Badge } from '../types';
import {
  ExportTemplateStyleId,
  ExportTemplateType,
  getDefaultTemplateStyleId,
  getTemplateStyleOptions,
  renderExportCanvas,
} from '../lib/certificateRenderer';
import {
  ExportFormat,
  buildBatchZipName,
  buildExportFileName,
  canvasToPdfBlob,
  canvasToPngBlob,
  downloadBlob,
  downloadZip,
  formatDateStamp,
  formatDisplayDate,
  sanitizeFileSegment,
} from '../lib/exportFile';
import { getPetById } from '../constants';
import { generateClientId } from '../lib/clientId';

export type ExportMode = 'single' | 'batch';

export interface ExportStudentTarget {
  id: string;
  name: string;
  badges: Badge[];
}

interface CertificateExportModalProps {
  isOpen: boolean;
  mode: ExportMode;
  classTitle: string;
  students: ExportStudentTarget[];
  defaultTemplateType: ExportTemplateType;
  onClose: () => void;
  onCompleted?: (message: string) => void;
}

type BatchBadgeScope = 'all' | 'recent';

const getTodayInputValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const getDefaultFormats = (templateType: ExportTemplateType): Set<ExportFormat> => {
  return templateType === 'certificate' ? new Set<ExportFormat>(['pdf']) : new Set<ExportFormat>(['png']);
};

const toFormatArray = (setValue: Set<ExportFormat>): ExportFormat[] => {
  return Array.from(setValue).sort((a, b) => {
    if (a === b) return 0;
    return a === 'pdf' ? -1 : 1;
  });
};

const buildSingleZipName = (templateType: ExportTemplateType, classTitle: string, studentName: string, dateStamp: string) => {
  const typeLabel = templateType === 'certificate' ? '证书' : '贴纸';
  return `导出-${sanitizeFileSegment(typeLabel)}-${sanitizeFileSegment(classTitle)}-${sanitizeFileSegment(studentName)}-${dateStamp}.zip`;
};

const buildSerialRandomSegment = (): string => {
  const normalized = generateClientId('certificate_serial')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  return normalized.slice(0, 6).padEnd(6, 'X');
};

const buildCertificateSerial = (dateStamp: string, sequence: number, basePart: string): string => {
  const seq = String(sequence + 1).padStart(4, '0');
  return `CERT-${dateStamp}-${basePart}${seq}-${buildSerialRandomSegment()}`;
};

export const CertificateExportModal: React.FC<CertificateExportModalProps> = ({
  isOpen,
  mode,
  classTitle,
  students,
  defaultTemplateType,
  onClose,
  onCompleted,
}) => {
  const [templateType, setTemplateType] = useState<ExportTemplateType>(defaultTemplateType);
  const [templateStyleId, setTemplateStyleId] = useState<ExportTemplateStyleId>(getDefaultTemplateStyleId(defaultTemplateType));
  const [selectedFormats, setSelectedFormats] = useState<Set<ExportFormat>>(getDefaultFormats(defaultTemplateType));
  const [exportDate, setExportDate] = useState<string>(getTodayInputValue());
  const [singleSelectedBadgeIds, setSingleSelectedBadgeIds] = useState<Set<string>>(new Set());
  const [batchBadgeScope, setBatchBadgeScope] = useState<BatchBadgeScope>('all');
  const [batchRecentCount, setBatchRecentCount] = useState(12);
  const [isExporting, setIsExporting] = useState(false);
  const [completedTasks, setCompletedTasks] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const currentStudent = mode === 'single' ? (students[0] || null) : null;
  const allSingleBadges = currentStudent?.badges || [];

  const selectedSingleBadges = useMemo(() => {
    if (allSingleBadges.length === 0) return [];
    return allSingleBadges.filter(badge => singleSelectedBadgeIds.has(badge.id));
  }, [allSingleBadges, singleSelectedBadgeIds]);

  const templateStyleOptions = useMemo(() => {
    return getTemplateStyleOptions(templateType);
  }, [templateType]);

  useEffect(() => {
    if (!isOpen) return;

    const nextDate = getTodayInputValue();
    setTemplateType(defaultTemplateType);
    setTemplateStyleId(getDefaultTemplateStyleId(defaultTemplateType));
    setSelectedFormats(getDefaultFormats(defaultTemplateType));
    setExportDate(nextDate);
    setBatchBadgeScope('all');
    setBatchRecentCount(12);
    setIsExporting(false);
    setCompletedTasks(0);
    setTotalTasks(0);
    setErrorMessage('');
    setSingleSelectedBadgeIds(new Set((students[0]?.badges || []).map(badge => badge.id)));
  }, [isOpen, defaultTemplateType, students]);

  if (!isOpen) return null;

  const formatList = toFormatArray(selectedFormats);

  const toggleFormat = (format: ExportFormat) => {
    if (isExporting) return;
    setSelectedFormats(prev => {
      const next = new Set(prev);
      if (next.has(format)) {
        next.delete(format);
      } else {
        next.add(format);
      }
      return next;
    });
  };

  const handleTemplateTypeChange = (nextType: ExportTemplateType) => {
    if (isExporting) return;
    setTemplateType(nextType);
    setTemplateStyleId(getDefaultTemplateStyleId(nextType));
    setSelectedFormats(getDefaultFormats(nextType));
  };

  const toggleSingleBadge = (badgeId: string) => {
    if (isExporting) return;
    setSingleSelectedBadgeIds(prev => {
      const next = new Set(prev);
      if (next.has(badgeId)) {
        next.delete(badgeId);
      } else {
        next.add(badgeId);
      }
      return next;
    });
  };

  const selectAllSingleBadges = () => {
    if (isExporting) return;
    setSingleSelectedBadgeIds(new Set(allSingleBadges.map(badge => badge.id)));
  };

  const clearAllSingleBadges = () => {
    if (isExporting) return;
    setSingleSelectedBadgeIds(new Set());
  };

  const resolveBatchBadges = (badges: Badge[]) => {
    if (batchBadgeScope === 'all') return badges;
    const count = Math.max(1, Math.floor(batchRecentCount || 1));
    return badges.slice(Math.max(0, badges.length - count));
  };

  const handleExport = async () => {
    if (formatList.length === 0) {
      setErrorMessage('请至少选择一种导出格式');
      return;
    }
    if (mode === 'single' && allSingleBadges.length > 0 && selectedSingleBadges.length === 0) {
      setErrorMessage('请至少选择一枚徽章');
      return;
    }
    if (students.length === 0) {
      setErrorMessage('没有可导出的学生数据');
      return;
    }

    setErrorMessage('');
    setIsExporting(true);
    setCompletedTasks(0);

    const displayDate = formatDisplayDate(exportDate);
    const dateStamp = formatDateStamp(exportDate);
    const serialBasePart = String(Date.now() % 1_000_000).padStart(6, '0');
    const certificateSerialByStudentId = new Map<string, string>();
    if (templateType === 'certificate') {
      students.forEach((student, index) => {
        certificateSerialByStudentId.set(
          student.id,
          buildCertificateSerial(dateStamp, index, serialBasePart)
        );
      });
    }
    const files: Array<{ fileName: string; blob: Blob }> = [];
    let doneCount = 0;

    try {
      if (mode === 'single') {
        const student = students[0];
        const exportBadges = allSingleBadges.length > 0 ? selectedSingleBadges : [];
        const failedFormats: ExportFormat[] = [];
        setTotalTasks(formatList.length);

        for (const format of formatList) {
          try {
            const canvas = await renderExportCanvas({
              templateType,
              templateStyleId,
              studentName: student.name,
              classTitle,
              badges: exportBadges,
              certificateSerial: certificateSerialByStudentId.get(student.id),
              dateText: displayDate,
            });
            const blob = format === 'png'
              ? await canvasToPngBlob(canvas)
              : await canvasToPdfBlob(canvas, templateType);
            files.push({
              fileName: buildExportFileName(templateType, classTitle, student.name, dateStamp, format),
              blob,
            });
          } catch (error) {
            console.error('[Export] Failed for format:', format, error);
            failedFormats.push(format);
          } finally {
            doneCount += 1;
            setCompletedTasks(doneCount);
          }
        }

        if (files.length === 0) {
          throw new Error('单人导出全部失败');
        }

        if (files.length === 1) {
          downloadBlob(files[0].blob, files[0].fileName);
        } else {
          await downloadZip(files, buildSingleZipName(templateType, classTitle, student.name, dateStamp));
        }

        if (failedFormats.length > 0) {
          const failedFormatLabel = failedFormats.map(format => format.toUpperCase()).join('、');
          onCompleted?.(`导出完成，部分格式导出失败（${failedFormatLabel}）`);
        } else {
          onCompleted?.('导出完成');
        }
        onClose();
        return;
      }

      const failedStudents = new Set<string>();
      setTotalTasks(students.length * formatList.length);

      for (const student of students) {
        const studentBadges = resolveBatchBadges(student.badges);

        for (const format of formatList) {
          try {
            const canvas = await renderExportCanvas({
              templateType,
              templateStyleId,
              studentName: student.name,
              classTitle,
              badges: studentBadges,
              certificateSerial: certificateSerialByStudentId.get(student.id),
              dateText: displayDate,
            });
            const blob = format === 'png'
              ? await canvasToPngBlob(canvas)
              : await canvasToPdfBlob(canvas, templateType);
            files.push({
              fileName: buildExportFileName(templateType, classTitle, student.name, dateStamp, format),
              blob,
            });
          } catch (error) {
            console.error('[Export] Failed for student:', student.name, error);
            failedStudents.add(student.name);
          } finally {
            doneCount += 1;
            setCompletedTasks(doneCount);
          }
        }
      }

      if (files.length === 0) {
        throw new Error('全部导出失败');
      }

      await downloadZip(files, buildBatchZipName(classTitle, dateStamp));
      if (failedStudents.size > 0) {
        const failedNames = Array.from(failedStudents);
        const previewLimit = 8;
        const previewNames = failedNames.slice(0, previewLimit).join('、');
        const extraHint = failedNames.length > previewLimit ? ` 等${failedNames.length}人` : '';
        onCompleted?.(`导出完成，部分学生导出失败：${previewNames}${extraHint}`);
      } else {
        onCompleted?.('批量导出完成');
      }
      onClose();
    } catch (error) {
      console.error('[Export] Failed:', error);
      setErrorMessage('导出失败，请重试');
    } finally {
      setIsExporting(false);
    }
  };

  const selectedCount = mode === 'single'
    ? (allSingleBadges.length > 0 ? selectedSingleBadges.length : 0)
    : students.length;

  const progressRatio = totalTasks > 0 ? Math.min(1, completedTasks / totalTasks) : 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[92vh] overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col modal-content">
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-sky-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">
              {mode === 'single' ? '导出证书/贴纸' : '批量导出证书/贴纸'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {mode === 'single'
                ? `${currentStudent?.name || '学生'} · ${classTitle}`
                : `${students.length} 位学生 · ${classTitle}`}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="touch-target p-2 rounded-full hover:bg-white/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="关闭导出弹窗"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMessage && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm font-medium">
              {errorMessage}
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700">导出类型</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                disabled={isExporting}
                onClick={() => handleTemplateTypeChange('certificate')}
                className={`p-4 rounded-2xl border text-left transition-colors ${
                  templateType === 'certificate'
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <FileText className="w-4 h-4" />
                  荣誉证书
                </div>
                <p className="text-xs text-slate-500 mt-1">A4 竖版，适合打印与装裱</p>
              </button>
              <button
                disabled={isExporting}
                onClick={() => handleTemplateTypeChange('sticker')}
                className={`p-4 rounded-2xl border text-left transition-colors ${
                  templateType === 'sticker'
                    ? 'border-indigo-300 bg-indigo-50'
                    : 'border-slate-200 hover:bg-slate-50'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center gap-2 font-bold text-slate-800">
                  <FileImage className="w-4 h-4" />
                  徽章贴纸图
                </div>
                <p className="text-xs text-slate-500 mt-1">圆形徽章（透明底），适合打印后裁切做冰箱贴</p>
              </button>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700">模板样式</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {templateStyleOptions.map((styleOption) => {
                const selected = templateStyleId === styleOption.id;
                return (
                  <button
                    key={styleOption.id}
                    disabled={isExporting}
                    onClick={() => setTemplateStyleId(styleOption.id)}
                    className={`p-4 rounded-2xl border text-left transition-colors ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 hover:bg-slate-50'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div className="text-sm font-bold text-slate-800">
                      {styleOption.name}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{styleOption.description}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700">导出格式（可多选）</h3>
            <div className="flex flex-wrap gap-3">
              {(['png', 'pdf'] as ExportFormat[]).map((format) => {
                const selected = selectedFormats.has(format);
                return (
                  <button
                    key={format}
                    disabled={isExporting}
                    onClick={() => toggleFormat(format)}
                    className={`px-4 py-2 rounded-full border text-sm font-bold transition-colors ${
                      selected
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    {format.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700">授予日期</h3>
            <div className="relative max-w-xs">
              <CalendarDays className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={exportDate}
                disabled={isExporting}
                onChange={(event) => setExportDate(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 disabled:bg-slate-100"
              />
            </div>
          </section>

          {mode === 'single' && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700">
                  徽章选择（已选 {selectedCount}/{allSingleBadges.length}）
                </h3>
                {allSingleBadges.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllSingleBadges}
                      disabled={isExporting}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    >
                      全选
                    </button>
                    <button
                      onClick={clearAllSingleBadges}
                      disabled={isExporting}
                      className="text-xs font-bold text-slate-500 hover:text-rose-600 disabled:opacity-50"
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>

              {allSingleBadges.length === 0 ? (
                <div className="px-4 py-5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  该学生暂无徽章，将导出“暂无徽章”占位版证书/贴纸。
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                  {allSingleBadges.map((badge) => {
                    const checked = singleSelectedBadgeIds.has(badge.id);
                    const petName = (badge.petName || '').trim() || getPetById(badge.petId)?.name || '徽章';
                    return (
                      <button
                        key={badge.id}
                        disabled={isExporting}
                        onClick={() => toggleSingleBadge(badge.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors disabled:opacity-60"
                      >
                        <div className="text-left">
                          <div className="text-sm font-medium text-slate-700">{petName}</div>
                          <div className="text-xs text-slate-400">
                            获得于 {new Date(badge.earnedAt).toLocaleDateString('zh-CN')}
                          </div>
                        </div>
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {mode === 'batch' && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">批量徽章范围</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="batchBadgeScope"
                    checked={batchBadgeScope === 'all'}
                    disabled={isExporting}
                    onChange={() => setBatchBadgeScope('all')}
                  />
                  每位学生导出全部徽章
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="batchBadgeScope"
                    checked={batchBadgeScope === 'recent'}
                    disabled={isExporting}
                    onChange={() => setBatchBadgeScope('recent')}
                  />
                  每位学生仅导出最近
                  <input
                    type="number"
                    value={batchRecentCount}
                    min={1}
                    max={99}
                    disabled={isExporting || batchBadgeScope !== 'recent'}
                    onChange={(event) => setBatchRecentCount(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
                    className="w-16 px-2 py-1 rounded-md border border-slate-200 text-center disabled:bg-slate-100"
                  />
                  枚
                </label>
              </div>
              <div className="text-xs text-slate-500">
                当前将导出 {students.length} 位学生数据，最终打包为 ZIP。
              </div>
            </section>
          )}

          {isExporting && (
            <section className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>导出进度</span>
                <span>{completedTasks}/{totalTasks}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 transition-all duration-200"
                  style={{ width: `${Math.round(progressRatio * 100)}%` }}
                />
              </div>
            </section>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {mode === 'single' ? '单人导出支持双格式同步输出' : '批量导出统一输出 ZIP 文件'}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting || students.length === 0}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold disabled:bg-slate-300 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  导出中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  立即导出
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificateExportModal;
