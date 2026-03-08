import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const constantsPath = path.join(projectRoot, 'src', 'constants.ts');
const outputRoot = path.join(projectRoot, 'public', '动物图片');
const upstreamOrigin = process.env.UPSTREAM_ORIGIN || 'https://bjcwy.cjgsup.com';
const forceDownload = process.argv.includes('--force');
const maxConcurrency = 8;

function buildAssetUrl(folder, stage) {
  return new URL(`/动物图片/${folder}/${stage}.webp`, upstreamOrigin).toString();
}

async function extractPetFolders() {
  const source = await fs.readFile(constantsPath, 'utf8');
  const folderPattern = /folder:\s*'([^']+)'/g;
  const folders = new Set();

  let match = folderPattern.exec(source);
  while (match) {
    folders.add(match[1]);
    match = folderPattern.exec(source);
  }

  return [...folders];
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function downloadAsset(folder, stage) {
  const outputDir = path.join(outputRoot, folder);
  const outputPath = path.join(outputDir, `${stage}.webp`);

  if (!forceDownload && await fileExists(outputPath)) {
    return { status: 'skipped', outputPath };
  }

  const response = await fetch(buildAssetUrl(folder, stage));
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, buffer);

  return { status: 'downloaded', outputPath };
}

async function runQueue(tasks, worker, concurrency) {
  const results = [];
  let cursor = 0;

  async function consume() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(tasks[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, tasks.length) }, () => consume())
  );

  return results;
}

async function main() {
  const folders = await extractPetFolders();
  const tasks = folders.flatMap(folder =>
    Array.from({ length: 10 }, (_, offset) => ({
      folder,
      stage: offset + 1,
    }))
  );

  console.log(`[mirror] Upstream origin: ${upstreamOrigin}`);
  console.log(`[mirror] Output dir: ${outputRoot}`);
  console.log(`[mirror] Preparing ${tasks.length} image files`);

  let downloaded = 0;
  let skipped = 0;

  await runQueue(
    tasks,
    async ({ folder, stage }, index) => {
      const result = await downloadAsset(folder, stage);
      if (result.status === 'downloaded') {
        downloaded += 1;
        console.log(`[mirror] ${index + 1}/${tasks.length} downloaded ${folder}/${stage}.webp`);
      } else {
        skipped += 1;
      }
      return result;
    },
    maxConcurrency
  );

  console.log(`[mirror] Completed. Downloaded: ${downloaded}, skipped: ${skipped}`);
}

main().catch((error) => {
  console.error('[mirror] Failed to mirror pet assets:', error);
  process.exitCode = 1;
});
