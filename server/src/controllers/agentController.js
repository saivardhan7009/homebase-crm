// src/controllers/agentController.js
import { query } from '../config/database.js';
import { success, notFound, error } from '../utils/response.js';
import { buildPagination } from '../utils/formatters.js';

// GET /api/agents — List verified agents with statistics
export const getAgents = async (req, res, next) => {
  try {
    const { page = 1, limit = 12, city, search } = req.query;
    const { limit: lim, offset, page: pg } = buildPagination(page, limit);

    const conditions = ["u.role = 'agent'"];
    const params = [];
    let idx = 1;

    if (city) {
      conditions.push(`EXISTS (SELECT 1 FROM properties p WHERE p.agent_id = u.id AND LOWER(p.city) LIKE $${idx})`);
      params.push(`%${city.toLowerCase()}%`);
      idx++;
    }

    if (search) {
      conditions.push(`(LOWER(u.name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR u.phone LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT
          u.id, u.name, u.email, u.phone, u.avatar_url, u.created_at,
          (SELECT COUNT(*) FROM properties WHERE agent_id = u.id AND status = 'active') AS active_listings_count,
          (SELECT COUNT(*) FROM properties WHERE agent_id = u.id AND status = 'sold') AS sold_listings_count,
          (SELECT COUNT(*) FROM leads WHERE agent_id = u.id) AS total_leads_count,
          (SELECT json_agg(DISTINCT city) FROM properties WHERE agent_id = u.id AND city IS NOT NULL) AS operating_cities
         FROM users u
         ${where}
         ORDER BY active_listings_count DESC, u.created_at DESC
         LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, lim, offset]
      ),
      query(`SELECT COUNT(*) FROM users u ${where}`, params),
    ]);

    const total = parseInt(countResult.rows[0].count);
    return res.status(200).json({
      success: true,
      data: dataResult.rows,
      meta: { page: pg, limit: lim, total, totalPages: Math.ceil(total / lim) },
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/agents/:id — Agent public profile with listings
export const getAgentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const agentResult = await query(
      `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.role, u.created_at,
        (SELECT COUNT(*) FROM properties WHERE agent_id = u.id AND status = 'active') AS active_listings_count,
        (SELECT COUNT(*) FROM properties WHERE agent_id = u.id AND status = 'sold') AS sold_listings_count,
        (SELECT COUNT(*) FROM leads WHERE agent_id = u.id) AS total_leads_count
       FROM users u
       WHERE u.id = $1 AND u.role IN ('agent', 'admin')`,
      [id]
    );

    if (!agentResult.rows.length) {
      return notFound(res, 'Agent');
    }

    const listingsResult = await query(
      `SELECT p.*,
        (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
       FROM properties p
       WHERE p.agent_id = $1
       ORDER BY p.created_at DESC
       LIMIT 12`,
      [id]
    );

    return success(res, {
      ...agentResult.rows[0],
      listings: listingsResult.rows,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/agents/me/stats — Agent personal dashboard metrics
export const getAgentStats = async (req, res, next) => {
  try {
    const agentId = req.user.id;

    const [listings, leads, appointments, recentActivities] = await Promise.all([
      query(
        `SELECT
          COUNT(*) AS total_properties,
          COUNT(*) FILTER (WHERE status = 'active') AS active_properties,
          COUNT(*) FILTER (WHERE status = 'sold') AS sold_properties,
          COUNT(*) FILTER (WHERE status = 'rented') AS rented_properties,
          COALESCE(SUM(price) FILTER (WHERE status = 'sold'), 0) AS total_sales_volume
         FROM properties WHERE agent_id = $1`,
        [agentId]
      ),
      query(
        `SELECT
          COUNT(*) AS total_leads,
          COUNT(*) FILTER (WHERE status = 'new') AS new_leads,
          COUNT(*) FILTER (WHERE status = 'won') AS won_leads,
          COUNT(*) FILTER (WHERE status IN ('contacted', 'qualified', 'viewing_scheduled', 'negotiation')) AS in_progress_leads
         FROM leads WHERE agent_id = $1`,
        [agentId]
      ),
      query(
        `SELECT
          COUNT(*) AS total_appointments,
          COUNT(*) FILTER (WHERE scheduled_at >= NOW() AND status = 'pending') AS upcoming_appointments
         FROM appointments WHERE agent_id = $1`,
        [agentId]
      ),
      query(
        `SELECT la.*, l.status AS lead_status, c.name AS customer_name
         FROM lead_activities la
         JOIN leads l ON l.id = la.lead_id
         LEFT JOIN customers c ON c.id = l.customer_id
         WHERE l.agent_id = $1
         ORDER BY la.created_at DESC LIMIT 10`,
        [agentId]
      ),
    ]);

    return success(res, {
      listings: listings.rows[0],
      leads: leads.rows[0],
      appointments: appointments.rows[0],
      recentActivities: recentActivities.rows,
    });
  } catch (err) {
    next(err);
  }
};
