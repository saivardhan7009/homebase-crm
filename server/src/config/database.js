// src/config/database.js
// PostgreSQL connection pool — shared across the entire app
import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const pool = new Pool({
  host: env.db.host,
  port: env.db.port,
  database: env.db.name,
  user: env.db.user,
  password: env.db.password,
  max: 20,               // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
  } else {
    console.log(`✅ PostgreSQL connected → ${env.db.name} @ ${env.db.host}:${env.db.port}`);
    release();
  }
});

// Helper: run a query with params
export const query = (text, params) => pool.query(text, params);

// Helper: get a client for transactions
export const getClient = () => pool.connect();

export default pool;
