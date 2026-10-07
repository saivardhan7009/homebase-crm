// src/routes/followupRoutes.js
import { Router } from 'express';
import {
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup,
} from '../controllers/followupController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate, requireRole('agent', 'admin'));

router.get('/', getFollowups);
router.post('/', createFollowup);
router.put('/:id', updateFollowup);
router.delete('/:id', deleteFollowup);

export default router;
