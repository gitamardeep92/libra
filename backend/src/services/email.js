// src/services/email.js
// Email service using Resend (https://resend.com)
// Free tier: 3,000 emails/month — no credit card required
// Setup: Sign up at resend.com → API Keys → Create Key → add RESEND_API_KEY to env

const FROM_EMAIL = process.env.FROM_EMAIL || 'LIBRA <noreply@yourdomain.com>';
const APP_URL    = process.env.APP_URL    || 'https://libra.onrender.com';

// Lazy-load Resend so the app still starts if the key is missing
function getResend() {
  if (!process.env.RESEND_API_KEY) return null;
  const { Resend } = require('resend');
  return new Resend(process.env.RESEND_API_KEY);
}

// ── Shared HTML wrapper ────────────────────────────────────────────────────────
function emailWrapper(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#0f0f11; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
  .wrap { max-width:520px; margin:40px auto; background:#1a1a22; border-radius:16px; overflow:hidden; border:1px solid #2a2a38; }
  .header { background:linear-gradient(135deg,#e8a838,#c87a1a); padding:28px 32px; }
  .logo { display:flex; align-items:center; gap:12px; }
  .logo-icon { width:40px; height:40px; background:rgba(255,255,255,0.2); border-radius:10px; display:flex; align-items:center; justify-content:center; }
  .logo-text { color:white; font-size:20px; font-weight:800; letter-spacing:3px; }
  .logo-sub { color:rgba(255,255,255,0.75); font-size:11px; margin-top:2px; }
  .body { padding:32px; color:#e0e0e0; }
  h2 { margin:0 0 16px; font-size:20px; color:#fff; }
  p { margin:0 0 14px; font-size:14px; line-height:1.7; color:#b0b0c0; }
  .code-box { background:#0f0f11; border:1.5px dashed #e8a838; border-radius:10px; padding:20px; text-align:center; margin:20px 0; }
  .code { font-size:36px; font-weight:800; letter-spacing:10px; color:#e8a838; font-family:monospace; }
  .code-note { font-size:12px; color:#666; margin-top:8px; }
  .btn { display:inline-block; background:linear-gradient(135deg,#e8a838,#c87a1a); color:white; text-decoration:none; padding:13px 28px; border-radius:8px; font-weight:700; font-size:14px; margin:8px 0; }
  .footer { padding:20px 32px; border-top:1px solid #2a2a38; font-size:11px; color:#555; }
  .divider { height:1px; background:#2a2a38; margin:20px 0; }
  strong { color:#e0e0e0; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div class="logo">
        <div class="logo-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" stroke-width="2" stroke-linecap="round"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div>
          <div class="logo-text">LIBRA</div>
          <div class="logo-sub">Library Management System</div>
        </div>
      </div>
    </div>
    <div class="body">
      <h2>${title}</h2>
      ${bodyHtml}
    </div>
    <div class="footer">
      This email was sent by LIBRA Library Management System.<br>
      If you did not request this, please ignore this email.
    </div>
  </div>
</body>
</html>`;
}

// ── Send password reset email ──────────────────────────────────────────────────
async function sendPasswordResetEmail({ toEmail, toName, resetCode, libraryName }) {
  const resend = getResend();

  // If no Resend key configured, return the code directly (dev/single-user mode)
  if (!resend) {
    console.log(`[EMAIL - NO KEY] Password reset code for ${toEmail}: ${resetCode}`);
    return { code: resetCode, emailSent: false };
  }

  const html = emailWrapper('Reset Your Password', `
    <p>Hi <strong>${toName || 'there'}</strong>,</p>
    <p>We received a request to reset the password for <strong>${libraryName || 'your LIBRA account'}</strong>.</p>
    <p>Use the code below to reset your password. It expires in <strong>15 minutes</strong>.</p>
    <div class="code-box">
      <div class="code">${resetCode}</div>
      <div class="code-note">Valid for 15 minutes</div>
    </div>
    <p>If you did not request a password reset, you can safely ignore this email.</p>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to:   toEmail,
      subject: `${resetCode} — Your LIBRA password reset code`,
      html,
    });
    return { emailSent: true };
  } catch (err) {
    console.error('Email send failed:', err.message);
    // Fallback: return code so the app doesn't break if email fails
    return { code: resetCode, emailSent: false, error: err.message };
  }
}

// ── Send welcome email on registration ────────────────────────────────────────
async function sendWelcomeEmail({ toEmail, ownerName, libraryName }) {
  const resend = getResend();
  if (!resend) {
    console.log(`[EMAIL - NO KEY] Welcome email for ${toEmail}`);
    return { emailSent: false };
  }

  const html = emailWrapper(`Welcome to LIBRA, ${ownerName}!`, `
    <p>Hi <strong>${ownerName}</strong>,</p>
    <p>Your library <strong>${libraryName}</strong> has been successfully registered on LIBRA.</p>
    <p>You can now manage students, subscriptions, shifts, seat maps, reminders, and more — all from one place.</p>
    <div class="divider"></div>
    <p><strong>Getting started:</strong></p>
    <p>1. Set up your <strong>Shifts</strong> (e.g. Morning 8am–2pm, Evening 2pm–9pm)</p>
    <p>2. Create <strong>Plans & Pricing</strong> for your library</p>
    <p>3. Add your <strong>Students</strong> and assign subscriptions</p>
    <p style="margin-top:20px">
      <a href="${APP_URL}" class="btn">Open LIBRA Dashboard →</a>
    </p>
  `);

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to:   toEmail,
      subject: `Welcome to LIBRA — ${libraryName} is ready!`,
      html,
    });
    return { emailSent: true };
  } catch (err) {
    console.error('Welcome email failed:', err.message);
    return { emailSent: false, error: err.message };
  }
}

module.exports = { sendPasswordResetEmail, sendWelcomeEmail };
