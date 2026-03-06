// src/routes/admin.js  —  Admin portal API
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const pool     = require('../db/pool');
const adminAuth = require('../middleware/adminAuth');
const { sendWelcomeEmail } = require('../services/email');

const router = express.Router();

// ── Helper: generate invoice number ──────────────────────────────────────────
async function nextInvoiceNumber() {
  const r = await pool.query(`SELECT COUNT(*) FROM invoices`);
  const n = parseInt(r.rows[0].count) + 1;
  return `INV-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`;
}

// ══════════════════════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════════════════════

// POST /api/admin/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const r = await pool.query('SELECT * FROM admin_users WHERE email=$1', [email.toLowerCase()]);
    if (!r.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = r.rows[0];
    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign(
      { adminId: admin.id, email: admin.email, role: admin.role, isAdmin: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    const { password: _, ...adminData } = admin;
    res.json({ token, admin: adminData });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/auth/setup  —  Create first admin (only if no admins exist)
router.post('/auth/setup', async (req, res) => {
  const { name, email, password, setupKey } = req.body;
  if (setupKey !== process.env.ADMIN_SETUP_KEY) return res.status(403).json({ error: 'Invalid setup key' });
  try {
    const exists = await pool.query('SELECT id FROM admin_users LIMIT 1');
    if (exists.rows.length) return res.status(409).json({ error: 'Admin already exists. Use login.' });
    const hash = await bcrypt.hash(password, 12);
    const r = await pool.query(
      `INSERT INTO admin_users (name,email,password,role) VALUES ($1,$2,$3,'superadmin') RETURNING id,name,email,role`,
      [name, email.toLowerCase(), hash]
    );
    res.status(201).json({ message: 'Admin created', admin: r.rows[0] });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/auth/me
router.get('/auth/me', adminAuth, async (req, res) => {
  const r = await pool.query('SELECT id,name,email,role,created_at FROM admin_users WHERE id=$1', [req.adminId]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  res.json(r.rows[0]);
});

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/dashboard
router.get('/dashboard', adminAuth, async (req, res) => {
  try {
    const [libs, revenue, payments, recentLibs, trialEnding] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE subscription_status='trial')              AS trial,
          COUNT(*) FILTER (WHERE subscription_status='active')             AS active,
          COUNT(*) FILTER (WHERE subscription_status='expired')            AS expired,
          COUNT(*) FILTER (WHERE subscription_status='suspended')          AS suspended,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
        FROM libraries
      `),
      pool.query(`
        SELECT
          COALESCE(SUM(amount) FILTER (WHERE paid_at >= DATE_TRUNC('month',NOW())),0) AS this_month,
          COALESCE(SUM(amount) FILTER (WHERE paid_at >= DATE_TRUNC('year',NOW())),0)  AS this_year,
          COALESCE(SUM(amount),0)                                                      AS total
        FROM saas_payments WHERE status='paid'
      `),
      pool.query(`
        SELECT sp.*, l.library_name, l.owner_name, l.email
        FROM saas_payments sp
        JOIN libraries l ON l.id=sp.library_id
        WHERE sp.status='paid'
        ORDER BY sp.paid_at DESC LIMIT 8
      `),
      pool.query(`
        SELECT id,library_name,owner_name,email,subscription_status,trial_ends_at,created_at
        FROM libraries ORDER BY created_at DESC LIMIT 8
      `),
      pool.query(`
        SELECT id,library_name,owner_name,email,trial_ends_at
        FROM libraries
        WHERE subscription_status='trial'
          AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'
        ORDER BY trial_ends_at ASC
      `),
    ]);

    // Monthly revenue for last 6 months
    const monthly = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month',paid_at),'Mon YY') AS month,
             SUM(amount) AS revenue, COUNT(*) AS count
      FROM saas_payments
      WHERE status='paid' AND paid_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month',paid_at)
      ORDER BY DATE_TRUNC('month',paid_at)
    `);

    res.json({
      stats:        libs.rows[0],
      revenue:      revenue.rows[0],
      recentPayments: payments.rows,
      recentLibraries: recentLibs.rows,
      trialEnding:  trialEnding.rows,
      monthlyRevenue: monthly.rows,
    });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// LIBRARIES
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/libraries
router.get('/libraries', adminAuth, async (req, res) => {
  try {
    const { search='', status='all', page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where = 'WHERE 1=1';
    const params = [];
    if (search) { params.push(`%${search}%`); where += ` AND (l.library_name ILIKE $${params.length} OR l.owner_name ILIKE $${params.length} OR l.email ILIKE $${params.length})`; }
    if (status !== 'all') { params.push(status); where += ` AND l.subscription_status=$${params.length}`; }

    const [rows, total] = await Promise.all([
      pool.query(`
        SELECT l.id, l.library_name, l.owner_name, l.email, l.city,
               l.total_seats, l.is_active, l.subscription_status,
               l.trial_ends_at, l.created_at,
               (SELECT COUNT(*) FROM students   WHERE library_id=l.id) AS student_count,
               (SELECT COUNT(*) FROM subscriptions WHERE library_id=l.id AND status='active') AS active_subs,
               ss.current_period_end, ss.plan_name AS saas_plan_name, ss.amount_paid
        FROM libraries l
        LEFT JOIN saas_subscriptions ss ON ss.library_id=l.id AND ss.status IN ('active','trial')
        ${where} ORDER BY l.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `, params),
      pool.query(`SELECT COUNT(*) FROM libraries l ${where}`, params),
    ]);
    res.json({ libraries: rows.rows, total: parseInt(total.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/libraries/:id
router.get('/libraries/:id', adminAuth, async (req, res) => {
  try {
    const [lib, subs, payments] = await Promise.all([
      pool.query(`SELECT l.*, ss.plan_name AS saas_plan_name, ss.status AS saas_status,
                         ss.current_period_end, ss.amount_paid
                  FROM libraries l
                  LEFT JOIN saas_subscriptions ss ON ss.library_id=l.id
                  WHERE l.id=$1 ORDER BY ss.created_at DESC LIMIT 1`, [req.params.id]),
      pool.query(`SELECT * FROM saas_subscriptions WHERE library_id=$1 ORDER BY created_at DESC`, [req.params.id]),
      pool.query(`SELECT sp.*, i.invoice_number FROM saas_payments sp
                  LEFT JOIN invoices i ON i.payment_id=sp.id
                  WHERE sp.library_id=$1 ORDER BY sp.created_at DESC`, [req.params.id]),
    ]);
    if (!lib.rows.length) return res.status(404).json({ error: 'Library not found' });
    const { password: _, ...libData } = lib.rows[0];
    res.json({ library: libData, subscriptions: subs.rows, payments: payments.rows });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/libraries  —  Manually create a library account
router.post('/libraries', adminAuth, async (req, res) => {
  const { ownerName, email, password, libraryName, city, planId } = req.body;
  if (!ownerName||!email||!password||!libraryName) return res.status(400).json({ error: 'All fields required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const exists = await client.query('SELECT id FROM libraries WHERE email=$1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });
    const hash = await bcrypt.hash(password, 12);
    const lib = await client.query(
      `INSERT INTO libraries (owner_name,email,password,library_name,city,subscription_status,trial_ends_at)
       VALUES ($1,$2,$3,$4,$5,'trial',NOW()+INTERVAL '14 days') RETURNING *`,
      [ownerName, email.toLowerCase(), hash, libraryName, city||null]
    );
    const libId = lib.rows[0].id;
    // Create trial subscription
    await client.query(
      `INSERT INTO saas_subscriptions (library_id,plan_name,status,trial_ends_at,current_period_start,current_period_end)
       VALUES ($1,'Free Trial','trial',NOW()+INTERVAL '14 days',CURRENT_DATE,CURRENT_DATE+14)`,
      [libId]
    );
    await client.query('COMMIT');
    sendWelcomeEmail({ toEmail: email, ownerName, libraryName }).catch(console.error);
    const { password: _, ...libData } = lib.rows[0];
    res.status(201).json({ library: libData });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// PATCH /api/admin/libraries/:id/status  —  Activate / suspend
router.patch('/libraries/:id/status', adminAuth, async (req, res) => {
  const { status, notes } = req.body; // active | suspended | trial | expired
  try {
    await pool.query(
      `UPDATE libraries SET subscription_status=$1, is_active=$2, updated_at=NOW() WHERE id=$3`,
      [status, status !== 'suspended', req.params.id]
    );
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/libraries/:id/impersonate  —  Get a login token for a library
router.post('/libraries/:id/impersonate', adminAuth, async (req, res) => {
  if (req.adminRole !== 'superadmin') return res.status(403).json({ error: 'Superadmin only' });
  try {
    const r = await pool.query('SELECT id,email,library_name FROM libraries WHERE id=$1', [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Library not found' });
    const lib = r.rows[0];
    const token = jwt.sign(
      { libraryId: lib.id, email: lib.email, libraryName: lib.library_name, impersonated: true },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token, library: lib });
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// SAAS PLANS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/plans', adminAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM saas_plans ORDER BY price ASC');
  res.json(r.rows);
});

router.post('/plans', adminAuth, async (req, res) => {
  const { name, price, durationDays, description, isTrial } = req.body;
  const r = await pool.query(
    `INSERT INTO saas_plans (name,price,duration_days,description,is_trial) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [name, price, durationDays||30, description||null, isTrial||false]
  );
  res.status(201).json(r.rows[0]);
});

router.put('/plans/:id', adminAuth, async (req, res) => {
  const { name, price, durationDays, description, isActive } = req.body;
  const r = await pool.query(
    `UPDATE saas_plans SET name=$1,price=$2,duration_days=$3,description=$4,is_active=$5 WHERE id=$6 RETURNING *`,
    [name, price, durationDays, description||null, isActive, req.params.id]
  );
  res.json(r.rows[0]);
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/payments
router.get('/payments', adminAuth, async (req, res) => {
  try {
    const { status='all', page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    let where = status !== 'all' ? `WHERE sp.status='${status}'` : '';
    const r = await pool.query(`
      SELECT sp.*, l.library_name, l.owner_name, l.email, i.invoice_number
      FROM saas_payments sp
      JOIN libraries l ON l.id=sp.library_id
      LEFT JOIN invoices i ON i.payment_id=sp.id
      ${where}
      ORDER BY sp.created_at DESC LIMIT ${limit} OFFSET ${offset}
    `);
    const total = await pool.query(`SELECT COUNT(*) FROM saas_payments sp ${where}`);
    res.json({ payments: r.rows, total: parseInt(total.rows[0].count) });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/payments  —  Record manual payment
router.post('/payments', adminAuth, async (req, res) => {
  const { libraryId, amount, planId, planName, paymentMethod, notes, couponCode } = req.body;
  if (!libraryId||!amount) return res.status(400).json({ error: 'libraryId and amount required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validate coupon if provided
    let discountAmount = 0;
    let finalAmount = parseFloat(amount);
    if (couponCode) {
      const coup = await client.query(
        `SELECT * FROM coupons WHERE code=UPPER($1) AND is_active=TRUE
         AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
         AND (max_uses IS NULL OR used_count < max_uses)`, [couponCode]
      );
      if (coup.rows.length) {
        const c = coup.rows[0];
        discountAmount = c.discount_type==='percent'
          ? finalAmount * (c.discount_value/100)
          : Math.min(c.discount_value, finalAmount);
        finalAmount = Math.max(0, finalAmount - discountAmount);
        await client.query(`UPDATE coupons SET used_count=used_count+1 WHERE id=$1`, [c.id]);
      }
    }

    // Get plan duration
    let durationDays = 30;
    if (planId) {
      const pl = await client.query('SELECT duration_days FROM saas_plans WHERE id=$1', [planId]);
      if (pl.rows.length) durationDays = pl.rows[0].duration_days;
    }

    const startDate = new Date();
    const endDate   = new Date(startDate);
    endDate.setDate(endDate.getDate() + durationDays);

    // Create payment record
    const invoiceNum = await nextInvoiceNumber();
    const pay = await client.query(
      `INSERT INTO saas_payments (library_id,amount,status,payment_method,notes,paid_at)
       VALUES ($1,$2,'paid',$3,$4,NOW()) RETURNING *`,
      [libraryId, finalAmount, paymentMethod||'manual', notes||null]
    );

    // Update or create saas_subscription
    const existSub = await client.query(
      `SELECT id FROM saas_subscriptions WHERE library_id=$1 ORDER BY created_at DESC LIMIT 1`, [libraryId]
    );
    if (existSub.rows.length) {
      await client.query(
        `UPDATE saas_subscriptions SET status='active', plan_name=$1, current_period_start=$2,
         current_period_end=$3, amount_paid=$4, discount_amount=$5, coupon_code=$6, updated_at=NOW()
         WHERE id=$7`,
        [planName||'Monthly', startDate, endDate, finalAmount, discountAmount, couponCode||null, existSub.rows[0].id]
      );
    } else {
      await client.query(
        `INSERT INTO saas_subscriptions (library_id,plan_name,status,current_period_start,current_period_end,amount_paid,discount_amount,coupon_code)
         VALUES ($1,$2,'active',$3,$4,$5,$6,$7)`,
        [libraryId, planName||'Monthly', startDate, endDate, finalAmount, discountAmount, couponCode||null]
      );
    }

    // Update library status
    await client.query(
      `UPDATE libraries SET subscription_status='active', is_active=TRUE, updated_at=NOW() WHERE id=$1`, [libraryId]
    );

    // Create invoice
    await client.query(
      `INSERT INTO invoices (invoice_number,library_id,payment_id,amount,total_amount,status,due_date,paid_at,line_items)
       VALUES ($1,$2,$3,$4,$5,'paid',CURRENT_DATE,NOW(),$6)`,
      [invoiceNum, libraryId, pay.rows[0].id, finalAmount, finalAmount,
       JSON.stringify([{ description: planName||'Monthly Plan', amount: finalAmount }])]
    );

    await client.query('COMMIT');
    res.status(201).json({ payment: pay.rows[0], invoiceNumber: invoiceNum, finalAmount, discountAmount });
  } catch(err) {
    await client.query('ROLLBACK');
    console.error(err); res.status(500).json({ error: 'Server error' });
  } finally { client.release(); }
});

// PATCH /api/admin/payments/:id/status
router.patch('/payments/:id/status', adminAuth, async (req, res) => {
  const { status } = req.body;
  await pool.query(`UPDATE saas_payments SET status=$1${status==='paid'?',paid_at=NOW()':''} WHERE id=$2`, [status, req.params.id]);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// COUPONS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/coupons', adminAuth, async (req, res) => {
  const r = await pool.query('SELECT * FROM coupons ORDER BY created_at DESC');
  res.json(r.rows);
});

router.post('/coupons', adminAuth, async (req, res) => {
  const { code, description, discountType, discountValue, maxUses, validFrom, validUntil } = req.body;
  if (!code||!discountValue) return res.status(400).json({ error: 'code and discountValue required' });
  try {
    const r = await pool.query(
      `INSERT INTO coupons (code,description,discount_type,discount_value,max_uses,valid_from,valid_until)
       VALUES (UPPER($1),$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code, description||null, discountType||'percent', discountValue, maxUses||null, validFrom||null, validUntil||null]
    );
    res.status(201).json(r.rows[0]);
  } catch(err) {
    if (err.code==='23505') return res.status(409).json({ error: 'Coupon code already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/coupons/:id', adminAuth, async (req, res) => {
  const { isActive } = req.body;
  const r = await pool.query(`UPDATE coupons SET is_active=$1 WHERE id=$2 RETURNING *`, [isActive, req.params.id]);
  res.json(r.rows[0]);
});

router.delete('/coupons/:id', adminAuth, async (req, res) => {
  await pool.query('DELETE FROM coupons WHERE id=$1', [req.params.id]);
  res.json({ deleted: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════

router.get('/reports', adminAuth, async (req, res) => {
  try {
    const [monthly, planBreakdown, topLibraries, conversionStats, churnData] = await Promise.all([
      // Monthly revenue last 12 months
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month',paid_at),'Mon YYYY') AS month,
               DATE_TRUNC('month',paid_at) AS month_date,
               SUM(amount) AS revenue, COUNT(*) AS payments
        FROM saas_payments WHERE status='paid' AND paid_at >= NOW()-INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month',paid_at) ORDER BY month_date
      `),
      // Revenue by plan
      pool.query(`
        SELECT ss.plan_name, COUNT(*) AS count, SUM(sp.amount) AS revenue
        FROM saas_payments sp
        JOIN saas_subscriptions ss ON ss.library_id=sp.library_id
        WHERE sp.status='paid'
        GROUP BY ss.plan_name ORDER BY revenue DESC
      `),
      // Top libraries by revenue
      pool.query(`
        SELECT l.library_name, l.owner_name, l.email, l.city,
               SUM(sp.amount) AS total_paid, COUNT(sp.id) AS payment_count,
               l.subscription_status
        FROM libraries l
        LEFT JOIN saas_payments sp ON sp.library_id=l.id AND sp.status='paid'
        GROUP BY l.id ORDER BY total_paid DESC NULLS LAST LIMIT 10
      `),
      // Trial conversion stats
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE subscription_status='trial')  AS current_trials,
          COUNT(*) FILTER (WHERE subscription_status='active') AS converted,
          COUNT(*) FILTER (WHERE subscription_status='expired' OR subscription_status='suspended') AS churned,
          COUNT(*) AS total
        FROM libraries
      `),
      // Libraries by status per month
      pool.query(`
        SELECT TO_CHAR(DATE_TRUNC('month',created_at),'Mon YY') AS month,
               COUNT(*) AS signups
        FROM libraries
        WHERE created_at >= NOW()-INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month',created_at) ORDER BY DATE_TRUNC('month',created_at)
      `),
    ]);

    res.json({
      monthlyRevenue:   monthly.rows,
      planBreakdown:    planBreakdown.rows,
      topLibraries:     topLibraries.rows,
      conversionStats:  conversionStats.rows[0],
      signupsByMonth:   churnData.rows,
    });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// INVOICES
// ══════════════════════════════════════════════════════════════════════════════

router.get('/invoices', adminAuth, async (req, res) => {
  const r = await pool.query(`
    SELECT i.*, l.library_name, l.owner_name, l.email
    FROM invoices i JOIN libraries l ON l.id=i.library_id
    ORDER BY i.created_at DESC LIMIT 50
  `);
  res.json(r.rows);
});

module.exports = router;

// ══════════════════════════════════════════════════════════════════════════════
// TOOLS — Business operations helpers
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/admin/tools/expiring  — Libraries expiring in next N days
router.get('/tools/expiring', adminAuth, async (req, res) => {
  const { days = 7 } = req.query;
  try {
    const r = await pool.query(`
      SELECT l.id, l.library_name, l.owner_name, l.email, l.subscription_status,
             ss.current_period_end, ss.plan_name,
             EXTRACT(DAY FROM ss.current_period_end - NOW())::int AS days_left
      FROM libraries l
      JOIN saas_subscriptions ss ON ss.library_id = l.id
      WHERE l.subscription_status = 'active'
        AND ss.current_period_end BETWEEN NOW() AND NOW() + (CAST($1 AS INT) * INTERVAL '1 day')
        AND ss.status = 'active'
      ORDER BY ss.current_period_end ASC
    `, [days]);
    res.json(r.rows);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/tools/never-paid  — Libraries still on trial, never paid
router.get('/tools/never-paid', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT l.id, l.library_name, l.owner_name, l.email,
             l.subscription_status, l.trial_ends_at, l.created_at,
             EXTRACT(DAY FROM NOW() - l.created_at)::int AS days_since_signup
      FROM libraries l
      WHERE NOT EXISTS (
        SELECT 1 FROM saas_payments sp WHERE sp.library_id = l.id AND sp.status = 'paid'
      )
      ORDER BY l.created_at DESC
    `);
    res.json(r.rows);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/tools/revenue-summary  — Quick revenue snapshot
router.get('/tools/revenue-summary', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE paid_at >= DATE_TRUNC('month', NOW())), 0)                    AS this_month,
        COALESCE(SUM(amount) FILTER (WHERE paid_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                                      AND paid_at < DATE_TRUNC('month', NOW())), 0)                       AS last_month,
        COALESCE(SUM(amount) FILTER (WHERE paid_at >= DATE_TRUNC('year', NOW())), 0)                     AS this_year,
        COUNT(*) FILTER (WHERE paid_at >= DATE_TRUNC('month', NOW()))                                    AS payments_this_month,
        COUNT(*) FILTER (WHERE paid_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
                           AND paid_at < DATE_TRUNC('month', NOW()))                                     AS payments_last_month
      FROM saas_payments WHERE status = 'paid'
    `);
    res.json(r.rows[0]);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/tools/extend  — Extend a library's subscription by N days
router.post('/tools/extend', adminAuth, async (req, res) => {
  const { libraryId, days, reason } = req.body;
  if (!libraryId || !days) return res.status(400).json({ error: 'libraryId and days required' });
  try {
    await pool.query(`
      UPDATE saas_subscriptions
      SET current_period_end = current_period_end + (CAST($1 AS INT) * INTERVAL '1 day'), updated_at = NOW()
      WHERE library_id = $2 AND status = 'active'
    `, [days, libraryId]);
    await pool.query(`UPDATE libraries SET subscription_status='active', is_active=TRUE WHERE id=$1`, [libraryId]);
    res.json({ success: true, message: `Extended by ${days} days` });
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/tools/broadcast-note  — Save a broadcast note (internal)
router.get('/tools/notes', adminAuth, async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT * FROM admin_notes ORDER BY created_at DESC LIMIT 50
    `);
    res.json(r.rows);
  } catch { res.json([]); }
});

router.post('/tools/notes', adminAuth, async (req, res) => {
  const { content, type } = req.body;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        type VARCHAR(50) DEFAULT 'note',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const r = await pool.query(
      `INSERT INTO admin_notes (content, type) VALUES ($1, $2) RETURNING *`,
      [content, type || 'note']
    );
    res.status(201).json(r.rows[0]);
  } catch(err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

router.delete('/tools/notes/:id', adminAuth, async (req, res) => {
  await pool.query('DELETE FROM admin_notes WHERE id=$1', [req.params.id]);
  res.json({ deleted: true });
});
