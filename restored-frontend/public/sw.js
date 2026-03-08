/**
 * Service Worker - 离线缓存
 * 
 * 功能：
 * 1. 缓存宠物图片，实现离线访问
 * 2. 缓存静态资源（JS/CSS）
 * 3. 网络优先策略，失败时使用缓存
 */

const CACHE_VERSION = 'v3-1.3.8-pet-image-fix';
const CACHE_NAME = `pet-garden-${CACHE_VERSION}`;

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
];

// 安装 Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');

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
    console.log('[SW] Activating Service Worker...');

    event.waitUntil(
        // 清理旧版本缓存
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('pet-garden-') && name !== CACHE_NAME)
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

// 拦截网络请求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 只处理 http/https 请求，过滤掉 chrome-extension:// 等其他协议
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

    // 判断是否是静态资源
    const isStaticAsset = url.pathname.match(/\.(js|css|woff|woff2|ttf|eot)$/i);

    if (isPetImage || isImage) {
        // 宠物图片：缓存优先策略（Cache First）
        // 优先使用缓存，没有缓存时从网络获取并缓存
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // console.log('[SW] Cache hit:', url.pathname);
                    return cachedResponse;
                }

                // console.log('[SW] Cache miss, fetching:', url.pathname);
                return fetch(event.request).then((networkResponse) => {
                    // 只缓存真正的图片响应，避免把 index.html(200) 缓存成图片
                    if (isRealImageResponse(networkResponse)) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch((error) => {
                    console.log('[SW] Fetch failed:', url.pathname, error);
                    // 返回一个占位图或错误响应
                    return new Response('Image not available offline', { status: 503 });
                });
            })
        );
    } else if (isStaticAsset) {
        // 静态资源：网络优先策略（Network First）
        // 优先从网络获取最新版本，失败时使用缓存
        event.respondWith(
            fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                return caches.match(event.request);
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
        caches.delete(CACHE_NAME).then(() => {
            console.log('[SW] Cache cleared');
        });
    }
});

console.log('[SW] Service Worker loaded');
