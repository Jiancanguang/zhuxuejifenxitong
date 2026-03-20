import fs from 'node:fs';
import path from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import { config } from './config.mjs';
import { db } from './db.mjs';
import {
  DEFAULT_REWARDS,
  DEFAULT_RESET_PASSWORD,
  DEFAULT_SCORE_ITEMS,
  DEFAULT_STAGE_THRESHOLDS,
  DEFAULT_SYSTEM_TITLE,
  DEFAULT_THEME_ID,
  GROUP_COLOR_TOKENS,
  LICENSE_CHARS,
} from './constants.mjs';
import {
  bootstrapAdminAccount,
  getAuthContextFromToken,
  hashPassword,
  issueSessionToken,
  requireAdmin,
  requireUser,
  revokeAllSessionsForUser,
  revokeSessionById,
  sanitizeUser,
  verifyPassword,
} from './auth.mjs';
import {
  errorHandler,
  HttpError,
  notFoundApiHandler,
  sendSuccess,
} from './http.mjs';
import { broadcastSyncEvent, registerSyncClient } from './sse.mjs';

const resolveCorsOrigin = (origin, callback) => {
  if (!origin || config.corsOrigins.length === 0 || config.corsOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new HttpError(403, '当前来源未被允许访问 API'));
};

const app = express();
app.use(cors({
  origin: resolveCorsOrigin,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

const nowIso = () => new Date().toISOString();
const nowTs = () => Date.now();
const createId = (prefix) => `${prefix}_${randomUUID().replace(/-/g, '')}`;

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeThresholds = (value) => {
  if (!Array.isArray(value) || value.length < 10) {
    return [...DEFAULT_STAGE_THRESHOLDS];
  }
  const normalized = [];
  value.slice(0, 10).forEach((item, index) => {
    const numeric = Number(item);
    if (!Number.isFinite(numeric)) {
      normalized.push(index === 0 ? 0 : Math.max(normalized[index - 1] + 1, DEFAULT_STAGE_THRESHOLDS[index]));
      return;
    }
    if (index === 0) {
      normalized.push(Math.max(0, Math.floor(numeric)));
      return;
    }
    normalized.push(Math.max(normalized[index - 1] + 1, Math.floor(numeric)));
  });
  return normalized;
};

const calculateStageFromFood = (foodCount, thresholds) => {
  const food = Math.max(0, Math.floor(foodCount || 0));
  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    if (food >= thresholds[index]) {
      return index + 1;
    }
  }
  return 1;
};

const normalizeInventory = (inventory, rewards) => {
  const next = {};
  const source = inventory && typeof inventory === 'object' ? inventory : {};
  for (const reward of rewards) {
    const rawValue = source[reward.id];
    const numeric = Number(rawValue);
    next[reward.id] = Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 10;
  }
  return next;
};

const createDefaultInventory = (rewards = DEFAULT_REWARDS) => {
  return normalizeInventory({}, rewards);
};

const createLicenseCode = () => {
  const segment = () => Array.from({ length: 4 }, () => {
    const index = randomInt(0, LICENSE_CHARS.length);
    return LICENSE_CHARS[index];
  }).join('');

  return `${segment()}-${segment()}-${segment()}`;
};

const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve()
    .then(() => handler(req, res))
    .catch(next);
};

const classLocks = new Set();
const withClassLock = async (classId, task, conflictMessage = '班级正在重置，请稍后重试') => {
  if (classLocks.has(classId)) {
    throw new HttpError(409, conflictMessage);
  }

  classLocks.add(classId);
  try {
    return await task();
  } finally {
    classLocks.delete(classId);
  }
};

const emitSync = (auth, classId, scope, reason) => {
  if (!auth?.userRow?.id) return;
  broadcastSyncEvent({
    userId: auth.userRow.id,
    classId,
    scope,
    reason,
    sourceSessionId: auth.sessionId,
  });
};

const selectUserByUsernameRoleStmt = db.prepare(`
  SELECT * FROM users
  WHERE username = ? AND role = ?
`);
const selectUserByIdStmt = db.prepare(`
  SELECT * FROM users
  WHERE id = ?
`);
const insertUserStmt = db.prepare(`
  INSERT INTO users (
    id, username, password_hash, role, is_disabled, is_activated,
    license_code, activated_at, system_title, current_class_id, created_at, updated_at
  ) VALUES (?, ?, ?, 'user', FALSE, TRUE, NULL, ?, ?, NULL, ?, ?)
`);
const updateUserPasswordStmt = db.prepare(`
  UPDATE users
  SET password_hash = ?, updated_at = ?
  WHERE id = ?
`);
const updateUserSettingsStmt = db.prepare(`
  UPDATE users
  SET system_title = ?, current_class_id = ?, updated_at = ?
  WHERE id = ?
`);
const updateUserDisabledStmt = db.prepare(`
  UPDATE users
  SET is_disabled = ?, updated_at = ?
  WHERE id = ?
`);
const updateUserLicenseBindingStmt = db.prepare(`
  UPDATE users
  SET license_code = ?, activated_at = ?, is_activated = ?, updated_at = ?
  WHERE id = ?
`);
const deleteUserStmt = db.prepare(`
  DELETE FROM users
  WHERE id = ?
`);

const selectClassesByUserStmt = db.prepare(`
  SELECT * FROM classes
  WHERE user_id = ?
  ORDER BY created_at ASC, id ASC
`);
const selectClassByIdStmt = db.prepare(`
  SELECT * FROM classes
  WHERE id = ?
`);
const selectClassByIdAndUserStmt = db.prepare(`
  SELECT * FROM classes
  WHERE id = ? AND user_id = ?
`);
const insertClassStmt = db.prepare(`
  INSERT INTO classes (
    id, user_id, title, target_count, stage_thresholds,
    student_sort_mode, theme_id, rewards, score_items, inventory, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const updateClassStmt = db.prepare(`
  UPDATE classes
  SET title = ?, target_count = ?, stage_thresholds = ?, student_sort_mode = ?,
      theme_id = ?, rewards = ?, score_items = ?, inventory = ?, updated_at = ?
  WHERE id = ?
`);
const deleteClassStmt = db.prepare(`
  DELETE FROM classes
  WHERE id = ?
`);
const touchClassStmt = db.prepare(`
  UPDATE classes
  SET updated_at = ?
  WHERE id = ?
`);

const selectGroupsByClassStmt = db.prepare(`
  SELECT * FROM groups
  WHERE class_id = ?
  ORDER BY sort_order ASC, created_at ASC, id ASC
`);
const selectGroupByIdOwnedStmt = db.prepare(`
  SELECT g.*, c.user_id
  FROM groups g
  JOIN classes c ON c.id = g.class_id
  WHERE g.id = ?
`);
const insertGroupStmt = db.prepare(`
  INSERT INTO groups (id, class_id, name, sort_order, color_token, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const updateGroupStmt = db.prepare(`
  UPDATE groups
  SET name = ?, updated_at = ?
  WHERE id = ?
`);
const updateGroupOrderStmt = db.prepare(`
  UPDATE groups
  SET sort_order = ?, updated_at = ?
  WHERE id = ?
`);
const deleteGroupStmt = db.prepare(`
  DELETE FROM groups
  WHERE id = ?
`);
const maxGroupOrderStmt = db.prepare(`
  SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
  FROM groups
  WHERE class_id = ?
`);

const selectStudentsByClassStmt = db.prepare(`
  SELECT * FROM students
  WHERE class_id = ?
  ORDER BY
    CASE WHEN sort_order IS NULL OR sort_order = 0 THEN 1 ELSE 0 END ASC,
    sort_order ASC,
    created_at ASC,
    id ASC
`);
const selectStudentContextOwnedStmt = db.prepare(`
  SELECT s.*, c.user_id, c.id AS owner_class_id
  FROM students s
  JOIN classes c ON c.id = s.class_id
  WHERE s.id = ?
`);
const insertStudentStmt = db.prepare(`
  INSERT INTO students (
    id, class_id, name, sort_order, group_id, pet_id, pet_stage,
    food_count, pet_nickname, spent_food, created_at, updated_at
  ) VALUES (?, ?, ?, ?, NULL, NULL, 1, 0, NULL, 0, ?, ?)
`);
const updateStudentCoreStmt = db.prepare(`
  UPDATE students
  SET name = ?, sort_order = ?, group_id = ?, pet_id = ?, pet_stage = ?,
      food_count = ?, pet_nickname = ?, spent_food = ?, updated_at = ?
  WHERE id = ?
`);
const updateStudentNameHistoryStmt = db.prepare(`
  UPDATE history_records
  SET student_name = ?
  WHERE student_id = ?
`);
const deleteStudentStmt = db.prepare(`
  DELETE FROM students
  WHERE id = ?
`);
const maxStudentOrderStmt = db.prepare(`
  SELECT COALESCE(MAX(sort_order), 0) AS maxOrder
  FROM students
  WHERE class_id = ?
`);
const clearStudentGroupStmt = db.prepare(`
  UPDATE students
  SET group_id = NULL, updated_at = ?
  WHERE group_id = ?
`);
const batchAssignGroupStmt = db.prepare(`
  UPDATE students
  SET group_id = ?, updated_at = ?
  WHERE id = ?
`);
const resetStudentsProgressStmt = db.prepare(`
  UPDATE students
  SET pet_id = NULL, pet_stage = 1, food_count = 0, pet_nickname = NULL, spent_food = 0, updated_at = ?
  WHERE class_id = ?
`);

const selectBadgesByClassStmt = db.prepare(`
  SELECT * FROM badges
  WHERE class_id = ?
  ORDER BY earned_at ASC, created_at ASC, id ASC
`);
const selectBadgesByStudentStmt = db.prepare(`
  SELECT * FROM badges
  WHERE student_id = ?
  ORDER BY earned_at ASC, created_at ASC, id ASC
`);
const insertBadgeStmt = db.prepare(`
  INSERT INTO badges (id, class_id, student_id, pet_id, pet_name, earned_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const deleteStudentBadgesStmt = db.prepare(`
  DELETE FROM badges
  WHERE student_id = ?
`);
const deleteBadgeByIdStmt = db.prepare(`
  DELETE FROM badges
  WHERE id = ?
`);
const deleteClassBadgesStmt = db.prepare(`
  DELETE FROM badges
  WHERE class_id = ?
`);

const selectHistoryByClassStmt = db.prepare(`
  SELECT * FROM history_records
  WHERE class_id = ?
  ORDER BY timestamp ASC, created_at ASC, id ASC
`);
const selectHistoryContextByIdStmt = db.prepare(`
  SELECT h.*, c.user_id
  FROM history_records h
  JOIN classes c ON c.id = h.class_id
  WHERE h.id = ?
`);
const selectHistoryByClassBatchStmt = db.prepare(`
  SELECT h.*
  FROM history_records h
  JOIN classes c ON c.id = h.class_id
  WHERE h.class_id = ? AND h.batch_id = ? AND c.user_id = ?
  ORDER BY h.timestamp ASC, h.id ASC
`);
const selectRevokeRecordByTargetStmt = db.prepare(`
  SELECT id
  FROM history_records
  WHERE revoked_record_id = ?
  LIMIT 1
`);
const insertHistoryStmt = db.prepare(`
  INSERT INTO history_records (
    id, class_id, student_id, student_name, type,
    score_item_name, score_value, reward_id, reward_name, cost, batch_id, pet_id,
    revoked_record_id, revoked_score_item_name, revoked_score_value,
    rename_from, rename_to, badge_id, meta, timestamp, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const deleteHistoryByIdStmt = db.prepare(`
  DELETE FROM history_records
  WHERE id = ?
`);
const deleteHistoryNonRedeemByClassStmt = db.prepare(`
  DELETE FROM history_records
  WHERE class_id = ? AND type != 'redeem'
`);
const deleteHistoryAllByClassStmt = db.prepare(`
  DELETE FROM history_records
  WHERE class_id = ?
`);
const countRedeemCostByStudentStmt = db.prepare(`
  SELECT COALESCE(SUM(cost), 0) AS totalCost
  FROM history_records
  WHERE class_id = ? AND student_id = ? AND type = 'redeem'
`);
const countBadgesByStudentStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM badges
  WHERE class_id = ? AND student_id = ?
`);
const countHistoryByClassStmt = db.prepare(`
  SELECT COUNT(*) AS total
  FROM history_records
  WHERE class_id = ?
`);

const selectLicensesWithUsersStmt = db.prepare(`
  SELECT l.*, u.username AS used_by_username
  FROM licenses l
  LEFT JOIN users u ON u.id = l.used_by
  ORDER BY l.created_at DESC, l.id DESC
`);
const selectLicenseByIdStmt = db.prepare(`
  SELECT l.*, u.username AS used_by_username
  FROM licenses l
  LEFT JOIN users u ON u.id = l.used_by
  WHERE l.id = ?
`);
const selectLicenseByCodeStmt = db.prepare(`
  SELECT * FROM licenses
  WHERE code = ?
`);
const insertLicenseStmt = db.prepare(`
  INSERT INTO licenses (id, code, is_used, is_revoked, used_by, used_at, note, created_at)
  VALUES (?, ?, FALSE, FALSE, NULL, NULL, ?, ?)
`);
const updateLicenseUsageStmt = db.prepare(`
  UPDATE licenses
  SET is_used = ?, is_revoked = ?, used_by = ?, used_at = ?
  WHERE id = ?
`);
const deleteLicenseStmt = db.prepare(`
  DELETE FROM licenses
  WHERE id = ?
`);
const clearActiveLicensesByUserStmt = db.prepare(`
  UPDATE licenses
  SET is_used = FALSE, used_by = NULL, used_at = NULL
  WHERE used_by = ? AND is_revoked = FALSE
`);
const clearRevokedLicensesByUserStmt = db.prepare(`
  UPDATE licenses
  SET used_by = NULL
  WHERE used_by = ? AND is_revoked = TRUE
`);

const mapGroup = (row) => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
  colorToken: row.color_token || null,
});

const mapBadge = (row) => ({
  id: row.id,
  studentId: row.student_id,
  petId: row.pet_id,
  petName: row.pet_name || null,
  earnedAt: row.earned_at,
});

const mapStudent = (row, badges = []) => ({
  id: row.id,
  name: row.name,
  groupId: row.group_id || null,
  petNickname: row.pet_nickname || null,
  petId: row.pet_id || undefined,
  petStage: row.pet_stage,
  foodCount: row.food_count,
  spentFood: row.spent_food || 0,
  sortOrder: row.sort_order,
  badges,
});

const mapHistory = (row) => ({
  id: row.id,
  studentId: row.student_id,
  studentName: row.student_name,
  type: row.type,
  scoreItemName: row.score_item_name || undefined,
  scoreValue: row.score_value ?? undefined,
  rewardId: row.reward_id || undefined,
  rewardName: row.reward_name || undefined,
  cost: row.cost ?? undefined,
  batchId: row.batch_id || undefined,
  petId: row.pet_id || undefined,
  revokedRecordId: row.revoked_record_id || undefined,
  revokedScoreItemName: row.revoked_score_item_name || undefined,
  revokedScoreValue: row.revoked_score_value ?? undefined,
  renameFrom: row.rename_from || undefined,
  renameTo: row.rename_to || undefined,
  badgeId: row.badge_id || undefined,
  meta: row.meta ? parseJson(row.meta, null) : undefined,
  timestamp: row.timestamp,
});

const mapAdminUser = (row) => ({
  id: row.id,
  username: row.username,
  isDisabled: Boolean(row.is_disabled),
  created: row.created_at,
  classCount: row.class_count ?? 0,
  studentCount: row.student_count ?? 0,
});

const mapAdminLicense = (row) => ({
  id: row.id,
  code: row.code,
  isUsed: Boolean(row.is_used),
  isRevoked: Boolean(row.is_revoked),
  usedBy: row.used_by || undefined,
  usedByUsername: row.used_by_username || undefined,
  usedAt: row.used_at || undefined,
  note: row.note || undefined,
  created: row.created_at,
});

const buildClassState = async (classRow) => {
  const parsedRewards = parseJson(classRow.rewards, DEFAULT_REWARDS);
  const rewards = Array.isArray(parsedRewards) ? parsedRewards : DEFAULT_REWARDS;
  const parsedScoreItems = parseJson(classRow.score_items, DEFAULT_SCORE_ITEMS);
  const scoreItems = Array.isArray(parsedScoreItems) ? parsedScoreItems : DEFAULT_SCORE_ITEMS;
  const stageThresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const inventory = normalizeInventory(parseJson(classRow.inventory, {}), rewards);

  const groups = (await selectGroupsByClassStmt.all(classRow.id)).map(mapGroup);
  const badgeRows = (await selectBadgesByClassStmt.all(classRow.id)).map(mapBadge);
  const badgesByStudentId = new Map();
  for (const badge of badgeRows) {
    const list = badgesByStudentId.get(badge.studentId) || [];
    list.push(badge);
    badgesByStudentId.set(badge.studentId, list);
  }

  const students = (await selectStudentsByClassStmt.all(classRow.id)).map((row) => {
    const badges = badgesByStudentId.get(row.id) || [];
    return mapStudent(row, badges);
  });

  const progress = {};
  const petSelections = {};
  const petStages = {};
  const badges = {};
  for (const student of students) {
    progress[student.id] = student.foodCount ?? 0;
    petStages[student.id] = student.petStage ?? 1;
    badges[student.id] = student.badges || [];
    if (student.petId) {
      petSelections[student.id] = student.petId;
    }
  }

  const history = (await selectHistoryByClassStmt.all(classRow.id)).map(mapHistory);

  return {
    id: classRow.id,
    title: classRow.title,
    students,
    groups,
    progress,
    petSelections,
    petStages,
    badges,
    history,
    redemptions: history.filter((record) => record.type === 'redeem'),
    inventory,
    rewards,
    scoreItems,
    targetCount: classRow.target_count || stageThresholds[9],
    stageThresholds,
    studentSortMode: classRow.student_sort_mode || 'manual',
    themeId: classRow.theme_id || DEFAULT_THEME_ID,
  };
};

const buildClassStateMapForUser = async (userId) => {
  const rows = await selectClassesByUserStmt.all(userId);
  const result = {};
  for (const row of rows) {
    result[row.id] = await buildClassState(row);
  }
  return result;
};

const getOwnedClassRow = async (userId, classId) => {
  const classRow = await selectClassByIdAndUserStmt.get(classId, userId);
  if (!classRow) {
    throw new HttpError(404, '班级不存在');
  }
  return classRow;
};

const getOwnedStudentContext = async (userId, studentId) => {
  const row = await selectStudentContextOwnedStmt.get(studentId);
  if (!row || row.user_id !== userId) {
    throw new HttpError(404, '学生不存在');
  }
  return row;
};

const getOwnedGroupContext = async (userId, groupId) => {
  const row = await selectGroupByIdOwnedStmt.get(groupId);
  if (!row || row.user_id !== userId) {
    throw new HttpError(404, '分组不存在');
  }
  return row;
};

const getOwnedHistoryContext = async (userId, recordId) => {
  const row = await selectHistoryContextByIdStmt.get(recordId);
  if (!row || row.user_id !== userId) {
    throw new HttpError(404, '记录不存在');
  }
  return row;
};

const getLicenseOrThrow = async (code) => {
  const license = await selectLicenseByCodeStmt.get(code);
  if (!license) {
    throw new HttpError(400, '激活码不存在或已失效');
  }
  return license;
};

const ensureHistoryLimit = async (classId, incomingCount = 1) => {
  const countRow = await countHistoryByClassStmt.get(classId);
  if ((countRow?.total || 0) + incomingCount > 10000) {
    throw new HttpError(409, '成长记录已达上限，请先清理旧记录');
  }
};

const insertHistoryRecordTx = async (payload) => {
  const record = {
    id: payload.id || createId('history'),
    classId: payload.classId,
    studentId: payload.studentId,
    studentName: payload.studentName,
    type: payload.type,
    scoreItemName: payload.scoreItemName ?? null,
    scoreValue: payload.scoreValue ?? null,
    rewardId: payload.rewardId ?? null,
    rewardName: payload.rewardName ?? null,
    cost: payload.cost ?? null,
    batchId: payload.batchId ?? null,
    petId: payload.petId ?? null,
    revokedRecordId: payload.revokedRecordId ?? null,
    revokedScoreItemName: payload.revokedScoreItemName ?? null,
    revokedScoreValue: payload.revokedScoreValue ?? null,
    renameFrom: payload.renameFrom ?? null,
    renameTo: payload.renameTo ?? null,
    badgeId: payload.badgeId ?? null,
    meta: payload.meta ? JSON.stringify(payload.meta) : null,
    timestamp: payload.timestamp ?? nowTs(),
    createdAt: payload.createdAt ?? nowIso(),
  };

  await insertHistoryStmt.run(
    record.id,
    record.classId,
    record.studentId,
    record.studentName,
    record.type,
    record.scoreItemName,
    record.scoreValue,
    record.rewardId,
    record.rewardName,
    record.cost,
    record.batchId,
    record.petId,
    record.revokedRecordId,
    record.revokedScoreItemName,
    record.revokedScoreValue,
    record.renameFrom,
    record.renameTo,
    record.badgeId,
    record.meta,
    record.timestamp,
    record.createdAt
  );

  return mapHistory({
    id: record.id,
    student_id: record.studentId,
    student_name: record.studentName,
    type: record.type,
    score_item_name: record.scoreItemName,
    score_value: record.scoreValue,
    reward_id: record.rewardId,
    reward_name: record.rewardName,
    cost: record.cost,
    batch_id: record.batchId,
    pet_id: record.petId,
    revoked_record_id: record.revokedRecordId,
    revoked_score_item_name: record.revokedScoreItemName,
    revoked_score_value: record.revokedScoreValue,
    rename_from: record.renameFrom,
    rename_to: record.renameTo,
    badge_id: record.badgeId,
    meta: record.meta,
    timestamp: record.timestamp,
  });
};

const replaceStudentBadgesTx = async (classId, studentId, badgeList = []) => {
  await deleteStudentBadgesStmt.run(studentId);
  const timestamp = nowIso();
  for (const badge of badgeList) {
    await insertBadgeStmt.run(
      badge.id || createId('badge'),
      classId,
      studentId,
      badge.petId,
      badge.petName || null,
      Number.isFinite(Number(badge.earnedAt)) ? Number(badge.earnedAt) : nowTs(),
      timestamp
    );
  }
};

const buildDeleteHistoryByIdsStatement = (ids) => {
  const placeholders = ids.map(() => '?').join(', ');
  return db.prepare(`
    DELETE FROM history_records
    WHERE id IN (${placeholders})
  `);
};

const buildSelectHistoryByIdsOwnedStatement = (ids) => {
  const placeholders = ids.map(() => '?').join(', ');
  return db.prepare(`
    SELECT h.id, h.class_id
    FROM history_records h
    JOIN classes c ON c.id = h.class_id
    WHERE c.user_id = ? AND h.id IN (${placeholders})
  `);
};

const updateStudentRowTx = async (studentRow, classRow, patch) => {
  const thresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const nextName = patch.name !== undefined ? String(patch.name).trim() : studentRow.name;
  const nextSortOrder = patch.sortOrder !== undefined ? Math.max(0, Number.parseInt(patch.sortOrder, 10) || 0) : studentRow.sort_order;
  const nextGroupId = patch.groupId !== undefined
    ? (patch.groupId || null)
    : (studentRow.group_id || null);
  const nextPetId = patch.petId !== undefined
    ? (patch.petId ? String(patch.petId) : null)
    : (studentRow.pet_id || null);

  let nextFoodCount = patch.foodCount !== undefined
    ? Math.max(0, Number.parseInt(patch.foodCount, 10) || 0)
    : studentRow.food_count;

  let nextPetStage = patch.petStage !== undefined
    ? Math.max(1, Number.parseInt(patch.petStage, 10) || 1)
    : studentRow.pet_stage;

  if (patch.foodCount !== undefined && patch.petStage === undefined) {
    nextPetStage = calculateStageFromFood(nextFoodCount, thresholds);
  }

  if (patch.petId !== undefined && !nextPetId) {
    nextPetStage = 1;
    if (patch.foodCount === undefined) {
      nextFoodCount = 0;
    }
  }

  const nextPetNickname = patch.petNickname !== undefined
    ? (patch.petNickname ? String(patch.petNickname).trim() : null)
    : (studentRow.pet_nickname || null);

  const nextSpentFood = patch.spentFood !== undefined
    ? Math.max(0, Number.parseInt(patch.spentFood, 10) || 0)
    : (studentRow.spent_food || 0);

  const updatedAt = nowIso();
  await updateStudentCoreStmt.run(
    nextName,
    nextSortOrder,
    nextGroupId,
    nextPetId,
    nextPetStage,
    nextFoodCount,
    nextPetNickname,
    nextSpentFood,
    updatedAt,
    studentRow.id
  );

  if (patch.name !== undefined && nextName !== studentRow.name) {
    await updateStudentNameHistoryStmt.run(nextName, studentRow.id);
  }

  if (Array.isArray(patch.badges)) {
    await replaceStudentBadgesTx(classRow.id, studentRow.id, patch.badges);
  }

  await touchClassStmt.run(updatedAt, classRow.id);
};

const assignRandomGroupsTx = async (classRow, groupCount) => {
  const classId = classRow.id;
  const timestamp = nowIso();
  const existingGroups = await selectGroupsByClassStmt.all(classId);
  for (const group of existingGroups) {
    await clearStudentGroupStmt.run(timestamp, group.id);
    await deleteGroupStmt.run(group.id);
  }

  const groups = [];
  for (let index = 0; index < groupCount; index += 1) {
    const groupId = createId('group');
    const name = `第${index + 1}组`;
    const colorToken = GROUP_COLOR_TOKENS[index % GROUP_COLOR_TOKENS.length];
    await insertGroupStmt.run(groupId, classId, name, index + 1, colorToken, timestamp, timestamp);
    groups.push({
      id: groupId,
      name,
      sortOrder: index + 1,
      colorToken,
    });
  }

  const students = await selectStudentsByClassStmt.all(classId);
  const shuffled = [...students].sort(() => Math.random() - 0.5);
  const assignments = [];
  for (const [index, student] of shuffled.entries()) {
    const group = groups[index % groups.length];
    await batchAssignGroupStmt.run(group.id, timestamp, student.id);
    assignments.push({ studentId: student.id, groupId: group.id });
  }

  await touchClassStmt.run(timestamp, classId);
  return { groups, assignments };
};

const getAvailableFoodBalance = async (studentId) => {
  const studentRow = await selectStudentContextOwnedStmt.get(studentId);
  if (!studentRow) return 0;
  return Math.max(0, (studentRow.food_count || 0) - (studentRow.spent_food || 0));
};

const selectStudentBadges = async (studentId) => {
  return (await selectBadgesByStudentStmt.all(studentId)).map(mapBadge);
};

const revokeSingleHistoryTx = async (historyRow, classRow) => {
  if (await selectRevokeRecordByTargetStmt.get(historyRow.id)) {
    return { alreadyRevoked: true };
  }

  const studentRow = await selectStudentContextOwnedStmt.get(historyRow.student_id);
  if (!studentRow) {
    throw new HttpError(404, '学生不存在');
  }

  const thresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const timestamp = nowIso();
  let nextFoodCount = studentRow.food_count;
  let nextPetStage = studentRow.pet_stage;
  let nextPetId = studentRow.pet_id || null;
  let nextPetNickname = studentRow.pet_nickname || null;
  let nextSpentFood = studentRow.spent_food || 0;
  let nextBadges = await selectStudentBadges(studentRow.id);

  if (historyRow.type === 'checkin') {
    nextFoodCount = Math.max(0, studentRow.food_count - (historyRow.score_value || 0));
    nextPetStage = calculateStageFromFood(nextFoodCount, thresholds);
  } else if (historyRow.type === 'graduate') {
    const meta = parseJson(historyRow.meta, {});
    // 毕业撤回：恢复宠物状态，但不恢复 food_count（因为 food_count 不再在毕业时重置）
    nextPetId = meta.previousPetId || null;
    nextPetNickname = meta.previousPetNickname || null;
    nextPetStage = Math.max(1, Number(meta.previousPetStage) || calculateStageFromFood(nextFoodCount, thresholds));
    if (historyRow.badge_id) {
      await deleteBadgeByIdStmt.run(historyRow.badge_id);
    }
    nextBadges = await selectStudentBadges(studentRow.id);
  } else if (historyRow.type === 'redeem') {
    // 兑换撤回：退还肉量
    nextSpentFood = Math.max(0, nextSpentFood - (historyRow.cost || 0));
  } else {
    throw new HttpError(400, '该记录不支持撤回');
  }

  await updateStudentCoreStmt.run(
    studentRow.name,
    studentRow.sort_order,
    studentRow.group_id || null,
    nextPetId,
    nextPetStage,
    nextFoodCount,
    nextPetNickname,
    nextSpentFood,
    timestamp,
    studentRow.id
  );

  const revokeRecord = await insertHistoryRecordTx({
    classId: historyRow.class_id,
    studentId: historyRow.student_id,
    studentName: historyRow.student_name,
    type: 'revoke',
    revokedRecordId: historyRow.id,
    revokedScoreItemName: historyRow.type === 'graduate'
      ? '毕业收获'
      : historyRow.type === 'redeem'
        ? (historyRow.reward_name || '兑换')
        : (historyRow.score_item_name || '操作'),
    revokedScoreValue: historyRow.type === 'redeem'
      ? (historyRow.cost ?? 0)
      : (historyRow.score_value ?? 0),
    petId: nextPetId,
    timestamp: nowTs(),
  });

  await touchClassStmt.run(timestamp, classRow.id);

  return {
    alreadyRevoked: false,
    revokeRecord,
    student: {
      id: studentRow.id,
      foodCount: nextFoodCount,
      spentFood: nextSpentFood,
      petStage: nextPetStage,
      petId: nextPetId,
      badges: nextBadges,
    },
  };
};

const revokeBatchHistoryTx = async (classRow, historyRows) => {
  const thresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const timestamp = nowIso();
  const revokeRecords = [];
  const touchedStudents = new Map();
  let skippedCount = 0;

  for (const historyRow of historyRows) {
    if (historyRow.type !== 'checkin') {
      skippedCount += 1;
      continue;
    }

    if (await selectRevokeRecordByTargetStmt.get(historyRow.id)) {
      skippedCount += 1;
      continue;
    }

    const studentRow = await selectStudentContextOwnedStmt.get(historyRow.student_id);
    if (!studentRow) {
      skippedCount += 1;
      continue;
    }

    const existing = touchedStudents.get(studentRow.id) || {
      id: studentRow.id,
      foodCount: studentRow.food_count,
      petStage: studentRow.pet_stage,
      petId: studentRow.pet_id || null,
      groupId: studentRow.group_id || null,
      name: studentRow.name,
      sortOrder: studentRow.sort_order,
      petNickname: studentRow.pet_nickname || null,
      spentFood: studentRow.spent_food || 0,
    };

    existing.foodCount = Math.max(0, existing.foodCount - (historyRow.score_value || 0));
    existing.petStage = calculateStageFromFood(existing.foodCount, thresholds);
    touchedStudents.set(studentRow.id, existing);

    revokeRecords.push(await insertHistoryRecordTx({
      classId: historyRow.class_id,
      studentId: historyRow.student_id,
      studentName: historyRow.student_name,
      type: 'revoke',
      revokedRecordId: historyRow.id,
      revokedScoreItemName: historyRow.score_item_name || '操作',
      revokedScoreValue: historyRow.score_value ?? 0,
      petId: existing.petId,
      timestamp: nowTs(),
    }));
  }

  for (const student of touchedStudents.values()) {
    await updateStudentCoreStmt.run(
      student.name,
      student.sortOrder,
      student.groupId,
      student.petId,
      student.petStage,
      student.foodCount,
      student.petNickname,
      student.spentFood,
      timestamp,
      student.id
    );
  }

  await touchClassStmt.run(timestamp, classRow.id);

  return {
    revokeRecords,
    students: [...touchedStudents.values()].map((student) => ({
      id: student.id,
      foodCount: student.foodCount,
      petStage: student.petStage,
      petId: student.petId,
    })),
    skippedCount,
  };
};

const ensureAdminBootstrap = async () => {
  try {
    const created = await bootstrapAdminAccount();
    if (created) {
      console.log(`[server] Created admin account: ${config.adminUsername}`);
    }
  } catch (err) {
    console.error('[server] 管理员账号初始化失败:', err.message);
    console.error('[server] 服务将继续运行，但管理员功能可能不可用');
  }
};

await ensureAdminBootstrap();

app.get('/api/health', (req, res) => {
  sendSuccess(res, {
    ok: true,
    mode: config.nodeEnv,
    database: db.name,
  });
});

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    throw new HttpError(400, '请输入用户名和密码');
  }

  if (
    await selectUserByUsernameRoleStmt.get(username, 'user')
    || await selectUserByUsernameRoleStmt.get(username, 'admin')
  ) {
    throw new HttpError(409, '用户名已存在');
  }

  const userId = randomUUID();
  const timestamp = nowIso();

  await insertUserStmt.run(
    userId,
    username,
    hashPassword(password),
    timestamp,
    DEFAULT_SYSTEM_TITLE,
    timestamp,
    timestamp
  );

  const userRow = await selectUserByIdStmt.get(userId);
  const token = await issueSessionToken(userRow, 'user');
  sendSuccess(res, { user: sanitizeUser(userRow), token }, 201);
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    throw new HttpError(400, '请输入用户名和密码');
  }

  const userRow = await selectUserByUsernameRoleStmt.get(username, 'user');
  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    throw new HttpError(401, '用户名或密码错误');
  }

  if (userRow.is_disabled) {
    throw new HttpError(401, '账号已被禁用');
  }

  const token = await issueSessionToken(userRow, 'user');
  sendSuccess(res, { user: sanitizeUser(userRow), token });
}));

app.post('/api/auth/logout', asyncRoute(async (req, res) => {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    try {
      const auth = await getAuthContextFromToken(token, 'user');
      await revokeSessionById(auth.sessionId);
    } catch {
      // ignore invalid token on logout
    }
  }
  sendSuccess(res, {});
}));

app.get('/api/auth/me', requireUser, asyncRoute(async (req, res) => {
  const userRow = await selectUserByIdStmt.get(req.auth.userRow.id);
  sendSuccess(res, { user: sanitizeUser(userRow) });
}));

app.get('/api/auth/check', requireUser, asyncRoute(async (req, res) => {
  sendSuccess(res, { status: 'valid' });
}));

app.put('/api/auth/settings', requireUser, asyncRoute(async (req, res) => {
  const currentUser = await selectUserByIdStmt.get(req.auth.userRow.id);
  const nextSystemTitle = req.body?.systemTitle !== undefined
    ? String(req.body.systemTitle || '').trim() || DEFAULT_SYSTEM_TITLE
    : currentUser.system_title;

  let nextCurrentClassId = currentUser.current_class_id || null;
  if (req.body?.currentClassId !== undefined) {
    const requestedClassId = String(req.body.currentClassId || '').trim();
    if (!requestedClassId) {
      nextCurrentClassId = null;
    } else {
      await getOwnedClassRow(req.auth.userRow.id, requestedClassId);
      nextCurrentClassId = requestedClassId;
    }
  }

  await updateUserSettingsStmt.run(
    nextSystemTitle,
    nextCurrentClassId,
    nowIso(),
    currentUser.id
  );

  sendSuccess(res, {});
}));

app.post('/api/auth/change-password', requireUser, asyncRoute(async (req, res) => {
  const oldPassword = String(req.body?.oldPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  const userRow = await selectUserByIdStmt.get(req.auth.userRow.id);

  if (!newPassword) {
    throw new HttpError(400, '请输入新密码');
  }
  if (!verifyPassword(oldPassword, userRow.password_hash)) {
    throw new HttpError(400, '原密码错误');
  }

  await updateUserPasswordStmt.run(hashPassword(newPassword), nowIso(), userRow.id);
  await revokeAllSessionsForUser(userRow.id, 'user');
  sendSuccess(res, {});
}));

app.post('/api/auth/reset-password', asyncRoute(async (req, res) => {
  throw new HttpError(403, '当前系统已改为内部账号体系，请联系管理员重置密码');
}));

app.post('/api/auth/verify-password', requireUser, asyncRoute(async (req, res) => {
  const password = String(req.body?.password || '');
  const userRow = await selectUserByIdStmt.get(req.auth.userRow.id);

  if (!verifyPassword(password, userRow.password_hash)) {
    throw new HttpError(401, '登录密码错误');
  }

  sendSuccess(res, {});
}));

app.post('/api/auth/activate', requireUser, asyncRoute(async (req, res) => {
  const userRow = await selectUserByIdStmt.get(req.auth.userRow.id);
  sendSuccess(res, { user: sanitizeUser(userRow) });
}));

app.post('/api/admin/login', asyncRoute(async (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const adminRow = await selectUserByUsernameRoleStmt.get(username, 'admin');

  if (!adminRow || !verifyPassword(password, adminRow.password_hash)) {
    throw new HttpError(401, '账号或密码错误');
  }

  const token = await issueSessionToken(adminRow, 'admin');
  sendSuccess(res, { token });
}));

app.get('/api/admin/stats', requireAdmin, asyncRoute(async (req, res) => {
  const users = await db.prepare(`
    SELECT * FROM users
    WHERE role = 'user'
  `).all();
  const today = new Date().toISOString().slice(0, 10);
  const totalClasses = (await db.prepare(`
    SELECT COUNT(*) AS total
    FROM classes
  `).get())?.total || 0;
  const totalStudents = (await db.prepare(`
    SELECT COUNT(*) AS total
    FROM students
  `).get())?.total || 0;
  const activeUsers = users.filter((user) => !user.is_disabled).length;

  sendSuccess(res, {
    totalUsers: users.length,
    activeUsers,
    disabledUsers: users.filter((user) => user.is_disabled).length,
    todayNewUsers: users.filter((user) => user.created_at.startsWith(today)).length,
    totalClasses,
    totalStudents,
    activatedUsers: users.length,
    notActivatedUsers: 0,
    totalLicenses: 0,
    usedLicenses: 0,
    unusedLicenses: 0,
  });
}));

app.get('/api/admin/users', requireAdmin, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const perPage = Math.max(1, Math.min(100, Number.parseInt(req.query.perPage || '10', 10) || 10));
  const filter = String(req.query.filter || 'all');
  const search = String(req.query.search || '').trim().toLowerCase();

  let items = (await db.prepare(`
    SELECT
      u.*,
      (SELECT COUNT(*) FROM classes c WHERE c.user_id = u.id) AS class_count,
      (
        SELECT COUNT(*)
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE c.user_id = u.id
      ) AS student_count
    FROM users u
    WHERE u.role = 'user'
    ORDER BY u.created_at DESC, u.id DESC
  `).all()).map(mapAdminUser);

  if (filter === 'active' || filter === 'activated') {
    items = items.filter((item) => !item.isDisabled);
  } else if (filter === 'not_activated') {
    items = items.filter(() => false);
  } else if (filter === 'disabled') {
    items = items.filter((item) => item.isDisabled);
  }

  if (search) {
    items = items.filter((item) => (
      item.username.toLowerCase().includes(search)
      || item.id.toLowerCase().includes(search)
    ));
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const offset = (page - 1) * perPage;

  sendSuccess(res, {
    items: items.slice(offset, offset + perPage),
    totalItems,
    totalPages,
  });
}));

app.get('/api/admin/users/:userId', requireAdmin, asyncRoute(async (req, res) => {
  const row = await db.prepare(`
    SELECT
      u.*,
      (SELECT COUNT(*) FROM classes c WHERE c.user_id = u.id) AS class_count,
      (
        SELECT COUNT(*)
        FROM students s
        JOIN classes c ON c.id = s.class_id
        WHERE c.user_id = u.id
      ) AS student_count
    FROM users u
    WHERE u.id = ? AND u.role = 'user'
  `).get(req.params.userId);

  if (!row) {
    throw new HttpError(404, '用户不存在');
  }

  sendSuccess(res, mapAdminUser(row));
}));

app.put('/api/admin/users/:userId/toggle-disable', requireAdmin, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  const userRow = await selectUserByIdStmt.get(userId);
  if (!userRow || userRow.role !== 'user') {
    throw new HttpError(404, '用户不存在');
  }

  const disabled = Boolean(req.body?.disabled);
  await updateUserDisabledStmt.run(disabled, nowIso(), userId);
  if (disabled) {
    await revokeAllSessionsForUser(userId, 'user');
  }

  sendSuccess(res, {});
}));

app.put('/api/admin/users/:userId/reset-password', requireAdmin, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  const userRow = await selectUserByIdStmt.get(userId);
  if (!userRow || userRow.role !== 'user') {
    throw new HttpError(404, '用户不存在');
  }

  await updateUserPasswordStmt.run(hashPassword(DEFAULT_RESET_PASSWORD), nowIso(), userId);
  await revokeAllSessionsForUser(userId, 'user');
  sendSuccess(res, {});
}));

app.put('/api/admin/users/:userId/unbind-license', requireAdmin, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  const userRow = await selectUserByIdStmt.get(userId);
  if (!userRow || userRow.role !== 'user') {
    throw new HttpError(404, '用户不存在');
  }

  await db.transaction(async () => {
    if (userRow.license_code) {
      const licenseRow = await selectLicenseByCodeStmt.get(userRow.license_code);
      if (licenseRow) {
        await updateLicenseUsageStmt.run(false, licenseRow.is_revoked, null, null, licenseRow.id);
      }
    }
    await updateUserLicenseBindingStmt.run(null, null, true, nowIso(), userId);
  })();

  sendSuccess(res, {});
}));

app.delete('/api/admin/users/:userId', requireAdmin, asyncRoute(async (req, res) => {
  const userId = req.params.userId;
  const userRow = await selectUserByIdStmt.get(userId);
  if (!userRow || userRow.role !== 'user') {
    throw new HttpError(404, '用户不存在');
  }

  await db.transaction(async () => {
    await clearActiveLicensesByUserStmt.run(userId);
    await clearRevokedLicensesByUserStmt.run(userId);
    await deleteUserStmt.run(userId);
  })();
  sendSuccess(res, {});
}));

app.get('/api/admin/licenses', requireAdmin, asyncRoute(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
  const perPage = Math.max(1, Math.min(100, Number.parseInt(req.query.perPage || '10', 10) || 10));
  const filter = String(req.query.filter || 'all');
  const search = String(req.query.search || '').trim().toLowerCase();

  let items = (await selectLicensesWithUsersStmt.all()).map(mapAdminLicense);

  if (filter === 'used') {
    items = items.filter((item) => item.isUsed && !item.isRevoked);
  } else if (filter === 'unused') {
    items = items.filter((item) => !item.isUsed && !item.isRevoked);
  } else if (filter === 'revoked') {
    items = items.filter((item) => item.isRevoked);
  }

  if (search) {
    items = items.filter((item) => (
      item.code.toLowerCase().includes(search)
      || (item.usedByUsername || '').toLowerCase().includes(search)
      || (item.note || '').toLowerCase().includes(search)
    ));
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
  const offset = (page - 1) * perPage;

  sendSuccess(res, {
    items: items.slice(offset, offset + perPage),
    totalItems,
    totalPages,
  });
}));

app.post('/api/admin/licenses/generate', requireAdmin, asyncRoute(async (req, res) => {
  const count = Math.max(1, Math.min(1000, Number.parseInt(req.body?.count || '1', 10) || 1));
  const note = req.body?.note ? String(req.body.note) : null;
  const codes = [];
  const timestamp = nowIso();

  await db.transaction(async () => {
    while (codes.length < count) {
      const code = createLicenseCode();
      if (await selectLicenseByCodeStmt.get(code)) {
        continue;
      }
      await insertLicenseStmt.run(createId('license'), code, note, timestamp);
      codes.push(code);
    }
  })();

  sendSuccess(res, { codes }, 201);
}));

app.delete('/api/admin/licenses/:licenseId', requireAdmin, asyncRoute(async (req, res) => {
  const licenseRow = await selectLicenseByIdStmt.get(req.params.licenseId);
  if (!licenseRow) {
    throw new HttpError(404, '卡密不存在');
  }

  if (licenseRow.is_used) {
    await updateLicenseUsageStmt.run(licenseRow.is_used, true, licenseRow.used_by, licenseRow.used_at, licenseRow.id);
  } else {
    await deleteLicenseStmt.run(licenseRow.id);
  }

  sendSuccess(res, {});
}));

app.get('/api/admin/licenses/export', requireAdmin, asyncRoute(async (req, res) => {
  const codes = (await selectLicensesWithUsersStmt
    .all())
    .filter((row) => !row.is_used && !row.is_revoked)
    .map((row) => row.code);

  sendSuccess(res, codes);
}));

app.get('/api/sync/stream', asyncRoute(async (req, res) => {
  const token = String(req.query.token || '');
  const auth = await getAuthContextFromToken(token, 'user');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const unregister = registerSyncClient(auth.userRow.id, res);
  req.on('close', unregister);
  req.on('end', unregister);
}));

app.get('/api/classes', requireUser, asyncRoute(async (req, res) => {
  sendSuccess(res, await buildClassStateMapForUser(req.auth.userRow.id));
}));

app.post('/api/classes', requireUser, asyncRoute(async (req, res) => {
  const title = String(req.body?.title || '').trim() || '默认班级';
  const timestamp = nowIso();
  const rewards = [...DEFAULT_REWARDS];
  const scoreItems = [...DEFAULT_SCORE_ITEMS];
  const stageThresholds = [...DEFAULT_STAGE_THRESHOLDS];
  const classId = createId('class');

  await insertClassStmt.run(
    classId,
    req.auth.userRow.id,
    title,
    stageThresholds[9],
    JSON.stringify(stageThresholds),
    'manual',
    DEFAULT_THEME_ID,
    JSON.stringify(rewards),
    JSON.stringify(scoreItems),
    JSON.stringify(createDefaultInventory(rewards)),
    timestamp,
    timestamp
  );

  const classRow = await selectClassByIdStmt.get(classId);
  emitSync(req.auth, classId, 'class', 'class-created');
  sendSuccess(res, await buildClassState(classRow), 201);
}));

app.put('/api/classes/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const nextRewards = Array.isArray(req.body?.rewards)
    ? req.body.rewards
    : parseJson(classRow.rewards, DEFAULT_REWARDS);
  const nextScoreItems = Array.isArray(req.body?.scoreItems)
    ? req.body.scoreItems
    : parseJson(classRow.score_items, DEFAULT_SCORE_ITEMS);
  const nextStageThresholds = req.body?.stageThresholds !== undefined
    ? normalizeThresholds(req.body.stageThresholds)
    : normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const nextInventory = req.body?.inventory !== undefined
    ? normalizeInventory(req.body.inventory, nextRewards)
    : normalizeInventory(parseJson(classRow.inventory, {}), nextRewards);
  const nextTargetCount = req.body?.targetCount !== undefined
    ? Math.max(1, Number.parseInt(req.body.targetCount, 10) || nextStageThresholds[9])
    : nextStageThresholds[9];
  const nextTitle = req.body?.title !== undefined
    ? (String(req.body.title || '').trim() || classRow.title)
    : classRow.title;
  const nextSortMode = req.body?.studentSortMode !== undefined
    ? String(req.body.studentSortMode || 'manual')
    : classRow.student_sort_mode;
  const nextThemeId = req.body?.themeId !== undefined
    ? (String(req.body.themeId || '').trim() || DEFAULT_THEME_ID)
    : classRow.theme_id;

  await updateClassStmt.run(
    nextTitle,
    nextTargetCount,
    JSON.stringify(nextStageThresholds),
    nextSortMode,
    nextThemeId,
    JSON.stringify(nextRewards),
    JSON.stringify(nextScoreItems),
    JSON.stringify(nextInventory),
    nowIso(),
    classRow.id
  );

  emitSync(req.auth, classRow.id, 'class', 'class-updated');
  sendSuccess(res, {});
}));

app.delete('/api/classes/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  await deleteClassStmt.run(classRow.id);

  const currentUser = await selectUserByIdStmt.get(req.auth.userRow.id);
  const remainingClasses = await selectClassesByUserStmt.all(req.auth.userRow.id);
  let nextCurrentClassId = currentUser.current_class_id || null;
  if (nextCurrentClassId === classRow.id) {
    nextCurrentClassId = remainingClasses[0]?.id || null;
  }
  await updateUserSettingsStmt.run(
    currentUser.system_title || DEFAULT_SYSTEM_TITLE,
    nextCurrentClassId,
    nowIso(),
    req.auth.userRow.id
  );

  emitSync(req.auth, classRow.id, 'class', 'class-deleted');
  sendSuccess(res, {});
}));

app.post('/api/classes/:classId/reset-progress', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const password = String(req.body?.password || '');
  if (!verifyPassword(password, req.auth.userRow.password_hash)) {
    throw new HttpError(401, '登录密码错误');
  }

  await withClassLock(classRow.id, async () => {
    await db.transaction(async () => {
      const timestamp = nowIso();
      await resetStudentsProgressStmt.run(timestamp, classRow.id);
      await deleteClassBadgesStmt.run(classRow.id);
      await deleteHistoryAllByClassStmt.run(classRow.id);
      await touchClassStmt.run(timestamp, classRow.id);
    })();
  }, '班级正在重置，请稍后重试');

  emitSync(req.auth, classRow.id, 'class', 'class-reset');
  sendSuccess(res, {});
}));

app.post('/api/classes/:classId/reuse-config', requireUser, asyncRoute(async (req, res) => {
  const targetClass = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const sourceClassId = String(req.body?.sourceClassId || '').trim();
  const password = String(req.body?.password || '');
  const applyFields = Array.isArray(req.body?.applyFields)
    ? req.body.applyFields.filter((item) => ['scoreItems', 'storeItems', 'levelConfig'].includes(item))
    : [];

  if (!sourceClassId || sourceClassId === targetClass.id) {
    throw new HttpError(400, '来源班级不能是当前班级');
  }
  if (applyFields.length === 0) {
    throw new HttpError(400, '请至少选择一项复用内容');
  }
  if (!verifyPassword(password, req.auth.userRow.password_hash)) {
    throw new HttpError(401, '密码错误，请重试');
  }

  const sourceClass = await getOwnedClassRow(req.auth.userRow.id, sourceClassId);

  const sourceRewards = parseJson(sourceClass.rewards, DEFAULT_REWARDS);
  const sourceScoreItems = parseJson(sourceClass.score_items, DEFAULT_SCORE_ITEMS);
  const sourceStageThresholds = normalizeThresholds(parseJson(sourceClass.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const sourceInventory = normalizeInventory(parseJson(sourceClass.inventory, {}), sourceRewards);

  let recomputedStudentCount = 0;
  await withClassLock(targetClass.id, async () => {
    await db.transaction(async () => {
      const nextRewards = applyFields.includes('storeItems')
        ? sourceRewards
        : parseJson(targetClass.rewards, DEFAULT_REWARDS);
      const nextScoreItems = applyFields.includes('scoreItems')
        ? sourceScoreItems
        : parseJson(targetClass.score_items, DEFAULT_SCORE_ITEMS);
      const nextStageThresholds = applyFields.includes('levelConfig')
        ? sourceStageThresholds
        : normalizeThresholds(parseJson(targetClass.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
      const nextInventory = applyFields.includes('storeItems')
        ? sourceInventory
        : normalizeInventory(parseJson(targetClass.inventory, {}), nextRewards);
      const nextTargetCount = applyFields.includes('levelConfig')
        ? sourceClass.target_count
        : targetClass.target_count;

      await updateClassStmt.run(
        targetClass.title,
        nextTargetCount,
        JSON.stringify(nextStageThresholds),
        targetClass.student_sort_mode,
        targetClass.theme_id,
        JSON.stringify(nextRewards),
        JSON.stringify(nextScoreItems),
        JSON.stringify(nextInventory),
        nowIso(),
        targetClass.id
      );

      if (applyFields.includes('levelConfig')) {
        const students = await selectStudentsByClassStmt.all(targetClass.id);
        const timestamp = nowIso();
        for (const student of students) {
          await updateStudentCoreStmt.run(
            student.name,
            student.sort_order,
            student.group_id || null,
            student.pet_id || null,
            calculateStageFromFood(student.food_count, nextStageThresholds),
            student.food_count,
            student.pet_nickname || null,
            student.spent_food || 0,
            timestamp,
            student.id
          );
          recomputedStudentCount += 1;
        }
      }
    })();
  }, '班级写请求排空超时，请稍后重试');

  emitSync(req.auth, targetClass.id, 'class', 'class-reused-config');
  sendSuccess(res, {
    targetClassId: targetClass.id,
    sourceClassId: sourceClass.id,
    sourceClassTitle: sourceClass.title,
    recomputedStudentCount,
    appliedFields: applyFields,
  });
}));

app.post('/api/students/class/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const name = String(req.body?.name || '').trim();
  if (!name) {
    throw new HttpError(400, '请输入学生姓名');
  }

  const timestamp = nowIso();
  const studentId = createId('student');
  const nextOrder = ((await maxStudentOrderStmt.get(classRow.id))?.maxOrder || 0) + 1;
  await insertStudentStmt.run(studentId, classRow.id, name, nextOrder, timestamp, timestamp);
  await touchClassStmt.run(timestamp, classRow.id);

  emitSync(req.auth, classRow.id, 'student', 'student-created');
  sendSuccess(res, mapStudent(await selectStudentContextOwnedStmt.get(studentId)), 201);
}));

app.put('/api/students/:studentId', requireUser, asyncRoute(async (req, res) => {
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, req.params.studentId);
  const classRow = await getOwnedClassRow(req.auth.userRow.id, studentRow.class_id);

  if (req.body?.groupId) {
    const group = await getOwnedGroupContext(req.auth.userRow.id, String(req.body.groupId));
    if (group.class_id !== classRow.id) {
      throw new HttpError(400, '分组不属于当前班级');
    }
  }

  await db.transaction(async () => {
    await updateStudentRowTx(studentRow, classRow, req.body || {});
  })();

  emitSync(req.auth, classRow.id, 'student', 'student-updated');
  sendSuccess(res, {});
}));

app.delete('/api/students/:studentId', requireUser, asyncRoute(async (req, res) => {
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, req.params.studentId);
  await deleteStudentStmt.run(studentRow.id);
  await touchClassStmt.run(nowIso(), studentRow.class_id);
  emitSync(req.auth, studentRow.class_id, 'student', 'student-deleted');
  sendSuccess(res, {});
}));

app.post('/api/students/:studentId/rename-pet', requireUser, asyncRoute(async (req, res) => {
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, req.params.studentId);
  const classRow = await getOwnedClassRow(req.auth.userRow.id, studentRow.class_id);
  const nickname = String(req.body?.nickname || '').trim();
  if (!nickname) {
    throw new HttpError(400, '请输入宠物昵称');
  }
  if (!studentRow.pet_id) {
    throw new HttpError(400, '请先领养宠物后再起名');
  }

  const timestamp = nowIso();
  await updateStudentCoreStmt.run(
    studentRow.name,
    studentRow.sort_order,
    studentRow.group_id || null,
    studentRow.pet_id,
    studentRow.pet_stage,
    studentRow.food_count,
    nickname,
    studentRow.spent_food || 0,
    timestamp,
    studentRow.id
  );

  const history = await insertHistoryRecordTx({
    classId: classRow.id,
    studentId: studentRow.id,
    studentName: studentRow.name,
    type: 'rename',
    petId: studentRow.pet_id,
    renameFrom: studentRow.pet_nickname || null,
    renameTo: nickname,
  });
  await touchClassStmt.run(timestamp, classRow.id);

  emitSync(req.auth, classRow.id, 'student', 'student-renamed-pet');
  sendSuccess(res, {
    studentId: studentRow.id,
    petNickname: nickname,
    history,
  });
}));

app.post('/api/history/class/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, req.body?.studentId);
  if (studentRow.class_id !== classRow.id) {
    throw new HttpError(400, '学生不属于当前班级');
  }

  await ensureHistoryLimit(classRow.id, 1);
  const history = await insertHistoryRecordTx({
    classId: classRow.id,
    studentId: studentRow.id,
    studentName: studentRow.name,
    type: req.body?.type || 'checkin',
    scoreItemName: req.body?.scoreItemName,
    scoreValue: req.body?.scoreValue,
    rewardName: req.body?.rewardName,
    cost: req.body?.cost,
    batchId: req.body?.batchId,
    petId: req.body?.petId,
  });
  await touchClassStmt.run(nowIso(), classRow.id);

  emitSync(req.auth, classRow.id, 'history', 'history-created');
  sendSuccess(res, history, 201);
}));

app.post('/api/history/class/:classId/checkin', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const studentId = String(req.body?.studentId || '').trim();
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, studentId);
  if (studentRow.class_id !== classRow.id) {
    throw new HttpError(400, '学生不属于当前班级');
  }

  await ensureHistoryLimit(classRow.id, 1);
  const thresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const scoreValue = Number.parseInt(req.body?.scoreValue, 10) || 0;
  const petId = req.body?.petId ? String(req.body.petId) : (studentRow.pet_id || null);
  const nextFoodCount = Math.max(0, studentRow.food_count + scoreValue);
  const nextPetStage = calculateStageFromFood(nextFoodCount, thresholds);
  const timestamp = nowIso();
  let history;

  await db.transaction(async () => {
    await updateStudentCoreStmt.run(
      studentRow.name,
      studentRow.sort_order,
      studentRow.group_id || null,
      petId,
      nextPetStage,
      nextFoodCount,
      studentRow.pet_nickname || null,
      studentRow.spent_food || 0,
      timestamp,
      studentRow.id
    );
    history = await insertHistoryRecordTx({
      classId: classRow.id,
      studentId: studentRow.id,
      studentName: studentRow.name,
      type: 'checkin',
      scoreItemName: String(req.body?.scoreItemName || '加分'),
      scoreValue,
      batchId: req.body?.batchId ? String(req.body.batchId) : null,
      petId,
    });
    await touchClassStmt.run(timestamp, classRow.id);
  })();

  emitSync(req.auth, classRow.id, 'history', 'history-checkin');
  sendSuccess(res, {
    history,
    student: {
      id: studentRow.id,
      foodCount: nextFoodCount,
      petStage: nextPetStage,
      petId,
    },
  });
}));

app.post('/api/history/class/:classId/checkin-batch', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (items.length === 0) {
    throw new HttpError(400, '请选择学生');
  }

  await ensureHistoryLimit(classRow.id, items.length);
  const thresholds = normalizeThresholds(parseJson(classRow.stage_thresholds, DEFAULT_STAGE_THRESHOLDS));
  const scoreValue = Number.parseInt(req.body?.scoreValue, 10) || 0;
  const scoreItemName = String(req.body?.scoreItemName || '批量加分');
  const batchId = req.body?.batchId ? String(req.body.batchId) : null;
  const studentResults = [];
  const historyResults = [];

  await db.transaction(async () => {
    const timestamp = nowIso();
    for (const item of items) {
      const studentRow = await getOwnedStudentContext(req.auth.userRow.id, item.studentId);
      if (studentRow.class_id !== classRow.id) {
        throw new HttpError(400, '存在不属于当前班级的学生');
      }

      const petId = item.petId ? String(item.petId) : (studentRow.pet_id || null);
      const nextFoodCount = Math.max(0, studentRow.food_count + scoreValue);
      const nextPetStage = calculateStageFromFood(nextFoodCount, thresholds);

      await updateStudentCoreStmt.run(
        studentRow.name,
        studentRow.sort_order,
        studentRow.group_id || null,
        petId,
        nextPetStage,
        nextFoodCount,
        studentRow.pet_nickname || null,
        studentRow.spent_food || 0,
        timestamp,
        studentRow.id
      );

      historyResults.push(await insertHistoryRecordTx({
        classId: classRow.id,
        studentId: studentRow.id,
        studentName: studentRow.name,
        type: 'checkin',
        scoreItemName,
        scoreValue,
        batchId,
        petId,
      }));

      studentResults.push({
        id: studentRow.id,
        foodCount: nextFoodCount,
        petStage: nextPetStage,
        petId,
      });
    }

    await touchClassStmt.run(timestamp, classRow.id);
  })();

  emitSync(req.auth, classRow.id, 'history', 'history-checkin-batch');
  sendSuccess(res, {
    histories: historyResults,
    students: studentResults,
  });
}));

app.post('/api/history/class/:classId/redeem', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const studentId = String(req.body?.studentId || '').trim();
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, studentId);
  if (studentRow.class_id !== classRow.id) {
    throw new HttpError(400, '学生不属于当前班级');
  }

  const rewards = parseJson(classRow.rewards, DEFAULT_REWARDS);
  const inventory = normalizeInventory(parseJson(classRow.inventory, {}), rewards);
  const rewardId = String(req.body?.rewardId || '');
  const reward = rewards.find((item) => item.id === rewardId);
  if (!reward) {
    throw new HttpError(404, '商品不存在');
  }

  const currentStock = inventory[reward.id] || 0;
  if (currentStock <= 0) {
    throw new HttpError(409, '库存不足');
  }

  const availableFood = Math.max(0, (studentRow.food_count || 0) - (studentRow.spent_food || 0));
  if (availableFood < reward.cost) {
    throw new HttpError(409, '肉量不足，无法兑换');
  }

  await ensureHistoryLimit(classRow.id, 1);
  inventory[reward.id] = currentStock - 1;
  const timestamp = nowIso();
  const nextSpentFood = (studentRow.spent_food || 0) + reward.cost;
  let history;

  await db.transaction(async () => {
    await updateClassStmt.run(
      classRow.title,
      classRow.target_count,
      classRow.stage_thresholds,
      classRow.student_sort_mode,
      classRow.theme_id,
      classRow.rewards,
      classRow.score_items,
      JSON.stringify(inventory),
      timestamp,
      classRow.id
    );

    await updateStudentCoreStmt.run(
      studentRow.name,
      studentRow.sort_order,
      studentRow.group_id || null,
      studentRow.pet_id || null,
      studentRow.pet_stage,
      studentRow.food_count,
      studentRow.pet_nickname || null,
      nextSpentFood,
      timestamp,
      studentRow.id
    );

    history = await insertHistoryRecordTx({
      classId: classRow.id,
      studentId: studentRow.id,
      studentName: studentRow.name,
      type: 'redeem',
      rewardId: reward.id,
      rewardName: reward.name,
      cost: reward.cost,
      petId: studentRow.pet_id || null,
    });
  })();

  const redemptions = (await selectHistoryByClassStmt
    .all(classRow.id))
    .map(mapHistory)
    .filter((record) => record.type === 'redeem');

  emitSync(req.auth, classRow.id, 'history', 'history-redeem');
  sendSuccess(res, {
    history,
    inventory,
    redemptions,
    spentFood: nextSpentFood,
    studentName: studentRow.name,
    rewardName: reward.name,
    cost: reward.cost,
  });
}));

app.post('/api/history/class/:classId/graduate', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const studentId = String(req.body?.studentId || '').trim();
  const studentRow = await getOwnedStudentContext(req.auth.userRow.id, studentId);
  if (studentRow.class_id !== classRow.id) {
    throw new HttpError(400, '学生不属于当前班级');
  }

  await ensureHistoryLimit(classRow.id, 1);
  const timestamp = nowIso();
  const badgeId = createId('badge');
  const petId = String(req.body?.petId || studentRow.pet_id || '');
  const petName = String(req.body?.petName || '').trim() || null;
  const earnedAt = nowTs();
  let history;

  if (!petId) {
    throw new HttpError(400, '请先选择毕业宠物');
  }

  await db.transaction(async () => {
    await insertBadgeStmt.run(
      badgeId,
      classRow.id,
      studentRow.id,
      petId,
      petName,
      earnedAt,
      timestamp
    );

    // 毕业时保留 food_count 和 spent_food，只重置宠物状态
    await updateStudentCoreStmt.run(
      studentRow.name,
      studentRow.sort_order,
      studentRow.group_id || null,
      null,
      1,
      studentRow.food_count,
      null,
      studentRow.spent_food || 0,
      timestamp,
      studentRow.id
    );

    history = await insertHistoryRecordTx({
      classId: classRow.id,
      studentId: studentRow.id,
      studentName: studentRow.name,
      type: 'graduate',
      scoreItemName: '毕业收获',
      scoreValue: studentRow.food_count,
      petId,
      badgeId,
      meta: {
        previousFoodCount: studentRow.food_count,
        previousPetStage: studentRow.pet_stage,
        previousPetId: studentRow.pet_id || null,
        previousPetNickname: studentRow.pet_nickname || null,
      },
    });

    await touchClassStmt.run(timestamp, classRow.id);
  })();

  const badges = await selectStudentBadges(studentRow.id);
  emitSync(req.auth, classRow.id, 'history', 'history-graduate');
  sendSuccess(res, {
    history,
    student: {
      id: studentRow.id,
      foodCount: studentRow.food_count,
      spentFood: studentRow.spent_food || 0,
      petStage: 1,
      petId: '',
      badges,
    },
    badge: {
      id: badgeId,
      petId,
      petName,
      earnedAt,
    },
  });
}));

app.post('/api/history/revoke', requireUser, asyncRoute(async (req, res) => {
  const historyRow = await getOwnedHistoryContext(req.auth.userRow.id, req.body?.recordId);
  const classRow = await getOwnedClassRow(req.auth.userRow.id, historyRow.class_id);

  const result = await db.transaction(async () => revokeSingleHistoryTx(historyRow, classRow))();
  emitSync(req.auth, classRow.id, 'history', 'history-revoked');
  sendSuccess(res, result);
}));

app.post('/api/history/revoke-batch', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.body?.classId);
  const batchId = String(req.body?.batchId || '').trim();
  if (!batchId) {
    throw new HttpError(400, '批次不存在');
  }

  const historyRows = await selectHistoryByClassBatchStmt.all(classRow.id, batchId, req.auth.userRow.id);
  const result = await db.transaction(async () => revokeBatchHistoryTx(classRow, historyRows))();
  emitSync(req.auth, classRow.id, 'history', 'history-revoked-batch');
  sendSuccess(res, result);
}));

app.delete('/api/history/:recordId', requireUser, asyncRoute(async (req, res) => {
  const historyRow = await getOwnedHistoryContext(req.auth.userRow.id, req.params.recordId);
  await deleteHistoryByIdStmt.run(historyRow.id);
  await touchClassStmt.run(nowIso(), historyRow.class_id);
  emitSync(req.auth, historyRow.class_id, 'history', 'history-deleted');
  sendSuccess(res, {});
}));

app.post('/api/history/batch-delete', requireUser, asyncRoute(async (req, res) => {
  const ids = Array.isArray(req.body?.ids)
    ? req.body.ids.map((item) => String(item)).filter(Boolean)
    : [];
  if (ids.length === 0) {
    sendSuccess(res, {});
    return;
  }

  const rows = await buildSelectHistoryByIdsOwnedStatement(ids).all(req.auth.userRow.id, ...ids);
  if (rows.length === 0) {
    sendSuccess(res, {});
    return;
  }

  await buildDeleteHistoryByIdsStatement(rows.map((row) => row.id)).run(...rows.map((row) => row.id));
  const touchedClassIds = new Set(rows.map((row) => row.class_id));
  const timestamp = nowIso();
  for (const classId of touchedClassIds) {
    await touchClassStmt.run(timestamp, classId);
    emitSync(req.auth, classId, 'history', 'history-batch-deleted');
  }
  sendSuccess(res, {});
}));

app.delete('/api/history/class/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  await deleteHistoryNonRedeemByClassStmt.run(classRow.id);
  await touchClassStmt.run(nowIso(), classRow.id);
  emitSync(req.auth, classRow.id, 'history', 'history-cleared');
  sendSuccess(res, {});
}));

app.post('/api/groups/class/:classId', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const name = String(req.body?.name || '').trim();
  if (!name) {
    throw new HttpError(400, '请输入分组名称');
  }

  const nextOrder = ((await maxGroupOrderStmt.get(classRow.id))?.maxOrder || 0) + 1;
  const timestamp = nowIso();
  const groupId = createId('group');
  const colorToken = GROUP_COLOR_TOKENS[(nextOrder - 1) % GROUP_COLOR_TOKENS.length];
  await insertGroupStmt.run(groupId, classRow.id, name, nextOrder, colorToken, timestamp, timestamp);
  await touchClassStmt.run(timestamp, classRow.id);

  emitSync(req.auth, classRow.id, 'group', 'group-created');
  sendSuccess(res, {
    id: groupId,
    name,
    sortOrder: nextOrder,
    colorToken,
  }, 201);
}));

app.put('/api/groups/:groupId', requireUser, asyncRoute(async (req, res) => {
  const groupRow = await getOwnedGroupContext(req.auth.userRow.id, req.params.groupId);
  const nextName = req.body?.name !== undefined
    ? String(req.body.name || '').trim() || groupRow.name
    : groupRow.name;
  const timestamp = nowIso();
  await updateGroupStmt.run(nextName, timestamp, groupRow.id);
  await touchClassStmt.run(timestamp, groupRow.class_id);

  emitSync(req.auth, groupRow.class_id, 'group', 'group-updated');
  sendSuccess(res, {
    id: groupRow.id,
    name: nextName,
    sortOrder: groupRow.sort_order,
    colorToken: groupRow.color_token || null,
  });
}));

app.delete('/api/groups/:groupId', requireUser, asyncRoute(async (req, res) => {
  const groupRow = await getOwnedGroupContext(req.auth.userRow.id, req.params.groupId);
  const affectedStudents = (await db.prepare(`
    SELECT COUNT(*) AS total
    FROM students
    WHERE group_id = ?
  `).get(groupRow.id))?.total || 0;

  const timestamp = nowIso();
  await db.transaction(async () => {
    await clearStudentGroupStmt.run(timestamp, groupRow.id);
    await deleteGroupStmt.run(groupRow.id);
    await touchClassStmt.run(timestamp, groupRow.class_id);
  })();

  emitSync(req.auth, groupRow.class_id, 'group', 'group-deleted');
  sendSuccess(res, { affectedStudents });
}));

app.put('/api/groups/class/:classId/reorder', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const orderedGroupIds = Array.isArray(req.body?.orderedGroupIds) ? req.body.orderedGroupIds : [];
  const groups = await selectGroupsByClassStmt.all(classRow.id);
  const groupIds = new Set(groups.map((group) => group.id));

  if (orderedGroupIds.length !== groups.length || orderedGroupIds.some((id) => !groupIds.has(id))) {
    throw new HttpError(400, '分组顺序无效');
  }

  const timestamp = nowIso();
  await db.transaction(async () => {
    for (const [index, groupId] of orderedGroupIds.entries()) {
      await updateGroupOrderStmt.run(index + 1, timestamp, groupId);
    }
    await touchClassStmt.run(timestamp, classRow.id);
  })();

  emitSync(req.auth, classRow.id, 'group', 'group-reordered');
  sendSuccess(res, (await selectGroupsByClassStmt.all(classRow.id)).map(mapGroup));
}));

app.post('/api/groups/class/:classId/random', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const groupCount = Math.max(1, Number.parseInt(req.body?.groupCount || '1', 10) || 1);

  const result = await db.transaction(async () => assignRandomGroupsTx(classRow, groupCount))();
  emitSync(req.auth, classRow.id, 'group', 'group-randomized');
  sendSuccess(res, result);
}));

app.put('/api/groups/class/:classId/batch-assign', requireUser, asyncRoute(async (req, res) => {
  const classRow = await getOwnedClassRow(req.auth.userRow.id, req.params.classId);
  const studentIds = Array.isArray(req.body?.studentIds)
    ? req.body.studentIds.map((item) => String(item)).filter(Boolean)
    : [];
  const groupId = req.body?.groupId ? String(req.body.groupId) : null;

  if (groupId) {
    const groupRow = await getOwnedGroupContext(req.auth.userRow.id, groupId);
    if (groupRow.class_id !== classRow.id) {
      throw new HttpError(400, '分组不属于当前班级');
    }
  }

  const timestamp = nowIso();
  await db.transaction(async () => {
    for (const studentId of studentIds) {
      const studentRow = await getOwnedStudentContext(req.auth.userRow.id, studentId);
      if (studentRow.class_id !== classRow.id) {
        throw new HttpError(400, '存在不属于当前班级的学生');
      }
      await batchAssignGroupStmt.run(groupId, timestamp, studentId);
    }
    await touchClassStmt.run(timestamp, classRow.id);
  })();

  emitSync(req.auth, classRow.id, 'group', 'group-batch-assigned');
  sendSuccess(res, {
    updatedCount: studentIds.length,
    studentIds,
    groupId,
  });
}));

app.use('/api', notFoundApiHandler);

app.use(express.static(config.publicDir, { index: false }));

if (fs.existsSync(config.distDir) && fs.existsSync(path.join(config.distDir, 'index.html'))) {
  app.use(express.static(config.distDir, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    res.sendFile(path.join(config.distDir, 'index.html'));
  });
}

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
  console.log('[server] Database: postgres');
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[server] 端口 ${config.port} 已被占用，请检查是否有其他进程在使用`);
  } else {
    console.error('[server] 服务器启动失败:', err.message);
  }
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('[server] 未捕获的异常:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[server] 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

const gracefulShutdown = async (signal) => {
  console.log(`[server] 收到 ${signal} 信号，正在关闭服务...`);
  try {
    await db.close();
    console.log('[server] 数据库连接已关闭');
  } catch {
    // ignore
  }
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
