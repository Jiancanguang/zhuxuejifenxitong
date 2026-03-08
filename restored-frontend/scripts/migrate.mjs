import { db } from '../server/db.mjs';
import { listMigrations } from '../server/migrations.mjs';

const appliedRows = await db.prepare(`
  SELECT id, applied_at
  FROM schema_migrations
  ORDER BY id ASC
`).all();

const appliedIds = new Set(appliedRows.map((row) => row.id));
const allIds = listMigrations();
const pendingIds = allIds.filter((id) => !appliedIds.has(id));

console.log(`[migrate] Database: ${db.name}`);
console.log(`[migrate] Applied migrations: ${appliedRows.length}`);
for (const row of appliedRows) {
  console.log(`- ${row.id} @ ${row.applied_at}`);
}

if (pendingIds.length === 0) {
  console.log('[migrate] No pending migrations.');
} else {
  console.log(`[migrate] Pending migrations: ${pendingIds.join(', ')}`);
}

await db.close();
