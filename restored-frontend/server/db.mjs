import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, types } from 'pg';
import { config } from './config.mjs';
import { runMigrations } from './migrations.mjs';

if (!config.databaseUrl) {
  throw new Error('DATABASE_URL 未配置');
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

await runMigrations(db);
