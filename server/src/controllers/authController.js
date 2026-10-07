// src/controllers/authController.js
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { success, created, error, unauthorized } from '../utils/response.js';

const signToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    env.jwt.secret,
    { expiresIn: env.jwt.expiresIn }
  );

// POST /api/auth/register
export const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'customer', phone } = req.body;

    // Check duplicate
    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length) {
      return error(res, 'An account with this email already exists.', 409);
    }

    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, name, email, role, phone, created_at`,
      [name.trim(), email.toLowerCase(), hash, role, phone || null]
    );

    const user = result.rows[0];
    const token = signToken(user);

    return created(res, { token, user });
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (username || email || '').toLowerCase().trim();

    if (!identifier || !password) {
      return unauthorized(res, 'Username and password are required.');
    }

    const result = await query(
      'SELECT id, name, email, username, password_hash, role, phone, avatar_url FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1',
      [identifier]
    );

    if (!result.rows.length) {
      return unauthorized(res, 'Invalid username or password.');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return unauthorized(res, 'Invalid username or password.');
    }

    // Update last login
    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken(user);
    const { password_hash, ...safeUser } = user;

    return success(res, { token, user: safeUser });
  } catch (err) {
    next(err);
  }
};

// GET /api/auth/me
export const getMe = async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id, name, email, role, phone, avatar_url, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return error(res, 'User not found.', 404);
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/profile
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET name=$1, phone=$2, avatar_url=$3, updated_at=NOW()
       WHERE id=$4
       RETURNING id, name, email, role, phone, avatar_url`,
      [name, phone, avatar_url, req.user.id]
    );
    return success(res, result.rows[0]);
  } catch (err) {
    next(err);
  }
};
