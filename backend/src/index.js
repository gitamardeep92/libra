// src/index.js  –  Express entry point
require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRouter  = require('./routes/auth');
const apiRouter   = require('./routes/api');
const adminRouter = require('./routes/admin');

const app  = express();
const PORT = process.env.PORT || 8080;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174')
  .split(',')
  .map(s => s.trim());

// Also always allow the backend's own origin (for QR checkin page)
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || '';

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, PWA)
    if (!origin) return callback(null, true);
    // Allow backend's own origin (QR checkin page is served from backend)
    if (BACKEND_URL && origin === BACKEND_URL) return callback(null, true);
    if (origin.includes('onrender.com')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Health check (used by AWS ELB / Elastic Beanstalk) ──────────────────────
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ─── Routes ───────────────────────────────────────────────────────────────────
const { router: pushRouter } = require('./routes/push');

// Public push endpoint — BEFORE any auth, no token needed
app.get('/api/push/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY || null;
  res.json({ key, configured: !!(key && process.env.VAPID_PRIVATE_KEY) });
});

app.use('/api/auth',  authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/push',  pushRouter);
app.use('/api',       apiRouter);


// ─── PUBLIC CHECK-IN PAGE (served directly by backend) ────────────────────────
// Students scan QR → lands here → no React app involved
app.get('/checkin/:libraryId', (req, res) => {
  const libraryId = req.params.libraryId;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0"/>
  <title>Library Check-In</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      min-height:100vh;
      background:linear-gradient(135deg,#0a0e1a 0%,#0f1729 100%);
      color:#e8eaf0;font-family:'Segoe UI',system-ui,sans-serif;
      display:flex;align-items:center;justify-content:center;padding:20px;
    }
    .card{
      background:#0e1117;border:1px solid #1f2535;border-radius:24px;
      padding:36px 28px;max-width:380px;width:100%;text-align:center;
      box-shadow:0 24px 80px rgba(0,0,0,0.5);
    }
    .logo{
      width:72px;height:72px;background:linear-gradient(135deg,#e8a838,#f5c842);
      border-radius:20px;display:flex;align-items:center;justify-content:center;
      font-size:32px;margin:0 auto 16px;box-shadow:0 8px 24px rgba(232,168,56,0.3);
    }
    .lib-name{font-size:22px;font-weight:800;color:#fff;margin-bottom:4px;}
    .subtitle{font-size:13px;color:#8892a4;margin-bottom:28px;}
    label{display:block;text-align:left;font-size:12px;font-weight:600;
      color:#8892a4;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;}
    .input{
      width:100%;padding:16px;background:#141720;
      border:1.5px solid #1f2535;border-radius:12px;
      color:#e8eaf0;font-size:20px;font-weight:700;
      letter-spacing:2px;text-align:center;outline:none;
      transition:border .2s,box-shadow .2s;font-family:inherit;
      -webkit-appearance:none;
    }
    .input:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.2);}
    .input::placeholder{font-size:14px;letter-spacing:0;font-weight:400;color:#4a5568;}
    .btn{
      width:100%;padding:16px;margin-top:14px;
      background:linear-gradient(135deg,#6366f1,#818cf8);
      border:none;border-radius:12px;color:white;
      font-size:16px;font-weight:700;cursor:pointer;
      transition:opacity .2s,transform .1s;letter-spacing:0.5px;
    }
    .btn:hover{opacity:0.92;transform:translateY(-1px);}
    .btn:active{transform:scale(0.98);}
    .btn:disabled{opacity:0.5;cursor:not-allowed;transform:none;}
    .result{
      margin-top:18px;padding:20px 16px;border-radius:14px;
      font-weight:600;font-size:15px;line-height:1.6;animation:fadeIn .3s ease;
    }
    .checkin {background:rgba(34,197,94,0.1);border:1.5px solid #22c55e;color:#22c55e;}
    .checkout{background:rgba(99,102,241,0.1);border:1.5px solid #6366f1;color:#818cf8;}
    .err     {background:rgba(239,68,68,0.1); border:1.5px solid #ef4444;color:#ef4444;}
    .big{font-size:40px;margin-bottom:10px;display:block;}
    .name{font-size:18px;font-weight:800;color:#fff;margin-bottom:4px;}
    .msg{font-size:13px;opacity:0.8;font-weight:400;}
    .hint{
      margin-top:20px;padding:12px 14px;background:rgba(255,255,255,0.03);
      border-radius:10px;font-size:12px;color:#4a5568;line-height:1.8;
    }
    .powered{font-size:11px;color:#2a3348;margin-top:20px;}
    .powered a{color:#6366f1;text-decoration:none;}
    .spinner{
      display:inline-block;width:18px;height:18px;
      border:2px solid rgba(255,255,255,0.3);
      border-top-color:white;border-radius:50%;
      animation:spin .7s linear infinite;vertical-align:middle;margin-right:8px;
    }
    @keyframes spin{to{transform:rotate(360deg);}}
    @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">📚</div>
    <div class="lib-name" id="libName">Loading…</div>
    <div class="subtitle" id="libCity">QR Check-In</div>

    <label for="phone">Your Phone Number</label>
    <input id="phone" class="input" type="tel" inputmode="numeric"
      placeholder="Enter your phone number" maxlength="10" autofocus/>
    <button class="btn" id="btn" onclick="doCheckin()">Check In / Check Out</button>

    <div id="result" style="display:none;"></div>

    <div class="hint">
      📲 First scan = <strong style="color:#22c55e">Check In</strong> &nbsp;·&nbsp;
      Second scan = <strong style="color:#818cf8">Check Out</strong><br/>
      Enter the phone number you registered with
    </div>
    <div class="powered">Powered by <a href="https://www.librarydesk.in" target="_blank">LibraryDesk</a></div>
  </div>

  <script>
    const API_URL = window.location.origin;
    const LIBRARY_ID = "${libraryId}";

    async function loadLibrary() {
      try {
        const r = await fetch(API_URL + '/api/attendance/qr-info/' + LIBRARY_ID);
        const d = await r.json();
        if (d.library_name) {
          document.getElementById('libName').textContent = d.library_name;
          document.getElementById('libCity').textContent = (d.city ? d.city + ' · ' : '') + 'QR Check-In';
          document.title = 'Check-In · ' + d.library_name;
        }
      } catch(e) { document.getElementById('libName').textContent = 'Library Check-In'; }
    }

    async function doCheckin() {
      const phone = document.getElementById('phone').value.replace(/\D/g,'').trim();
      if (!phone || phone.length < 10) {
        showResult('err','⚠️','Please enter a valid 10-digit phone number','');
        return;
      }
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Processing…';
      try {
        const r = await fetch(API_URL + '/api/attendance/checkin', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ libraryId: LIBRARY_ID, phone })
        });
        const d = await r.json();
        if (!r.ok) {
          showResult('err','❌', d.error || 'Phone number not found in this library.', 'Make sure you enter the number registered with your library.');
        } else if (d.action === 'checkin') {
          showResult('checkin','✅', d.student.name, 'Checked in! Have a great study session 📖');
          document.getElementById('phone').value = '';
        } else {
          showResult('checkout','👋', d.student.name, 'Checked out! See you next time 🚪');
          document.getElementById('phone').value = '';
        }
      } catch(e) {
        showResult('err','❌','Connection error','Please try again.');
      } finally {
        btn.disabled = false;
        btn.innerHTML = 'Check In / Check Out';
      }
    }

    function showResult(type, icon, name, msg) {
      const el = document.getElementById('result');
      el.style.display = 'block';
      el.className = 'result ' + type;
      el.innerHTML = '<span class="big">' + icon + '</span><div class="name">' + name + '</div><div class="msg">' + msg + '</div>';
      if (type !== 'err') setTimeout(() => { el.style.display = 'none'; }, 5000);
    }

    document.getElementById('phone').addEventListener('keydown', e => {
      if (e.key === 'Enter') doCheckin();
    });

    loadLibrary();
  </script>
</body>
</html>`);
});


// ─── SHIFT-BASED ATTENDANCE REMINDERS (cron) ─────────────────────────────────
// Runs every minute, checks if any shift has a reminder due
// Check-in reminder: 30 mins before shift start
// Check-out reminder: 15 mins before shift end
// Only for libraries with WaBulk configured
// Only for students with active subscriptions

(async () => {
  try {
    const pool = require('./db/pool');

    const runReminders = async () => {
      try {
        // Current time in IST (UTC+5:30)
        const nowUTC = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const nowIST = new Date(nowUTC.getTime() + istOffset);
        const currentHH = nowIST.getUTCHours();
        const currentMM = nowIST.getUTCMinutes();
        const currentTimeStr = `${String(currentHH).padStart(2,'0')}:${String(currentMM).padStart(2,'0')}`;
        const todayIST = nowIST.toISOString().slice(0,10);

        // Check-in reminder time = shift start - 30 mins
        // Check-out reminder time = shift end - 15 mins
        // We find shifts where reminder is due RIGHT NOW (within this minute)

        // Build backend URL for check-in links
        const CHECKIN_BASE = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL || 'https://libra-backend-gjgo.onrender.com';

        const { rows: libraries } = await pool.query(`
          SELECT l.id as library_id, l.library_name,
                 ws.api_key, ws.session_id
          FROM libraries l
          JOIN whatsapp_settings ws ON ws.library_id = l.id
          WHERE l.is_active = TRUE
            AND l.subscription_status IN ('active', 'trial')
            AND ws.reminders_enabled = TRUE
        `);

        if (!libraries.length) return;

        for (const lib of libraries) {
          // ── CHECK-IN REMINDERS ──
          // Find shifts where (start_time - 30 min) = current time
          const { rows: checkinShifts } = await pool.query(`
            SELECT sh.id as shift_id, sh.name as shift_name,
                   sh.start_time, sh.end_time
            FROM shifts sh
            WHERE sh.library_id = $1
              AND TO_CHAR(
                (sh.start_time::time - INTERVAL '30 minutes'),
                'HH24:MI'
              ) = $2
          `, [lib.library_id, currentTimeStr]);

          for (const shift of checkinShifts) {
            // Get active students in this shift who haven't checked in today
            const { rows: students } = await pool.query(`
              SELECT s.id, s.name, s.phone
              FROM students s
              JOIN subscriptions sub ON sub.student_id = s.id
                AND sub.library_id = $1
                AND sub.status = 'active'
                AND sub.end_date >= CURRENT_DATE
                AND sub.shift_id = $2
              WHERE s.library_id = $1
                AND s.status = 'active'
                AND s.phone IS NOT NULL
                AND s.phone != ''
                AND NOT EXISTS (
                  SELECT 1 FROM attendance a
                  WHERE a.student_id = s.id
                    AND a.library_id = $1
                    AND a.date = $3
                )
            `, [lib.library_id, shift.shift_id, todayIST]);

            if (!students.length) continue;

            const startTime = shift.start_time.slice(0,5);
            const checkinUrl = `${CHECKIN_BASE}/checkin/${lib.library_id}`;
            const messages = students.map(s => {
              const phone = s.phone.replace(/\D/g, '');
              const to = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
              return {
                to,
                vars: {
                  name:    s.name,
                  shift:   shift.shift_name,
                  time:    startTime,
                  library: lib.library_name,
                  link:    checkinUrl,
                }
              };
            });

            await fetch('https://wabulk-api.onrender.com/v1/messages/send', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lib.api_key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: lib.session_id,
                template: (()=>{
                  const day = nowIST.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
                  const msgs = [
                    `Good morning, {{name}}! 🌅 A peaceful Sunday study session awaits. Your {{shift}} session begins at {{time}}. Quiet mind, sharp focus — come scan in and today is yours! 🧘📖\n— {{library}}`,
                    `Rise and shine, {{name}}! 🌟 A new week, a fresh start — your {{shift}} session begins at {{time}}. Champions show up on Mondays, be one! Head to the library, scan in and let's make this week count! 💪📚\n— {{library}}`,
                    `Good morning, {{name}}! ✨ Day 2 and you're already making it count. Your {{shift}} session starts at {{time}}. Every page you read brings you closer to your goal — come scan in and get started! 📖\n— {{library}}`,
                    `Hey {{name}}! 🌈 Midweek already — you're doing amazing! Your {{shift}} session begins at {{time}}. Push through, the weekend is closer than you think. We're waiting for you — scan in and own today! 🚀\n— {{library}}`,
                    `Almost there, {{name}}! 🔥 One more push before the weekend. Your {{shift}} starts at {{time}}. Today's effort is tomorrow's result — head in, scan and make it happen! 💡📚\n— {{library}}`,
                    `Happy Friday, {{name}}! 🎉 End the week on a high note! Your {{shift}} session begins at {{time}}. Finish strong — come scan in and let your future self thank you! ⭐\n— {{library}}`,
                    `Weekend warrior alert, {{name}}! 💥 While others rest, you invest in yourself. Your {{shift}} starts at {{time}}. Head to the library, scan in — that's what sets you apart! 🏆📚\n— {{library}}`,
                  ];
                  return msgs[day];
                })(),
                messages,
                delay_ms: 3000,
              }),
            }).catch(e => console.error('[checkin reminder] WaBulk error:', e.message));

            console.log(`[checkin reminder] Sent to ${messages.length} students for shift ${shift.shift_name} at library ${lib.library_name}`);
          }

          // ── CHECK-OUT REMINDERS ──
          // Find shifts where (end_time - 15 min) = current time
          const { rows: checkoutShifts } = await pool.query(`
            SELECT sh.id as shift_id, sh.name as shift_name,
                   sh.start_time, sh.end_time
            FROM shifts sh
            WHERE sh.library_id = $1
              AND TO_CHAR(
                (sh.end_time::time - INTERVAL '15 minutes'),
                'HH24:MI'
              ) = $2
          `, [lib.library_id, currentTimeStr]);

          for (const shift of checkoutShifts) {
            // Get students who checked in today but haven't checked out yet
            const { rows: students } = await pool.query(`
              SELECT s.id, s.name, s.phone, a.check_in
              FROM students s
              JOIN subscriptions sub ON sub.student_id = s.id
                AND sub.library_id = $1
                AND sub.status = 'active'
                AND sub.end_date >= CURRENT_DATE
                AND sub.shift_id = $2
              JOIN attendance a ON a.student_id = s.id
                AND a.library_id = $1
                AND a.date = $3
                AND a.check_out IS NULL
              WHERE s.library_id = $1
                AND s.status = 'active'
                AND s.phone IS NOT NULL
                AND s.phone != ''
            `, [lib.library_id, shift.shift_id, todayIST]);

            if (!students.length) continue;

            const endTime = shift.end_time.slice(0,5);
            const checkoutUrl = `${CHECKIN_BASE}/checkin/${lib.library_id}`;
            const messages = students.map(s => {
              const phone = s.phone.replace(/\D/g, '');
              const to = phone.startsWith('91') ? `+${phone}` : `+91${phone}`;
              return {
                to,
                vars: {
                  name:    s.name,
                  shift:   shift.shift_name,
                  time:    endTime,
                  library: lib.library_name,
                  link:    checkoutUrl,
                }
              };
            });

            await fetch('https://wabulk-api.onrender.com/v1/messages/send', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${lib.api_key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: lib.session_id,
                template: (()=>{
                  const day = nowIST.getUTCDay();
                  const msgs = [
                    `Beautiful Sunday session, {{name}}! 🌅 Your {{shift}} wraps up at {{time}}. Scan out before you leave — you've set the perfect tone for the week ahead. See you Monday! 🧘\n— {{library}}`,
                    `Great start to the week, {{name}}! 🌟 Your {{shift}} session wraps up at {{time}}. Before you leave, don't forget to scan out at the desk. You showed up and that's everything — see you tomorrow! 💪\n— {{library}}`,
                    `Brilliant work today, {{name}}! ✨ Your session ends at {{time}}. Please scan out before leaving — two days strong, you're building an unstoppable habit! 📚\n— {{library}}`,
                    `Halfway hero, {{name}}! 🌈 Your {{shift}} session concludes at {{time}}. Remember to scan out before you head home — that consistency is your superpower! 🚀\n— {{library}}`,
                    `Almost at the finish line, {{name}}! 🔥 Your session wraps up at {{time}}. Scan out before leaving — one more day and you've conquered the week! 💡\n— {{library}}`,
                    `What a week, {{name}}! 🎉 Your {{shift}} session ends at {{time}}. Please scan out before you leave — you earned this weekend, enjoy it and come back recharged! ⭐\n— {{library}}`,
                    `Weekend warrior mission complete, {{name}}! 💥 Your session ends at {{time}}. Don't forget to scan out — most people relaxed today but you chose growth. Be proud! 🏆\n— {{library}}`,
                  ];
                  return msgs[day];
                })(),
                messages,
                delay_ms: 3000,
              }),
            }).catch(e => console.error('[checkout reminder] WaBulk error:', e.message));

            console.log(`[checkout reminder] Sent to ${messages.length} students for shift ${shift.shift_name} at library ${lib.library_name}`);
          }
        }
      } catch(e) {
        console.error('[reminder cron error]', e.message);
      }
    };

    // Run every minute
    setInterval(runReminders, 60 * 1000);
    console.log('✅ Shift attendance reminder cron started');

  } catch(e) {
    console.error('[reminder cron setup error]', e.message);
  }
})();

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Libra API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
