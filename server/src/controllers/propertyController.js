// src/controllers/propertyController.js
import { query } from '../config/database.js';
import { success, created, notFound, error } from '../utils/response.js';
import { buildPagination } from '../utils/formatters.js';

// GET /api/properties — paginated, filterable
export const getProperties = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 12, city, state, property_type, listing_type,
      status, min_price, max_price, min_beds, max_beds, min_baths,
      min_sqft, max_sqft, verified, sort = 'newest',
      parking, pool, gym, furnished, pet_friendly,
      search, // free-text
    } = req.query;

    const { limit: lim, offset, page: pg } = buildPagination(page, limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (city) { conditions.push(`LOWER(p.city) LIKE $${idx++}`); params.push(`%${city.toLowerCase()}%`); }
    if (state) { conditions.push(`LOWER(p.state) LIKE $${idx++}`); params.push(`%${state.toLowerCase()}%`); }
    if (property_type) { conditions.push(`p.property_type = $${idx++}`); params.push(property_type); }
    if (listing_type) { conditions.push(`p.listing_type = $${idx++}`); params.push(listing_type); }
    if (status) { conditions.push(`p.status = $${idx++}`); params.push(status); }
    if (min_price) { conditions.push(`p.price >= $${idx++}`); params.push(Number(min_price)); }
    if (max_price) { conditions.push(`p.price <= $${idx++}`); params.push(Number(max_price)); }
    if (min_beds) { conditions.push(`p.bedrooms >= $${idx++}`); params.push(Number(min_beds)); }
    if (max_beds) { conditions.push(`p.bedrooms <= $${idx++}`); params.push(Number(max_beds)); }
    if (min_baths) { conditions.push(`p.bathrooms >= $${idx++}`); params.push(Number(min_baths)); }
    if (min_sqft) { conditions.push(`p.sqft >= $${idx++}`); params.push(Number(min_sqft)); }
    if (max_sqft) { conditions.push(`p.sqft <= $${idx++}`); params.push(Number(max_sqft)); }
    if (verified === 'true') { conditions.push(`p.verified = true`); }

    // Full-text search
    if (search) {
      conditions.push(`p.fts_vector @@ plainto_tsquery('english', $${idx++})`);
      params.push(search);
    }

    // Amenity filters
    const amenityFilters = { parking, pool, gym, furnished, pet_friendly };
    for (const [amenity, val] of Object.entries(amenityFilters)) {
      if (val === 'true') {
        conditions.push(
          `EXISTS (SELECT 1 FROM property_amenities pa WHERE pa.property_id = p.id AND pa.amenity = $${idx++})`
        );
        params.push(amenity);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortMap = {
      newest: 'p.created_at DESC',
      oldest: 'p.created_at ASC',
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      sqft_desc: 'p.sqft DESC',
      beds_desc: 'p.bedrooms DESC',
    };
    const orderBy = sortMap[sort] || 'p.created_at DESC';

    const dataQuery = `
      SELECT
        p.*,
        u.name AS agent_name, u.phone AS agent_phone,
        (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image,
        (SELECT COUNT(*) FROM property_views WHERE property_id = p.id) AS view_count,
        (SELECT COUNT(*) FROM favorites WHERE property_id = p.id) AS favorite_count
      FROM properties p
      LEFT JOIN users u ON u.id = p.agent_id
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${idx++} OFFSET $${idx++}
    `;
    params.push(lim, offset);

    const countQuery = `SELECT COUNT(*) FROM properties p ${where}`;
    const countParams = params.slice(0, params.length - 2);

    const [dataResult, countResult] = await Promise.all([
      query(dataQuery, params),
      query(countQuery, countParams),
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

// GET /api/properties/:id
export const getPropertyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT p.*,
        u.name AS agent_name, u.email AS agent_email, u.phone AS agent_phone, u.avatar_url AS agent_avatar,
        (SELECT json_agg(pi ORDER BY pi.sort_order) FROM property_images pi WHERE pi.property_id = p.id) AS images,
        (SELECT json_agg(pa.amenity) FROM property_amenities pa WHERE pa.property_id = p.id) AS amenities,
        (SELECT json_agg(json_build_object('feature', pf.feature, 'value', pf.value)) FROM property_features pf WHERE pf.property_id = p.id) AS features
       FROM properties p
       LEFT JOIN users u ON u.id = p.agent_id
       WHERE p.id = $1`,
      [id]
    );

    if (!result.rows.length) return notFound(res, 'Property');

    // Record view (fire-and-forget)
    const userId = req.user?.id || null;
    query(
      'INSERT INTO property_views (property_id, user_id, created_at) VALUES ($1, $2, NOW())',
      [id, userId]
    ).catch(() => {});

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// POST /api/properties
export const createProperty = async (req, res, next) => {
  try {
    const {
      title, description, price, property_type, listing_type,
      bedrooms, bathrooms, sqft, address, city, state, zip,
      latitude, longitude, year_built, amenities = [], features = [], images = [],
    } = req.body;

    const pricePerSqft = sqft && sqft > 0 ? Math.round(price / sqft) : null;

    const result = await query(
      `INSERT INTO properties
        (title, description, price, price_per_sqft, property_type, listing_type, status,
         bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude,
         year_built, agent_id, verified, verification_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,false,'pending',NOW(),NOW())
       RETURNING *`,
      [title, description, price, pricePerSqft, property_type, listing_type,
       bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude,
       year_built, req.user.id]
    );

    const property = result.rows[0];

    // Insert amenities
    if (amenities.length) {
      const amenityValues = amenities.map((_, i) => `($1, $${i + 2})`).join(', ');
      await query(
        `INSERT INTO property_amenities (property_id, amenity) VALUES ${amenityValues}`,
        [property.id, ...amenities]
      );
    }

    // Insert images
    if (images.length) {
      for (let i = 0; i < images.length; i++) {
        await query(
          'INSERT INTO property_images (property_id, url, is_primary, sort_order) VALUES ($1, $2, $3, $4)',
          [property.id, images[i].url, i === 0, i]
        );
      }
    }

    return created(res, property);
  } catch (err) {
    next(err);
  }
};

// PUT /api/properties/:id
export const updateProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT agent_id FROM properties WHERE id = $1', [id]);
    if (!existing.rows.length) return notFound(res, 'Property');

    // Only agent who owns or admin can update
    if (req.user.role !== 'admin' && existing.rows[0].agent_id !== req.user.id) {
      return error(res, 'You do not have permission to edit this property.', 403);
    }

    const {
      title, description, price, property_type, listing_type, status,
      bedrooms, bathrooms, sqft, address, city, state, zip,
      latitude, longitude, year_built,
    } = req.body;

    const pricePerSqft = sqft && sqft > 0 ? Math.round(price / sqft) : null;

    const result = await query(
      `UPDATE properties SET
        title=$1, description=$2, price=$3, price_per_sqft=$4,
        property_type=$5, listing_type=$6, status=$7, bedrooms=$8,
        bathrooms=$9, sqft=$10, address=$11, city=$12, state=$13, zip=$14,
        latitude=$15, longitude=$16, year_built=$17, updated_at=NOW()
       WHERE id=$18 RETURNING *`,
      [title, description, price, pricePerSqft, property_type, listing_type, status,
       bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude,
       year_built, id]
    );

    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// DELETE /api/properties/:id
export const deleteProperty = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT agent_id FROM properties WHERE id = $1', [id]);
    if (!existing.rows.length) return notFound(res, 'Property');

    if (req.user.role !== 'admin' && existing.rows[0].agent_id !== req.user.id) {
      return error(res, 'You do not have permission to delete this property.', 403);
    }

    await query('DELETE FROM properties WHERE id = $1', [id]);
    return success(res, { message: 'Property deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id/similar
export const getSimilarProperties = async (req, res, next) => {
  try {
    const { id } = req.params;
    const prop = await query('SELECT city, property_type, price, bedrooms FROM properties WHERE id = $1', [id]);
    if (!prop.rows.length) return notFound(res, 'Property');

    const { city, property_type, price, bedrooms } = prop.rows[0];
    const result = await query(
      `SELECT p.*, (SELECT url FROM property_images WHERE property_id = p.id AND is_primary = true LIMIT 1) AS primary_image
       FROM properties p
       WHERE p.id != $1
         AND p.city = $2
         AND p.property_type = $3
         AND p.price BETWEEN $4 AND $5
       ORDER BY ABS(p.bedrooms - $6)
       LIMIT 6`,
      [id, city, property_type, price * 0.7, price * 1.3, bedrooms]
    );

    return success(res, result.rows);
  } catch (err) {
    next(err);
  }
};

// GET /api/properties/:id/analytics
export const getPropertyAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [views, favorites, enquiries, appointments] = await Promise.all([
      query('SELECT COUNT(*) FROM property_views WHERE property_id = $1', [id]),
      query('SELECT COUNT(*) FROM favorites WHERE property_id = $1', [id]),
      query('SELECT COUNT(*) FROM property_enquiries WHERE property_id = $1', [id]),
      query('SELECT COUNT(*) FROM appointments WHERE property_id = $1', [id]),
    ]);

    return success(res, {
      views: parseInt(views.rows[0].count),
      favorites: parseInt(favorites.rows[0].count),
      enquiries: parseInt(enquiries.rows[0].count),
      appointments: parseInt(appointments.rows[0].count),
    });
  } catch (err) {
    next(err);
  }
};
