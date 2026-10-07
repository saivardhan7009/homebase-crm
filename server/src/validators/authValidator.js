// src/validators/authValidator.js
import { body } from 'express-validator';
import { validate } from '../middleware/validation.js';

export const validateRegister = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['customer', 'agent', 'admin']).withMessage('Role must be customer, agent, or admin'),
  body('phone').optional().isString().trim(),
  validate,
];

export const validateLogin = [
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

export const validateUpdateProfile = [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('phone').optional().isString().trim(),
  body('avatar_url').optional().isURL().withMessage('Avatar must be a valid URL'),
  validate,
];
