// src/routes/agentRoutes.js
import { Router } from 'express';
import {
  getAgents,
  getAgentById,
  getAgentStats,
} from '../controllers/agentController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// Agent personal dashboard stats (Must be before /:id to avoid matching 'me' as an id)
router.get('/me/stats', authenticate, requireRole('agent', 'admin'), getAgentStats);

// Public agent directory and profile
router.get('/', getAgents);
router.get('/:id', getAgentById);

export default router;
