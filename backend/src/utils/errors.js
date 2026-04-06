/**
 * Application-level error with HTTP status code.
 * Thrown from services, caught by the global error handler.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Not authorized') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
    this.name = 'BadRequestError';
  }
}

module.exports = { AppError, NotFoundError, ConflictError, ForbiddenError, BadRequestError };
