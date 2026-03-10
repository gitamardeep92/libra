const express = require('express');
const router  = express.Router();
const webpush = require('web-push');
const pool    = require('../db/pool');
const authenticateToken = require('../middleware/auth');

// ── VAPID Keys (set in env, or auto-generate once) ──
const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL   = process.env.VAPID_EMAIL || 'mailto:support@librarydesk.in';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
  console.log('[Push] VAPID configured ✓');
} else {
  console.warn('[Push] WARNING: VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set in environment. Push notifications will not work.');
}

// ── Auto-create push_subscriptions table ──
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id          SERIAL PRIMARY KEY,
        library_id  INTEGER NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
        endpoint    TEXT NOT NULL UNIQUE,
        p256dh      TEXT NOT NULL,
        auth        TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  } catch (e) {
    console.error('Push table error:', e.message);
  }
})();

// ── GET /api/push/vapid-public-key ──
router.get('/vapid-public-key', (req, res) => {
  res.json({ 
    key: VAPID_PUBLIC || null,
    configured: !!(VAPID_PUBLIC && VAPID_PRIVATE)
  });
});

// ── POST /api/push/subscribe ── Save push subscription
router.post('/subscribe', authenticateToken, async (req, res) => {
  const { subscription } = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  try {
    await pool.query(`
      INSERT INTO push_subscriptions (library_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint) DO UPDATE SET library_id=$1, p256dh=$3, auth=$4
    `, [req.library.id, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── DELETE /api/push/unsubscribe ── Remove subscription
router.delete('/unsubscribe', authenticateToken, async (req, res) => {
  const { endpoint } = req.body;
  try {
    await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1 AND library_id=$2',
      [endpoint, req.library.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Helper: send push to all subscriptions of a library ──
async function sendPushToLibrary(libraryId, payload) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  try {
    const subs = await pool.query(
      'SELECT * FROM push_subscriptions WHERE library_id=$1', [libraryId]
    );
    const msg = JSON.stringify(payload);
    for (const sub of subs.rows) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, msg);
      } catch (e) {
        // If subscription expired/invalid, remove it
        if (e.statusCode === 410 || e.statusCode === 404) {
          await pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [sub.endpoint]);
        }
      }
    }
  } catch (e) {
    console.error('Push send error:', e.message);
  }
}

// ── POST /api/push/test ── Test notification
router.post('/test', authenticateToken, async (req, res) => {
  await sendPushToLibrary(req.library.id, {
    title: '🔔 LibraryDesk Notifications',
    body: 'Push notifications are working!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    url: '/'
  });
  res.json({ ok: true });
});

module.exports = { router, sendPushToLibrary };
