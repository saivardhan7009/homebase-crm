// src/utils/formatters.js
// Price, date, and string formatters

export const formatPrice = (price) => {
  if (!price) return '₹0';
  const num = Number(price);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString('en-IN')}`;
};

export const formatPricePerSqft = (price, sqft) => {
  if (!price || !sqft || sqft === 0) return null;
  return Math.round(price / sqft);
};

export const buildPagination = (page = 1, limit = 12) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, Math.max(1, parseInt(limit)));
  const offset = (p - 1) * l;
  return { page: p, limit: l, offset };
};

export const slugify = (str) =>
  str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();

export const sanitizeString = (str) =>
  typeof str === 'string' ? str.trim().replace(/[<>"']/g, '') : str;
