// src/middleware/validation.js
import { validationResult } from 'express-validator';
import { validationError } from '../utils/response.js';

// Run this after express-validator chains to short-circuit invalid requests
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationError(res, errors.array());
  }
  next();
};
