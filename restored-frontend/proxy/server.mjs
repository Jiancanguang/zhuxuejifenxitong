import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const upstreamOrigin = new URL(process.env.UPSTREAM_ORIGIN || 'https://bjcwy.cjgsup.com');
const port = Number.parseInt(process.env.PORT || '3001', 10);
const staticDirArg = getCliOption('--static');
const staticDir = staticDirArg ? path.resolve(projectRoot, staticDirArg) : null;
const petAssetDir = path.join(projectRoot, 'public', '动物图片');

function getCliOption(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return null;
  }

  return process.argv[index + 1] || null;
}

function decodePathname(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isApiPath(pathname) {
  const decoded = decodePathname(pathname);
  return decoded === '/api' || decoded.startsWith('/api/');
}

function isPetAssetPath(pathname) {
  const decoded = decodePathname(pathname);
  return decoded === '/动物图片' || decoded.startsWith('/动物图片/');
}

function toSafeRelativePath(pathname, prefix) {
  const decoded = decodePathname(pathname);
  if (!decoded.startsWith(prefix)) {
    return null;
  }

  const trimmed = decoded.slice(prefix.length).replace(/^\/+/, '');
  if (!trimmed) {
    return '';
  }

  const normalized = path.normalize(trimmed);
  if (normalized.split(path.sep).includes('..')) {
    return null;
  }

  return normalized;
}

function resolveInside(baseDir, relativePath) {
  const fullPath = path.resolve(baseDir, relativePath);
  if (fullPath === baseDir || fullPath.startsWith(`${baseDir}${path.sep}`)) {
    return fullPath;
  }
  return null;
}

function getMimeType(filePath) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.map':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.ico':
      return 'image/x-icon';
    case '.txt':
      return 'text/plain; charset=utf-8';
    default:
      return 'application/octet-stream';
  }
}

async function serveFile(res, filePath, cacheControl) {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      return false;
    }

    res.writeHead(200, {
      'content-type': getMimeType(filePath),
      'content-length': String(stat.size),
      'cache-control': cacheControl,
    });

    const stream = createReadStream(filePath);
    stream.on('error', (error) => {
      console.error('[proxy] Failed to read file:', filePath, error);
      if (!res.headersSent) {
        sendText(res, 500, 'Failed to read local file');
        return;
      }
      res.destroy(error);
    });

    stream.pipe(res);
    return true;
  } catch {
    return false;
  }
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
  });
  res.end(body);
}

function proxyToUpstream(req, res) {
  const transport = upstreamOrigin.protocol === 'https:' ? httpsRequest : httpRequest;
  const upstreamRequest = transport(
    {
      protocol: upstreamOrigin.protocol,
      hostname: upstreamOrigin.hostname,
      port: upstreamOrigin.port || (upstreamOrigin.protocol === 'https:' ? 443 : 80),
      method: req.method,
      path: req.url,
      headers: {
        ...req.headers,
        host: upstreamOrigin.host,
      },
    },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    }
  );

  upstreamRequest.on('error', (error) => {
    console.error('[proxy] Upstream request failed:', req.method, req.url, error);
    if (res.headersSent) {
      res.destroy(error);
      return;
    }

    sendJson(res, 502, {
      success: false,
      message: `Local proxy request failed: ${error.message}`,
    });
  });

  req.on('aborted', () => {
    upstreamRequest.destroy();
  });

  res.on('close', () => {
    if (!res.writableEnded) {
      upstreamRequest.destroy();
    }
  });

  if (req.method === 'GET' || req.method === 'HEAD' || req.readableEnded) {
    upstreamRequest.end();
    return;
  }

  req.pipe(upstreamRequest);
}

async function handlePetAsset(req, res, pathname) {
  const relativePath = toSafeRelativePath(pathname, '/动物图片');
  if (relativePath === null) {
    sendText(res, 400, 'Invalid pet asset path');
    return;
  }

  if (relativePath) {
    const localPath = resolveInside(petAssetDir, relativePath);
    if (localPath) {
      const served = await serveFile(res, localPath, 'public, max-age=604800');
      if (served) {
        return;
      }
    }
  }

  proxyToUpstream(req, res);
}

async function handleStatic(req, res, pathname) {
  if (!staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) {
    return false;
  }

  const decodedPathname = decodePathname(pathname);
  const relativePath = decodedPathname === '/' ? 'index.html' : decodedPathname.replace(/^\/+/, '');
  const normalizedPath = path.normalize(relativePath);

  if (!normalizedPath.split(path.sep).includes('..')) {
    const requestedFile = resolveInside(staticDir, normalizedPath);
    if (requestedFile) {
      const served = await serveFile(res, requestedFile, 'no-cache');
      if (served) {
        return true;
      }
    }
  }

  const looksLikeFile = path.posix.basename(decodedPathname).includes('.');
  if (looksLikeFile) {
    sendText(res, 404, 'Not Found');
    return true;
  }

  const indexFile = path.join(staticDir, 'index.html');
  const served = await serveFile(res, indexFile, 'no-cache');
  if (!served) {
    sendText(res, 404, 'Build output not found. Run "npm run build" first.');
  }
  return true;
}

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  const { pathname } = requestUrl;

  if (pathname === '/__proxy/health') {
    sendJson(res, 200, {
      ok: true,
      upstream: upstreamOrigin.origin,
      staticDir,
      petAssetDir,
    });
    return;
  }

  if (isApiPath(pathname)) {
    proxyToUpstream(req, res);
    return;
  }

  if (isPetAssetPath(pathname)) {
    await handlePetAsset(req, res, pathname);
    return;
  }

  const servedStatic = await handleStatic(req, res, pathname);
  if (servedStatic) {
    return;
  }

  sendText(
    res,
    200,
    'Local proxy is running. Use the Vite dev server on http://localhost:5173 or pass --static dist to serve a local build.'
  );
});

server.listen(port, () => {
  console.log(`[proxy] Listening on http://localhost:${port}`);
  console.log(`[proxy] Upstream origin: ${upstreamOrigin.origin}`);
  console.log(`[proxy] Pet asset dir: ${petAssetDir}`);
  if (staticDir) {
    console.log(`[proxy] Static dir: ${staticDir}`);
  }
});
