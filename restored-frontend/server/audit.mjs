import { randomUUID } from 'node:crypto';
import { db } from './db.mjs';

const nowIso = () => new Date().toISOString();

const insertAuditLogStmt = db.prepare(`
  INSERT INTO audit_logs (id, actor_id, actor_username, actor_role, action, resource_type, resource_id, summary, meta, ip_address, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectAuditLogsStmt = db.prepare(`
  SELECT * FROM audit_logs
  ORDER BY created_at DESC
  LIMIT ?
  OFFSET ?
`);

const countAuditLogsStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM audit_logs
`);

const selectAuditLogsFilteredStmt = db.prepare(`
  SELECT * FROM audit_logs
  WHERE action = ?
  ORDER BY created_at DESC
  LIMIT ?
  OFFSET ?
`);

const countAuditLogsFilteredStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM audit_logs
  WHERE action = ?
`);

const selectAuditLogsSearchStmt = db.prepare(`
  SELECT * FROM audit_logs
  WHERE (summary ILIKE ? OR actor_username ILIKE ?)
  ORDER BY created_at DESC
  LIMIT ?
  OFFSET ?
`);

const countAuditLogsSearchStmt = db.prepare(`
  SELECT COUNT(*) AS total FROM audit_logs
  WHERE (summary ILIKE ? OR actor_username ILIKE ?)
`);

/**
 * Write an audit log entry.
 */
export const writeAuditLog = async ({
  actorId,
  actorUsername,
  actorRole,
  action,
  resourceType,
  resourceId = null,
  summary,
  meta = null,
  ipAddress = null,
}) => {
  const id = `audit_${randomUUID().replace(/-/g, '')}`;
  await insertAuditLogStmt.run(
    id,
    actorId,
    actorUsername,
    actorRole,
    action,
    resourceType,
    resourceId,
    summary,
    meta ? JSON.stringify(meta) : null,
    ipAddress,
    nowIso()
  );
  return id;
};

/**
 * Query audit logs with pagination and optional filtering.
 */
export const queryAuditLogs = async ({ page = 1, perPage = 20, action = null, search = null } = {}) => {
  const limit = Math.max(1, Math.min(100, perPage));
  const offset = (Math.max(1, page) - 1) * limit;
  let rows;
  let totalRow;

  if (search) {
    const pattern = `%${search}%`;
    rows = await selectAuditLogsSearchStmt.all(pattern, pattern, limit, offset);
    totalRow = await countAuditLogsSearchStmt.get(pattern, pattern);
  } else if (action) {
    rows = await selectAuditLogsFilteredStmt.all(action, limit, offset);
    totalRow = await countAuditLogsFilteredStmt.get(action);
  } else {
    rows = await selectAuditLogsStmt.all(limit, offset);
    totalRow = await countAuditLogsStmt.get();
  }

  return {
    items: rows.map(mapAuditLog),
    totalItems: totalRow?.total || 0,
    totalPages: Math.max(1, Math.ceil((totalRow?.total || 0) / limit)),
  };
};

const mapAuditLog = (row) => ({
  id: row.id,
  actorId: row.actor_id,
  actorUsername: row.actor_username,
  actorRole: row.actor_role,
  action: row.action,
  resourceType: row.resource_type,
  resourceId: row.resource_id || undefined,
  summary: row.summary,
  meta: row.meta ? safeParseJson(row.meta) : undefined,
  ipAddress: row.ip_address || undefined,
  createdAt: row.created_at,
});

const safeParseJson = (str) => {
  try { return JSON.parse(str); } catch { return null; }
};

/**
 * Extract client IP from request.
 */
export const getClientIp = (req) => {
  return req.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.get('x-real-ip')
    || req.socket?.remoteAddress
    || null;
};
