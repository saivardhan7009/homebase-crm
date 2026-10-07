// src/middleware/auth.js
// JWT authentication middleware

import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/response.js';

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return unauthorized(res, 'No authentication token provided.');
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded; // { id, email, role, name }
    next();
  } catch (err) {
    return next(err); // handled by errorHandler (JWT errors)
  }
};

// Optional auth — attaches user if token present, but doesn't block
export const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const token = header.split(' ')[1];
      req.user = jwt.verify(token, env.jwt.secret);
    } catch {
      req.user = null;
    }
  }
  next();
};
