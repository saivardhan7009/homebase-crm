// src/routes/favoriteRoutes.js
import { Router } from 'express';
import {
  getFavorites,
  addFavorite,
  removeFavorite,
  updateFavoriteNotes,
} from '../controllers/favoriteController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getFavorites);
router.post('/', addFavorite);
router.delete('/:propertyId', removeFavorite);
router.patch('/:propertyId/notes', updateFavoriteNotes);

export default router;
