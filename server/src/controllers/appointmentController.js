// src/controllers/appointmentController.js
import { query } from '../config/database.js';
import { success, created, notFound } from '../utils/response.js';

// GET /api/appointments
export const getAppointments = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let q = `
      SELECT a.*, p.title AS property_title, p.city AS property_city,
             c.name AS customer_name, c.phone AS customer_phone,
             u.name AS agent_name
      FROM appointments a
      JOIN properties p ON p.id = a.property_id
      JOIN customers c ON c.id = a.customer_id
      LEFT JOIN users u ON u.id = a.agent_id
    `;

    let params = [];
    if (role === 'agent') {
      q += ' WHERE a.agent_id = $1';
      params = [userId];
    } else if (role === 'customer') {
      q += ' WHERE a.customer_id = (SELECT id FROM customers WHERE user_id = $1 LIMIT 1)';
      params = [userId];
    }

    q += ' ORDER BY a.scheduled_at DESC';

    const result = await query(q, params);
    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/appointments
export const createAppointment = async (req, res, next) => {
  try {
    const { property_id, customer_id, agent_id, scheduled_at, notes } = req.body;
    const result = await query(
      `INSERT INTO appointments (property_id, customer_id, agent_id, scheduled_at, status, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'pending',$5,NOW(),NOW()) RETURNING *`,
      [property_id, customer_id, agent_id || null, scheduled_at, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/appointments/:id
export const updateAppointment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, scheduled_at, notes } = req.body;
    const result = await query(
      `UPDATE appointments SET
        status=COALESCE($1, status),
        scheduled_at=COALESCE($2, scheduled_at),
        notes=COALESCE($3, notes),
        updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, scheduled_at, notes, id]
    );
    if (!result.rows.length) return notFound(res, 'Appointment');
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
