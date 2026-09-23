function errorHandler(err, req, res, next) {
  console.error('[API Error]:', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.originalUrl,
    method: req.method,
    studioId: req.studioId || null,
    userId: req.user ? req.user.id : null,
  });

  const statusCode = err.statusCode || 500;
  const message = err.isPublic || process.env.NODE_ENV === 'development' 
    ? err.message 
    : 'Internal server error';

  res.status(statusCode).json({
    error: message,
    code: err.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { details: err.details })
  });
}

module.exports = errorHandler;
