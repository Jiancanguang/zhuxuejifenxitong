import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({
  path: path.join(rootDir, '.env'),
  quiet: true,
});

const resolveFromRoot = (value) => {
  if (!value) return value;
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
};

const splitCsv = (value) => String(value || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const toPort = (value, fallback) => {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  rootDir,
  distDir: path.join(rootDir, 'dist'),
  publicDir: path.join(rootDir, 'public'),
  port: toPort(process.env.PORT, 3001),
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: String(process.env.DATABASE_SSL || 'true').toLowerCase() !== 'false',
  backupDir: resolveFromRoot(process.env.BACKUP_DIR || './backups'),
  corsOrigins: splitCsv(process.env.CORS_ORIGIN),
  jwtSecret: process.env.JWT_SECRET || 'replace-this-in-production',
  adminUsername: (process.env.ADMIN_USERNAME || 'studioadmin').trim(),
  adminPassword: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  userTokenTtl: process.env.USER_TOKEN_TTL || '30d',
  adminTokenTtl: process.env.ADMIN_TOKEN_TTL || '30d',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export const isProduction = config.nodeEnv === 'production';

if (isProduction) {
  if (config.jwtSecret === 'replace-this-in-production') {
    console.warn('[config] 警告: JWT_SECRET 使用了默认值，生产环境请务必设置安全的密钥');
  }
  if (config.adminPassword === 'ChangeMe123!') {
    console.warn('[config] 警告: ADMIN_PASSWORD 使用了默认值，请尽快修改管理员密码');
  }
}
