const nowIso = () => new Date().toISOString();

const migrations = [
  {
    id: '001_init_schema',
    up: async (db) => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
          is_activated BOOLEAN NOT NULL DEFAULT TRUE,
          license_code TEXT,
          activated_at TEXT,
          system_title TEXT NOT NULL DEFAULT '学生积分系统',
          current_class_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS licenses (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE,
          is_used BOOLEAN NOT NULL DEFAULT FALSE,
          is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
          used_by TEXT,
          used_at TEXT,
          note TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL,
          revoked_at TEXT,
          created_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS classes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          target_count INTEGER NOT NULL DEFAULT 100,
          stage_thresholds TEXT NOT NULL,
          student_sort_mode TEXT NOT NULL DEFAULT 'manual',
          theme_id TEXT NOT NULL DEFAULT 'pink',
          rewards TEXT NOT NULL,
          score_items TEXT NOT NULL,
          inventory TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS groups (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          color_token TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS students (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL,
          name TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          group_id TEXT,
          pet_id TEXT,
          pet_stage INTEGER NOT NULL DEFAULT 1,
          food_count INTEGER NOT NULL DEFAULT 0,
          pet_nickname TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS badges (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          pet_id TEXT NOT NULL,
          pet_name TEXT,
          earned_at BIGINT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS history_records (
          id TEXT PRIMARY KEY,
          class_id TEXT NOT NULL,
          student_id TEXT NOT NULL,
          student_name TEXT NOT NULL,
          type TEXT NOT NULL,
          score_item_name TEXT,
          score_value INTEGER,
          reward_id TEXT,
          reward_name TEXT,
          cost INTEGER,
          batch_id TEXT,
          pet_id TEXT,
          revoked_record_id TEXT,
          revoked_score_item_name TEXT,
          revoked_score_value INTEGER,
          rename_from TEXT,
          rename_to TEXT,
          badge_id TEXT,
          meta TEXT,
          timestamp BIGINT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_classes_user_id ON classes(user_id);
        CREATE INDEX IF NOT EXISTS idx_groups_class_id ON groups(class_id);
        CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
        CREATE INDEX IF NOT EXISTS idx_students_group_id ON students(group_id);
        CREATE INDEX IF NOT EXISTS idx_badges_class_student ON badges(class_id, student_id);
        CREATE INDEX IF NOT EXISTS idx_history_class_id ON history_records(class_id);
        CREATE INDEX IF NOT EXISTS idx_history_batch_id ON history_records(class_id, batch_id);
        CREATE INDEX IF NOT EXISTS idx_licenses_used_by ON licenses(used_by);
      `);
    },
  },
  {
    id: '002_add_spent_food',
    up: async (db) => {
      await db.query(`
        ALTER TABLE students ADD COLUMN spent_food INTEGER NOT NULL DEFAULT 0;
      `);
    },
  },
  {
    id: '003_add_audit_logs',
    up: async (db) => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          actor_username TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          summary TEXT NOT NULL,
          meta TEXT,
          ip_address TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      `);
    },
  },
  {
    id: '004_add_backup_records',
    up: async (db) => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS backup_records (
          id TEXT PRIMARY KEY,
          filename TEXT NOT NULL,
          file_size BIGINT NOT NULL DEFAULT 0,
          trigger_type TEXT NOT NULL DEFAULT 'manual',
          status TEXT NOT NULL DEFAULT 'completed',
          error_message TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_backup_records_created ON backup_records(created_at DESC);
      `);
    },
  },
];

const ensureMigrationsTable = async (db) => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
};

export const getAppliedMigrationIds = async (db) => {
  await ensureMigrationsTable(db);
  const rows = await db.prepare(`
    SELECT id
    FROM schema_migrations
    ORDER BY id ASC
  `).all();
  return new Set(rows.map((row) => row.id));
};

export const runMigrations = async (db) => {
  await ensureMigrationsTable(db);
  const appliedIds = await getAppliedMigrationIds(db);
  const markAppliedStmt = db.prepare(`
    INSERT INTO schema_migrations (id, applied_at)
    VALUES (?, ?)
  `);

  const appliedNow = [];
  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) {
      continue;
    }

    await db.transaction(async () => {
      await migration.up(db);
      await markAppliedStmt.run(migration.id, nowIso());
    })();

    appliedNow.push(migration.id);
  }

  return appliedNow;
};

export const listMigrations = () => migrations.map((migration) => migration.id);
