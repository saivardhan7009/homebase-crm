// src/controllers/analyticsController.js
import { query } from '../config/database.js';
import { success } from '../utils/response.js';

// GET /api/analytics/dashboard
export const getDashboard = async (req, res, next) => {
  try {
    const [
      propertyCounts, leadCounts, customerCount, agentCount,
      recentLeads, topCities, propertyTypes, monthlyListings,
    ] = await Promise.all([
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'active') AS active,
          COUNT(*) FILTER (WHERE status = 'sold') AS sold,
          COUNT(*) FILTER (WHERE status = 'rented') AS rented,
          COUNT(*) FILTER (WHERE verified = true) AS verified
        FROM properties
      `),
      query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'new') AS new_leads,
          COUNT(*) FILTER (WHERE status = 'won') AS won,
          COUNT(*) FILTER (WHERE status = 'lost') AS lost
        FROM leads
      `),
      query('SELECT COUNT(*) FROM customers'),
      query('SELECT COUNT(*) FROM users WHERE role = $1', ['agent']),
      query(`
        SELECT l.id, l.status, l.priority, c.name AS customer_name, l.created_at
        FROM leads l JOIN customers c ON c.id = l.customer_id
        ORDER BY l.created_at DESC LIMIT 5
      `),
      query(`
        SELECT city, COUNT(*) AS count, AVG(price)::BIGINT AS avg_price
        FROM properties WHERE city IS NOT NULL
        GROUP BY city ORDER BY count DESC LIMIT 6
      `),
      query(`
        SELECT property_type, COUNT(*) AS count
        FROM properties GROUP BY property_type ORDER BY count DESC
      `),
      query(`
        SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS count
        FROM properties
        WHERE created_at >= NOW() - INTERVAL '6 months'
        GROUP BY month ORDER BY month
      `),
    ]);

    return success(res, {
      properties: propertyCounts.rows[0],
      leads: leadCounts.rows[0],
      customers: parseInt(customerCount.rows[0].count),
      agents: parseInt(agentCount.rows[0].count),
      recentLeads: recentLeads.rows,
      topCities: topCities.rows,
      propertyTypes: propertyTypes.rows,
      monthlyListings: monthlyListings.rows,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/market-insights
export const getMarketInsights = async (req, res, next) => {
  try {
    const { city } = req.query;

    const filter = city ? 'WHERE LOWER(city) = $1' : '';
    const params = city ? [city.toLowerCase()] : [];

    const result = await query(
      `SELECT
        city,
        COUNT(*) AS total_listings,
        AVG(price)::BIGINT AS avg_price,
        AVG(price_per_sqft)::INT AS avg_price_per_sqft,
        MIN(price) AS min_price,
        MAX(price) AS max_price,
        COUNT(*) FILTER (WHERE status = 'sold') AS sold_count,
        COUNT(*) FILTER (WHERE listing_type = 'rent') AS rental_count,
        COUNT(*) FILTER (WHERE listing_type = 'buy') AS sale_count
       FROM properties ${filter}
       GROUP BY city
       ORDER BY total_listings DESC
       LIMIT 10`,
      params
    );

    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};
