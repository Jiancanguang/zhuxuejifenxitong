import fs from 'node:fs';
import path from 'node:path';
import { config } from '../server/config.mjs';
import { db } from '../server/db.mjs';

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tables = [
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

fs.mkdirSync(config.backupDir, { recursive: true });
const targetFile = path.join(config.backupDir, `app-${stamp}.json`);

try {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    database: 'postgres',
    tables: {},
  };

  for (const table of tables) {
    const result = await db.query(`SELECT * FROM ${table} ORDER BY 1 ASC`);
    snapshot.tables[table] = result.rows;
  }

  fs.writeFileSync(targetFile, JSON.stringify(snapshot, null, 2));
  console.log(`[backup] Target: ${targetFile}`);
} finally {
  await db.close();
}
