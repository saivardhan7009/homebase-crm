// src/routes/assistantRoutes.js
import { Router } from 'express';
import {
  searchPropertiesNL,
  chatWithAssistant,
} from '../controllers/assistantController.js';
import { aiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/search-nl', searchPropertiesNL);
router.post('/chat', aiLimiter, chatWithAssistant);

export default router;
