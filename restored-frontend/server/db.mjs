import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types } from 'pg';
import { config } from './config.mjs';
import { runMigrations } from './migrations.mjs';

if (!config.databaseUrl) {
  console.error('[db] 致命错误: DATABASE_URL 环境变量未配置');
  console.error('[db] 请在 Render 后台或 .env 文件中设置 DATABASE_URL');
  process.exit(1);
}

types.setTypeParser(20, (value) => Number.parseInt(value, 10));

const transactionStorage = new AsyncLocalStorage();

const replacePlaceholders = (sql) => {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
};

const normalizeSql = (sql) => replacePlaceholders(sql).trim();

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
});

pool.on('error', (err) => {
  console.error('[db] 数据库连接池发生意外错误:', err.message);
});

const getExecutor = () => transactionStorage.getStore()?.client || pool;

const query = async (sql, params = []) => {
  return getExecutor().query(normalizeSql(sql), params);
};

const prepare = (sql) => ({
  get: async (...params) => {
    const result = await query(sql, params);
    return result.rows[0];
  },
  all: async (...params) => {
    const result = await query(sql, params);
    return result.rows;
  },
  run: async (...params) => {
    const result = await query(sql, params);
    return {
      changes: result.rowCount || 0,
      rowCount: result.rowCount || 0,
    };
  },
});

const transaction = (handler) => async (...args) => {
  const existingContext = transactionStorage.getStore();
  if (existingContext?.client) {
    return handler(...args);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await transactionStorage.run({ client }, () => handler(...args));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const db = {
  name: 'postgres',
  pool,
  query,
  prepare,
  transaction,
  close: async () => pool.end(),
};

try {
  const applied = await runMigrations(db);
  if (applied.length > 0) {
    console.log(`[db] 已执行 ${applied.length} 个数据库迁移: ${applied.join(', ')}`);
  }
  console.log('[db] 数据库连接成功');
} catch (err) {
  console.error('[db] 数据库迁移失败:', err.message);
  console.error('[db] 请检查 DATABASE_URL 是否正确，以及数据库是否可以访问');
  await pool.end().catch(() => {});
  process.exit(1);
}
