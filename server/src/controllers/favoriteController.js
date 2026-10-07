// src/controllers/favoriteController.js
import { query } from '../config/database.js';
import { success, created, error } from '../utils/response.js';

// GET /api/favorites
export const getFavorites = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT f.id, f.notes, f.created_at,
        p.id AS property_id, p.title, p.price, p.property_type, p.listing_type,
        p.bedrooms, p.bathrooms, p.sqft, p.city, p.state, p.status, p.verified,
        (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
       FROM favorites f
       JOIN properties p ON p.id = f.property_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/favorites
export const addFavorite = async (req, res, next) => {
  try {
    const { property_id, notes } = req.body;

    // Prevent duplicates
    const existing = await query(
      'SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2',
      [req.user.id, property_id]
    );
    if (existing.rows.length) {
      return error(res, 'Property already in favorites.', 409);
    }

    const result = await query(
      'INSERT INTO favorites (user_id, property_id, notes, created_at) VALUES ($1,$2,$3,NOW()) RETURNING *',
      [req.user.id, property_id, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/favorites/:propertyId
export const removeFavorite = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    await query(
      'DELETE FROM favorites WHERE user_id = $1 AND property_id = $2',
      [req.user.id, propertyId]
    );
    return success(res, { message: 'Removed from favorites.' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/favorites/:propertyId/notes
export const updateFavoriteNotes = async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const { notes } = req.body;
    const result = await query(
      'UPDATE favorites SET notes=$1 WHERE user_id=$2 AND property_id=$3 RETURNING *',
      [notes, req.user.id, propertyId]
    );
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
