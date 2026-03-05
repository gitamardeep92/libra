// backend/src/scripts/createAdmin.js
// Run: node src/scripts/createAdmin.js
// Creates the first superadmin account

require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool   = require('../db/pool');

const ADMIN = {
  name:     process.env.ADMIN_NAME     || 'Amardeep Singh',
  email:    process.env.ADMIN_EMAIL    || 'admin@librarydesk.in',
  password: process.env.ADMIN_PASSWORD || 'Admin@1234',
};

async function create() {
  const client = await pool.connect();
  try {
    console.log('Creating admin account...');
    const exists = await client.query(
      'SELECT id FROM admin_users WHERE email=$1', [ADMIN.email.toLowerCase()]
    );
    if (exists.rows.length) {
      console.log('⚠️  Admin already exists:', ADMIN.email);
      return;
    }
    const hash = await bcrypt.hash(ADMIN.password, 12);
    const r = await client.query(
      `INSERT INTO admin_users (name,email,password,role)
       VALUES ($1,$2,$3,'superadmin') RETURNING id,name,email,role`,
      [ADMIN.name, ADMIN.email.toLowerCase(), hash]
    );
    console.log('✅ Admin created successfully!');
    console.log('   Name:  ', r.rows[0].name);
    console.log('   Email: ', r.rows[0].email);
    console.log('   Role:  ', r.rows[0].role);
    console.log('\n⚠️  Change your password after first login!');
  } catch(err) {
    console.error('❌ Failed:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

create();
