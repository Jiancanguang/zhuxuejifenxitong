import { ExportTemplateType } from './certificateRenderer';

export type ExportFormat = 'png' | 'pdf';

export interface ExportFileEntry {
  fileName: string;
  blob: Blob;
}

const INVALID_FILE_CHARS = /[\\/:*?"<>|]/g;
const SPACE_NORMALIZER = /\s+/g;

export const sanitizeFileSegment = (value: string): string => {
  const normalized = value
    .replace(INVALID_FILE_CHARS, '-')
    .replace(SPACE_NORMALIZER, ' ')
    .trim();
  return normalized || '未命名';
};

export const formatDateStamp = (dateValue: string): string => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
};

export const formatDisplayDate = (dateValue: string): string => {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleDateString('zh-CN');
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const splitFileName = (fileName: string): { baseName: string; extension: string } => {
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return { baseName: fileName, extension: '' };
  }
  return {
    baseName: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  };
};

const ensureUniqueFileName = (fileName: string, usedNames: Set<string>): string => {
  const safeName = sanitizeFileSegment(fileName);
  if (!usedNames.has(safeName)) {
    usedNames.add(safeName);
    return safeName;
  }

  const { baseName, extension } = splitFileName(safeName);
  let suffix = 2;
  let candidate = `${baseName}(${suffix})${extension}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName}(${suffix})${extension}`;
  }

  usedNames.add(candidate);
  return candidate;
};

const triggerDownload = (blob: Blob, fileName: string) => {
  const safeFileName = sanitizeFileSegment(fileName);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = safeFileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  triggerDownload(blob, fileName);
};

export const downloadZip = async (files: ExportFileEntry[], zipName: string) => {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const usedNames = new Set<string>();
  files.forEach((file) => {
    const uniqueName = ensureUniqueFileName(file.fileName, usedNames);
    zip.file(uniqueName, file.blob);
  });
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  triggerDownload(zipBlob, zipName);
};

export const canvasToPngBlob = async (canvas: HTMLCanvasElement): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG 导出失败'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

export const canvasToPdfBlob = async (
  canvas: HTMLCanvasElement,
  templateType: ExportTemplateType
): Promise<Blob> => {
  const { jsPDF } = await import('jspdf');
  const orientation = templateType === 'certificate' ? 'portrait' : 'landscape';
  const pdf = new jsPDF({
    orientation,
    unit: 'px',
    format: [canvas.width, canvas.height],
    compress: true,
  });

  pdf.addImage(canvas, 'PNG', 0, 0, canvas.width, canvas.height);
  return pdf.output('blob');
};

export const buildExportFileName = (
  templateType: ExportTemplateType,
  classTitle: string,
  studentName: string,
  dateStamp: string,
  format: ExportFormat
): string => {
  const typeLabel = templateType === 'certificate' ? '证书' : '贴纸';
  const safeClassTitle = sanitizeFileSegment(classTitle);
  const safeStudentName = sanitizeFileSegment(studentName);
  return `${typeLabel}-${safeClassTitle}-${safeStudentName}-${dateStamp}.${format}`;
};

export const buildBatchZipName = (classTitle: string, dateStamp: string): string => {
  const safeClassTitle = sanitizeFileSegment(classTitle);
  return `批量导出-${safeClassTitle}-${dateStamp}.zip`;
};
