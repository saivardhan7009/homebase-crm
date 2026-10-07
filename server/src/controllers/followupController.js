// src/controllers/followupController.js
import { query } from '../config/database.js';
import { success, created, notFound, error } from '../utils/response.js';

// GET /api/followups — List followups for agent or specific lead
export const getFollowups = async (req, res, next) => {
  try {
    const { lead_id, status } = req.query;
    const userId = req.user.id;
    const role = req.user.role;

    const conditions = [];
    const params = [];
    let idx = 1;

    if (role === 'agent') {
      conditions.push(`fo.agent_id = $${idx++}`);
      params.push(userId);
    }

    if (lead_id) {
      conditions.push(`fo.lead_id = $${idx++}`);
      params.push(lead_id);
    }

    if (status) {
      conditions.push(`fo.status = $${idx++}`);
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
      `SELECT fo.*,
              c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              l.status AS lead_status, l.priority AS lead_priority,
              p.title AS property_title
       FROM followups fo
       JOIN leads l ON l.id = fo.lead_id
       LEFT JOIN customers c ON c.id = l.customer_id
       LEFT JOIN properties p ON p.id = l.property_id
       ${where}
       ORDER BY fo.scheduled_at ASC`,
      params
    );

    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// POST /api/followups — Schedule a new followup
export const createFollowup = async (req, res, next) => {
  try {
    const { lead_id, scheduled_at, type = 'call', notes } = req.body;
    const agentId = req.user.id;

    const result = await query(
      `INSERT INTO followups (lead_id, agent_id, type, scheduled_at, status, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'pending', $5, NOW(), NOW())
       RETURNING *`,
      [lead_id, agentId, type, scheduled_at, notes || null]
    );

    // Update lead's next_followup_at
    await query(
      `UPDATE leads SET next_followup_at = $1, updated_at = NOW() WHERE id = $2`,
      [scheduled_at, lead_id]
    );

    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/followups/:id — Update followup status or schedule
export const updateFollowup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, scheduled_at, notes, result_notes } = req.body;

    const result = await query(
      `UPDATE followups SET
        status = COALESCE($1, status),
        scheduled_at = COALESCE($2, scheduled_at),
        notes = COALESCE($3, notes),
        result_notes = COALESCE($4, result_notes),
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
        updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [status, scheduled_at, notes, result_notes, id]
    );

    if (!result.rows.length) return notFound(res, 'Followup');

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/followups/:id
export const deleteFollowup = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM followups WHERE id = $1', [id]);
    return success(res, { message: 'Followup deleted.' });
  } catch (err) {
    next(err);
  }
};
