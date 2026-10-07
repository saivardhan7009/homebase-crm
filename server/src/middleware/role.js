// src/middleware/role.js
// Role-based access control middleware

import { forbidden } from '../utils/response.js';

// Usage: requireRole('admin') or requireRole('admin', 'agent')
export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return forbidden(res, 'Authentication required.');
    }
    if (!roles.includes(req.user.role)) {
      return forbidden(res, `Access restricted. Required role: ${roles.join(' or ')}.`);
    }
    next();
  };
};

export const isAdmin = requireRole('admin');
export const isAgent = requireRole('admin', 'agent');
export const isCustomer = requireRole('admin', 'agent', 'customer');
