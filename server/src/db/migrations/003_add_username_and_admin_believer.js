// src/db/migrations/003_add_username_and_admin_believer.js
import bcrypt from 'bcryptjs';
import { query } from '../../config/database.js';

async function updateAdmin() {
  try {
    console.log('🔄 Adding username column and setting up admin believer...');

    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(100) UNIQUE;
    `);

    const hash = await bcrypt.hash('Sai@7009', 12);

    // Update existing admin or insert new believer admin
    const existing = await query("SELECT id FROM users WHERE email = 'believer@homebase.com' OR username = 'believer' OR email = 'admin@homebase.com'");
    
    if (existing.rows.length > 0) {
      await query(
        `UPDATE users SET
          username = 'believer',
          email = 'believer@homebase.com',
          name = 'Admin Believer',
          password_hash = $1,
          role = 'admin',
          failed_attempts = 0,
          locked_until = NULL,
          updated_at = NOW()
         WHERE id = $2`,
        [hash, existing.rows[0].id]
      );
      console.log('✅ Updated existing admin account to username "believer" with password "Sai@7009"');
    } else {
      await query(
        `INSERT INTO users (username, name, email, password_hash, role, phone, created_at, updated_at)
         VALUES ('believer', 'Admin Believer', 'believer@homebase.com', $1, 'admin', '+91 98765 43210', NOW(), NOW())`,
        [hash]
      );
      console.log('✅ Created new admin believer account with password "Sai@7009"');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to update admin:', err);
    process.exit(1);
  }
}

updateAdmin();
