// admin/src/App.jsx  —  LIBRA Admin Portal
import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "https://libra-backend-gjgo.onrender.com";

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const getToken  = () => localStorage.getItem("libra_admin_token");
const setToken  = (t) => localStorage.setItem("libra_admin_token", t);
const clearToken = () => localStorage.removeItem("libra_admin_token");

async function req(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const api = {
  login:      (b)   => req("/api/admin/auth/login",  { method: "POST", body: JSON.stringify(b) }),
  me:         ()    => req("/api/admin/auth/me"),
  dashboard:  ()    => req("/api/admin/dashboard"),
  libraries:  (q)   => req(`/api/admin/libraries?${new URLSearchParams(q)}`),
  library:    (id)  => req(`/api/admin/libraries/${id}`),
  createLib:  (b)   => req("/api/admin/libraries",   { method: "POST",  body: JSON.stringify(b) }),
  setStatus:  (id,b)=> req(`/api/admin/libraries/${id}/status`, { method:"PATCH", body:JSON.stringify(b) }),
  impersonate:(id)  => req(`/api/admin/libraries/${id}/impersonate`, { method:"POST" }),
  plans:      ()    => req("/api/admin/plans"),
  payments:   (q)   => req(`/api/admin/payments?${new URLSearchParams(q)}`),
  addPayment: (b)   => req("/api/admin/payments",    { method: "POST",  body: JSON.stringify(b) }),
  coupons:    ()    => req("/api/admin/coupons"),
  addCoupon:  (b)   => req("/api/admin/coupons",     { method: "POST",  body: JSON.stringify(b) }),
  toggleCoupon:(id,b)=>req(`/api/admin/coupons/${id}`,{ method:"PATCH", body:JSON.stringify(b) }),
  deleteCoupon:(id) => req(`/api/admin/coupons/${id}`,{ method:"DELETE" }),
  reports:    ()    => req("/api/admin/reports"),
  invoices:   ()    => req("/api/admin/invoices"),
  tools: {
    expiring:  (days=7) => req(`/api/admin/tools/expiring?days=${days}`),
    neverPaid: ()       => req('/api/admin/tools/never-paid'),
    revenue:   ()       => req('/api/admin/tools/revenue-summary'),
    extend:    (b)      => req('/api/admin/tools/extend', { method:'POST', body:JSON.stringify(b) }),
    notes:     ()       => req('/api/admin/tools/notes'),
    addNote:   (b)      => req('/api/admin/tools/notes', { method:'POST', body:JSON.stringify(b) }),
    delNote:   (id)     => req(`/api/admin/tools/notes/${id}`, { method:'DELETE' }),
  },
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
const fmt    = (n) => `₹${Number(n||0).toLocaleString("en-IN")}`;
const fmtDate= (d) => d ? new Date(d).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const today  = () => new Date().toISOString().slice(0,10);
const daysDiff=(d)=> Math.ceil((new Date(d)-new Date())/86400000);

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{margin:0;padding:0;box-sizing:border-box;}
  :root{
    --bg:#080a0f; --surface:#0e1117; --surface2:#141720; --surface3:#1c2030;
    --border:#1f2535; --border2:#2a3348;
    --text:#e8eaf0; --text2:#8892a4; --text3:#4a5568;
    --accent:#6366f1; --accent-dim:#1e1f3d; --accent2:#818cf8;
    --green:#22c55e; --green-dim:#0f2a1a;
    --red:#ef4444; --red-dim:#2a0f0f;
    --yellow:#f59e0b; --yellow-dim:#2a2010;
    --purple:#a855f7; --purple-dim:#1f1030;
    --gold:#e8a838; --gold-dim:#2a1f08;
    --font:'DM Sans',sans-serif; --font-display:'Syne',sans-serif;
  }
  html,body,#root{height:100%;background:var(--bg);color:var(--text);font-family:var(--font);}
  .app{display:flex;height:100vh;overflow:hidden;}

  /* SIDEBAR */
  .sidebar{width:220px;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;}
  .sidebar-logo{padding:22px 20px 18px;border-bottom:1px solid var(--border);}
  .logo-badge{display:flex;align-items:center;gap:10px;}
  .logo-icon{width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,var(--accent),#4f46e5);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
  .logo-title{font-family:var(--font-display);font-size:15px;font-weight:800;letter-spacing:2px;color:var(--text);}
  .logo-sub{font-size:10px;color:var(--text3);letter-spacing:.5px;margin-top:1px;}
  .admin-badge{display:inline-block;background:var(--accent-dim);color:var(--accent2);font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;letter-spacing:1px;margin-top:4px;}
  .sidebar-nav{flex:1;padding:12px 10px;overflow-y:auto;}
  .nav-section{margin-bottom:20px;}
  .nav-label{font-size:9px;font-weight:700;letter-spacing:1.5px;color:var(--text3);text-transform:uppercase;padding:0 8px;margin-bottom:6px;}
  .nav-item{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;cursor:pointer;border:none;background:none;color:var(--text2);font-size:13px;font-family:var(--font);width:100%;text-align:left;transition:all .15s;}
  .nav-item:hover{background:var(--surface2);color:var(--text);}
  .nav-item.active{background:var(--accent-dim);color:var(--accent2);font-weight:600;}
  .nav-item .nbadge{margin-left:auto;background:var(--red);color:white;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;}
  .sidebar-footer{padding:14px 12px;border-top:1px solid var(--border);}
  .admin-info{display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:var(--surface2);margin-bottom:6px;}
  .admin-avatar{width:28px;height:28px;border-radius:8px;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;color:var(--accent2);font-weight:700;font-size:12px;flex-shrink:0;}

  /* MAIN */
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
  .topbar{height:56px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 24px;flex-shrink:0;}
  .topbar-title{font-family:var(--font-display);font-size:18px;font-weight:700;}
  .topbar-sub{font-size:11px;color:var(--text3);margin-top:1px;}
  .content{flex:1;overflow-y:auto;padding:24px;}

  /* CARDS */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;}
  .card-sm{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:14px;}

  /* STAT CARDS */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin-bottom:20px;}
  .stat{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 20px;}
  .stat.accent{border-color:var(--accent);background:var(--accent-dim);}
  .stat.green{border-color:var(--green);background:var(--green-dim);}
  .stat.red{border-color:var(--red);background:var(--red-dim);}
  .stat.gold{border-color:var(--gold);background:var(--gold-dim);}
  .stat-label{font-size:11px;color:var(--text3);font-weight:600;letter-spacing:.5px;text-transform:uppercase;margin-bottom:8px;}
  .stat-value{font-family:var(--font-display);font-size:26px;font-weight:800;line-height:1;}
  .stat-sub{font-size:11px;color:var(--text3);margin-top:5px;}
  .stat.accent .stat-value{color:var(--accent2);}
  .stat.green  .stat-value{color:var(--green);}
  .stat.red    .stat-value{color:var(--red);}
  .stat.gold   .stat-value{color:var(--gold);}

  /* TABLE */
  .table-wrap{overflow-x:auto;border-radius:10px;border:1px solid var(--border);}
  table{width:100%;border-collapse:collapse;}
  th{background:var(--surface2);font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--text3);padding:10px 14px;text-align:left;border-bottom:1px solid var(--border);}
  td{padding:11px 14px;font-size:13px;border-bottom:1px solid var(--border);vertical-align:middle;}
  tr:last-child td{border-bottom:none;}
  tr:hover td{background:var(--surface2);}

  /* BADGES */
  .badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:.3px;}
  .badge-green{background:var(--green-dim);color:var(--green);border:1px solid rgba(34,197,94,.2);}
  .badge-red{background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2);}
  .badge-yellow{background:var(--yellow-dim);color:var(--yellow);border:1px solid rgba(245,158,11,.2);}
  .badge-purple{background:var(--purple-dim);color:var(--purple);border:1px solid rgba(168,85,247,.2);}
  .badge-accent{background:var(--accent-dim);color:var(--accent2);border:1px solid rgba(99,102,241,.2);}
  .badge-gray{background:var(--surface3);color:var(--text3);border:1px solid var(--border);}
  .badge-gold{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(232,168,56,.2);}

  /* BUTTONS */
  .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;font-family:var(--font);cursor:pointer;border:none;transition:all .15s;}
  .btn-primary{background:var(--accent);color:white;}
  .btn-primary:hover{background:#4f46e5;}
  .btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border);}
  .btn-secondary:hover{background:var(--surface3);}
  .btn-danger{background:var(--red-dim);color:var(--red);border:1px solid rgba(239,68,68,.2);}
  .btn-danger:hover{background:rgba(239,68,68,.15);}
  .btn-ghost{background:none;color:var(--text2);}
  .btn-ghost:hover{background:var(--surface2);color:var(--text);}
  .btn-sm{padding:5px 11px;font-size:12px;}
  .btn-icon{padding:6px;border-radius:7px;}
  .btn:disabled{opacity:.5;cursor:not-allowed;}

  /* FORM */
  .form-group{margin-bottom:14px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .label{display:block;font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px;}
  .input{width:100%;background:var(--surface2);border:1px solid var(--border2);border-radius:8px;padding:9px 12px;color:var(--text);font-size:13px;font-family:var(--font);outline:none;transition:border .15s;}
  .input:focus{border-color:var(--accent);}
  select.input{cursor:pointer;}

  /* MODAL */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;backdrop-filter:blur(4px);}
  .modal{background:var(--surface);border:1px solid var(--border2);border-radius:16px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;}
  .modal-header{display:flex;align-items:center;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border);}
  .modal-title{font-family:var(--font-display);font-size:16px;font-weight:700;}
  .modal-body{padding:20px 22px;}
  .modal-footer{padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px;}

  /* MISC */
  .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:20px;}
  .section-title{font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--text3);margin-bottom:12px;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
  .flex{display:flex;} .gap-2{gap:8px;} .gap-3{gap:12px;} .items-center{align-items:center;}
  .text-sm{font-size:12px;} .text-xs{font-size:11px;} .text-muted{color:var(--text3);} .text-green{color:var(--green);} .text-red{color:var(--red);} .text-gold{color:var(--gold);} .text-accent{color:var(--accent2);}
  .font-bold{font-weight:700;} .mt-1{margin-top:4px;} .mt-2{margin-top:8px;} .mt-3{margin-top:12px;} .mb-3{margin-bottom:12px;} .mb-4{margin-bottom:16px;}
  .empty{text-align:center;padding:48px 20px;color:var(--text3);}
  .empty-icon{font-size:32px;margin-bottom:12px;}
  .alert{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:8px;margin-bottom:14px;font-size:13px;}
  .alert-error{background:var(--red-dim);border:1px solid rgba(239,68,68,.2);color:var(--red);}
  .alert-success{background:var(--green-dim);border:1px solid rgba(34,197,94,.2);color:var(--green);}
  .alert-warn{background:var(--yellow-dim);border:1px solid rgba(245,158,11,.2);color:var(--yellow);}
  .pill-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;}
  .pill{padding:5px 13px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;background:var(--surface2);color:var(--text3);border:1px solid var(--border);transition:all .15s;}
  .pill.active{background:var(--accent-dim);color:var(--accent2);border-color:var(--accent);}
  .search-bar{display:flex;align-items:center;gap:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:7px 12px;min-width:220px;}
  .search-bar input{background:none;border:none;outline:none;color:var(--text);font-size:13px;font-family:var(--font);width:100%;}
  .divider{height:1px;background:var(--border);margin:16px 0;}

  /* AUTH */
  .auth-page{height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);}
  .auth-card{background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:40px;width:100%;max-width:400px;}
  .auth-logo{text-align:center;margin-bottom:28px;}

  /* BAR CHART */
  .bar-chart{display:flex;align-items:flex-end;gap:8px;height:100px;padding-top:10px;}
  .bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;}
  .bar{background:linear-gradient(to top,var(--accent),var(--accent2));border-radius:4px 4px 0 0;width:100%;min-height:3px;transition:height .4s ease;}
  .bar-label{font-size:10px;color:var(--text3);}
  .bar-val{font-size:10px;color:var(--accent2);font-weight:700;}

  /* STATUS DOT */
  .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
  .dot-green{background:var(--green);}
  .dot-red{background:var(--red);}
  .dot-yellow{background:var(--yellow);}
  .dot-gray{background:var(--text3);}
  .dot-accent{background:var(--accent);}

  /* SPINNER */
  @keyframes spin{to{transform:rotate(360deg);}}
  .spinner{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .6s linear infinite;}
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size=16, color="currentColor" }) => {
  const s = { width:size, height:size };
  const icons = {
    dashboard: <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
    users:  <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    payment:<svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    coupon: <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    chart:  <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    invoice:<svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    plus:   <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    x:      <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    logout: <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    eye:    <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    search: <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    check:  <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
    warn:   <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    plan:   <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
    link:   <svg {...s} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  };
  return icons[name] || null;
};

