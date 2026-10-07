// src/utils/response.js
// Standardized API response helpers

export const success = (res, data, statusCode = 200, meta = {}) => {
  const payload = { success: true, data };
  if (Object.keys(meta).length) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

export const created = (res, data) => success(res, data, 201);

export const paginated = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    meta: {
      page: Number(page),
      limit: Number(limit),
      total: Number(total),
      totalPages: Math.ceil(total / limit),
    },
  });
};

export const error = (res, message, statusCode = 500, details = null) => {
  const payload = { success: false, message };
  if (details && process.env.NODE_ENV === 'development') payload.details = details;
  return res.status(statusCode).json(payload);
};

export const notFound = (res, resource = 'Resource') =>
  error(res, `${resource} not found`, 404);

export const unauthorized = (res, msg = 'Unauthorized') => error(res, msg, 401);

export const forbidden = (res, msg = 'Forbidden') => error(res, msg, 403);

export const validationError = (res, errors) =>
  res.status(422).json({ success: false, message: 'Validation failed', errors });
