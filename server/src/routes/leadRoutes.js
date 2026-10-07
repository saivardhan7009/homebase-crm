// src/routes/leadRoutes.js
import { Router } from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  addLeadActivity,
} from '../controllers/leadController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import {
  validateCreateLead,
  validateUpdateLead,
  validateAddActivity,
} from '../validators/leadValidator.js';

const router = Router();

// Agents & Admins can access leads
router.get('/', authenticate, requireRole('agent', 'admin'), getLeads);
router.get('/:id', authenticate, requireRole('agent', 'admin'), getLeadById);
router.post('/', authenticate, validateCreateLead, createLead);
router.put('/:id', authenticate, requireRole('agent', 'admin'), validateUpdateLead, updateLead);
router.delete('/:id', authenticate, requireRole('admin'), deleteLead);
router.post('/:id/activities', authenticate, requireRole('agent', 'admin'), validateAddActivity, addLeadActivity);

export default router;