const Spinner = () => <div className="spinner"/>;

// ─── STATUS HELPERS ───────────────────────────────────────────────────────────
const statusBadge = (s) => {
  const map = { active:"badge-green", trial:"badge-accent", expired:"badge-red", suspended:"badge-red", paid:"badge-green", pending:"badge-yellow", failed:"badge-red", refunded:"badge-gray" };
  return <span className={`badge ${map[s]||"badge-gray"}`}>{s}</span>;
};
const statusDot = (s) => {
  const map = { active:"dot-green", trial:"dot-accent", expired:"dot-red", suspended:"dot-red" };
  return <div className={`dot ${map[s]||"dot-gray"}`}/>;
};

// ══════════════════════════════════════════════════════════════════════════════
// AUTH PAGE
// ══════════════════════════════════════════════════════════════════════════════
function AuthPage({ onAuth }) {
  const [form, setForm] = useState({ email:"", password:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const r = await api.login(form);
      setToken(r.token);
      onAuth(r.admin);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:8}}>
            <div className="logo-icon" style={{width:42,height:42,borderRadius:11}}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{fontFamily:"var(--font-display)",fontSize:22,fontWeight:800,letterSpacing:3}}>LIBRA</div>
          </div>
          <div style={{fontSize:11,color:"var(--text3)",letterSpacing:1}}>ADMIN PORTAL</div>
        </div>
        {error && <div className="alert alert-error"><Icon name="warn" size={14}/>{error}</div>}
        <div className="form-group">
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="admin@librarydesk.in" value={form.email} onChange={e=>setForm(p=>({...p,email:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <div className="form-group">
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&submit()}/>
        </div>
        <button className="btn btn-primary" style={{width:"100%",justifyContent:"center",marginTop:4}} onClick={submit} disabled={loading}>
          {loading?<Spinner/>:null} Sign In
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ api.dashboard().then(setData).finally(()=>setLoading(false)); },[]);

  if (loading) return <div style={{display:"flex",justifyContent:"center",padding:60}}><Spinner/></div>;
  if (!data)   return <div className="empty">Failed to load dashboard</div>;

  const { stats, revenue, recentPayments, recentLibraries, trialEnding, monthlyRevenue } = data;
  const maxRev = Math.max(...(monthlyRevenue||[]).map(m=>Number(m.revenue)),1);

  return (
    <div>
      <div className="stats-grid">
        <div className="stat gold"><div className="stat-label">Total Revenue</div><div className="stat-value">{fmt(revenue?.total)}</div><div className="stat-sub">₹{Number(revenue?.this_month||0).toLocaleString("en-IN")} this month</div></div>
        <div className="stat green"><div className="stat-label">Active Libraries</div><div className="stat-value">{stats?.active||0}</div><div className="stat-sub">{stats?.new_this_month||0} new this month</div></div>
        <div className="stat accent"><div className="stat-label">On Trial</div><div className="stat-value">{stats?.trial||0}</div><div className="stat-sub">{trialEnding?.length||0} ending in 3d</div></div>
        <div className="stat red"><div className="stat-label">Expired</div><div className="stat-value">{stats?.expired||0}</div><div className="stat-sub">{stats?.suspended||0} suspended</div></div>
        <div className="stat"><div className="stat-label">Total Libraries</div><div className="stat-value">{stats?.total||0}</div><div className="stat-sub">All time registrations</div></div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        {/* Revenue Chart */}
        <div className="card">
          <div className="section-title">Monthly Revenue</div>
          {monthlyRevenue?.length>0 ? (
            <div className="bar-chart">
              {monthlyRevenue.map((m,i)=>(
                <div key={i} className="bar-col">
                  <div className="bar-val">₹{(Number(m.revenue)/1000).toFixed(0)}k</div>
                  <div className="bar" style={{height:`${(Number(m.revenue)/maxRev)*80}px`}}/>
                  <div className="bar-label">{m.month}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-muted text-sm" style={{padding:"20px 0"}}>No revenue data yet</div>}
        </div>

        {/* Trial Ending Soon */}
        <div className="card">
          <div className="section-title">Trial Ending Soon</div>
          {trialEnding?.length===0 ? <div className="text-muted text-sm">No trials ending soon</div> :
            trialEnding?.map(l=>(
              <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{l.library_name}</div><div className="text-xs text-muted">{l.email}</div></div>
                <span className="badge badge-yellow">{daysDiff(l.trial_ends_at)}d left</span>
              </div>
            ))
          }
        </div>
      </div>

      <div className="grid-2">
        {/* Recent Libraries */}
        <div className="card">
          <div className="section-title">Recent Signups</div>
          {recentLibraries?.map(l=>(
            <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {statusDot(l.subscription_status)}
                <div><div style={{fontWeight:600,fontSize:13}}>{l.library_name}</div><div className="text-xs text-muted">{l.owner_name}</div></div>
              </div>
              {statusBadge(l.subscription_status)}
            </div>
          ))}
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="section-title">Recent Payments</div>
          {recentPayments?.length===0 ? <div className="text-muted text-sm">No payments yet</div> :
            recentPayments?.map(p=>(
              <div key={p.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)"}}>
                <div><div style={{fontWeight:600,fontSize:13}}>{p.library_name}</div><div className="text-xs text-muted">{fmtDate(p.paid_at)}</div></div>
                <span className="text-green font-bold" style={{fontSize:13}}>{fmt(p.amount)}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LIBRARIES
// ══════════════════════════════════════════════════════════════════════════════
function Libraries() {
  const [data, setData]       = useState({ libraries:[], total:0 });
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [plans, setPlans]     = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({ ownerName:"", email:"", password:"", libraryName:"", city:"" });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.libraries({ search, status: filter })); }
    finally { setLoading(false); }
  }, [search, filter]);

  useEffect(()=>{ load(); }, [load]);
  useEffect(()=>{ api.plans().then(setPlans).catch(()=>{}); }, []);

  const openDetail = async (lib) => {
    setShowDetail(lib);
    setDetailData(null);
    api.library(lib.id).then(setDetailData);
  };

  const setStatus = async (id, status) => {
    await api.setStatus(id, { status });
    load();
    if (showDetail?.id===id) setShowDetail(p=>({...p,subscription_status:status}));
  };

  const impersonate = async (id) => {
    try {
      const r = await api.impersonate(id);
      const appUrl = import.meta.env.VITE_APP_URL || "https://app.librarydesk.in";
      window.open(`${appUrl}?impersonate=${r.token}`, "_blank");
    } catch(e) { alert(e.message); }
  };

  const saveLib = async () => {
    if (!form.ownerName||!form.email||!form.password||!form.libraryName) { setError("All fields required"); return; }
    setSaving(true); setError("");
    try { await api.createLib(form); setShowModal(false); setForm({ ownerName:"", email:"", password:"", libraryName:"", city:"" }); load(); }
    catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2 style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>Libraries</h2><div className="text-sm text-muted mt-1">{data.total} total</div></div>
        <div className="flex gap-2 items-center">
          <div className="search-bar"><Icon name="search" size={14} color="var(--text3)"/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14}/>Add Library</button>
        </div>
      </div>

      <div className="pill-tabs">
        {[["all","All"],["trial","Trial"],["active","Active"],["expired","Expired"],["suspended","Suspended"]].map(([v,l])=>(
          <div key={v} className={`pill${filter===v?" active":""}`} onClick={()=>setFilter(v)}>{l}</div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Library</th><th>Owner</th><th>Status</th><th>Plan / Expires</th><th>Students</th><th>Joined</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7}><div className="empty"><Spinner/></div></td></tr>
            : data.libraries.length===0 ? <tr><td colSpan={7}><div className="empty"><div className="empty-icon">🏛️</div>No libraries found</div></td></tr>
            : data.libraries.map(l=>(
              <tr key={l.id}>
                <td><div style={{fontWeight:600}}>{l.library_name}</div><div className="text-xs text-muted">{l.city||"—"}</div></td>
                <td><div style={{fontSize:13}}>{l.owner_name}</div><div className="text-xs text-muted">{l.email}</div></td>
                <td>{statusBadge(l.subscription_status)}</td>
                <td><div className="text-sm">{l.saas_plan_name||"—"}</div>
                  {l.current_period_end&&<div className="text-xs text-muted">Until {fmtDate(l.current_period_end)}</div>}
                  {l.subscription_status==="trial"&&l.trial_ends_at&&<div className="text-xs" style={{color:"var(--yellow)"}}>Trial ends {fmtDate(l.trial_ends_at)}</div>}
                </td>
                <td className="text-sm">{l.student_count||0}</td>
                <td className="text-xs text-muted">{fmtDate(l.created_at)}</td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-ghost btn-icon btn-sm" title="View details" onClick={()=>openDetail(l)}><Icon name="eye" size={14}/></button>
                    <button className="btn btn-ghost btn-icon btn-sm" title="Open in app" onClick={()=>impersonate(l.id)}><Icon name="link" size={14}/></button>
                    {l.subscription_status!=="suspended"
                      ? <button className="btn btn-danger btn-sm" onClick={()=>setStatus(l.id,"suspended")}>Suspend</button>
                      : <button className="btn btn-secondary btn-sm" onClick={()=>setStatus(l.id,"active")}>Activate</button>
                    }
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Library Modal */}
      {showModal&&<div className="modal-overlay"><div className="modal">
        <div className="modal-header"><div className="modal-title">Add Library</div><button className="btn btn-ghost btn-icon" onClick={()=>{setShowModal(false);setError("");}}><Icon name="x" size={16}/></button></div>
        <div className="modal-body">
          {error&&<div className="alert alert-error"><Icon name="warn" size={14}/>{error}</div>}
          <div className="form-row"><div className="form-group"><label className="label">Owner Name *</label><input className="input" value={form.ownerName} onChange={e=>set("ownerName",e.target.value)}/></div><div className="form-group"><label className="label">Library Name *</label><input className="input" value={form.libraryName} onChange={e=>set("libraryName",e.target.value)}/></div></div>
          <div className="form-row"><div className="form-group"><label className="label">Email *</label><input className="input" type="email" value={form.email} onChange={e=>set("email",e.target.value)}/></div><div className="form-group"><label className="label">Password *</label><input className="input" type="password" placeholder="Min 8 chars" value={form.password} onChange={e=>set("password",e.target.value)}/></div></div>
          <div className="form-group"><label className="label">City</label><input className="input" value={form.city} onChange={e=>set("city",e.target.value)}/></div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>{setShowModal(false);setError("");}}>Cancel</button><button className="btn btn-primary" onClick={saveLib} disabled={saving}>{saving&&<Spinner/>}Create Library</button></div>
      </div></div>}

      {/* Library Detail Modal */}
      {showDetail&&<div className="modal-overlay"><div className="modal" style={{maxWidth:620}}>
        <div className="modal-header">
          <div><div className="modal-title">{showDetail.library_name}</div><div className="text-xs text-muted mt-1">{showDetail.email}</div></div>
          <button className="btn btn-ghost btn-icon" onClick={()=>setShowDetail(null)}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body">
          {!detailData ? <div style={{textAlign:"center",padding:20}}><Spinner/></div> : (<>
            <div className="grid-3 mb-3">
              <div className="card-sm"><div className="text-xs text-muted">Status</div><div style={{marginTop:4}}>{statusBadge(showDetail.subscription_status)}</div></div>
              <div className="card-sm"><div className="text-xs text-muted">Students</div><div style={{fontWeight:700,marginTop:4}}>{detailData.library?.student_count||0}</div></div>
              <div className="card-sm"><div className="text-xs text-muted">Joined</div><div style={{fontSize:12,marginTop:4}}>{fmtDate(detailData.library?.created_at)}</div></div>
            </div>
            <div className="section-title">Subscription History</div>
            {detailData.subscriptions?.length===0 ? <div className="text-muted text-sm mb-3">No subscriptions</div> :
              detailData.subscriptions?.map(s=>(
                <div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div><div style={{fontWeight:600}}>{s.plan_name}</div><div className="text-xs text-muted">{fmtDate(s.current_period_start)} → {fmtDate(s.current_period_end)}</div></div>
                  <div style={{textAlign:"right"}}>{statusBadge(s.status)}<div className="text-xs text-muted mt-1">{fmt(s.amount_paid)}</div></div>
                </div>
              ))
            }
            <div className="section-title mt-3">Payment History</div>
            {detailData.payments?.length===0 ? <div className="text-muted text-sm">No payments</div> :
              detailData.payments?.map(p=>(
                <div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                  <div><div style={{fontWeight:600}}>{fmt(p.amount)}</div><div className="text-xs text-muted">{p.payment_method} · {fmtDate(p.paid_at)}</div></div>
                  <div style={{textAlign:"right"}}>{statusBadge(p.status)}{p.invoice_number&&<div className="text-xs text-muted mt-1">{p.invoice_number}</div>}</div>
                </div>
              ))
            }
          </>)}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost btn-sm" onClick={()=>impersonate(showDetail.id)}><Icon name="link" size={13}/>Open in App</button>
          {showDetail.subscription_status!=="active"&&<button className="btn btn-secondary btn-sm" onClick={()=>setStatus(showDetail.id,"active")}><Icon name="check" size={13}/>Activate</button>}
          {showDetail.subscription_status!=="suspended"&&<button className="btn btn-danger btn-sm" onClick={()=>setStatus(showDetail.id,"suspended")}>Suspend</button>}
          <button className="btn btn-secondary" onClick={()=>setShowDetail(null)}>Close</button>
        </div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════════════════════
function Payments() {
  const [data, setData]       = useState({ payments:[], total:0 });
  const [filter, setFilter]   = useState("all");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [plans, setPlans]     = useState([]);
  const [libraries, setLibraries] = useState([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm]       = useState({ libraryId:"", planId:"", planName:"Monthly", amount:"1000", paymentMethod:"manual", couponCode:"", notes:"" });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await api.payments({ status: filter })); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(()=>{ load(); }, [load]);
  useEffect(()=>{
    api.plans().then(setPlans).catch(()=>{});
    api.libraries({ limit:200 }).then(r=>setLibraries(r.libraries||[])).catch(()=>{});
  },[]);

  const save = async () => {
    if (!form.libraryId||!form.amount) { setError("Library and amount required"); return; }
    setSaving(true); setError("");
    try {
      const r = await api.addPayment({ ...form, amount: Number(form.amount) });
      setSuccess(`Payment recorded! Invoice: ${r.invoiceNumber}. Final amount: ${fmt(r.finalAmount)}${r.discountAmount>0?` (Discount: ${fmt(r.discountAmount)})`:""}`);
      setShowModal(false);
      setForm({ libraryId:"", planId:"", planName:"Monthly", amount:"1000", paymentMethod:"manual", couponCode:"", notes:"" });
      load();
      setTimeout(()=>setSuccess(""),5000);
    } catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h2 style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>Payments</h2><div className="text-sm text-muted mt-1">{data.total} records</div></div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14}/>Record Payment</button>
      </div>

      {success&&<div className="alert alert-success"><Icon name="check" size={14}/>{success}</div>}

      <div className="pill-tabs">
        {[["all","All"],["paid","Paid"],["pending","Pending"],["failed","Failed"]].map(([v,l])=>(
          <div key={v} className={`pill${filter===v?" active":""}`} onClick={()=>setFilter(v)}>{l}</div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead><tr><th>Library</th><th>Amount</th><th>Method</th><th>Status</th><th>Invoice</th><th>Date</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><div className="empty"><Spinner/></div></td></tr>
            : data.payments.length===0 ? <tr><td colSpan={6}><div className="empty"><div className="empty-icon">💳</div>No payments found</div></td></tr>
            : data.payments.map(p=>(
              <tr key={p.id}>
                <td><div style={{fontWeight:600}}>{p.library_name}</div><div className="text-xs text-muted">{p.owner_name}</div></td>
                <td><span className="text-green font-bold">{fmt(p.amount)}</span></td>
                <td><span className="badge badge-gray" style={{textTransform:"capitalize"}}>{p.payment_method}</span></td>
                <td>{statusBadge(p.status)}</td>
                <td className="text-xs text-muted">{p.invoice_number||"—"}</td>
                <td className="text-xs text-muted">{fmtDate(p.paid_at||p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal&&<div className="modal-overlay"><div className="modal">
        <div className="modal-header"><div className="modal-title">Record Payment</div><button className="btn btn-ghost btn-icon" onClick={()=>{setShowModal(false);setError("");}}><Icon name="x" size={16}/></button></div>
        <div className="modal-body">
          {error&&<div className="alert alert-error"><Icon name="warn" size={14}/>{error}</div>}
          <div className="form-group"><label className="label">Library *</label>
            <select className="input" value={form.libraryId} onChange={e=>set("libraryId",e.target.value)}>
              <option value="">Select library…</option>
              {libraries.map(l=><option key={l.id} value={l.id}>{l.library_name} — {l.owner_name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">Plan</label>
              <select className="input" value={form.planId} onChange={e=>{set("planId",e.target.value);const p=plans.find(x=>x.id===e.target.value);if(p){set("planName",p.name);set("amount",String(p.price));}}}>
                <option value="">Custom</option>
                {plans.filter(p=>!p.is_trial).map(p=><option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="label">Amount (₹) *</label><input className="input" type="number" value={form.amount} onChange={e=>set("amount",e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">Payment Method</label>
              <select className="input" value={form.paymentMethod} onChange={e=>set("paymentMethod",e.target.value)}>
                {["manual","upi","razorpay","bank_transfer","cash","cheque"].map(m=><option key={m} value={m} style={{textTransform:"capitalize"}}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="label">Coupon Code</label><input className="input" placeholder="OPTIONAL" value={form.couponCode} onChange={e=>set("couponCode",e.target.value.toUpperCase())}/></div>
          </div>
          <div className="form-group"><label className="label">Notes</label><input className="input" placeholder="Optional notes…" value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>{setShowModal(false);setError("");}}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving&&<Spinner/>}Record Payment</button></div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUPONS
// ══════════════════════════════════════════════════════════════════════════════
function Coupons() {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [form, setForm]       = useState({ code:"", description:"", discountType:"percent", discountValue:"", maxUses:"", validUntil:"" });
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const load = () => api.coupons().then(setCoupons).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const save = async () => {
    if (!form.code||!form.discountValue) { setError("Code and discount value required"); return; }
    setSaving(true); setError("");
    try { await api.addCoupon({ ...form, discountValue: Number(form.discountValue), maxUses: form.maxUses?Number(form.maxUses):null }); setShowModal(false); setForm({ code:"", description:"", discountType:"percent", discountValue:"", maxUses:"", validUntil:"" }); load(); }
    catch(e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const toggle = async (c) => { await api.toggleCoupon(c.id,{isActive:!c.is_active}); load(); };
  const del    = async (id) => { if(confirm("Delete coupon?")) { await api.deleteCoupon(id); load(); } };

  return (
    <div>
      <div className="page-header">
        <div><h2 style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>Coupons</h2><div className="text-sm text-muted mt-1">{coupons.length} codes</div></div>
        <button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={14}/>New Coupon</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Code</th><th>Discount</th><th>Used</th><th>Valid Until</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6}><div className="empty"><Spinner/></div></td></tr>
            : coupons.length===0 ? <tr><td colSpan={6}><div className="empty"><div className="empty-icon">🏷️</div>No coupons yet</div></td></tr>
            : coupons.map(c=>(
              <tr key={c.id}>
                <td><div style={{fontFamily:"monospace",fontWeight:700,fontSize:14,color:"var(--accent2)"}}>{c.code}</div><div className="text-xs text-muted">{c.description||"—"}</div></td>
                <td><span className="badge badge-gold">{c.discount_type==="percent"?`${c.discount_value}% OFF`:`₹${c.discount_value} OFF`}</span></td>
                <td className="text-sm">{c.used_count}{c.max_uses?`/${c.max_uses}`:""}</td>
                <td className="text-xs text-muted">{c.valid_until?fmtDate(c.valid_until):"No expiry"}</td>
                <td><button onClick={()=>toggle(c)} className={`badge ${c.is_active?"badge-green":"badge-gray"}`} style={{cursor:"pointer",border:"none"}}>{c.is_active?"Active":"Inactive"}</button></td>
                <td><button className="btn btn-danger btn-icon btn-sm" onClick={()=>del(c.id)}><Icon name="x" size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal&&<div className="modal-overlay"><div className="modal">
        <div className="modal-header"><div className="modal-title">New Coupon</div><button className="btn btn-ghost btn-icon" onClick={()=>{setShowModal(false);setError("");}}><Icon name="x" size={16}/></button></div>
        <div className="modal-body">
          {error&&<div className="alert alert-error"><Icon name="warn" size={14}/>{error}</div>}
          <div className="form-row"><div className="form-group"><label className="label">Coupon Code *</label><input className="input" placeholder="LAUNCH50" value={form.code} onChange={e=>set("code",e.target.value.toUpperCase())}/></div><div className="form-group"><label className="label">Description</label><input className="input" placeholder="50% off first month" value={form.description} onChange={e=>set("description",e.target.value)}/></div></div>
          <div className="form-row">
            <div className="form-group"><label className="label">Discount Type</label>
              <select className="input" value={form.discountType} onChange={e=>set("discountType",e.target.value)}>
                <option value="percent">Percentage (%)</option>
                <option value="flat">Flat Amount (₹)</option>
              </select>
            </div>
            <div className="form-group"><label className="label">Value *</label><input className="input" type="number" placeholder={form.discountType==="percent"?"50":"500"} value={form.discountValue} onChange={e=>set("discountValue",e.target.value)}/></div>
          </div>
          <div className="form-row"><div className="form-group"><label className="label">Max Uses</label><input className="input" type="number" placeholder="Unlimited" value={form.maxUses} onChange={e=>set("maxUses",e.target.value)}/></div><div className="form-group"><label className="label">Valid Until</label><input className="input" type="date" value={form.validUntil} onChange={e=>set("validUntil",e.target.value)}/></div></div>
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>{setShowModal(false);setError("");}}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving&&<Spinner/>}Create</button></div>
      </div></div>}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════════════════════
// TOOLS
// ══════════════════════════════════════════════════════════════════════════════
function Tools() {
  const [expiring, setExpiring]   = useState([]);
  const [neverPaid, setNeverPaid] = useState([]);
  const [revenue, setRevenue]     = useState(null);
  const [notes, setNotes]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [extendModal, setExtendModal] = useState(null);
  const [extendDays, setExtendDays]   = useState("30");
  const [extendSaving, setExtendSaving] = useState(false);
  const [newNote, setNewNote]     = useState("");
  const [expiryDays, setExpiryDays] = useState(7);
  const [success, setSuccess]     = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [e, n, r, no] = await Promise.all([
        api.tools.expiring(expiryDays),
        api.tools.neverPaid(),
        api.tools.revenue(),
        api.tools.notes(),
      ]);
      setExpiring(e); setNeverPaid(n); setRevenue(r); setNotes(no);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, [expiryDays]);

  const extend = async () => {
    if (!extendDays) return;
    setExtendSaving(true);
    try {
      await api.tools.extend({ libraryId: extendModal.id, days: parseInt(extendDays), reason:"Admin extension" });
      setSuccess(`Extended ${extendModal.library_name} by ${extendDays} days`);
      setExtendModal(null); load();
      setTimeout(()=>setSuccess(""),4000);
    } finally { setExtendSaving(false); }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    await api.tools.addNote({ content: newNote });
    setNewNote(""); load();
  };

  const delNote = async (id) => {
    await api.tools.delNote(id);
    load();
  };

  const waLink = (lib, msg) => {
    const text = msg || `Hi ${lib.owner_name}, this is a reminder from LibraryDesk regarding your library account "${lib.library_name}". Please contact us to continue.`;
    return `https://wa.me/${lib.email.includes('@') ? '' : lib.email}?text=${encodeURIComponent(text)}`;
  };

  const mom = revenue ? ((Number(revenue.this_month) - Number(revenue.last_month)) / Math.max(Number(revenue.last_month),1) * 100).toFixed(0) : 0;

  return (
    <div>
      {success && <div className="alert alert-success" style={{marginBottom:16}}><Icon name="check" size={14}/>{success}</div>}

      {/* ── Revenue Snapshot ── */}
      <div className="stats-grid" style={{marginBottom:20}}>
        <div className="stat gold">
          <div className="stat-label">This Month</div>
          <div className="stat-value">{fmt(revenue?.this_month)}</div>
          <div className="stat-sub">{revenue?.payments_this_month||0} payments</div>
        </div>
        <div className="stat">
          <div className="stat-label">Last Month</div>
          <div className="stat-value">{fmt(revenue?.last_month)}</div>
          <div className="stat-sub">{revenue?.payments_last_month||0} payments</div>
        </div>
        <div className={`stat ${Number(mom)>=0?"green":"red"}`}>
          <div className="stat-label">MoM Growth</div>
          <div className="stat-value">{Number(mom)>=0?"+":""}{mom}%</div>
          <div className="stat-sub">vs last month</div>
        </div>
        <div className="stat accent">
          <div className="stat-label">This Year</div>
          <div className="stat-value">{fmt(revenue?.this_year)}</div>
          <div className="stat-sub">Total 2025</div>
        </div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        {/* ── Expiring Soon ── */}
        <div className="card">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <div className="section-title" style={{margin:0}}>⚠️ Expiring Subscriptions</div>
            <select className="input" style={{width:"auto",padding:"4px 10px",fontSize:12}}
              value={expiryDays} onChange={e=>setExpiryDays(e.target.value)}>
              {[7,14,30].map(d=><option key={d} value={d}>Next {d} days</option>)}
            </select>
          </div>
          {loading ? <Spinner/> : expiring.length===0
            ? <div className="empty" style={{padding:"24px 0"}}><div className="empty-icon">🎉</div><div style={{fontSize:13}}>No subscriptions expiring in {expiryDays} days</div></div>
            : expiring.map(l=>(
              <div key={l.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.library_name}</div>
                  <div className="text-xs text-muted">{l.plan_name} · expires {fmtDate(l.current_period_end)}</div>
                </div>
                <span className={`badge ${l.days_left<=3?"badge-red":"badge-yellow"}`}>{l.days_left}d left</span>
                <div className="flex gap-2">
                  <a href={`https://wa.me/91${l.email}`} target="_blank" rel="noreferrer"
                    style={{width:28,height:28,background:"#25D366",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",fontSize:13}}>💬</a>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setExtendModal(l)}>Extend</button>
                </div>
              </div>
            ))
          }
        </div>

        {/* ── Never Paid / Leads ── */}
        <div className="card">
          <div className="section-title" style={{marginBottom:14}}>🎯 Trial / Never Paid</div>
          {loading ? <Spinner/> : neverPaid.length===0
            ? <div className="empty" style={{padding:"24px 0"}}><div className="empty-icon">✅</div><div style={{fontSize:13}}>Everyone has paid!</div></div>
            : neverPaid.slice(0,8).map(l=>(
              <div key={l.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border)",gap:8}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.library_name}</div>
                  <div className="text-xs text-muted">{l.owner_name} · {l.days_since_signup}d ago</div>
                </div>
                {statusBadge(l.subscription_status)}
                <a href={`https://wa.me/917844913738?text=${encodeURIComponent(`Hi! Following up on your LibraryDesk trial for "${l.library_name}". Would you like to activate your account? We have special offers available!`)}`}
                  target="_blank" rel="noreferrer"
                  style={{width:28,height:28,background:"#25D366",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",fontSize:13,flexShrink:0}}>💬</a>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="card" style={{marginBottom:16}}>
        <div className="section-title" style={{marginBottom:14}}>⚡ Quick Actions</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
          {[
            { label:"View All Libraries",  icon:"users",   action:()=>window.location.hash="#libraries" },
            { label:"Record Payment",      icon:"payment", action:()=>document.querySelector('[data-page=payments]')?.click() },
            { label:"Create Coupon",       icon:"coupon",  action:()=>document.querySelector('[data-page=coupons]')?.click() },
            { label:"LibraryDesk Website", icon:"link",    action:()=>window.open("https://www.librarydesk.in","_blank") },
            { label:"App Dashboard",       icon:"link",    action:()=>window.open("https://app.librarydesk.in","_blank") },
            { label:"WhatsApp Support",    icon:"plan",    action:()=>window.open("https://wa.me/917844913738","_blank") },
          ].map((a,i)=>(
            <button key={i} className="btn btn-secondary" style={{justifyContent:"flex-start",gap:8,padding:"10px 14px"}} onClick={a.action}>
              <Icon name={a.icon} size={14}/>{a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Sticky Notes ── */}
      <div className="card">
        <div className="section-title" style={{marginBottom:14}}>📝 Business Notes</div>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <input className="input" style={{flex:1}} placeholder="Add a note — follow ups, reminders, ideas…"
            value={newNote} onChange={e=>setNewNote(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addNote()}/>
          <button className="btn btn-primary" onClick={addNote}><Icon name="plus" size={14}/>Add</button>
        </div>
        {notes.length===0 ? <div className="text-muted text-sm">No notes yet</div> :
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {notes.map(n=>(
              <div key={n.id} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"10px 12px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)"}}>
                <span style={{fontSize:14,marginTop:1}}>📌</span>
                <div style={{flex:1,fontSize:13,lineHeight:1.6}}>{n.content}</div>
                <div style={{fontSize:11,color:"var(--text3)",flexShrink:0,marginTop:1}}>{fmtDate(n.created_at)}</div>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={()=>delNote(n.id)} style={{color:"var(--red)",flexShrink:0}}>
                  <Icon name="x" size={13}/>
                </button>
              </div>
            ))}
          </div>
        }
      </div>

      {/* ── Extend Modal ── */}
      {extendModal && <div className="modal-overlay"><div className="modal">
        <div className="modal-header">
          <div className="modal-title">Extend Subscription</div>
          <button className="btn btn-ghost btn-icon" onClick={()=>setExtendModal(null)}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom:16}}>
            <div style={{fontWeight:700}}>{extendModal.library_name}</div>
            <div className="text-sm text-muted">{extendModal.owner_name} · Expires {fmtDate(extendModal.current_period_end)}</div>
          </div>
          <div className="form-group">
            <label className="label">Extend by (days)</label>
            <select className="input" value={extendDays} onChange={e=>setExtendDays(e.target.value)}>
              {["7","14","30","60","90","365"].map(d=><option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
          <div className="alert alert-warn"><Icon name="warn" size={13}/>This extends without recording a payment. Use Record Payment for paid extensions.</div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={()=>setExtendModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={extend} disabled={extendSaving}>{extendSaving&&<Spinner/>}Extend</button>
        </div>
      </div></div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REPORTS
// ══════════════════════════════════════════════════════════════════════════════
function Reports() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ api.reports().then(setData).finally(()=>setLoading(false)); },[]);

  if (loading) return <div style={{display:"flex",justifyContent:"center",padding:60}}><Spinner/></div>;
  if (!data)   return <div className="empty">Failed to load reports</div>;

  const { monthlyRevenue, planBreakdown, topLibraries, conversionStats, signupsByMonth } = data;
  const maxRev = Math.max(...(monthlyRevenue||[]).map(m=>Number(m.revenue)),1);
  const convRate = conversionStats?.converted && conversionStats?.total
    ? Math.round((conversionStats.converted / conversionStats.total) * 100) : 0;

  return (
    <div>
      <div className="stats-grid">
        <div className="stat gold"><div className="stat-label">Conversion Rate</div><div className="stat-value">{convRate}%</div><div className="stat-sub">{conversionStats?.converted||0} of {conversionStats?.total||0} converted</div></div>
        <div className="stat green"><div className="stat-label">Active</div><div className="stat-value">{conversionStats?.converted||0}</div></div>
        <div className="stat accent"><div className="stat-label">On Trial</div><div className="stat-value">{conversionStats?.current_trials||0}</div></div>
        <div className="stat red"><div className="stat-label">Churned</div><div className="stat-value">{conversionStats?.churned||0}</div></div>
      </div>

      <div className="grid-2" style={{marginBottom:16}}>
        <div className="card">
          <div className="section-title">Monthly Revenue (12 months)</div>
          {monthlyRevenue?.length>0 ? (
            <div className="bar-chart" style={{height:120}}>
              {monthlyRevenue.map((m,i)=>(
                <div key={i} className="bar-col">
                  <div className="bar-val">₹{(Number(m.revenue)/1000).toFixed(0)}k</div>
                  <div className="bar" style={{height:`${(Number(m.revenue)/maxRev)*90}px`}}/>
                  <div className="bar-label">{m.month}</div>
                </div>
              ))}
            </div>
          ) : <div className="text-muted text-sm">No revenue data yet</div>}
        </div>
        <div className="card">
          <div className="section-title">Revenue by Plan</div>
          {planBreakdown?.length===0 ? <div className="text-muted text-sm">No data</div> :
            planBreakdown?.map((p,i)=>(
              <div key={i} style={{marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:600}}>{p.plan_name}</span>
                  <span className="text-gold font-bold" style={{fontSize:13}}>{fmt(p.revenue)}</span>
                </div>
                <div style={{height:6,background:"var(--surface3)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${(p.revenue/Math.max(...planBreakdown.map(x=>x.revenue),1))*100}%`,background:"linear-gradient(to right,var(--accent),var(--accent2))",borderRadius:3}}/>
                </div>
                <div className="text-xs text-muted mt-1">{p.count} payments</div>
              </div>
            ))
          }
        </div>
      </div>

      <div className="card">
        <div className="section-title">Top Libraries by Revenue</div>
        <div className="table-wrap" style={{border:"none"}}>
          <table>
            <thead><tr><th>#</th><th>Library</th><th>City</th><th>Status</th><th>Payments</th><th>Total Paid</th></tr></thead>
            <tbody>
              {topLibraries?.length===0 ? <tr><td colSpan={6}><div className="empty">No data</div></td></tr>
              : topLibraries?.map((l,i)=>(
                <tr key={i}>
                  <td className="text-muted text-sm">{i+1}</td>
                  <td><div style={{fontWeight:600}}>{l.library_name}</div><div className="text-xs text-muted">{l.owner_name}</div></td>
                  <td className="text-sm text-muted">{l.city||"—"}</td>
                  <td>{statusBadge(l.subscription_status)}</td>
                  <td className="text-sm">{l.payment_count||0}</td>
                  <td><span className="text-green font-bold">{fmt(l.total_paid)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PLANS
// ══════════════════════════════════════════════════════════════════════════════
function Plans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{ api.plans().then(setPlans).finally(()=>setLoading(false)); },[]);

  return (
    <div>
      <div className="page-header">
        <div><h2 style={{fontFamily:"var(--font-display)",fontSize:20,fontWeight:700}}>SaaS Plans</h2></div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
        {loading ? <Spinner/> : plans.map(p=>(
          <div key={p.id} className="card" style={{borderColor:p.is_trial?"var(--accent)":p.price>=9000?"var(--gold)":"var(--border)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <span className={`badge ${p.is_trial?"badge-accent":p.price>=9000?"badge-gold":"badge-green"}`}>{p.is_trial?"Trial":p.price>=9000?"Annual":"Monthly"}</span>
              <span className={`badge ${p.is_active?"badge-green":"badge-gray"}`}>{p.is_active?"Active":"Inactive"}</span>
            </div>
            <div style={{fontFamily:"var(--font-display)",fontSize:18,fontWeight:800,marginBottom:4}}>{p.name}</div>
            <div style={{fontSize:28,fontWeight:800,color:"var(--gold)",marginBottom:4}}>{fmt(p.price)}<span style={{fontSize:12,fontWeight:400,color:"var(--text3)"}}>/period</span></div>
            <div className="text-sm text-muted">{p.duration_days} days</div>
            {p.description&&<div className="text-sm text-muted" style={{marginTop:6,fontSize:12}}>{p.description}</div>}
          </div>
        ))}
      </div>
      <div className="alert alert-warn" style={{marginTop:16}}><Icon name="warn" size={14}/>To modify plans, update them directly in the Supabase database or add an edit UI here.</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [admin, setAdmin]   = useState(null);
  const [page, setPage]     = useState("dashboard");
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (getToken()) {
      api.me().then(setAdmin).catch(()=>clearToken()).finally(()=>setLoading(false));
    } else { setLoading(false); }
  },[]);

  if (loading) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}><Spinner/></div>;
  if (!admin)  return <><style>{styles}</style><AuthPage onAuth={a=>{setAdmin(a); setPage("dashboard");}}/></>;

  const navItems = [
    { id:"dashboard", icon:"dashboard", label:"Dashboard",  section:"main" },
    { id:"libraries", icon:"users",     label:"Libraries",  section:"manage" },
    { id:"payments",  icon:"payment",   label:"Payments",   section:"manage" },
    { id:"coupons",   icon:"coupon",    label:"Coupons",    section:"manage" },
    { id:"plans",     icon:"plan",      label:"SaaS Plans", section:"manage" },
    { id:"reports",   icon:"chart",     label:"Reports",    section:"manage" },
  { id:"tools",     icon:"plan",      label:"Tools",      section:"manage" },
  ];

  const titles = { dashboard:"Dashboard", libraries:"Libraries", payments:"Payments", coupons:"Coupons", plans:"SaaS Plans", reports:"Reports", tools:"Tools" };
  const subs   = { dashboard:"Overview & metrics", libraries:"Manage library accounts", payments:"Track & record payments", coupons:"Discount codes", plans:"Subscription plans", reports:"Analytics & insights", tools:"Expiring, leads & quick actions" };

  const pages = { dashboard:<Dashboard/>, libraries:<Libraries/>, payments:<Payments/>, coupons:<Coupons/>, plans:<Plans/>, reports:<Reports/>, tools:<Tools/> };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <div className="logo-badge">
              <div className="logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="white" strokeWidth="2" strokeLinecap="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div><div className="logo-title">LIBRA</div><div className="logo-sub">librarydesk.in</div></div>
            </div>
            <div className="admin-badge">ADMIN</div>
          </div>
          <nav className="sidebar-nav">
            <div className="nav-section">
              <div className="nav-label">Main</div>
              {navItems.filter(i=>i.section==="main").map(i=>(
                <button key={i.id} className={`nav-item${page===i.id?" active":""}`} onClick={()=>setPage(i.id)}>
                  <Icon name={i.icon} size={15}/>{i.label}
                </button>
              ))}
            </div>
            <div className="nav-section">
              <div className="nav-label">Manage</div>
              {navItems.filter(i=>i.section==="manage").map(i=>(
                <button key={i.id} className={`nav-item${page===i.id?" active":""}`} onClick={()=>setPage(i.id)}>
                  <Icon name={i.icon} size={15}/>{i.label}
                </button>
              ))}
            </div>
          </nav>
          <div className="sidebar-footer">
            <div className="admin-info">
              <div className="admin-avatar">{admin.name?.[0]?.toUpperCase()||"A"}</div>
              <div><div style={{fontSize:12,fontWeight:600}}>{admin.name}</div><div style={{fontSize:10,color:"var(--text3)"}}>{admin.role}</div></div>
            </div>
            <button className="nav-item" onClick={()=>{clearToken();setAdmin(null);}} style={{color:"var(--red)"}}>
              <Icon name="logout" size={14}/>Sign Out
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div>
              <div className="topbar-title">{titles[page]}</div>
              <div className="topbar-sub">{subs[page]}</div>
            </div>
          </div>
          <div className="content">
            {pages[page]}
          </div>
        </main>
      </div>
    </>
  );
}
