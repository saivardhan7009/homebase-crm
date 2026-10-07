// src/controllers/notificationController.js
import { query } from '../config/database.js';
import { success } from '../utils/response.js';

// GET /api/notifications
export const getNotifications = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.user.id]
    );
    const unreadCount = result.rows.filter((n) => !n.read_at).length;
    return success(res, { notifications: result.rows, unreadCount });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/:id/read
export const markRead = async (req, res, next) => {
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    return success(res, { message: 'Marked as read.' });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/notifications/read-all
export const markAllRead = async (req, res, next) => {
  try {
    await query(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL',
      [req.user.id]
    );
    return success(res, { message: 'All notifications marked as read.' });
  } catch (err) {
    next(err);
  }
};
