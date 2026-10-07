// src/routes/analyticsRoutes.js
import { Router } from 'express';
import {
  getDashboard,
  getMarketInsights,
} from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// Public / open market intelligence
router.get('/market-insights', getMarketInsights);

// Secured executive & agent dashboard analytics
router.get('/dashboard', authenticate, requireRole('agent', 'admin'), getDashboard);

export default router;
