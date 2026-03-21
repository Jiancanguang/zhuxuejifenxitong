import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { config } from './config.mjs';
import { db } from './db.mjs';

const nowIso = () => new Date().toISOString();

const TABLES = [
  'schema_migrations',
  'users',
  'licenses',
  'sessions',
  'classes',
  'groups',
  'students',
  'badges',
  'history_records',
];

const MAX_BACKUP_FILES = 30; // 最多保留 30 个备份
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 每 24 小时自动备份一次

const insertBackupRecordStmt = db.prepare(`
  INSERT INTO backup_records (id, filename, file_size, trigger_type, status, error_message, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const selectBackupRecordsStmt = db.prepare(`
  SELECT * FROM backup_records
  ORDER BY created_at DESC
  LIMIT ?
  OFFSET ?
`);

const countBackupRecordsStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM backup_records
`);

const deleteBackupRecordStmt = db.prepare(`
  DELETE FROM backup_records WHERE id = ?
`);

const selectBackupByIdStmt = db.prepare(`
  SELECT * FROM backup_records WHERE id = ?
`);

/**
 * Execute a backup now.
 * @param {'manual'|'scheduled'} triggerType
 * @returns {{ id: string, filename: string, fileSize: number }}
 */
export const runBackup = async (triggerType = 'manual') => {
  fs.mkdirSync(config.backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `app-${stamp}.json`;
  const targetFile = path.join(config.backupDir, filename);
  const recordId = `backup_${randomUUID().replace(/-/g, '')}`;
  const timestamp = nowIso();

  try {
    const snapshot = {
      exportedAt: timestamp,
      database: 'postgres',
      tables: {},
    };

    for (const table of TABLES) {
      const result = await db.query(`SELECT * FROM ${table} ORDER BY 1 ASC`);
      snapshot.tables[table] = result.rows;
    }

    const content = JSON.stringify(snapshot, null, 2);
    fs.writeFileSync(targetFile, content);

    const stat = fs.statSync(targetFile);
    const fileSize = stat.size;

    await insertBackupRecordStmt.run(
      recordId, filename, fileSize, triggerType, 'completed', null, timestamp
    );

    console.log(`[backup] ${triggerType === 'scheduled' ? '定时' : '手动'}备份完成: ${filename} (${formatBytes(fileSize)})`);

    // 清理旧备份
    await cleanOldBackups();

    return { id: recordId, filename, fileSize };
  } catch (err) {
    await insertBackupRecordStmt.run(
      recordId, filename, 0, triggerType, 'failed', err.message, timestamp
    );
    console.error(`[backup] 备份失败:`, err.message);
    throw err;
  }
};

/**
 * 清理超过保留数量的旧备份文件
 */
const cleanOldBackups = async () => {
  try {
    if (!fs.existsSync(config.backupDir)) return;

    const files = fs.readdirSync(config.backupDir)
      .filter((f) => f.startsWith('app-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length <= MAX_BACKUP_FILES) return;

    const toRemove = files.slice(MAX_BACKUP_FILES);
    for (const file of toRemove) {
      try {
        fs.unlinkSync(path.join(config.backupDir, file));
        console.log(`[backup] 已删除旧备份: ${file}`);
      } catch {
        // ignore single file deletion errors
      }
    }
  } catch (err) {
    console.error(`[backup] 清理旧备份失败:`, err.message);
  }
};

/**
 * Query backup records with pagination.
 */
export const queryBackupRecords = async ({ page = 1, perPage = 20 } = {}) => {
  const limit = Math.max(1, Math.min(100, perPage));
  const offset = (Math.max(1, page) - 1) * limit;
  const rows = await selectBackupRecordsStmt.all(limit, offset);
  const totalRow = await countBackupRecordsStmt.get();

  return {
    items: rows.map(mapBackupRecord),
    totalItems: totalRow?.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow?.total || 0) / limit)),
  };
};

/**
 * Delete a backup record (and its file).
 */
export const deleteBackup = async (backupId) => {
  const record = await selectBackupByIdStmt.get(backupId);
  if (!record) return false;

  // Try to delete the physical file
  try {
    const filePath = path.join(config.backupDir, record.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // ignore
  }

  await deleteBackupRecordStmt.run(backupId);
  return true;
};

const mapBackupRecord = (row) => ({
  id: row.id,
  filename: row.filename,
  fileSize: row.file_size,
  fileSizeFormatted: formatBytes(row.file_size),
  triggerType: row.trigger_type,
  status: row.status,
  errorMessage: row.error_message || undefined,
  createdAt: row.created_at,
});

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
};

// === 定时备份调度 ===

let schedulerTimer = null;

export const startBackupScheduler = () => {
  if (schedulerTimer) return;

  console.log(`[backup] 自动备份已启用，间隔: ${BACKUP_INTERVAL_MS / 3600000} 小时，保留最近 ${MAX_BACKUP_FILES} 份`);

  // 启动后延迟 5 分钟执行首次检查，避免和服务启动冲突
  const initialDelay = 5 * 60 * 1000;
  setTimeout(async () => {
    await runScheduledBackupIfDue();
    schedulerTimer = setInterval(runScheduledBackupIfDue, 60 * 60 * 1000); // 每小时检查一次
    schedulerTimer.unref();
  }, initialDelay).unref();
};

const runScheduledBackupIfDue = async () => {
  try {
    const latestBackup = (await selectBackupRecordsStmt.all(1, 0))[0];
    if (latestBackup) {
      const lastBackupTime = new Date(latestBackup.created_at).getTime();
      if (Date.now() - lastBackupTime < BACKUP_INTERVAL_MS) {
        return; // 还没到备份时间
      }
    }

    await runBackup('scheduled');
  } catch (err) {
    console.error('[backup] 定时备份执行失败:', err.message);
  }
};
