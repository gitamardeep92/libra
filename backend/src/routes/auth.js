// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const { sendPasswordResetEmail, sendWelcomeEmail } = require('../services/email');

const router = express.Router();

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { ownerName, email, password, libraryName, city } = req.body;
  if (!ownerName || !email || !password || !libraryName) {
    return res.status(400).json({ error: 'All required fields must be provided' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const exists = await pool.query('SELECT id FROM libraries WHERE email = $1', [email.toLowerCase()]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO libraries (owner_name, email, password, library_name, city)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, owner_name, email, library_name, city, total_seats, open_time, close_time, created_at`,
      [ownerName, email.toLowerCase(), hash, libraryName, city || null]
    );
    const lib = result.rows[0];
    const token = jwt.sign(
      { libraryId: lib.id, email: lib.email, libraryName: lib.library_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    // Send welcome email (non-blocking)
    sendWelcomeEmail({ toEmail: lib.email, ownerName: lib.owner_name, libraryName: lib.library_name })
      .catch(e => console.error('Welcome email error:', e));

    res.status(201).json({ token, library: lib });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query(
      `SELECT id, owner_name, email, password, library_name, city, total_seats, open_time, close_time, created_at
       FROM libraries WHERE email = $1`,
      [email.toLowerCase()]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid email or password' });
    const lib = result.rows[0];
    const valid = await bcrypt.compare(password, lib.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { libraryId: lib.id, email: lib.email, libraryName: lib.library_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    const { password: _, ...libData } = lib;
    res.json({ token, library: libData });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, owner_name, email, library_name, city, total_seats, open_time, close_time, created_at FROM libraries WHERE id = $1`,
      [req.libraryId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Library not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/auth/seats ─────────────────────────────────────────────────────
router.patch('/seats', auth, async (req, res) => {
  const { totalSeats } = req.body;
  if (!totalSeats || totalSeats < 1) return res.status(400).json({ error: 'Invalid seat count' });
  try {
    await pool.query('UPDATE libraries SET total_seats=$1, updated_at=NOW() WHERE id=$2', [totalSeats, req.libraryId]);
    res.json({ totalSeats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PATCH /api/auth/profile ──────────────────────────────────────────────────
router.patch('/profile', auth, async (req, res) => {
  const { ownerName, libraryName, city } = req.body;
  if (!ownerName || !libraryName) return res.status(400).json({ error: 'Name fields required' });
  try {
    const r = await pool.query(
      `UPDATE libraries SET owner_name=$1, library_name=$2, city=$3, updated_at=NOW()
       WHERE id=$4 RETURNING id, owner_name, email, library_name, city, total_seats, open_time, close_time`,
      [ownerName, libraryName, city||null, req.libraryId]
    );
    res.json(r.rows[0]);
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// ── PATCH /api/auth/password ──────────────────────────────────────────────────
router.patch('/password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const r = await pool.query('SELECT password FROM libraries WHERE id=$1', [req.libraryId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Library not found' });
    const valid = await bcrypt.compare(currentPassword, r.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE libraries SET password=$1, updated_at=NOW() WHERE id=$2', [hash, req.libraryId]);
    res.json({ success: true });
  } catch(err) { res.status(500).json({ error: 'Server error' }); }
});

// ── PATCH /api/auth/ophours ──────────────────────────────────────────────────
router.patch('/ophours', auth, async (req, res) => {
  const { openTime, closeTime } = req.body;
  if (!openTime || !closeTime) return res.status(400).json({ error: 'openTime and closeTime required' });
  try {
    await pool.query(
      'UPDATE libraries SET open_time=$1, close_time=$2, updated_at=NOW() WHERE id=$3',
      [openTime, closeTime, req.libraryId]
    );
    res.json({ openTime, closeTime });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  try {
    const r = await pool.query(
      'SELECT id, library_name, owner_name FROM libraries WHERE email=$1',
      [email.toLowerCase()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'No account found with that email' });
    const lib     = r.rows[0];
    const code    = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await pool.query(
      'UPDATE libraries SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [code, expires, email.toLowerCase()]
    );

    // Send email via Resend if configured
    const RESEND_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@libra-app.in';
    if (RESEND_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `LIBRA <${FROM_EMAIL}>`,
            to: [email.toLowerCase()],
            subject: 'Your LIBRA Password Reset Code',
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0a0c10;color:#eef0f5;border-radius:12px;">
                <div style="text-align:center;margin-bottom:24px;">
                  <div style="display:inline-block;background:linear-gradient(135deg,#e8a838,#c87a1a);padding:12px 20px;border-radius:10px;font-size:22px;font-weight:800;letter-spacing:4px;color:white;">📚 LIBRA</div>
                </div>
                <h2 style="color:#e8a838;margin-bottom:8px;">Password Reset Request</h2>
                <p style="color:#8892a4;">Hi ${lib.owner_name}, use the code below to reset your LIBRA password for <strong style="color:#eef0f5;">${lib.library_name}</strong>.</p>
                <div style="text-align:center;margin:28px 0;">
                  <div style="display:inline-block;background:#1e2330;border:2px solid #e8a838;border-radius:12px;padding:18px 36px;font-size:36px;font-weight:800;letter-spacing:10px;color:#e8a838;">${code}</div>
                </div>
                <p style="color:#8892a4;font-size:13px;">This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, you can ignore this email.</p>
                <div style="margin-top:24px;padding-top:16px;border-top:1px solid #2e3648;font-size:12px;color:#8892a4;text-align:center;">LIBRA Library Management System</div>
              </div>
            `,
          }),
        });
        res.json({ message: 'Reset code sent to your email. Check your inbox.' });
      } catch (emailErr) {
        console.error('Email send failed:', emailErr);
        // Fallback: return code directly if email fails
        res.json({ message: 'Email service unavailable', code, note: 'Use this code (email failed).' });
      }
    } else {
      // No email service configured — return code directly (dev/demo mode)
      res.json({ message: 'Reset code generated (no email configured)', code });
    }
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/reset-password ─────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body;
  if (!email || !token || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const r = await pool.query(
      'SELECT id, reset_token, reset_token_expires FROM libraries WHERE email=$1',
      [email.toLowerCase()]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Account not found' });
    const lib = r.rows[0];
    if (!lib.reset_token || lib.reset_token !== token) return res.status(400).json({ error: 'Invalid reset code' });
    if (new Date() > new Date(lib.reset_token_expires)) return res.status(400).json({ error: 'Reset code has expired. Please request a new one.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query(
      'UPDATE libraries SET password=$1, reset_token=NULL, reset_token_expires=NULL, updated_at=NOW() WHERE id=$2',
      [hash, lib.id]
    );
    res.json({ success: true, message: 'Password reset successfully' });
  } catch(err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
