// src/controllers/leadController.js
import { query } from '../config/database.js';
import { success, created, notFound, error } from '../utils/response.js';
import { buildPagination } from '../utils/formatters.js';

const VALID_STATUSES = [
  'new', 'contacted', 'qualified', 'viewing_scheduled',
  'viewing_completed', 'offer', 'negotiation', 'won', 'lost',
];

// GET /api/leads
export const getLeads = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, priority, agent_id, search } = req.query;
    const { limit: lim, offset, page: pg } = buildPagination(page, limit);

    const conditions = [];
    const params = [];
    let idx = 1;

    // Agents only see their own leads
    if (req.user.role === 'agent') {
      conditions.push(`l.agent_id = $${idx++}`);
      params.push(req.user.id);
    } else if (agent_id) {
      conditions.push(`l.agent_id = $${idx++}`);
      params.push(agent_id);
    }

    if (status) { conditions.push(`l.status = $${idx++}`); params.push(status); }
    if (priority) { conditions.push(`l.priority = $${idx++}`); params.push(priority); }
    if (search) {
      conditions.push(`(LOWER(c.name) LIKE $${idx} OR LOWER(c.email) LIKE $${idx} OR c.phone LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT l.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
             u.name AS agent_name,
             p.title AS property_title, p.city AS property_city
      FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      LEFT JOIN users u ON u.id = l.agent_id
      LEFT JOIN properties p ON p.id = l.property_id
      ${where}
      ORDER BY l.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(lim, offset);

    const countQuery = `
      SELECT COUNT(*) FROM leads l
      LEFT JOIN customers c ON c.id = l.customer_id
      ${where}
    `;
    const countParams = params.slice(0, params.length - 2);

    const [data, count] = await Promise.all([
      query(dataQuery, params),
      query(countQuery, countParams),
    ]);

    const total = parseInt(count.rows[0].count);
    return res.status(200).json({
      success: true,
      data: data.rows,
      meta: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/leads/:id
export const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT l.*, c.name AS customer_name, c.email AS customer_email, c.phone AS customer_phone,
              u.name AS agent_name, p.title AS property_title,
              (SELECT json_agg(la ORDER BY la.created_at DESC) FROM lead_activities la WHERE la.lead_id = l.id) AS activities
       FROM leads l
       LEFT JOIN customers c ON c.id = l.customer_id
       LEFT JOIN users u ON u.id = l.agent_id
       LEFT JOIN properties p ON p.id = l.property_id
       WHERE l.id = $1`,
      [id]
    );
    if (!result.rows.length) return notFound(res, 'Lead');
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/leads
export const createLead = async (req, res, next) => {
  try {
    const {
      customer_id, property_id, agent_id, source, priority = 'medium',
      budget_min, budget_max, preferred_city, preferred_property_type, notes,
    } = req.body;

    const result = await query(
      `INSERT INTO leads
        (customer_id, property_id, agent_id, source, status, priority,
         budget_min, budget_max, preferred_city, preferred_property_type,
         notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'new',$5,$6,$7,$8,$9,$10,NOW(),NOW())
       RETURNING *`,
      [customer_id, property_id || null, agent_id || null, source || 'manual', priority,
       budget_min || null, budget_max || null, preferred_city || null,
       preferred_property_type || null, notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/leads/:id
export const updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT agent_id FROM leads WHERE id = $1', [id]);
    if (!existing.rows.length) return notFound(res, 'Lead');

    const {
      status, priority, agent_id, budget_min, budget_max,
      preferred_city, preferred_property_type, notes,
      next_followup_at, last_contact_at,
    } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return error(res, `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);
    }

    const result = await query(
      `UPDATE leads SET
        status=COALESCE($1, status), priority=COALESCE($2, priority),
        agent_id=COALESCE($3, agent_id), budget_min=COALESCE($4, budget_min),
        budget_max=COALESCE($5, budget_max), preferred_city=COALESCE($6, preferred_city),
        preferred_property_type=COALESCE($7, preferred_property_type),
        notes=COALESCE($8, notes), next_followup_at=COALESCE($9, next_followup_at),
        last_contact_at=COALESCE($10, last_contact_at), updated_at=NOW()
       WHERE id=$11 RETURNING *`,
      [status, priority, agent_id, budget_min, budget_max, preferred_city,
       preferred_property_type, notes, next_followup_at, last_contact_at, id]
    );

    // Log activity
    if (status) {
      await query(
        `INSERT INTO lead_activities (lead_id, type, description, created_by, created_at)
         VALUES ($1, 'status_change', $2, $3, NOW())`,
        [id, `Status changed to ${status}`, req.user.id]
      );
    }

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/leads/:id
export const deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT id FROM leads WHERE id = $1', [id]);
    if (!existing.rows.length) return notFound(res, 'Lead');
    await query('DELETE FROM leads WHERE id = $1', [id]);
    return success(res, { message: 'Lead deleted.' });
  } catch (err) {
    next(err);
  }
};

// POST /api/leads/:id/activities
export const addLeadActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, description } = req.body;
    const result = await query(
      `INSERT INTO lead_activities (lead_id, type, description, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [id, type, description, req.user.id]
    );
    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
