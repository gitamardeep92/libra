// src/routes/api.js  –  all protected CRUD routes
const express = require('express');
let pushNotify; try { pushNotify = require('./push').sendPushToLibrary; } catch(e) {}
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const router = express.Router();

// ── PUBLIC ROUTES (no auth) ──────────────────────────────────────────────────
// Health check — keeps Render server alive (used by UptimeRobot)
router.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Auto-create/fix attendance table
const ensureAttendanceTable = async () => {
  // Check if student_id column is wrong type (INTEGER instead of UUID)
  const colCheck = await pool.query(`
    SELECT data_type FROM information_schema.columns
    WHERE table_name='attendance' AND column_name='student_id'
  `).catch(()=>({rows:[]}));

  if (colCheck.rows.length && colCheck.rows[0].data_type === 'integer') {
    // Wrong type — drop and recreate (data will be lost but it was broken anyway)
    console.warn('[attendance] Dropping old attendance table with wrong column types...');
    await pool.query('DROP TABLE IF EXISTS attendance').catch(()=>{});
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      library_id UUID NOT NULL,
      student_id UUID NOT NULL,
      check_in   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      check_out  TIMESTAMPTZ,
      date       DATE NOT NULL DEFAULT CURRENT_DATE,
      notes      TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS att_lib_date ON attendance(library_id, date)`).catch(()=>{});
  await pool.query(`CREATE INDEX IF NOT EXISTS att_student ON attendance(student_id)`).catch(()=>{});
  console.log('[attendance] Table ready ✓');
};
ensureAttendanceTable().catch(e => console.warn('[attendance table]', e.message));

// PUBLIC: Student check-in via QR (no auth — uses library token in URL)
// GET /api/attendance/qr-info/:libraryToken  — get library name for QR page
router.get('/attendance/qr-info/:token', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT id, library_name, city FROM libraries WHERE id=$1 AND is_active=TRUE`,
      [req.params.token]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Library not found' });
    res.json(r.rows[0]);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// PUBLIC: Student check-in — POST /api/attendance/checkin
router.post('/attendance/checkin', async (req, res) => {
  const { libraryId, phone } = req.body;
  if (!libraryId || !phone) return res.status(400).json({ error: 'Missing libraryId or phone' });
  // Normalize phone — strip country code, keep last 10 digits
  const normalizedPhone = phone.replace(/\D/g,'').slice(-10);
  try {
    // Ensure attendance table exists (inline, no FK constraints)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        library_id UUID NOT NULL,
        student_id UUID NOT NULL,
        check_in   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        check_out  TIMESTAMPTZ,
        date       DATE NOT NULL DEFAULT CURRENT_DATE,
        notes      TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `).catch(()=>{});

    // Find student by phone — simple match on last 10 digits
    const normalizedForQuery = normalizedPhone;
    const st = await pool.query(
      `SELECT s.id, s.name, s.phone,
              sub.end_date, sub.plan_name, sub.shift_id,
              sh.name as shift_name
       FROM students s
       LEFT JOIN subscriptions sub ON sub.student_id=s.id AND sub.library_id=$1 AND sub.status='active' AND sub.end_date>=CURRENT_DATE
       LEFT JOIN shifts sh ON sh.id=sub.shift_id
       WHERE RIGHT(REGEXP_REPLACE(s.phone,'[^0-9]','','g'),10)=$2 AND s.library_id=$1 AND s.status='active'`,
      [libraryId, normalizedForQuery]
    );
    if (!st.rows.length) return res.status(404).json({ error: 'Student not found or inactive' });

    const student = st.rows[0];
    const studentId = student.id;

    // Check if already checked in today (no check-out yet)
    const existing = await pool.query(
      `SELECT id FROM attendance WHERE library_id=$1 AND student_id=$2 AND date=CURRENT_DATE AND check_out IS NULL`,
      [libraryId, studentId]
    );

    if (existing.rows.length) {
      // Already checked in — do check-out
      await pool.query(
        `UPDATE attendance SET check_out=NOW() WHERE id=$1`,
        [existing.rows[0].id]
      );
      if (pushNotify) {
        pushNotify(libraryId, {
          title: `👋 ${student.name} Checked Out`,
          body: `Left the library`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-96.png',
          url: '/?page=attendance'
        }).catch(()=>{});
      }
      return res.json({ action: 'checkout', student, message: `Goodbye ${student.name}! See you soon.` });
    }

    // Check-in
    await pool.query(
      `INSERT INTO attendance(library_id, student_id, date) VALUES($1,$2,CURRENT_DATE)`,
      [libraryId, studentId]
    );
    // Push notification to library owner
    if (pushNotify) {
      pushNotify(libraryId, {
        title: `✅ ${student.name} Checked In`,
        body: `${student.shift_name ? student.shift_name + ' shift · ' : ''}Seat active`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-96.png',
        url: '/?page=attendance'
      }).catch(()=>{});
    }
    res.json({ action: 'checkin', student, message: `Welcome ${student.name}!` });
  } catch(err) {
    console.error('[checkin error]', err.message, '| libraryId:', req.body?.libraryId, '| phone:', req.body?.phone);
    res.status(500).json({ error: 'Server error', detail: err.message });
  }
});


// ── PROTECTED ROUTES (JWT required) ─────────────────────────────────────────
router.use(auth);  // every route below requires JWT

// ─── helper ──────────────────────────────────────────────────────────────────
const libId = (req) => req.libraryId;

// ═══════════════════════════════════════════════════════════════════════════════
// SHIFTS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/shifts', async (req, res) => {
  const r = await pool.query('SELECT * FROM shifts WHERE library_id=$1 ORDER BY start_time', [libId(req)]);
  res.json(r.rows);
});
router.post('/shifts', async (req, res) => {
  const { name, startTime, endTime, description } = req.body;
  if (!name || !startTime || !endTime) return res.status(400).json({ error: 'name, startTime, endTime required' });
  const r = await pool.query(
    `INSERT INTO shifts (library_id,name,start_time,end_time,description) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [libId(req), name, startTime, endTime, description || null]
  );
  res.status(201).json(r.rows[0]);
});
router.put('/shifts/:id', async (req, res) => {
  const { name, startTime, endTime, description } = req.body;
  const r = await pool.query(
    `UPDATE shifts SET name=$1,start_time=$2,end_time=$3,description=$4 WHERE id=$5 AND library_id=$6 RETURNING *`,
    [name, startTime, endTime, description || null, req.params.id, libId(req)]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Shift not found' });
  res.json(r.rows[0]);
});
router.delete('/shifts/:id', async (req, res) => {
  await pool.query('DELETE FROM shifts WHERE id=$1 AND library_id=$2', [req.params.id, libId(req)]);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/plans', async (req, res) => {
  const r = await pool.query(
    `SELECT p.*, s.name as shift_name FROM plans p LEFT JOIN shifts s ON s.id=p.shift_id WHERE p.library_id=$1 ORDER BY p.created_at`,
    [libId(req)]
  );
  res.json(r.rows);
});
router.post('/plans', async (req, res) => {
  const { name, duration, price, shiftId, description } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'name and price required' });
  const r = await pool.query(
    `INSERT INTO plans (library_id,name,duration,price,shift_id,description) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [libId(req), name, duration || 30, price, shiftId || null, description || null]
  );
  res.status(201).json(r.rows[0]);
});
router.put('/plans/:id', async (req, res) => {
  const { name, duration, price, shiftId, description } = req.body;
  const r = await pool.query(
    `UPDATE plans SET name=$1,duration=$2,price=$3,shift_id=$4,description=$5 WHERE id=$6 AND library_id=$7 RETURNING *`,
    [name, duration, price, shiftId || null, description || null, req.params.id, libId(req)]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Plan not found' });
  res.json(r.rows[0]);
});
router.delete('/plans/:id', async (req, res) => {
  await pool.query('DELETE FROM plans WHERE id=$1 AND library_id=$2', [req.params.id, libId(req)]);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/students', async (req, res) => {
  const r = await pool.query(
    `SELECT s.*,
      (SELECT row_to_json(sub) FROM (
        SELECT id,plan_name,shift_name,end_date,status,seat_number FROM subscriptions
        WHERE student_id=s.id AND status='active'
        ORDER BY end_date DESC LIMIT 1
      ) sub) AS active_subscription
     FROM students s WHERE s.library_id=$1 ORDER BY s.created_at DESC`,
    [libId(req)]
  );
  res.json(r.rows);
});
router.post('/students', async (req, res) => {
  const { name, phone, email, address, idProof, notes, joinDate } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
  const r = await pool.query(
    `INSERT INTO students (library_id,name,phone,email,address,id_proof,notes,join_date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [libId(req), name, phone, email || null, address || null, idProof || null, notes || null, joinDate || null]
  );
  res.status(201).json(r.rows[0]);
});
router.put('/students/:id', async (req, res) => {
  const { name, phone, email, address, idProof, notes, status, joinDate } = req.body;
  const r = await pool.query(
    `UPDATE students SET name=$1,phone=$2,email=$3,address=$4,id_proof=$5,notes=$6,status=$7,
     join_date=COALESCE($8,join_date),updated_at=NOW()
     WHERE id=$9 AND library_id=$10 RETURNING *`,
    [name, phone, email || null, address || null, idProof || null, notes || null,
     status || 'active', joinDate || null, req.params.id, libId(req)]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Student not found' });
  res.json(r.rows[0]);
});
router.delete('/students/:id', async (req, res) => {
  await pool.query('DELETE FROM students WHERE id=$1 AND library_id=$2', [req.params.id, libId(req)]);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTIONS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/subscriptions', async (req, res) => {
  const r = await pool.query(
    `SELECT sub.*, st.name as student_name, st.phone as student_phone
     FROM subscriptions sub
     JOIN students st ON st.id=sub.student_id
     WHERE sub.library_id=$1
       AND NOT (
         sub.end_date < CURRENT_DATE
         AND sub.status != 'cancelled'
         AND EXISTS (
           SELECT 1 FROM subscriptions s2
           WHERE s2.student_id = sub.student_id
             AND s2.library_id = sub.library_id
             AND s2.id != sub.id
             AND s2.start_date > sub.start_date
         )
       )
     ORDER BY sub.created_at DESC`,
    [libId(req)]
  );
  res.json(r.rows);
});
router.post('/subscriptions', async (req, res) => {
  const { studentId, planId, planName, shiftId, shiftName, seatNumber, amount, discount, paymentMode, startDate, endDate, notes } = req.body;
  if (!studentId || !planName || !startDate || !endDate) return res.status(400).json({ error: 'Required fields missing' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(
      `INSERT INTO subscriptions (library_id,student_id,plan_id,plan_name,shift_id,shift_name,seat_number,amount,discount,payment_mode,start_date,end_date,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [libId(req), studentId, planId || null, planName, shiftId || null, shiftName || null, seatNumber || null, amount, discount || 0, paymentMode || 'cash', startDate, endDate, notes || null]
    );
    // Auto-create renewal reminder 3 days before expiry
    const reminderDate = new Date(endDate);
    reminderDate.setDate(reminderDate.getDate() - 3);
    const stResult = await client.query('SELECT name FROM students WHERE id=$1', [studentId]);
    const studentName = stResult.rows[0]?.name || 'Student';
    // Mark any existing pending reminders for this student as done (they just renewed)
    await client.query(
      `UPDATE reminders SET done=true WHERE student_id=$1 AND library_id=$2 AND done=false AND type='renewal'`,
      [libId(req), studentId]
    );
    await client.query(
      `INSERT INTO reminders (library_id,student_id,message,type,due_date) VALUES ($1,$2,$3,'renewal',$4)`,
      [libId(req), studentId, `Subscription renewal for ${studentName} — plan: ${planName}`, reminderDate.toISOString().slice(0, 10)]
    );
    await client.query('COMMIT');
    res.status(201).json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Subscription error:', err);
    res.status(500).json({ error: 'Could not create subscription' });
  } finally {
    client.release();
  }
});
router.patch('/subscriptions/:id/cancel', async (req, res) => {
  const r = await pool.query(
    `UPDATE subscriptions SET status='cancelled' WHERE id=$1 AND library_id=$2 RETURNING *`,
    [req.params.id, libId(req)]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Subscription not found' });
  res.json(r.rows[0]);
});

// ── PUT /subscriptions/:id — Edit an existing subscription ───────────────────
router.put('/subscriptions/:id', async (req, res) => {
  const { planId, planName, shiftId, shiftName, seatNumber, amount, discount,
          paymentMode, startDate, endDate, notes } = req.body;
  try {
    const r = await pool.query(
      `UPDATE subscriptions
       SET plan_id=$1, plan_name=$2, shift_id=$3, shift_name=$4,
           seat_number=$5, amount=$6, discount=$7, payment_mode=$8,
           start_date=$9, end_date=$10, notes=$11
       WHERE id=$12 AND library_id=$13
       RETURNING *`,
      [planId||null, planName, shiftId||null, shiftName||'',
       seatNumber||null, amount, discount||0, paymentMode||'cash',
       startDate, endDate, notes||'',
       req.params.id, libId(req)]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Subscription not found' });
    res.json(r.rows[0]);
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDERS
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/reminders', async (req, res) => {
  const r = await pool.query(
    `SELECT rem.*, st.name as student_name, st.phone as student_phone
     FROM reminders rem LEFT JOIN students st ON st.id=rem.student_id
     WHERE rem.library_id=$1 ORDER BY rem.due_date`,
    [libId(req)]
  );
  res.json(r.rows);
});
router.post('/reminders', async (req, res) => {
  const { studentId, message, type, dueDate } = req.body;
  if (!message || !dueDate) return res.status(400).json({ error: 'message and dueDate required' });
  const r = await pool.query(
    `INSERT INTO reminders (library_id,student_id,message,type,due_date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [libId(req), studentId || null, message, type || 'custom', dueDate]
  );
  res.status(201).json(r.rows[0]);
});
router.patch('/reminders/:id/toggle', async (req, res) => {
  const r = await pool.query(
    `UPDATE reminders SET done=NOT done WHERE id=$1 AND library_id=$2 RETURNING *`,
    [req.params.id, libId(req)]
  );
  if (!r.rows.length) return res.status(404).json({ error: 'Reminder not found' });
  res.json(r.rows[0]);
});
router.delete('/reminders/:id', async (req, res) => {
  await pool.query('DELETE FROM reminders WHERE id=$1 AND library_id=$2', [req.params.id, libId(req)]);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPENSES
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/expenses', async (req, res) => {
  const r = await pool.query('SELECT * FROM expenses WHERE library_id=$1 ORDER BY date DESC', [libId(req)]);
  res.json(r.rows);
});
router.post('/expenses', async (req, res) => {
  const { title, amount, category, date, paymentMode, description } = req.body;
  if (!title || !amount) return res.status(400).json({ error: 'title and amount required' });
  const r = await pool.query(
    `INSERT INTO expenses (library_id,title,amount,category,date,payment_mode,description) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [libId(req), title, amount, category || 'other', date, paymentMode || 'cash', description || null]
  );
  res.status(201).json(r.rows[0]);
});
router.delete('/expenses/:id', async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1 AND library_id=$2', [req.params.id, libId(req)]);
  res.json({ deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REPORTS / DASHBOARD SUMMARY  (single efficient query)
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/reports/summary', async (req, res) => {
  try {
    const [libR, statsR, monthR, recentR] = await Promise.all([
      pool.query('SELECT total_seats FROM libraries WHERE id=$1', [libId(req)]),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM students WHERE library_id=$1) AS total_students,
          (SELECT COUNT(*) FROM students WHERE library_id=$1 AND status='active') AS active_students,
          (SELECT COUNT(*) FROM subscriptions WHERE library_id=$1 AND status='active' AND end_date>=CURRENT_DATE) AS active_subscriptions,
          (SELECT COUNT(*) FROM subscriptions WHERE library_id=$1 AND status='active' AND end_date<CURRENT_DATE) AS expired_subscriptions,
          (SELECT COUNT(*) FROM subscriptions WHERE library_id=$1 AND status='active' AND end_date>=CURRENT_DATE AND end_date<=CURRENT_DATE+5) AS expiring_soon
      `, [libId(req)]),
      pool.query(`
        SELECT
          COALESCE(SUM(CASE WHEN DATE_TRUNC('month', COALESCE(start_date, created_at::date))=DATE_TRUNC('month',CURRENT_DATE) THEN amount ELSE 0 END),0) AS month_revenue,
          COALESCE((SELECT SUM(amount) FROM expenses WHERE library_id=$1 AND DATE_TRUNC('month',COALESCE(date, created_at::date))=DATE_TRUNC('month',CURRENT_DATE)),0) AS month_expenses
        FROM subscriptions WHERE library_id=$1
      `, [libId(req)]),
      pool.query(`
        SELECT sub.*, st.name as student_name, st.phone as student_phone
        FROM subscriptions sub JOIN students st ON st.id=sub.student_id
        WHERE sub.library_id=$1 ORDER BY sub.created_at DESC LIMIT 5
      `, [libId(req)]),
    ]);

    // Monthly revenue for bar chart (last 6 months)
    const revenueByMonth = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month',COALESCE(start_date, created_at::date)),'Mon') as month,
             DATE_TRUNC('month',COALESCE(start_date, created_at::date)) as month_date,
             SUM(amount) as revenue
      FROM subscriptions
      WHERE library_id=$1 AND COALESCE(start_date, created_at::date) >= DATE_TRUNC('month',CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY DATE_TRUNC('month',COALESCE(start_date, created_at::date))
      ORDER BY month_date
    `, [libId(req)]);

    res.json({
      totalSeats:     libR.rows[0]?.total_seats || 30,
      ...statsR.rows[0],
      ...monthR.rows[0],
      recentSubscriptions: recentR.rows,
      revenueByMonth: revenueByMonth.rows,
    });
  } catch (err) {
    console.error('Reports summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});


// ── ATTENDANCE ────────────────────────────────────────────────────────────────

// PRIVATE: Get today's attendance
router.get('/attendance/today', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT a.*, s.name as student_name, s.phone as student_phone,
             sh.name as shift_name
      FROM attendance a
      JOIN students s ON s.id=a.student_id
      LEFT JOIN subscriptions sub ON sub.student_id=a.student_id AND sub.library_id=a.library_id AND sub.status='active'
      LEFT JOIN shifts sh ON sh.id=sub.shift_id
      WHERE a.library_id=$1 AND a.date=CURRENT_DATE
      ORDER BY a.check_in DESC
    `, [libId(req)]);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// PRIVATE: Get attendance by date range
router.get('/attendance', async (req, res) => {
  const { from, to, studentId } = req.query;
  try {
    let q = `
      SELECT a.*, s.name as student_name, s.phone as student_phone
      FROM attendance a JOIN students s ON s.id=a.student_id
      WHERE a.library_id=$1
    `;
    const params = [libId(req)];
    if (from) { params.push(from); q += ` AND a.date >= $${params.length}`; }
    if (to)   { params.push(to);   q += ` AND a.date <= $${params.length}`; }
    if (studentId) { params.push(studentId); q += ` AND a.student_id=$${params.length}`; }
    q += ' ORDER BY a.check_in DESC LIMIT 200';
    const r = await pool.query(q, params);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// PRIVATE: Monthly attendance summary per student
router.get('/attendance/summary', async (req, res) => {
  const { month } = req.query; // YYYY-MM
  try {
    const r = await pool.query(`
      SELECT s.id, s.name, s.phone,
             COUNT(a.id) as days_present,
             SUM(CASE WHEN a.check_out IS NOT NULL THEN EXTRACT(EPOCH FROM (a.check_out - a.check_in))/3600 ELSE 0 END)::numeric(10,1) as total_hours
      FROM students s
      LEFT JOIN attendance a ON a.student_id=s.id AND a.library_id=$1
        AND TO_CHAR(a.date,'YYYY-MM')=COALESCE($2, TO_CHAR(CURRENT_DATE,'YYYY-MM'))
      WHERE s.library_id=$1 AND s.status='active'
      GROUP BY s.id, s.name, s.phone
      ORDER BY days_present DESC
    `, [libId(req), month || null]);
    res.json(r.rows);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL SETTINGS  (save / fetch SMTP config per library)
// ═══════════════════════════════════════════════════════════════════════════════

// Ensure email_settings table exists (runs once on startup)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_settings (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        library_id   UUID UNIQUE NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        smtp_host    VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
        smtp_port    INTEGER      NOT NULL DEFAULT 587,
        smtp_user    VARCHAR(255) NOT NULL,
        smtp_pass    VARCHAR(255) NOT NULL,
        from_name    VARCHAR(255),
        created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
      )
    `);
  } catch(e) { console.warn('[email_settings table]', e.message); }
})();

// GET /api/email-settings  — fetch current settings (password masked)
router.get('/email-settings', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT smtp_host, smtp_port, smtp_user, from_name,
              CASE WHEN smtp_pass IS NOT NULL AND smtp_pass != '' THEN '••••••••' ELSE '' END as smtp_pass_hint
       FROM email_settings WHERE library_id=$1`,
      [libId(req)]
    );
    res.json(r.rows[0] || null);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/email-settings  — upsert SMTP settings
router.post('/email-settings', async (req, res) => {
  const { smtpHost, smtpPort, smtpUser, smtpPass, fromName } = req.body;
  if (!smtpUser || !smtpPass) return res.status(400).json({ error: 'smtpUser and smtpPass are required' });
  try {
    const r = await pool.query(`
      INSERT INTO email_settings (library_id, smtp_host, smtp_port, smtp_user, smtp_pass, from_name)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (library_id) DO UPDATE SET
        smtp_host  = EXCLUDED.smtp_host,
        smtp_port  = EXCLUDED.smtp_port,
        smtp_user  = EXCLUDED.smtp_user,
        smtp_pass  = EXCLUDED.smtp_pass,
        from_name  = EXCLUDED.from_name,
        updated_at = NOW()
      RETURNING smtp_host, smtp_port, smtp_user, from_name
    `, [libId(req), smtpHost || 'smtp.gmail.com', smtpPort || 587, smtpUser, smtpPass, fromName || null]);
    res.json({ ok: true, ...r.rows[0] });
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL BLAST
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/email-blast  — send email to a list of students
router.post('/email-blast', async (req, res) => {
  const { subject, body, recipientIds } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'subject and body are required' });

  // 1. Load SMTP settings for this library
  const cfgRes = await pool.query(
    `SELECT smtp_host, smtp_port, smtp_user, smtp_pass, from_name FROM email_settings WHERE library_id=$1`,
    [libId(req)]
  );
  if (!cfgRes.rows.length) {
    return res.status(400).json({ error: 'Email not configured. Please set up your Gmail SMTP in Settings → Email Setup.' });
  }
  const cfg = cfgRes.rows[0];

  // 2. Fetch recipients — either specific IDs or all active students with email
  let students = [];

  // Special case: test email — send to library owner
  if (recipientIds && recipientIds.length === 1 && recipientIds[0] === "__self__") {
    const libRes = await pool.query(`SELECT owner_name, email FROM libraries WHERE id=$1`, [libId(req)]);
    if (libRes.rows.length) {
      const lib = libRes.rows[0];
      students = [{ id: lib.email, name: lib.owner_name, email: lib.email }];
    }
  } else {
  } else {
    let studentsQuery;
    let studentsParams;
    if (recipientIds && recipientIds.length > 0) {
      studentsQuery = `SELECT id, name, email FROM students WHERE library_id=$1 AND id=ANY($2) AND email IS NOT NULL AND email != ''`;
      studentsParams = [libId(req), recipientIds];
    } else {
      studentsQuery = `SELECT id, name, email FROM students WHERE library_id=$1 AND status='active' AND email IS NOT NULL AND email != ''`;
      studentsParams = [libId(req)];
    }
    const studentsRes = await pool.query(studentsQuery, studentsParams);
    students = studentsRes.rows;
  }

  if (!students.length) {
    return res.status(400).json({ error: 'No students with email addresses found. Make sure students have emails saved.' });
  }

  // 3. Send emails using nodemailer
  let nodemailer;
  try { nodemailer = require('nodemailer'); } catch(e) {
    return res.status(500).json({ error: 'nodemailer not installed. Run: npm install nodemailer' });
  }

  const transporter = nodemailer.createTransport({
    host:   cfg.smtp_host,
    port:   cfg.smtp_port,
    secure: cfg.smtp_port === 465,
    auth:   { user: cfg.smtp_user, pass: cfg.smtp_pass },
  });

  const results = { sent: [], failed: [] };

  for (const student of students) {
    // Replace placeholders in body
    const personalizedBody = body
      .replace(/\{name\}/g, student.name)
      .replace(/\{Name\}/g, student.name);

    const htmlBody = personalizedBody
      .split('\n')
      .map(line => `<p style="margin:0 0 8px">${line}</p>`)
      .join('');

    try {
      await transporter.sendMail({
        from: `"${cfg.from_name || 'Library'}" <${cfg.smtp_user}>`,
        to:   student.email,
        subject,
        text: personalizedBody,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#fff;border-radius:8px;border:1px solid #e0e0e0">
            <h2 style="color:#4f46e5;margin:0 0 16px">${subject}</h2>
            <div style="color:#333;font-size:15px;line-height:1.7">${htmlBody}</div>
            <hr style="margin:24px 0;border:none;border-top:1px solid #eee"/>
            <p style="color:#999;font-size:12px;margin:0">You received this email because you are a member of ${cfg.from_name || 'our library'}.</p>
          </div>`,
      });
      results.sent.push(student.email);
    } catch(e) {
      results.failed.push({ email: student.email, error: e.message });
    }
  }

  res.json({
    ok: true,
    total: students.length,
    sent: results.sent.length,
    failed: results.failed.length,
    failedList: results.failed,
  });
});

module.exports = router;

