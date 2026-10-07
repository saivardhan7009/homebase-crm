// src/db/migrateAndSeed.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

async function run() {
  console.log('🔄 Checking database existence and connecting...');

  // 1. Connect to default 'postgres' database first to create 'realestate_crm' if missing
  const adminClient = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const checkDb = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [env.db.name]
    );

    if (checkDb.rows.length === 0) {
      console.log(`📦 Creating database '${env.db.name}'...`);
      await adminClient.query(`CREATE DATABASE "${env.db.name}"`);
      console.log(`✅ Database '${env.db.name}' created successfully.`);
    } else {
      console.log(`ℹ️ Database '${env.db.name}' already exists.`);
    }
  } catch (err) {
    console.error('⚠️ Admin client error:', err.message);
  } finally {
    await adminClient.end();
  }

  // 2. Connect to the target realestate_crm database
  const targetClient = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
  });

  try {
    await targetClient.connect();
    console.log(`✅ Connected to '${env.db.name}'`);

    // Reset schema to ensure clean slate
    console.log('🧹 Resetting public schema...');
    await targetClient.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');

    // Run Schema Migration
    const schemaPath = path.join(__dirname, 'migrations', '001_initial_schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('📜 Executing schema migration 001_initial_schema.sql...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await targetClient.query(schemaSql);
      console.log('✅ Schema migration completed.');
    }

    // Hash default passwords for seeds
    const passwordHash = await bcrypt.hash('password123', 10);

    // Run Seeds
    console.log('🌱 Seeding initial real estate data...');

    // Clear existing tables for fresh seed (in reverse dependency order)
    await targetClient.query(`
      TRUNCATE TABLE property_enquiries, property_views, notifications, favorites, appointments,
                     followups, lead_activities, leads, customers, property_features,
                     property_amenities, property_images, properties, users CASCADE;
    `);

    // Seed Users
    const usersResult = await targetClient.query(`
      INSERT INTO users (name, email, password_hash, role, phone, avatar_url) VALUES
      ('Admin Executive', 'admin@homebase.com', '${passwordHash}', 'admin', '+91 98765 43210', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'),
      ('Priya Sharma', 'priya.sharma@homebase.com', '${passwordHash}', 'agent', '+91 98111 22334', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'),
      ('Rohit Mehta', 'rohit.mehta@homebase.com', '${passwordHash}', 'agent', '+91 98222 33445', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150'),
      ('Ananya Reddy', 'ananya.reddy@homebase.com', '${passwordHash}', 'agent', '+91 98333 44556', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'),
      ('Vikram Singh', 'vikram.singh@homebase.com', '${passwordHash}', 'agent', '+91 98444 55667', 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150'),
      ('Kiran Kumar', 'kiran.kumar@gmail.com', '${passwordHash}', 'customer', '+91 98555 66778', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'),
      ('Deepa Nair', 'deepa.nair@outlook.com', '${passwordHash}', 'customer', '+91 98666 77889', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150'),
      ('Arjun Patel', 'arjun.patel@yahoo.com', '${passwordHash}', 'customer', '+91 98777 88990', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150'),
      ('Sneha Deshmukh', 'sneha.deshmukh@gmail.com', '${passwordHash}', 'customer', '+91 98888 99001', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150')
      RETURNING id, email, role;
    `);

    const usersMap = {};
    usersResult.rows.forEach(u => { usersMap[u.email] = u.id; });

    // Seed Properties
    const prop1 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'The Grand Palm 4BHK Penthouse',
        'Spectacular panoramic skyline views of Central Bangalore with Italian marble flooring, wrap-around sky deck, private elevator lobby, and automated smart home systems.',
        42500000, 11805, 'penthouse', 'buy', 'active',
        4, 4.5, 3600, 'Palace Road, Vasanth Nagar', 'Bangalore', 'Karnataka', '560052',
        12.9892, 77.5873, 2023, '${usersMap['priya.sharma@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop2 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'Sea Crest Luxury 3BHK Waterfront Residence',
        'Direct Arabian Sea vistas from every room in Worli Sea Face. Ultra-luxury finishings with infinity rooftop pool, concierge valet, and private marina access.',
        85000000, 35416, 'apartment', 'buy', 'active',
        3, 3.5, 2400, 'Worli Sea Face, South Mumbai', 'Mumbai', 'Maharashtra', '400030',
        19.0178, 72.8173, 2022, '${usersMap['rohit.mehta@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop3 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'The Sovereign Estate 5BHK Villa',
        'Palatial private villa with manicured Japanese gardens, temperature-controlled lap pool, home theatre, and double-height living foyer in Jubilee Hills.',
        125000000, 20833, 'villa', 'buy', 'active',
        5, 6, 6000, 'Road No. 36, Jubilee Hills', 'Hyderabad', 'Telangana', '500033',
        17.4319, 78.4073, 2024, '${usersMap['ananya.reddy@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop4 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'CyberGreens 3BHK Smart Apartment',
        'Contemporary urban living walking distance from Whitefield tech corridors. Clubhouse with badminton court, co-working lounge, and Olympic pool.',
        14500000, 8055, 'apartment', 'buy', 'active',
        3, 3, 1800, 'ITPL Main Road, Whitefield', 'Bangalore', 'Karnataka', '560066',
        12.9856, 77.7315, 2023, '${usersMap['priya.sharma@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop5 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'Golf View Corporate Penthouse',
        'Overlooking the 18-hole championship DLF Golf Course. Floor-to-ceiling glass architecture with expansive terrace garden and double parking garage.',
        92000000, 21904, 'penthouse', 'buy', 'active',
        4, 5, 4200, 'Golf Course Road, DLF Phase 5', 'Gurgaon', 'Haryana', '122002',
        28.4357, 77.0945, 2021, '${usersMap['vikram.singh@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop6 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'Casa Del Sol Tropical Coastal Villa',
        'Private boutique Goan villa with Portuguese architectural heritage, sun-drenched private swimming pool, outdoor cabana, and organic spice garden.',
        38000000, 11875, 'villa', 'buy', 'active',
        3, 3.5, 3200, 'Assagao Highlands', 'Goa', 'Goa', '403507',
        15.5898, 73.7749, 2022, '${usersMap['rohit.mehta@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop7 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'Elysium Heights Premium 2BHK Rental',
        'Fully furnished designer apartment in prime Koregaon Park with Italian leather furniture, 65-inch OLED entertainment setup, and high-speed fiber.',
        85000, 68, 'apartment', 'rent', 'active',
        2, 2, 1250, 'Lane 7, Koregaon Park', 'Pune', 'Maharashtra', '411001',
        18.5362, 73.8958, 2020, '${usersMap['priya.sharma@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const prop8 = await targetClient.query(`
      INSERT INTO properties (
        title, description, price, price_per_sqft, property_type, listing_type, status,
        bedrooms, bathrooms, sqft, address, city, state, zip, latitude, longitude, year_built,
        agent_id, verified, verification_status
      ) VALUES (
        'The Apex Commercial Office Floor',
        'Grade-A commercial workspace with LEED Gold certification, 120 dedicated workstations, 4 boardrooms, and 100% DG power backup in Financial District.',
        550000, 91, 'commercial', 'rent', 'active',
        0, 4, 6000, 'Nanakramguda Financial District', 'Hyderabad', 'Telangana', '500032',
        17.4125, 78.3456, 2023, '${usersMap['ananya.reddy@homebase.com']}', true, 'verified'
      ) RETURNING id;
    `);

    const propIds = [
      prop1.rows[0].id, prop2.rows[0].id, prop3.rows[0].id, prop4.rows[0].id,
      prop5.rows[0].id, prop6.rows[0].id, prop7.rows[0].id, prop8.rows[0].id
    ];

    // Seed Property Images
    const images = [
      // Prop 1 (Penthouse Bangalore)
      { pid: propIds[0], url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1000', is_primary: true },
      { pid: propIds[0], url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1000', is_primary: false },
      { pid: propIds[0], url: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1000', is_primary: false },
      // Prop 2 (Mumbai Sea Crest)
      { pid: propIds[1], url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1000', is_primary: true },
      { pid: propIds[1], url: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000', is_primary: false },
      // Prop 3 (Hyderabad Sovereign Villa)
      { pid: propIds[2], url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=1000', is_primary: true },
      { pid: propIds[2], url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000', is_primary: false },
      // Prop 4 (CyberGreens Whitefield)
      { pid: propIds[3], url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1000', is_primary: true },
      { pid: propIds[3], url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000', is_primary: false },
      // Prop 5 (Golf View Gurgaon)
      { pid: propIds[4], url: 'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=1000', is_primary: true },
      // Prop 6 (Goa Villa)
      { pid: propIds[5], url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1000', is_primary: true },
      // Prop 7 (Pune Rental)
      { pid: propIds[6], url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000', is_primary: true },
      // Prop 8 (Commercial Hyderabad)
      { pid: propIds[7], url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1000', is_primary: true },
    ];

    for (const img of images) {
      await targetClient.query(
        'INSERT INTO property_images (property_id, url, is_primary) VALUES ($1, $2, $3)',
        [img.pid, img.url, img.is_primary]
      );
    }

    // Seed Amenities
    const commonAmenities = ['parking', 'pool', 'gym', 'elevator', 'security', 'power_backup'];
    for (const pid of propIds) {
      for (const amenity of commonAmenities) {
        await targetClient.query(
          'INSERT INTO property_amenities (property_id, amenity) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [pid, amenity]
        );
      }
    }

    // Seed Customers (CRM Database)
    const cust1 = await targetClient.query(`
      INSERT INTO customers (user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes)
      VALUES ('${usersMap['kiran.kumar@gmail.com']}', 'Kiran Kumar', 'kiran.kumar@gmail.com', '+91 98555 66778', 30000000, 50000000, ARRAY['Bangalore', 'Hyderabad'], ARRAY['penthouse', 'apartment'], 'Looking for ready-to-move luxury penthouse near tech corridor.')
      RETURNING id;
    `);

    const cust2 = await targetClient.query(`
      INSERT INTO customers (user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes)
      VALUES ('${usersMap['deepa.nair@outlook.com']}', 'Deepa Nair', 'deepa.nair@outlook.com', '+91 98666 77889', 70000000, 100000000, ARRAY['Mumbai'], ARRAY['apartment'], 'Wants sea-facing view in South Mumbai or Bandra.')
      RETURNING id;
    `);

    const cust3 = await targetClient.query(`
      INSERT INTO customers (user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes)
      VALUES ('${usersMap['arjun.patel@yahoo.com']}', 'Arjun Patel', 'arjun.patel@yahoo.com', '+91 98777 88990', 100000000, 150000000, ARRAY['Hyderabad', 'Goa'], ARRAY['villa'], 'High Net Worth investor seeking bespoke luxury villa.')
      RETURNING id;
    `);

    const cust4 = await targetClient.query(`
      INSERT INTO customers (user_id, name, email, phone, budget_min, budget_max, preferred_cities, preferred_types, notes)
      VALUES ('${usersMap['sneha.deshmukh@gmail.com']}', 'Sneha Deshmukh', 'sneha.deshmukh@gmail.com', '+91 98888 99001', 50000, 100000, ARRAY['Pune', 'Bangalore'], ARRAY['apartment'], 'Relocating from Singapore, seeking premium furnished rental.')
      RETURNING id;
    `);

    // Seed Leads (CRM Pipeline)
    const lead1 = await targetClient.query(`
      INSERT INTO leads (customer_id, property_id, agent_id, source, status, priority, budget_min, budget_max, preferred_city, preferred_property_type, notes)
      VALUES ('${cust1.rows[0].id}', '${propIds[0]}', '${usersMap['priya.sharma@homebase.com']}', 'website_enquiry', 'negotiation', 'urgent', 35000000, 45000000, 'Bangalore', 'penthouse', 'Offer submitted at 4.10 Cr, discussing final parking inclusion.')
      RETURNING id;
    `);

    const lead2 = await targetClient.query(`
      INSERT INTO leads (customer_id, property_id, agent_id, source, status, priority, budget_min, budget_max, preferred_city, preferred_property_type, notes)
      VALUES ('${cust2.rows[0].id}', '${propIds[1]}', '${usersMap['rohit.mehta@homebase.com']}', 'referral', 'viewing_scheduled', 'high', 75000000, 90000000, 'Mumbai', 'apartment', 'Physical site inspection scheduled for Saturday 11 AM.')
      RETURNING id;
    `);

    const lead3 = await targetClient.query(`
      INSERT INTO leads (customer_id, property_id, agent_id, source, status, priority, budget_min, budget_max, preferred_city, preferred_property_type, notes)
      VALUES ('${cust3.rows[0].id}', '${propIds[2]}', '${usersMap['ananya.reddy@homebase.com']}', 'ai_assistant', 'qualified', 'high', 110000000, 130000000, 'Hyderabad', 'villa', 'Pre-qualified with ICICI Wealth Management verification.')
      RETURNING id;
    `);

    const lead4 = await targetClient.query(`
      INSERT INTO leads (customer_id, property_id, agent_id, source, status, priority, budget_min, budget_max, preferred_city, preferred_property_type, notes)
      VALUES ('${cust4.rows[0].id}', '${propIds[6]}', '${usersMap['priya.sharma@homebase.com']}', 'campaign', 'new', 'medium', 70000, 90000, 'Pune', 'apartment', 'Inquired through digital ad campaign.')
      RETURNING id;
    `);

    // Seed Followups
    await targetClient.query(`
      INSERT INTO followups (lead_id, agent_id, type, scheduled_at, status, notes) VALUES
      ('${lead1.rows[0].id}', '${usersMap['priya.sharma@homebase.com']}', 'meeting', NOW() + INTERVAL '1 day', 'pending', 'Final price alignment meeting with seller representative'),
      ('${lead2.rows[0].id}', '${usersMap['rohit.mehta@homebase.com']}', 'site_visit', NOW() + INTERVAL '2 days', 'pending', 'Worli Sea Face site viewing walkthrough'),
      ('${lead3.rows[0].id}', '${usersMap['ananya.reddy@homebase.com']}', 'call', NOW() + INTERVAL '4 hours', 'pending', 'Follow up on structural layout blueprints requested by architect');
    `);

    // Seed Appointments
    await targetClient.query(`
      INSERT INTO appointments (property_id, customer_id, agent_id, scheduled_at, status, notes) VALUES
      ('${propIds[0]}', '${cust1.rows[0].id}', '${usersMap['priya.sharma@homebase.com']}', NOW() + INTERVAL '1 day 2 hours', 'confirmed', 'VIP Penthouse walkthrough'),
      ('${propIds[1]}', '${cust2.rows[0].id}', '${usersMap['rohit.mehta@homebase.com']}', NOW() + INTERVAL '2 days', 'confirmed', 'Sea Crest private marina & penthouse inspection');
    `);

    // Seed Favorites
    await targetClient.query(`
      INSERT INTO favorites (user_id, property_id, notes) VALUES
      ('${usersMap['kiran.kumar@gmail.com']}', '${propIds[0]}', 'Top choice for penthouse in Bangalore'),
      ('${usersMap['kiran.kumar@gmail.com']}', '${propIds[3]}', 'Backup option in Whitefield'),
      ('${usersMap['deepa.nair@outlook.com']}', '${propIds[1]}', 'Must-see sea view flat in Worli');
    `);

    // Seed Notifications
    await targetClient.query(`
      INSERT INTO notifications (user_id, title, message, type, link) VALUES
      ('${usersMap['admin@homebase.com']}', 'New High-Value Lead', 'New ₹12.5 Cr lead created for The Sovereign Estate, Hyderabad', 'lead', '/admin/leads'),
      ('${usersMap['priya.sharma@homebase.com']}', 'Appointment Confirmed', 'Kiran Kumar confirmed site visit for Grand Palm Penthouse', 'appointment', '/agent/appointments'),
      ('${usersMap['kiran.kumar@gmail.com']}', 'Price Update', 'New verified luxury penthouse listed in Vasanth Nagar', 'info', '/properties');
    `);

    console.log('✅ Seeding completed successfully!');
  } catch (err) {
    console.error('❌ Migration/Seed error:', err);
  } finally {
    await targetClient.end();
  }
}

run();
