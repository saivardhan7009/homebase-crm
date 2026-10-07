// src/validators/leadValidator.js
import { body, param } from 'express-validator';
import { validate } from '../middleware/validation.js';

export const validateCreateLead = [
  body('customer_id').isUUID().withMessage('Valid customer ID is required'),
  body('property_id').optional().isUUID().withMessage('Invalid property ID'),
  body('agent_id').optional().isUUID().withMessage('Invalid agent ID'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority level'),
  body('budget_min').optional().isNumeric().withMessage('Budget min must be numeric'),
  body('budget_max').optional().isNumeric().withMessage('Budget max must be numeric'),
  body('notes').optional().isString(),
  validate,
];

export const validateUpdateLead = [
  param('id').isUUID().withMessage('Invalid lead ID format'),
  body('status')
    .optional()
    .isIn([
      'new', 'contacted', 'qualified', 'viewing_scheduled',
      'viewing_completed', 'offer', 'negotiation', 'won', 'lost'
    ])
    .withMessage('Invalid pipeline status'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('budget_min').optional().isNumeric(),
  body('budget_max').optional().isNumeric(),
  validate,
];

export const validateAddActivity = [
  param('id').isUUID().withMessage('Invalid lead ID format'),
  body('type').trim().notEmpty().withMessage('Activity type is required'),
  body('description').trim().notEmpty().withMessage('Activity description is required'),
  validate,
];
