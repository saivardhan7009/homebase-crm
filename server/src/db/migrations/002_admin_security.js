// src/db/migrations/002_admin_security.js
import { query } from '../../config/database.js';

async function migrate() {
  try {
    console.log('🔒 Applying Admin Security Migration...');
    await query(`
      CREATE TABLE IF NOT EXISTS admin_security_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          email VARCHAR(255) NOT NULL,
          event_type VARCHAR(100) NOT NULL,
          ip_address VARCHAR(100),
          user_agent TEXT,
          status VARCHAR(50) NOT NULL,
          details JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_pin VARCHAR(255) DEFAULT '889900';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

      CREATE INDEX IF NOT EXISTS idx_admin_logs_created ON admin_security_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_email ON admin_security_logs(email);
    `);
    console.log('✅ Admin security migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
