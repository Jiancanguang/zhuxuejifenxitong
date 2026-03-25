/**
 * Service Worker - 离线缓存（增强版）
 *
 * 功能：
 * 1. 缓存宠物图片，实现离线访问（Cache First）
 * 2. 缓存静态资源 JS/CSS（Stale-While-Revalidate）
 * 3. 缓存 HTML 页面导航（Network First + 离线回退）
 * 4. 缓存 API GET 请求（Network First + 短时缓存回退，弱网可用）
 * 5. 自动限制缓存大小，防止存储膨胀
 */

const CACHE_VERSION = 'v4-1.3.9-offline-enhanced';
const CACHE_NAME = `pet-garden-${CACHE_VERSION}`;
const API_CACHE_NAME = `pet-garden-api-${CACHE_VERSION}`;
const API_CACHE_MAX_AGE = 5 * 60 * 1000; // API 缓存有效期 5 分钟
const MAX_API_CACHE_ENTRIES = 50;

function isRealImageResponse(response) {
    if (!response || response.status !== 200) return false;
    const contentType = response.headers.get('content-type') || '';
    return contentType.toLowerCase().startsWith('image/');
}

// 需要缓存的资源类型
const CACHEABLE_EXTENSIONS = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'];

// 静态资源缓存（安装时预缓存）
const STATIC_CACHE_URLS = [
    '/',
    '/index.html',
    '/favicon.svg',
];

// 离线回退页面（嵌入 SW 中，不依赖网络）
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>离线模式 - 学生积分系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fef2f2; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: white; border-radius: 24px; padding: 48px 32px; text-align: center; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .icon { font-size: 48px; margin-bottom: 16px; }
    h1 { font-size: 20px; color: #1e293b; margin-bottom: 8px; }
    p { font-size: 14px; color: #64748b; line-height: 1.6; margin-bottom: 24px; }
    button { background: linear-gradient(135deg, #ec4899, #f43f5e); color: white; border: none; padding: 12px 32px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; }
    button:active { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📡</div>
    <h1>当前处于离线模式</h1>
    <p>无法连接到服务器。已缓存的图片和资源仍然可用。<br>请检查网络连接后重试。</p>
    <button onclick="location.reload()">重新连接</button>
  </div>
</body>
</html>`;

// 安装 Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker (enhanced)...');

    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Pre-caching static resources');
            return cache.addAll(STATIC_CACHE_URLS);
        })
    );

    // 立即激活，不等待旧 SW 退出
    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker (enhanced)...');

    event.waitUntil(
        // 清理旧版本缓存
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('pet-garden-') && name !== CACHE_NAME && name !== API_CACHE_NAME)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        })
    );

    // 立即接管所有页面
    self.clients.claim();
});

/**
 * 限制 cache 中的条目数量，淘汰最旧的
 */
async function trimCache(cacheName, maxEntries) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxEntries) {
        await cache.delete(keys[0]);
        return trimCache(cacheName, maxEntries);
    }
}

/**
 * 带超时的 fetch，弱网环境下快速回退到缓存
 */
function fetchWithTimeout(request, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error('Network timeout'));
        }, timeoutMs);

        fetch(request).then((response) => {
            clearTimeout(timer);
            resolve(response);
        }).catch((err) => {
            clearTimeout(timer);
            reject(err);
        });
    });
}

// 拦截网络请求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 只处理 http/https 请求
    if (!url.protocol.startsWith('http')) {
        return;
    }

    // 只处理 GET 请求
    if (event.request.method !== 'GET') {
        return;
    }

    // 判断是否是图片请求
    const isImage = CACHEABLE_EXTENSIONS.some(ext => url.pathname.toLowerCase().endsWith(ext));

    // 判断是否是宠物图片
    const isPetImage = url.pathname.includes('/动物图片/') || url.pathname.includes('/%E5%8A%A8%E7%89%A9%E5%9B%BE%E7%89%87/');

    // 判断是否是静态资源（带 hash 的 JS/CSS）
    const isHashedAsset = url.pathname.match(/\.[a-f0-9]{8,}\.(js|css)$/i);
    const isStaticAsset = url.pathname.match(/\.(js|css|woff|woff2|ttf|eot)$/i);

    // 判断是否是 API GET 请求（可缓存的只读 API）
    const isCacheableApi = url.pathname.startsWith('/api/')
        && url.pathname !== '/api/sync/stream'
        && !url.pathname.startsWith('/api/auth/')
        && !url.pathname.startsWith('/api/admin/');

    // 判断是否是页面导航请求
    const isNavigationRequest = event.request.mode === 'navigate';

    if (isPetImage || isImage) {
        // === 图片：Cache First ===
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request).then((networkResponse) => {
                    if (isRealImageResponse(networkResponse)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return new Response('Image not available offline', {
                        status: 503,
                        headers: { 'Content-Type': 'text/plain' },
                    });
                });
            })
        );

    } else if (isHashedAsset) {
        // === 带 hash 的静态资源：Cache First（文件名包含 hash，内容不变）===
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    return caches.match(event.request);
                });
            })
        );

    } else if (isStaticAsset) {
        // === 普通静态资源：Stale-While-Revalidate ===
        // 立即返回缓存版本，同时在后台更新
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(() => cachedResponse);

                return cachedResponse || fetchPromise;
            })
        );

    } else if (isCacheableApi) {
        // === API GET 请求：Network First + 超时回退到缓存 ===
        // 弱网时 3 秒超时后回退到缓存
        event.respondWith(
            fetchWithTimeout(event.request, 3000).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(API_CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                        trimCache(API_CACHE_NAME, MAX_API_CACHE_ENTRIES);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        // 检查缓存是否过期
                        const cachedDate = cachedResponse.headers.get('date');
                        if (cachedDate) {
                            const age = Date.now() - new Date(cachedDate).getTime();
                            if (age > API_CACHE_MAX_AGE) {
                                // 缓存过期但仍然返回（比没有数据好）
                                console.log('[SW] API cache stale but serving:', url.pathname);
                            }
                        }
                        return cachedResponse;
                    }
                    return new Response(JSON.stringify({
                        success: false,
                        message: '网络不可用，请检查连接后重试',
                    }), {
                        status: 503,
                        headers: { 'Content-Type': 'application/json' },
                    });
                });
            })
        );

    } else if (isNavigationRequest) {
        // === 页面导航：Network First + 离线回退页面 ===
        event.respondWith(
            fetchWithTimeout(event.request, 5000).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // 返回离线回退页面
                    return new Response(OFFLINE_HTML, {
                        status: 200,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' },
                    });
                });
            })
        );
    }
    // 其他请求不处理，使用默认网络行为
});

// 接收来自页面的消息
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    // 清除缓存命令
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        Promise.all([
            caches.delete(CACHE_NAME),
            caches.delete(API_CACHE_NAME),
        ]).then(() => {
            console.log('[SW] All caches cleared');
        });
    }
});

console.log('[SW] Service Worker loaded (enhanced offline support)');
