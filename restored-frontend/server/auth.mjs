import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from './db.mjs';
import { config } from './config.mjs';
import { DEFAULT_SYSTEM_TITLE } from './constants.mjs';
import { HttpError } from './http.mjs';

const nowIso = () => new Date().toISOString();

const findUserByIdStmt = db.prepare('SELECT * FROM users WHERE id = ?');
const findUserByUsernameStmt = db.prepare('SELECT * FROM users WHERE username = ?');
const findSessionStmt = db.prepare(`
  SELECT * FROM sessions
  WHERE id = ? AND user_id = ? AND role = ? AND revoked_at IS NULL
`);
const insertSessionStmt = db.prepare(`
  INSERT INTO sessions (id, user_id, role, revoked_at, created_at, last_seen_at)
  VALUES (?, ?, ?, NULL, ?, ?)
`);
const revokeAllSessionsStmt = db.prepare(`
  UPDATE sessions
  SET revoked_at = ?
  WHERE user_id = ? AND role = ? AND revoked_at IS NULL
`);
const revokeSessionStmt = db.prepare(`
  UPDATE sessions
  SET revoked_at = ?
  WHERE id = ? AND revoked_at IS NULL
`);
const touchSessionStmt = db.prepare(`
  UPDATE sessions
  SET last_seen_at = ?
  WHERE id = ?
`);
const insertUserStmt = db.prepare(`
  INSERT INTO users (
    id, username, password_hash, role, is_disabled, is_activated,
    license_code, activated_at, system_title, current_class_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

export const hashPassword = (password) => bcrypt.hashSync(password, 10);
export const verifyPassword = (password, hash) => bcrypt.compareSync(password, hash);

export const sanitizeUser = (userRow) => ({
  id: userRow.id,
  username: userRow.username,
  isActivated: Boolean(userRow.is_activated),
  currentClassId: userRow.current_class_id || null,
  systemTitle: userRow.system_title || DEFAULT_SYSTEM_TITLE,
  created: userRow.created_at,
});

const signToken = (userRow, role, sessionId) => {
  const ttl = role === 'admin' ? config.adminTokenTtl : config.userTokenTtl;
  return jwt.sign(
    { userId: userRow.id, sessionId, role },
    config.jwtSecret,
    { expiresIn: ttl }
  );
};

export const issueSessionToken = async (userRow, role = userRow.role) => {
  const sessionId = randomUUID();
  const timestamp = nowIso();

  // 支持多设备同时登录：不再撤销旧 session，直接追加新 session
  await insertSessionStmt.run(sessionId, userRow.id, role, timestamp, timestamp);

  // 异步清理过期 session（超过 90 天未活跃的），防止表膨胀
  cleanupStaleSessions(userRow.id, role).catch(() => {});

  return signToken(userRow, role, sessionId);
};

const STALE_SESSION_DAYS = 90;

const cleanupStaleSessions = async (userId, role) => {
  const cutoff = new Date(Date.now() - STALE_SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.query(
    `DELETE FROM sessions WHERE user_id = $1 AND role = $2 AND revoked_at IS NULL AND last_seen_at < $3`,
    [userId, role, cutoff]
  );
};

export const revokeAllSessionsForUser = async (userId, role = 'user') => {
  await revokeAllSessionsStmt.run(nowIso(), userId, role);
};

export const revokeSessionById = async (sessionId) => {
  await revokeSessionStmt.run(nowIso(), sessionId);
};

const readBearerToken = (req) => {
  const header = req.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    return null;
  }
  return header.slice(7).trim();
};

const resolveToken = async (token, expectedRole) => {
  if (!token) {
    throw new HttpError(401, '请先登录');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, '无效的登录凭证');
  }

  if (expectedRole && payload.role !== expectedRole) {
    if (expectedRole === 'admin') {
      throw new HttpError(403, '没有权限执行此操作');
    }
    throw new HttpError(401, '无效的登录凭证');
  }

  const userRow = await findUserByIdStmt.get(payload.userId);
  if (!userRow) {
    throw new HttpError(401, '无效的登录凭证');
  }

  if (expectedRole === 'user' && userRow.role !== 'user') {
    throw new HttpError(401, '无效的登录凭证');
  }

  if (expectedRole === 'admin' && userRow.role !== 'admin') {
    throw new HttpError(403, '没有权限执行此操作');
  }

  if (expectedRole === 'user' && userRow.is_disabled) {
    throw new HttpError(401, '账号已被禁用');
  }

  const sessionRow = await findSessionStmt.get(payload.sessionId, userRow.id, payload.role);
  if (!sessionRow) {
    const message = expectedRole === 'admin'
      ? '管理员登录已失效，请重新登录'
      : '登录已失效，请重新登录';
    throw new HttpError(401, message);
  }

  await touchSessionStmt.run(nowIso(), sessionRow.id);

  return {
    userRow,
    sessionId: sessionRow.id,
    role: payload.role,
    user: sanitizeUser(userRow),
  };
};

export const getAuthContextFromToken = async (token, expectedRole = 'user') => {
  return resolveToken(token, expectedRole);
};

export const requireUser = async (req, res, next) => {
  try {
    req.auth = await resolveToken(readBearerToken(req), 'user');
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    req.auth = await resolveToken(readBearerToken(req), 'admin');
    next();
  } catch (error) {
    next(error);
  }
};

export const bootstrapAdminAccount = async () => {
  const existing = await findUserByUsernameStmt.get(config.adminUsername);

  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error(`用户名 ${config.adminUsername} 已被普通用户占用，无法创建管理员账号`);
    }
    return false;
  }

  const timestamp = nowIso();
  await insertUserStmt.run(
    randomUUID(),
    config.adminUsername,
    hashPassword(config.adminPassword),
    'admin',
    false,
    true,
    null,
    timestamp,
    DEFAULT_SYSTEM_TITLE,
    null,
    timestamp,
    timestamp
  );

  return true;
};
