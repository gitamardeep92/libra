// src/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

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
       RETURNING id, owner_name, email, library_name, city, total_seats, created_at`,
      [ownerName, email.toLowerCase(), hash, libraryName, city || null]
    );
    const lib = result.rows[0];
    const token = jwt.sign(
      { libraryId: lib.id, email: lib.email, libraryName: lib.library_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
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
      `SELECT id, owner_name, email, password, library_name, city, total_seats, created_at
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
      `SELECT id, owner_name, email, library_name, city, total_seats, created_at FROM libraries WHERE id = $1`,
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

module.exports = router;
