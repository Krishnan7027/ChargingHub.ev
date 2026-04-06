function errorHandler(err, req, res, _next) {
  // Log all errors in dev, only 5xx in production
  if (process.env.NODE_ENV !== 'production' || !err.statusCode || err.statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, err.message);
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    const response = { error: 'Resource already exists' };
    if (process.env.NODE_ENV !== 'production') response.detail = err.detail;
    return res.status(409).json(response);
  }

  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    const response = { error: 'Referenced resource not found' };
    if (process.env.NODE_ENV !== 'production') response.detail = err.detail;
    return res.status(400).json(response);
  }

  // PostgreSQL check constraint
  if (err.code === '23514') {
    const response = { error: 'Validation constraint failed' };
    if (process.env.NODE_ENV !== 'production') response.detail = err.detail;
    return res.status(400).json(response);
  }

  // Application errors carry their own status code
  const status = err.statusCode || 500;
  const message = status === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
