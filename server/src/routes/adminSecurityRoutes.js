// src/routes/adminSecurityRoutes.js
import { Router } from 'express';
import {
  adminLoginEnhanced,
  getSecurityLogs,
  getSecurityStats,
  updateSecurityPin,
} from '../controllers/adminSecurityController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Enhanced Dual-Factor Admin Login
router.post('/login', authLimiter, adminLoginEnhanced);

// Protected Admin Security Endpoints
router.use(authenticate, requireRole('admin'));

router.get('/logs', getSecurityLogs);
router.get('/stats', getSecurityStats);
router.post('/update-pin', updateSecurityPin);

export default router;
