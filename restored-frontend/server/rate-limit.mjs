/**
 * 简单的内存 Rate Limiter（基于 Token Bucket 算法）
 *
 * 支持按 IP 或自定义 key 进行限流。
 * 注意：仅适用于单进程部署；多实例部署需要使用 Redis 等外部存储。
 */

const buckets = new Map();

// 每 5 分钟清理过期 bucket
const CLEANUP_INTERVAL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.lastAccess > bucket.windowMs * 2) {
      buckets.delete(key);
    }
  }
}, CLEANUP_INTERVAL).unref();

/**
 * 创建 rate limiter 中间件
 *
 * @param {object} options
 * @param {number} options.windowMs - 时间窗口（毫秒），默认 60000（1分钟）
 * @param {number} options.maxRequests - 窗口内最大请求数，默认 60
 * @param {function} options.keyGenerator - 生成限流 key 的函数，默认按 IP
 * @param {string} options.message - 超限时的错误消息
 */
export const createRateLimiter = ({
  windowMs = 60 * 1000,
  maxRequests = 60,
  keyGenerator = null,
  message = '操作过于频繁，请稍后再试',
} = {}) => {
  const getKey = keyGenerator || ((req) => {
    return req.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.get('x-real-ip')
      || req.socket?.remoteAddress
      || 'unknown';
  });

  return (req, res, next) => {
    const key = getKey(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || (now - bucket.windowStart) >= windowMs) {
      bucket = { windowStart: now, count: 0, lastAccess: now };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    bucket.lastAccess = now;

    const remaining = Math.max(0, maxRequests - bucket.count);
    const resetAt = bucket.windowStart + windowMs;

    res.set('X-RateLimit-Limit', String(maxRequests));
    res.set('X-RateLimit-Remaining', String(remaining));
    res.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

    if (bucket.count > maxRequests) {
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    next();
  };
};

/**
 * 全局 API 限流：每个 IP 每分钟 120 次请求
 */
export const globalApiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 120,
  message: '请求过于频繁，请稍后再试',
});

/**
 * 认证相关限流（登录/注册）：每个 IP 每分钟 10 次
 */
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: '登录尝试过于频繁，请稍后再试',
});

/**
 * 写操作限流：每个 IP 每分钟 60 次
 */
export const writeLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: '操作过于频繁，请稍后再试',
});
