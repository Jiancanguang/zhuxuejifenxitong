export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

export const sendSuccess = (res, data = {}, status = 200) => {
  res.status(status).json({ success: true, data });
};

export const notFoundApiHandler = (req, res) => {
  res.status(404).json({ success: false, message: '接口不存在' });
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (!(error instanceof HttpError)) {
    console.error('[server] Unhandled error:', error);
  }

  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof HttpError ? error.message : '服务器内部错误';
  const extra = error instanceof HttpError ? error.extra : {};

  res.status(status).json({
    success: false,
    message,
    ...extra,
  });
};
