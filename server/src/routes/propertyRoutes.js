// src/routes/propertyRoutes.js
import { Router } from 'express';
import {
  getProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  getSimilarProperties,
  getPropertyAnalytics,
} from '../controllers/propertyController.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import {
  validateCreateProperty,
  validateUpdateProperty,
  validatePropertyId,
} from '../validators/propertyValidator.js';

const router = Router();

// Public / Authenticated listings
router.get('/', optionalAuth, getProperties);
router.get('/:id', optionalAuth, validatePropertyId, getPropertyById);
router.get('/:id/similar', validatePropertyId, getSimilarProperties);

// Agent / Admin operations
router.post('/', authenticate, requireRole('agent', 'admin'), validateCreateProperty, createProperty);
router.put('/:id', authenticate, requireRole('agent', 'admin'), validateUpdateProperty, updateProperty);
router.delete('/:id', authenticate, requireRole('agent', 'admin'), validatePropertyId, deleteProperty);
router.get('/:id/analytics', authenticate, requireRole('agent', 'admin'), validatePropertyId, getPropertyAnalytics);

export default router;
