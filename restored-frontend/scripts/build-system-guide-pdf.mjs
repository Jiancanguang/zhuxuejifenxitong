import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const sourceHtml = path.join(rootDir, 'public', 'system-guide.html');
const outputPdf = path.join(rootDir, 'public', 'system-guide.pdf');

const chromeCandidates = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

const findChrome = async () => {
  for (const candidate of chromeCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // continue
    }
  }

  throw new Error(
    '未找到可用的 Chromium/Chrome 可执行文件。请设置 CHROME_BIN，或安装 Google Chrome。'
  );
};

const main = async () => {
  const chrome = await findChrome();
  const tempProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'system-guide-chrome-'));

  try {
    await fs.access(sourceHtml);

    const sourceUrl = pathToFileURL(sourceHtml).href;
    await execFileAsync(
      chrome,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--allow-file-access-from-files',
        `--user-data-dir=${tempProfile}`,
        '--virtual-time-budget=3000',
        '--no-pdf-header-footer',
        `--print-to-pdf=${outputPdf}`,
        sourceUrl,
      ],
      {
        cwd: rootDir,
        maxBuffer: 1024 * 1024 * 8,
        env: {
          ...process.env,
          LANG: 'zh_CN.UTF-8',
        },
      }
    );

    const stat = await fs.stat(outputPdf);
    console.log(`[guide] 已生成 ${outputPdf} (${Math.round(stat.size / 1024)} KB)`);
  } finally {
    await fs.rm(tempProfile, { recursive: true, force: true });
  }
};

main().catch((error) => {
  console.error('[guide] 生成失败:', error.message);
  process.exitCode = 1;
});
