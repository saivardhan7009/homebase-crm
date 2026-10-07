// src/controllers/customerController.js
import { query } from '../config/database.js';
import { success, created, notFound } from '../utils/response.js';
import { buildPagination } from '../utils/formatters.js';

// GET /api/customers
export const getCustomers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const { limit: lim, offset, page: pg } = buildPagination(page, limit);

    const conditions = [];
    const params = [];
    let idx = 1;

    if (search) {
      conditions.push(`(LOWER(c.name) LIKE $${idx} OR LOWER(c.email) LIKE $${idx} OR c.phone LIKE $${idx})`);
      params.push(`%${search.toLowerCase()}%`);
      idx++;
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [data, count] = await Promise.all([
      query(
        `SELECT c.*,
          (SELECT COUNT(*) FROM leads WHERE customer_id = c.id) AS lead_count,
          (SELECT COUNT(*) FROM favorites WHERE user_id = c.user_id) AS favorite_count,
          (SELECT COUNT(*) FROM appointments WHERE customer_id = c.id) AS appointment_count
         FROM customers c ${where}
         ORDER BY c.created_at DESC LIMIT $${idx++} OFFSET $${idx++}`,
        [...params, lim, offset]
      ),
      query(`SELECT COUNT(*) FROM customers c ${where}`, params),
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

// GET /api/customers/:id — 360 profile
export const getCustomerById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [customer, leads, favorites, appointments, followups] = await Promise.all([
      query('SELECT * FROM customers WHERE id = $1', [id]),
      query(
        `SELECT l.*, p.title AS property_title FROM leads l
         LEFT JOIN properties p ON p.id = l.property_id
         WHERE l.customer_id = $1 ORDER BY l.created_at DESC LIMIT 10`,
        [id]
      ),
      query(
        `SELECT f.*, p.title, p.city, p.price, p.property_type,
          (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS image
         FROM favorites f
         JOIN properties p ON p.id = f.property_id
         WHERE f.user_id = (SELECT user_id FROM customers WHERE id = $1)
         ORDER BY f.created_at DESC LIMIT 10`,
        [id]
      ),
      query(
        `SELECT a.*, p.title AS property_title FROM appointments a
         LEFT JOIN properties p ON p.id = a.property_id
         WHERE a.customer_id = $1 ORDER BY a.scheduled_at DESC LIMIT 10`,
        [id]
      ),
      query(
        `SELECT fo.* FROM followups fo
         JOIN leads l ON l.id = fo.lead_id
         WHERE l.customer_id = $1 ORDER BY fo.scheduled_at DESC LIMIT 10`,
        [id]
      ),
    ]);

    if (!customer.rows.length) return notFound(res, 'Customer');

    return success(res, {
      ...customer.rows[0],
      leads: leads.rows,
      favorites: favorites.rows,
      appointments: appointments.rows,
      followups: followups.rows,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/customers
export const createCustomer = async (req, res, next) => {
  try {
    const { user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes } = req.body;
    const result = await query(
      `INSERT INTO customers (user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW()) RETURNING *`,
      [user_id || null, name, email, phone || null, budget_min || null, budget_max || null,
       preferred_cities || [], preferred_types || [], notes || null]
    );
    return created(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/customers/:id
export const updateCustomer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes } = req.body;
    const result = await query(
      `UPDATE customers SET name=$1, email=$2, phone=$3, budget_min=$4, budget_max=$5,
       preferred_cities=$6, preferred_types=$7, notes=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes, id]
    );
    if (!result.rows.length) return notFound(res, 'Customer');
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
