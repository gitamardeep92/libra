// frontend/src/App.jsx
// Identical UI/UX to the previous version — only data layer changed.
// localStorage is gone. All state comes from API calls via src/api.js
import { useState, useEffect, useCallback } from "react";
import { api, setToken, getToken, clearToken } from "./api";

// ─── UTILS ────────────────────────────────────────────────────────────────────
const today      = () => new Date().toISOString().slice(0, 10);
const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const formatCurrency = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const addDays    = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const daysDiff   = (d1, d2 = today()) => Math.ceil((new Date(d1) - new Date(d2)) / 86400000);

// ── Trial / billing helpers ───────────────────────────────────────────────────
function getTrialDaysLeft(library) {
  if (!library?.trial_ends_at) return null;
  return daysDiff(library.trial_ends_at);
}
function isReadOnly(library) {
  if (!library) return false;
  const s = library.subscription_status;
  if (s === 'active') return false;
  if (s === 'trial') {
    const d = getTrialDaysLeft(library);
    return d !== null && d < 0;
  }
  return s === 'expired' || s === 'suspended';
}
function getTrialBannerType(library) {
  if (!library) return null;
  const s = library.subscription_status;
  if (s === 'active') return null;
  if (s === 'suspended') return 'suspended';
  if (s === 'expired') return 'expired';
  if (s === 'trial') {
    const d = getTrialDaysLeft(library);
    if (d === null) return null;
    if (d < 0)  return 'expired';
    if (d <= 3) return 'urgent';
    if (d <= 7) return 'warning';
    return 'info';
  }
  return null;
}
const openWhatsApp = (phone, message) => {
  const cleaned = phone ? phone.replace(/\D/g, '') : '';
  const num = cleaned.startsWith('91') ? cleaned : `91${cleaned}`;
  const url = `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
};

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 20, color = "currentColor" }) => {
  const icons = {
    book:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
    users:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    dollar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12M6 8h12M6 13h8a5 5 0 0 0 0-10"/><path d="M6 21l6-8"/></svg>,
    payment: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
    bell:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    chart:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
    plus:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    edit:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    trash:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
    logout: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    home:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    eye:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
    eyeoff: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
    check:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    x:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
    tag:    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    warn:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    seat2:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"/><path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"/></svg>,
    search: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
    id:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>,
    clock:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    menu:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>,
    spin:   <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{animation:"spin 1s linear infinite"}}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>,
    calendar:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    send:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    megaphone:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
    settings:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    key:<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    whatsapp:<svg width={size} height={size} viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>,
    rupee:      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h12M6 8h12"/><path d="M6 8a5 5 0 0 0 4 8l-4 5"/><path d="M16 21l-5-5"/></svg>,
    qr:         <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="5" y="5" width="3" height="3" fill={color}/><rect x="16" y="5" width="3" height="3" fill={color}/><rect x="5" y="16" width="3" height="3" fill={color}/><path d="M14 14h3v3M17 17h3v3M14 20h3"/></svg>,
    attendance: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
    link:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    plan:       <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
    coupon:     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
    marketing:  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  };
  return icons[name] || <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
};

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  @keyframes spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes modalIn{from{opacity:0;transform:scale(0.95) translateY(8px);}to{opacity:1;transform:none;}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(6px);}to{opacity:1;transform:none;}}
  @keyframes slideUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;}}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
  :root{
    --bg:#0a0c10;--surface:#11141a;--surface2:#181c25;--surface3:#1e2330;
    --border:#252b3a;--border2:#2e3648;
    --accent:#e8a838;--accent2:#f0c060;--accent-dim:rgba(232,168,56,0.12);--accent-glow:rgba(232,168,56,0.25);
    --text:#eef0f5;--text2:#8892a4;--text3:#5a6478;
    --green:#3dd68c;--green-dim:rgba(61,214,140,0.12);
    --red:#f06060;--red-dim:rgba(240,96,96,0.12);
    --yellow:#f5c542;--yellow-dim:rgba(245,197,66,0.14);
    --blue:#5b9cf6;--blue-dim:rgba(91,156,246,0.12);
    --purple:#a78bfa;--purple-dim:rgba(167,139,250,0.12);
    --gold:#e8a838;--gold-dim:rgba(232,168,56,0.12);
    --radius:14px;--radius-sm:8px;--shadow:0 4px 24px rgba(0,0,0,0.45);--transition:0.18s ease;
    --sidebar-w:252px;
    --topbar-h:60px;
    --bottom-nav-h:60px;
  }
  html{scroll-behavior:smooth;overflow-x:hidden;}
  body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden;max-width:100vw;}
  #root{overflow-x:hidden;max-width:100vw;}
  ::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--border2);border-radius:3px;}

  /* ── LAYOUT ── */
  .app{display:flex;min-height:100vh;position:relative;overflow-x:hidden;max-width:100vw;}
  .sidebar{
    width:var(--sidebar-w);background:var(--surface);border-right:1px solid var(--border);
    display:flex;flex-direction:column;position:fixed;top:0;left:0;height:100vh;
    z-index:200;transition:transform 0.25s cubic-bezier(0.4,0,0.2,1);overflow:hidden;
  }
  .sidebar-logo{padding:20px 20px 14px;border-bottom:1px solid var(--border);flex-shrink:0;}
  .logo-text{font-family:'Playfair Display',serif;font-size:20px;color:var(--accent);}
  .logo-sub{font-size:10px;color:var(--text3);letter-spacing:2.5px;text-transform:uppercase;margin-top:2px;}
  .sidebar-nav{flex:1;padding:12px 8px;overflow-y:auto;overflow-x:hidden;}
  .nav-section{margin-bottom:18px;}
  .nav-section-title{font-size:9.5px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;padding:0 12px;margin-bottom:5px;}
  .nav-item{
    display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-sm);
    cursor:pointer;color:var(--text2);font-size:13.5px;font-weight:500;
    transition:all var(--transition);margin-bottom:1px;border:none;background:none;
    width:100%;text-align:left;font-family:'DM Sans',sans-serif;
  }
  .nav-item:hover{background:var(--surface2);color:var(--text);}
  .nav-item.active{background:var(--accent-dim);color:var(--accent);}
  .nav-item .nbadge{margin-left:auto;background:var(--red);color:white;font-size:10px;font-weight:700;padding:2px 6px;border-radius:20px;min-width:18px;text-align:center;}
  .sidebar-footer{padding:12px 8px;border-top:1px solid var(--border);flex-shrink:0;}
  .lib-info{display:flex;align-items:center;gap:10px;padding:8px 12px;}
  .lib-avatar{width:32px;height:32px;border-radius:9px;background:var(--accent-dim);border:1px solid var(--accent);display:flex;align-items:center;justify-content:center;color:var(--accent);font-weight:700;font-size:13px;flex-shrink:0;}
  .sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:199;backdrop-filter:blur(2px);}
  .main{margin-left:var(--sidebar-w);flex:1;display:flex;flex-direction:column;min-height:100vh;transition:margin 0.25s ease;min-width:0;max-width:100%;}
  .topbar{
    background:var(--surface);border-bottom:1px solid var(--border);
    padding:0 24px;height:var(--topbar-h);
    display:flex;align-items:center;justify-content:space-between;
    position:sticky;top:0;z-index:100;gap:12px;
  }
  .topbar-left{display:flex;align-items:center;gap:12px;min-width:0;}
  .topbar-title{font-family:'Playfair Display',serif;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .topbar-sub{font-size:11px;color:var(--text3);display:none;}
  .topbar-right{display:flex;align-items:center;gap:8px;flex-shrink:0;}
  .mobile-toggle{display:none;background:none;border:none;cursor:pointer;color:var(--text2);padding:8px;border-radius:8px;align-items:center;justify-content:center;}
  .mobile-toggle:hover{background:var(--surface2);color:var(--text);}
  .content{padding:24px;flex:1;animation:fadeIn 0.2s ease;max-width:1400px;width:100%;}

  /* ── BOTTOM NAV (mobile only) ── */
  .bottom-nav{
    display:none;position:fixed;bottom:0;left:0;right:0;
    height:var(--bottom-nav-h);background:var(--surface);
    border-top:1px solid var(--border);z-index:150;
    padding-bottom:env(safe-area-inset-bottom);
  }
  .bottom-nav-inner{display:flex;height:100%;align-items:center;}
  .bottom-nav-item{
    flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
    gap:3px;cursor:pointer;padding:6px 4px;border:none;background:none;
    color:var(--text3);font-family:'DM Sans',sans-serif;font-size:9.5px;font-weight:600;
    transition:color var(--transition);text-transform:uppercase;letter-spacing:0.5px;
    position:relative;
  }
  .bottom-nav-item.active{color:var(--accent);}
  .bottom-nav-item .bnbadge{
    position:absolute;top:4px;right:calc(50% - 18px);
    background:var(--red);color:white;font-size:9px;font-weight:700;
    padding:1px 5px;border-radius:10px;min-width:16px;text-align:center;
  }

  /* ── BUTTONS ── */
  .btn{display:inline-flex;align-items:center;gap:7px;padding:9px 16px;border-radius:var(--radius-sm);font-size:13.5px;font-weight:600;cursor:pointer;transition:all var(--transition);border:none;font-family:'DM Sans',sans-serif;white-space:nowrap;touch-action:manipulation;}
  .btn:disabled{opacity:0.5;cursor:not-allowed;}
  .btn-primary{background:var(--accent);color:#0a0c10;}
  .btn-primary:not(:disabled):hover{background:var(--accent2);transform:translateY(-1px);box-shadow:0 4px 14px var(--accent-glow);}
  .btn-primary:active{transform:scale(0.97);}
  .btn-secondary{background:var(--surface2);color:var(--text);border:1px solid var(--border2);}
  .btn-secondary:hover{background:var(--surface3);}
  .btn-danger{background:var(--red-dim);color:var(--red);border:1px solid rgba(240,96,96,0.25);}
  .btn-danger:hover{background:var(--red);color:white;}
  .btn-ghost{background:transparent;color:var(--text2);padding:7px;border-radius:var(--radius-sm);}
  .btn-ghost:hover{background:var(--surface2);color:var(--text);}
  .btn-sm{padding:5px 11px;font-size:12px;}
  .btn-icon{width:34px;height:34px;padding:0;justify-content:center;}

  /* ── CARDS ── */
  .card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:20px;}
  .card-sm{padding:14px;}
  .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}

  /* ── STAT CARDS ── */
  .stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-bottom:24px;}
  .stat-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;position:relative;overflow:hidden;}
  .stat-card::before{content:'';position:absolute;top:0;right:0;width:64px;height:64px;border-radius:50%;opacity:0.07;transform:translate(18px,-18px);}
  .stat-card.gold::before{background:var(--accent)}.stat-card.green::before{background:var(--green)}.stat-card.red::before{background:var(--red)}.stat-card.blue::before{background:var(--blue)}.stat-card.purple::before{background:var(--purple)}
  .stat-label{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px;}
  .stat-value{font-family:'Playfair Display',serif;font-size:24px;font-weight:600;}
  .stat-card.gold .stat-value{color:var(--accent)}.stat-card.green .stat-value{color:var(--green)}.stat-card.red .stat-value{color:var(--red)}.stat-card.blue .stat-value{color:var(--blue)}.stat-card.purple .stat-value{color:var(--purple)}
  .stat-icon{position:absolute;top:16px;right:16px;opacity:0.4;}
  .stat-change{font-size:11px;margin-top:4px;color:var(--text3);}

  /* ── TABLE ── */
  .table-container{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:500px;}
  .table th{text-align:left;padding:10px 14px;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--text3);font-weight:600;border-bottom:1px solid var(--border);white-space:nowrap;}
  .table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:middle;}
  .table tr:last-child td{border-bottom:none;}
  .table tbody tr:hover td{background:var(--surface2);}

  /* ── BADGES ── */
  .badge{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:11.5px;font-weight:600;}
  .badge-green{background:var(--green-dim);color:var(--green)}.badge-red{background:var(--red-dim);color:var(--red)}.badge-gold{background:var(--accent-dim);color:var(--accent)}.badge-blue{background:var(--blue-dim);color:var(--blue)}.badge-purple{background:var(--purple-dim);color:var(--purple)}.badge-gray{background:var(--surface3);color:var(--text2)}.badge-yellow{background:var(--yellow-dim);color:var(--yellow)}

  /* ── FORMS ── */
  .form-group{margin-bottom:15px;}
  .label{display:block;font-size:11px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
  .input{width:100%;padding:10px 13px;background:var(--surface2);border:1.5px solid var(--border2);border-radius:var(--radius-sm);color:var(--text);font-size:14px;font-family:'DM Sans',sans-serif;transition:border-color var(--transition);outline:none;-webkit-appearance:none;appearance:none;}
  .input:focus{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-dim);}
  .input::placeholder{color:var(--text3);}
  .select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='none' stroke='%238892a4' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px;cursor:pointer;}
  .textarea{resize:vertical;min-height:76px;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  input[type="date"],input[type="time"],input[type="month"]{-webkit-appearance:none;appearance:none;color:var(--text);background:var(--surface2);cursor:pointer;min-width:0;width:100%;}
  input[type="time"]{min-width:130px;letter-spacing:0.5px;}
  input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator,input[type="month"]::-webkit-calendar-picker-indicator{filter:invert(0.6);cursor:pointer;}

  /* ── MODAL ── */
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:300;display:flex;align-items:center;justify-content:center;padding:16px;}
  .modal{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);width:100%;max-width:520px;max-height:92vh;overflow-y:auto;box-shadow:var(--shadow);animation:modalIn 0.18s ease;}
  .modal-lg{max-width:680px;}
  .modal-header{padding:20px 20px 0;display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
  .modal-title{font-family:'Playfair Display',serif;font-size:18px;}
  .modal-body{padding:0 20px;}
  .modal-footer{padding:18px 20px;display:flex;gap:10px;justify-content:flex-end;border-top:1px solid var(--border);margin-top:18px;}

  /* ── AUTH ── */
  .auth-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);position:relative;overflow:hidden;padding:20px;}
  .auth-bg{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at 50% -10%,rgba(232,168,56,0.07) 0%,transparent 70%);pointer-events:none;}
  .auth-card{width:100%;max-width:420px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;z-index:1;}
  .auth-logo{text-align:center;margin-bottom:24px;}
  .auth-logo-icon{width:64px;height:64px;border-radius:16px;overflow:hidden;margin:0 auto 10px;box-shadow:0 4px 20px rgba(232,168,56,0.3);}
  .auth-logo-icon img{width:100%;height:100%;object-fit:cover;}
  .auth-title{font-family:'Playfair Display',serif;font-size:24px;color:var(--text);margin-bottom:3px;}
  .auth-sub{font-size:13px;color:var(--text3);}
  .auth-toggle{text-align:center;margin-top:20px;font-size:13px;color:var(--text3);}
  .auth-toggle a{color:var(--accent);cursor:pointer;font-weight:600;}

  /* ── MISC COMPONENTS ── */
  .search-bar{display:flex;align-items:center;gap:9px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);padding:7px 13px;flex:1;max-width:280px;}
  .search-bar input{background:none;border:none;color:var(--text);font-size:13.5px;font-family:'DM Sans',sans-serif;outline:none;flex:1;min-width:0;}
  .search-bar input::placeholder{color:var(--text3);}
  .page-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;}
  .page-header-left h1{font-family:'Playfair Display',serif;font-size:22px;margin-bottom:2px;}
  .page-header-left p{font-size:13px;color:var(--text3);}
  .section-title{font-size:11.5px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px;display:flex;align-items:center;gap:8px;}
  .section-title::after{content:'';flex:1;height:1px;background:var(--border);}
  .tabs{display:flex;gap:3px;background:var(--surface2);border-radius:var(--radius-sm);padding:4px;margin-bottom:20px;width:fit-content;overflow-x:auto;max-width:100%;}
  .tab{padding:7px 14px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;color:var(--text3);transition:all var(--transition);border:none;background:none;font-family:'DM Sans',sans-serif;white-space:nowrap;}
  .tab.active{background:var(--surface);color:var(--text);box-shadow:0 1px 6px rgba(0,0,0,0.28);}
  .pill-tabs{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;}
  .pill{padding:5px 13px;border-radius:20px;font-size:12px;font-weight:500;cursor:pointer;background:var(--surface2);color:var(--text2);border:1px solid var(--border);transition:all var(--transition);white-space:nowrap;}
  .pill.active{background:var(--accent-dim);color:var(--accent);border-color:var(--accent);}
  .plans-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:13px;}
  .plan-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;transition:all var(--transition);cursor:pointer;}
  .plan-card:hover{border-color:var(--accent);transform:translateY(-2px);}
  .reminder-chip{display:flex;align-items:center;gap:10px;padding:10px 13px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface2);margin-bottom:6px;}
  .reminder-chip.urgent{border-color:rgba(240,96,96,0.3);background:rgba(240,96,96,0.05);}
  .reminder-chip.soon{border-color:rgba(232,168,56,0.3);background:rgba(232,168,56,0.05);}
  .reminder-chip.ok{border-color:rgba(61,214,140,0.2);background:rgba(61,214,140,0.03);}
  .alert{padding:11px 14px;border-radius:var(--radius-sm);border:1px solid;display:flex;align-items:flex-start;gap:9px;margin-bottom:12px;font-size:13px;}
  .alert-warning{background:rgba(232,168,56,0.08);border-color:rgba(232,168,56,0.3);}
  .alert-success{background:var(--green-dim);border-color:rgba(61,214,140,0.3);}
  .alert-error{background:var(--red-dim);border-color:rgba(240,96,96,0.3);}
  .seat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(54px,1fr));gap:7px;}
  .seat{width:100%;aspect-ratio:1;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer;transition:all var(--transition);border:1.5px solid;line-height:1.2;}
  .seat.available{background:var(--green-dim);border-color:var(--green);color:var(--green);}
  .seat.available:hover{background:rgba(61,214,140,0.22);transform:scale(1.07);}
  .seat.half{background:var(--yellow-dim);border-color:var(--yellow);color:var(--yellow);}
  .seat.occupied{background:var(--red-dim);border-color:var(--red);color:var(--red);}
  .seat-legend{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;}
  .seat-legend-item{display:flex;align-items:center;gap:5px;font-size:11.5px;color:var(--text2);}
  .seat-legend-dot{width:11px;height:11px;border-radius:3px;border:1.5px solid;}
  .bar-chart{display:flex;align-items:flex-end;gap:6px;height:100px;padding:6px 0;}
  .bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:4px;}
  .bar{width:100%;border-radius:4px 4px 0 0;background:var(--accent-dim);border:1px solid var(--accent);transition:height 0.6s ease;min-height:3px;}
  .bar-label{font-size:9.5px;color:var(--text3);}
  .bar-value{font-size:10px;color:var(--accent);font-weight:600;}
  .empty-state{text-align:center;padding:44px 20px;}
  .empty-icon{width:54px;height:54px;background:var(--surface2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;opacity:0.45;}
  .empty-title{font-size:16px;font-weight:600;color:var(--text2);margin-bottom:5px;}
  .empty-sub{font-size:12.5px;color:var(--text3);}
  .divider{height:1px;background:var(--border);margin:14px 0;}
  .avatar{width:32px;height:32px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;}
  .w-full{width:100%;}.flex{display:flex;}.items-center{align-items:center;}.justify-between{justify-content:space-between;}
  .gap-2{gap:8px;}.gap-3{gap:12px;}
  .text-sm{font-size:13px;}.text-xs{font-size:11px;}.text-muted{color:var(--text3);}.text-accent{color:var(--accent);}.text-green{color:var(--green);}.text-red{color:var(--red);}.text-yellow{color:var(--yellow);}
  .font-bold{font-weight:700;}.font-600{font-weight:600;}
  .loading-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:400;}

  /* ── PWA INSTALL FLOATING BUTTON ── */
  .pwa-fab{
    position:fixed;bottom:calc(var(--bottom-nav-h) + 16px);right:16px;
    width:48px;height:48px;border-radius:50%;
    background:var(--accent);color:#0a0c10;
    border:none;cursor:pointer;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 4px 16px rgba(232,168,56,0.5);
    z-index:500;animation:fadeIn 0.3s ease;
    transition:transform 0.2s ease,box-shadow 0.2s ease;
  }
  .pwa-fab:hover{transform:scale(1.1);box-shadow:0 6px 22px rgba(232,168,56,0.65);}
  .pwa-fab:active{transform:scale(0.95);}
  .pwa-fab-tooltip{
    position:fixed;bottom:calc(var(--bottom-nav-h) + 22px);right:72px;
    background:var(--surface);border:1px solid var(--border2);
    padding:7px 12px;border-radius:8px;font-size:12px;font-weight:600;
    white-space:nowrap;pointer-events:none;
    box-shadow:0 4px 14px rgba(0,0,0,0.3);
    animation:fadeIn 0.2s ease;
  }
  @media(max-width:768px){
    .pwa-fab{bottom:calc(var(--bottom-nav-h) + 12px);right:12px;}
    .pwa-fab-tooltip{bottom:calc(var(--bottom-nav-h) + 18px);right:68px;}
  }

  /* ══════════════════════════════
     TABLET (768px – 1024px)
     ══════════════════════════════ */
  @media(max-width:1024px){
    :root{--sidebar-w:220px;}
    .content{padding:20px;}
    .topbar{padding:0 18px;}
    .grid-3{grid-template-columns:1fr 1fr;}
    .stats-grid{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));}
  }

  /* ══════════════════════════════
     MOBILE (≤768px)
     ══════════════════════════════ */
  @media(max-width:768px){
    :root{--topbar-h:54px;}

    /* Sidebar becomes a drawer */
    .sidebar{transform:translateX(-100%);width:280px;box-shadow:4px 0 32px rgba(0,0,0,0.5);}
    .sidebar.open{transform:translateX(0);}
    .sidebar-overlay{display:block;}
    .sidebar-overlay.hidden{display:none;}

    /* Main expands full width */
    .main{margin-left:0;}

    /* Topbar */
    .topbar{padding:0 14px;gap:8px;overflow:hidden;}
    .topbar-title{font-size:15px;}
    .mobile-toggle{display:flex;}
    .search-bar{max-width:100%;flex:1;}
    .topbar-owner-name{display:none;}
    .topbar-lib-name{display:none;}
    .topbar-trial-badge{font-size:10px;padding:2px 6px;}

    /* Content */
    .content{padding:14px;padding-bottom:calc(var(--bottom-nav-h) + 14px);}

    /* Bottom nav visible */
    .bottom-nav{display:block;}

    /* Grid collapses */
    .grid-2,.grid-3{grid-template-columns:1fr;}
    .dashboard-grid{grid-template-columns:1fr!important;}
    .stats-grid{grid-template-columns:1fr 1fr;}
    .form-row{grid-template-columns:1fr;}
    .plans-grid{grid-template-columns:1fr 1fr;}

    /* Page header stacks */
    .page-header{flex-direction:column;align-items:flex-start;}
    .page-header .btn{width:100%;justify-content:center;}

    /* Table horizontal scroll */
    .table-container{margin:0 -14px;padding:0 14px;}
    .table th,.table td{padding:10px 12px;}

    /* Modal full-screen on mobile */
    .modal-overlay{padding:0;align-items:flex-end;}
    .modal{max-width:100%;border-radius:20px 20px 0 0;max-height:85vh;}
    .modal-lg{max-width:100%;}

    /* Stat cards compact */
    .stat-card{padding:13px;}
    .stat-value{font-size:20px;}

    /* Card compact */
    .card{padding:14px;}

    /* Auth page */
    .auth-card{padding:24px 20px;}

    /* Hide topbar search on mobile, show it in page */
    .topbar .search-bar{display:none;}

    /* Pill tabs scroll */
    .pill-tabs{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch;}
    .tabs{width:100%;max-width:100%;}

    /* Seat grid bigger touch targets */
    .seat-grid{grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px;}
    .seat{font-size:10px;}

    /* Bar chart compact */
    .bar-chart{height:80px;}
    .bar-label{font-size:9px;}


  }

  /* ══════════════════════════════
     SMALL MOBILE (≤380px)
     ══════════════════════════════ */
  @media(max-width:480px){
    input[type="time"]{font-size:15px;padding:11px 10px;}
    .form-row{grid-template-columns:1fr;}
  }
  @media(max-width:380px){
    .stats-grid{grid-template-columns:1fr;}
    .plans-grid{grid-template-columns:1fr;}
    .content{padding:10px;padding-bottom:calc(var(--bottom-nav-h) + 10px);}
    .stat-value{font-size:18px;}
    .page-header-left h1{font-size:18px;}
  }

  /* ══════════════════════════════
     DESKTOP LARGE (>1400px)
     ══════════════════════════════ */
  @media(min-width:1400px){
    :root{--sidebar-w:270px;}
    .content{padding:32px;}
    .grid-3{grid-template-columns:1fr 1fr 1fr;}
    .stats-grid{grid-template-columns:repeat(auto-fill,minmax(200px,1fr));}
  }
`;


// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Spinner({ size = 20 }) {
  return <Icon name="spin" size={size} color="var(--accent)" />;
}

function ConfirmDialog({ title, message, onConfirm, onCancel, confirmLabel = "Confirm", danger = false }) {
  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header"><h2 className="modal-title">{title}</h2><button className="btn btn-ghost btn-icon" onClick={onCancel}><Icon name="x" size={17} /></button></div>
        <div className="modal-body" style={{ paddingBottom: 4 }}><p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.6 }}>{message}</p></div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onCancel}>Cancel</button><button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

// ─── DATA HOOK ────────────────────────────────────────────────────────────────
// Loads ALL data for the current library in one pass on mount & after mutations
function useLibraryData(isLoggedIn) {
  const [data, setData] = useState({ shifts: [], plans: [], students: [], subscriptions: [], reminders: [], expenses: [], totalSeats: 30 });
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async (keys = null) => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const toLoad = keys || ["shifts", "plans", "students", "subscriptions", "reminders", "expenses"];
      const results = await Promise.all(toLoad.map(k => api[k].list()));
      const updates = {};
      toLoad.forEach((k, i) => { updates[k] = results[i]; });
      setData(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error("Data reload error:", err);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => { if (isLoggedIn) reload(); }, [isLoggedIn]);

  return { data, setData, reload, loading };
}

// ─── AMOUNT CELL (hidden by default, reveal on click) ────────────────────────
function AmountCell({ amount }) {
  const [show, setShow] = useState(false);
  return (
    <td>
      <button onClick={()=>setShow(s=>!s)}
        style={{background:"none",border:"none",cursor:"pointer",padding:"2px 6px",borderRadius:6,
                fontSize:13,fontWeight:700,color:show?"var(--accent)":"var(--text3)",
                background:show?"var(--accent-dim)":"var(--surface3)",transition:"all 0.15s"}}>
        {show ? formatCurrency(amount) : "₹ ••••"}
      </button>
    </td>
  );
}

// ─── SEAT HELPERS (same logic as before, now uses data arrays not lib object) ─
// ─── SEAT STATUS (operation-hours aware) ─────────────────────────────────────
const toMins = (t) => { const [h,m] = (t||"00:00").split(":").map(Number); return h*60+(m||0); };

// Returns how many minutes of the operation window a shift covers
function shiftCoverage(shift, opStart, opEnd) {
  if (!shift) return 0;
  const s = Math.max(toMins(shift.start_time), opStart);
  const e = Math.min(toMins(shift.end_time),   opEnd);
  return Math.max(0, e - s);
}

// Get operation window from library settings (fallback: earliest shift → latest shift)
function getOperationWindow(library, shifts) {
  const opOpen  = library?.open_time  || null;
  const opClose = library?.close_time || null;
  if (opOpen && opClose) return { opStart: toMins(opOpen), opEnd: toMins(opClose) };
  if (!shifts || shifts.length === 0) return { opStart: 8*60, opEnd: 21*60 };
  return {
    opStart: Math.min(...shifts.map(s => toMins(s.start_time))),
    opEnd:   Math.max(...shifts.map(s => toMins(s.end_time))),
  };
}

// Build a set of covered minutes for a seat from its active subscriptions
function getCoveredMins(seatNum, subscriptions, shifts) {
  const active = (subscriptions||[]).filter(s => s.status==="active" && Number(s.seat_number)===seatNum && daysDiff(s.end_date)>=0);
  const mins = new Set();
  active.forEach(sub => {
    const sh = (shifts||[]).find(s => s.id===sub.shift_id);
    if (sh) for (let m = toMins(sh.start_time); m < toMins(sh.end_time); m++) mins.add(m);
  });
  return mins;
}

function getSeatStatus(seatNum, subscriptions, shifts, library) {
  const active = (subscriptions||[]).filter(s => s.status==="active" && Number(s.seat_number)===seatNum && daysDiff(s.end_date)>=0);
  if (active.length === 0) return "available";
  const { opStart, opEnd } = getOperationWindow(library, shifts);
  const totalMins = opEnd - opStart;
  if (totalMins <= 0) return active.length > 0 ? "occupied" : "available";
  // Count how many operation minutes are covered by active subscriptions
  const covered = getCoveredMins(seatNum, subscriptions, shifts);
  const coveredInOp = [...covered].filter(m => m >= opStart && m < opEnd).length;
  if (coveredInOp >= totalMins * 0.97) return "occupied";
  if (coveredInOp > 0) return "half";
  return "available";
}

function getSeatOccupants(seatNum, subscriptions) {
  // Active subs + recently expired (within 10 days) for info display
  return (subscriptions||[]).filter(s =>
    Number(s.seat_number)===seatNum &&
    s.status==="active" &&
    daysDiff(s.end_date) >= -10
  ).sort((a,b) => daysDiff(a.end_date) - daysDiff(b.end_date));
}

function getAvailableShiftsForSeat(seatNum, subscriptions, shifts, library) {
  const { opStart, opEnd } = getOperationWindow(library, shifts);
  const covered = getCoveredMins(seatNum, subscriptions, shifts);
  const occupiedShiftIds = (subscriptions||[])
    .filter(s => s.status==="active" && Number(s.seat_number)===seatNum && daysDiff(s.end_date)>=0)
    .map(s => s.shift_id);
  return (shifts||[]).filter(sh => {
    if (occupiedShiftIds.includes(sh.id)) return false;
    // Check if shift has any uncovered minutes within operation window
    const shStart = Math.max(toMins(sh.start_time), opStart);
    const shEnd   = Math.min(toMins(sh.end_time),   opEnd);
    for (let m = shStart; m < shEnd; m++) {
      if (!covered.has(m)) return true;
    }
    return false;
  });
}

// ─── SEAT PANEL ───────────────────────────────────────────────────────────────
function SeatPanel({ data, library, onUpdate, onCreateSubscription, showControls = false }) {
  const [tooltip, setTooltip] = useState(null);
  const [saving, setSaving] = useState(false);
  const totalSeats = library?.total_seats || data.totalSeats || 30;

  const updateTotal = async (n) => {
    if (!n || n < 1) return;
    setSaving(true);
    try {
      await api.auth.updateSeats(n);
      onUpdate({ totalSeats: n });
    } finally { setSaving(false); }
  };

  const updateOpHours = async (openTime, closeTime) => {
    setSaving(true);
    try {
      await api.auth.updateOpHours(openTime, closeTime);
      onUpdate({ open_time: openTime, close_time: closeTime });
    } finally { setSaving(false); }
  };

  const status  = (n) => getSeatStatus(n, data.subscriptions, data.shifts, library);
  const occs    = (n) => getSeatOccupants(n, data.subscriptions);
  const freeShifts = (n) => getAvailableShiftsForSeat(n, data.subscriptions, data.shifts, library);

  const handleClick = (n) => {
    const s = status(n);
    // Fully occupied seats open tooltip (info only, no subscribe button)
    if (s === "available" && onCreateSubscription) { onCreateSubscription({ seatNumber: n, shiftId: "" }); return; }
    setTooltip(tooltip === n ? null : n);
  };

  return (
    <>
      {showControls && (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-sm text-muted">Total seats:</span>
            <input className="input" type="number" min="1" style={{ width: 78 }} defaultValue={totalSeats}
              onBlur={e => { const n = Number(e.target.value); if (n !== totalSeats && n >= 1) updateTotal(n); }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-sm text-muted">Operation hours:</span>
            <input className="input" type="time" style={{ width: 110 }} defaultValue={library?.open_time || "08:00"}
              onBlur={e => { if(e.target.value) updateOpHours(e.target.value, library?.close_time || "21:00"); }} />
            <span className="text-sm text-muted">to</span>
            <input className="input" type="time" style={{ width: 110 }} defaultValue={library?.close_time || "21:00"}
              onBlur={e => { if(e.target.value) updateOpHours(library?.open_time || "08:00", e.target.value); }} />
          </div>
          {saving && <Spinner size={16} />}
        </div>
      )}
      <div className="seat-legend">
        {[["available","var(--green)","Free"],["half","var(--yellow)","Partially Occupied"],["occupied","var(--red)","Fully Occupied"]].map(([cls,color,label])=>(
          <div key={cls} className="seat-legend-item"><div className="seat-legend-dot" style={{borderColor:color,background:`${color}22`}}/>{label}</div>
        ))}
      </div>
      <div className="seat-grid">
        {Array.from({length:totalSeats},(_,i)=>i+1).map(n=>{
          const s=status(n);
          return(
            <div key={n} className={`seat ${s}`} onClick={()=>handleClick(n)} title={`Seat #${n}`}>
              <span>{n}</span>
              {s==="half"&&<div style={{width:5,height:5,borderRadius:"50%",background:"var(--yellow)",marginTop:2}}/>}
              {s==="occupied"&&<div style={{width:5,height:5,borderRadius:"50%",background:"var(--red)",marginTop:2}}/>}
            </div>
          );
        })}
      </div>
      {tooltip!==null&&(()=>{
        const s=status(tooltip);
        const oList=occs(tooltip);
        const free=freeShifts(tooltip);
        return(
          <div className="modal-overlay" onClick={()=>setTooltip(null)}>
            <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
              <div className="modal-header"><h2 className="modal-title">Seat #{tooltip}</h2><button className="btn btn-ghost btn-icon" onClick={()=>setTooltip(null)}><Icon name="x" size={17}/></button></div>
              <div className="modal-body" style={{paddingBottom:4}}>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  <span className={`badge ${s==="available"?"badge-green":s==="half"?"badge-yellow":"badge-red"}`}>{s==="available"?"Free":s==="half"?"Half Occupied":"Fully Occupied"}</span>
                  {free.map(sh=><span key={sh.id} className="badge badge-green" style={{fontSize:11}}>Avail: {sh.name}</span>)}
                </div>
                {oList.length>0&&<>
                  <div className="section-title" style={{fontSize:11}}>Current Occupants</div>
                  {oList.map((sub,i)=>(
                    <div key={i} style={{background:"var(--surface3)",borderRadius:8,padding:"10px 12px",marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <div><div style={{fontWeight:700,fontSize:14}}>{sub.student_name}</div><div className="text-xs text-muted">{sub.student_phone}</div></div>
                        <div style={{textAlign:"right"}}>
                          <div className="text-xs text-muted">Expires</div>
                          <div style={{fontSize:13,fontWeight:600}}>{formatDate(sub.end_date)}</div>
                          {(()=>{const d=daysDiff(sub.end_date);return<div className={`text-xs ${d<0?"text-red":d<=5?"text-yellow":"text-green"}`}>{d<0?`Expired ${Math.abs(d)}d ago`:d===0?"Today":`${d}d left`}</div>})()}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7,marginTop:8,flexWrap:"wrap"}}>
                        <span className="badge badge-blue" style={{fontSize:11}}>{sub.plan_name}</span>
                        {sub.shift_name&&<span className="badge badge-purple" style={{fontSize:11}}>{sub.shift_name}</span>}
                        <span className="badge badge-gold" style={{fontSize:11}}>{formatCurrency(sub.amount)}</span>
                      </div>
                    </div>
                  ))}
                </>}
                {(s==="available"||s==="half")&&onCreateSubscription&&<>
                  <div className="divider"/>
                  <div style={{fontSize:13,color:"var(--text2)",marginBottom:10}}>{s==="half"?`${free.length} shift(s) still available.`:"Seat is free."}</div>
                  <button className="btn btn-primary w-full" style={{justifyContent:"center"}} onClick={()=>{setTooltip(null);onCreateSubscription({seatNumber:tooltip,shiftId:free[0]?.id||""});}}>
                    <Icon name="plus" size={15}/>Add Subscription for Seat #{tooltip}
                  </button>
                </>}
              </div>
              <div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setTooltip(null)}>Close</button></div>
            </div>
          </div>
        );
      })()}
    </>
  );
}


// ─── MARKETING PAGE ───────────────────────────────────────────────────────────
// ─── ATTENDANCE PAGE ──────────────────────────────────────────────────────────
function Attendance({ library }) {
  const [tab, setTab]           = useState("today");   // today | history | summary | qr
  const [today, setToday]       = useState([]);
  const [history, setHistory]   = useState([]);
  const [summary, setSummary]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [fromDate, setFromDate] = useState(new Date(Date.now()-7*86400000).toISOString().slice(0,10));
  const [toDate, setToDate]     = useState(new Date().toISOString().slice(0,10));
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0,7));

  const qrUrl = `https://libra-backend-gjgo.onrender.com/checkin/${library?.id}`;

  const load = async () => {
    setLoading(true);
    try {
      if (tab==="today")   { const r = await api.attendance.today(); setToday(r); }
      if (tab==="history") { const r = await api.attendance.history({ from:fromDate, to:toDate }); setHistory(r); }
      if (tab==="summary") { const r = await api.attendance.summary(summaryMonth); setSummary(r); }
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(()=>{ load(); },[tab, fromDate, toDate, summaryMonth]);

  const durStr = (checkIn, checkOut) => {
    if (!checkOut) return <span style={{color:"var(--green)",fontWeight:600}}>● In</span>;
    const mins = Math.round((new Date(checkOut)-new Date(checkIn))/60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins/60)}h ${mins%60}m`;
  };

  const tabBtn = (id, label) => (
    <button onClick={()=>setTab(id)} style={{
      padding:"9px 18px", border:"none", borderRadius:8, cursor:"pointer",
      fontWeight:600, fontSize:13,
      background: tab===id ? "var(--accent-dim)" : "transparent",
      color: tab===id ? "var(--accent2)" : "var(--text3)",
      borderBottom: tab===id ? "2px solid var(--accent)" : "2px solid transparent",
    }}>{label}</button>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>Attendance</h1><p>QR check-in & daily logs</p></div>
        <button className="btn btn-primary" onClick={()=>setTab("qr")} style={{gap:8}}>
          <Icon name="qr" size={15}/>Show QR Code
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid var(--border)"}}>
        {tabBtn("today",   "📋 Today")}
        {tabBtn("history", "📅 History")}
        {tabBtn("summary", "📊 Monthly Summary")}
        {tabBtn("qr",      "📱 QR Code")}
      </div>

      {/* ── TODAY ── */}
      {tab==="today" && (
        <div>
          <div style={{display:"flex",gap:12,marginBottom:16}}>
            <div className="stat-card green" style={{flex:1}}>
              <div className="stat-label">Currently In</div>
              <div className="stat-value">{today.filter(a=>!a.check_out).length}</div>
            </div>
            <div className="stat-card blue" style={{flex:1}}>
              <div className="stat-label">Total Today</div>
              <div className="stat-value">{today.length}</div>
            </div>
            <div className="stat-card" style={{flex:1}}>
              <div className="stat-label">Checked Out</div>
              <div className="stat-value">{today.filter(a=>a.check_out).length}</div>
            </div>
          </div>
          {loading ? <div style={{textAlign:"center",padding:40}}><Spinner size={28}/></div> :
            today.length===0 ? (
              <div className="card"><div className="empty-state">
                <div className="empty-icon">📋</div>
                <div className="empty-title">No check-ins today yet</div>
                <div className="empty-sub">Share the QR code with students to start tracking</div>
              </div></div>
            ) : (
              <div className="card" style={{padding:0}}>
                <table className="table"><thead><tr>
                  <th>Student</th><th>Check In</th><th>Check Out</th><th>Duration</th><th>Shift</th>
                </tr></thead>
                <tbody>
                  {today.map(a=>(
                    <tr key={a.id}>
                      <td><div style={{fontWeight:600}}>{a.student_name}</div><div className="text-xs text-muted">{a.student_phone}</div></td>
                      <td className="text-sm">{new Date(a.check_in).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</td>
                      <td className="text-sm">{a.check_out ? new Date(a.check_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                      <td>{durStr(a.check_in, a.check_out)}</td>
                      <td>{a.shift_name ? <span className="badge badge-purple" style={{fontSize:11}}>{a.shift_name}</span> : <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )
          }
        </div>
      )}

      {/* ── HISTORY ── */}
      {tab==="history" && (
        <div>
          <div className="card" style={{marginBottom:16,display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap"}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="label">From</label>
              <input className="input" type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{width:160}}/>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="label">To</label>
              <input className="input" type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{width:160}}/>
            </div>
            <button className="btn btn-primary" onClick={load}>Filter</button>
          </div>
          {loading ? <div style={{textAlign:"center",padding:40}}><Spinner size={28}/></div> :
            history.length===0 ? (
              <div className="card"><div className="empty-state"><div className="empty-icon">📅</div><div className="empty-title">No records found</div></div></div>
            ) : (
              <div className="card" style={{padding:0}}>
                <table className="table"><thead><tr>
                  <th>Date</th><th>Student</th><th>Check In</th><th>Check Out</th><th>Duration</th>
                </tr></thead>
                <tbody>
                  {history.map(a=>(
                    <tr key={a.id}>
                      <td className="text-sm text-muted">{new Date(a.date).toLocaleDateString("en-IN",{day:"numeric",month:"short"})}</td>
                      <td><div style={{fontWeight:600}}>{a.student_name}</div></td>
                      <td className="text-sm">{new Date(a.check_in).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</td>
                      <td className="text-sm">{a.check_out ? new Date(a.check_out).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}</td>
                      <td>{durStr(a.check_in, a.check_out)}</td>
                    </tr>
                  ))}
                </tbody></table>
              </div>
            )
          }
        </div>
      )}

      {/* ── SUMMARY ── */}
      {tab==="summary" && (
        <div>
          <div className="card" style={{marginBottom:16,display:"flex",gap:12,alignItems:"flex-end"}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="label">Month</label>
              <input className="input" type="month" value={summaryMonth} onChange={e=>setSummaryMonth(e.target.value)} style={{width:180}}/>
            </div>
            <button className="btn btn-primary" onClick={load}>Load</button>
          </div>
          {loading ? <div style={{textAlign:"center",padding:40}}><Spinner size={28}/></div> :
            <div className="card" style={{padding:0}}>
              <table className="table"><thead><tr>
                <th>Student</th><th>Days Present</th><th>Total Hours</th><th>Attendance %</th>
              </tr></thead>
              <tbody>
                {summary.map(s=>{
                  const daysInMonth = new Date(summaryMonth.split("-")[0], summaryMonth.split("-")[1], 0).getDate();
                  const pct = Math.round((s.days_present/daysInMonth)*100);
                  return (
                    <tr key={s.id}>
                      <td><div style={{fontWeight:600}}>{s.name}</div><div className="text-xs text-muted">{s.phone}</div></td>
                      <td><span className="badge badge-blue">{s.days_present} days</span></td>
                      <td className="text-sm">{s.total_hours > 0 ? `${s.total_hours}h` : "—"}</td>
                      <td>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{flex:1,height:6,background:"var(--surface3)",borderRadius:3,overflow:"hidden"}}>
                            <div style={{width:`${pct}%`,height:"100%",background:pct>=75?"var(--green)":pct>=50?"var(--yellow)":"var(--red)",borderRadius:3,transition:"width .3s"}}/>
                          </div>
                          <span style={{fontSize:12,fontWeight:600,minWidth:32,color:pct>=75?"var(--green)":pct>=50?"var(--yellow)":"var(--red)"}}>{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          }
        </div>
      )}

      {/* ── QR CODE ── */}
      {tab==="qr" && (
        <div style={{maxWidth:480,margin:"0 auto"}}>
          <div className="card" style={{textAlign:"center",padding:32}}>
            <div style={{fontWeight:700,fontSize:18,marginBottom:4}}>{library?.library_name}</div>
            <div style={{color:"var(--text3)",fontSize:13,marginBottom:24}}>Students scan this QR to check in / check out</div>

            {/* QR Code rendered via Google Charts API — works without any library */}
            <div style={{display:"inline-block",padding:16,background:"white",borderRadius:16,marginBottom:20}}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=000000&margin=10`}
                alt="QR Code"
                style={{width:220,height:220,display:"block"}}
              />
            </div>

            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,color:"var(--text3)",marginBottom:6}}>Check-in URL</div>
              <div style={{background:"var(--surface2)",borderRadius:8,padding:"10px 14px",fontSize:12,fontFamily:"monospace",wordBreak:"break-all",color:"var(--accent2)"}}>
                {qrUrl}
              </div>
            </div>

            <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
              <button className="btn btn-primary" onClick={()=>{
                const link = document.createElement("a");
                link.href = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(qrUrl)}&bgcolor=ffffff&color=000000&margin=20`;
                link.download = `${library?.library_name}-qr.png`;
                link.target = "_blank";
                link.click();
              }}>⬇️ Download QR</button>
              <button className="btn btn-secondary" onClick={()=>{
                navigator.clipboard.writeText(qrUrl);
                alert("Link copied to clipboard!");
              }}>📋 Copy Link</button>
              <a href={qrUrl} target="_blank" rel="noreferrer" className="btn btn-secondary">🔗 Open Page</a>
            </div>

            <div style={{marginTop:20,padding:"12px 16px",background:"var(--surface2)",borderRadius:10,fontSize:12,color:"var(--text2)",lineHeight:1.8,textAlign:"left"}}>
              <strong style={{color:"var(--text)"}}>How it works:</strong><br/>
              1. Print or display this QR in your library<br/>
              2. Student scans → enters their Student ID<br/>
              3. First scan = Check In ✅ · Second scan = Check Out 🚪<br/>
              4. View live log in the "Today" tab
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Marketing({ data, library }) {
  const UNSPLASH_KEY = import.meta.env.VITE_UNSPLASH_KEY || "";
  const [mainTab, setMainTab] = useState("whatsapp"); // whatsapp | social
  const [selectedShifts, setSelectedShifts] = useState([]);
  const [statusFilter, setStatusFilter]     = useState("active"); // active | expiring | all
  const [msgTemplate, setMsgTemplate]       = useState("custom");
  const [customMsg, setCustomMsg]           = useState("");
  const [preview, setPreview]               = useState(null);

  const templates = {
    renewal:  (s) => `Hi ${s.name}, your library subscription expires on ${formatDate(s.end_date)}. Please renew to continue your access. Visit us soon! — ${library?.library_name}`,
    payment:  (s) => `Hi ${s.name}, this is a reminder about your pending payment for ${library?.library_name}. Please clear dues at your earliest. Thank you!`,
    announce: (s) => `Dear ${s.name}, we have an important announcement from ${library?.library_name}. ${customMsg}`,
    custom:   (s) => customMsg.replace("{name}", s.name).replace("{library}", library?.library_name||""),
  };

  const toggleShift = (id) => setSelectedShifts(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id]);

  // Build recipient list based on filters
  const recipients = (data.students||[]).filter(st => {
    if (st.status !== "active") return false;
    const activeSub = (data.subscriptions||[]).find(s =>
      s.student_id===st.id && s.status==="active" && daysDiff(s.end_date)>=0
    );
    // Shift filter
    if (selectedShifts.length > 0) {
      if (!activeSub) return false;
      if (!selectedShifts.includes(activeSub.shift_id)) return false;
    }
    // Status filter
    if (statusFilter==="active"   && !activeSub) return false;
    if (statusFilter==="expiring" && (!activeSub || daysDiff(activeSub.end_date)>7)) return false;
    if (statusFilter==="inactive") return st.status==="active" && !activeSub;
    return true;
  }).map(st => {
    const sub = (data.subscriptions||[]).find(s=>s.student_id===st.id&&s.status==="active"&&daysDiff(s.end_date)>=0);
    return { ...st, end_date: sub?.end_date, plan_name: sub?.plan_name, shift_name: sub?.shift_name };
  });

  const getMessage = (st) => {
    if (msgTemplate==="custom") return customMsg.replace(/\{name\}/g,st.name).replace(/\{library\}/g,library?.library_name||"");
    return templates[msgTemplate](st);
  };

  const sendAll = () => {
    recipients.forEach(st => {
      if (st.phone) openWhatsApp(st.phone, getMessage(st));
    });
  };

  // ── Social Post state ──
  const [caption, setCaption]       = useState("");
  const [images, setImages]         = useState([]);
  const [selImg, setSelImg]         = useState(null);
  const [imgQuery, setImgQuery]     = useState("library study students");
  const [imgLoading, setImgLoading] = useState(false);
  const [fbPage, setFbPage]         = useState(localStorage.getItem("lib_fb_page")||"");
  const [igHandle, setIgHandle]     = useState(localStorage.getItem("lib_ig_handle")||"");
  const [socialSaved, setSocialSaved] = useState(false);

  const fetchImages = async (q) => {
    setImgLoading(true);
    try {
      const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape&client_id=${UNSPLASH_KEY}`);
      const d = await r.json();
      setImages(d.results||[]);
      if(d.results?.length) setSelImg(d.results[0]);
    } catch(e){} finally { setImgLoading(false); }
  };

  useEffect(()=>{ if(mainTab==="social" && images.length===0) fetchImages(imgQuery); },[mainTab]);

  const shareToFacebook = () => {
    if(fbPage) window.open(`https://www.facebook.com/${fbPage}`,"_blank");
    else window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://www.librarydesk.in")}&quote=${encodeURIComponent(caption)}`,"_blank");
  };
  const shareToInstagram = () => {
    navigator.clipboard.writeText(caption).then(()=>{
      window.open(igHandle?`https://www.instagram.com/${igHandle.replace("@","")}`:"https://www.instagram.com/","_blank");
      alert("Caption copied! Open Instagram, create a post, upload the image and paste the caption.");
    });
  };
  const [downloaded, setDownloaded] = useState(false);
  const downloadPost = async () => {
    if(!selImg){ alert("Please select an image first."); return; }
    await navigator.clipboard.writeText(caption||"");
    const a=document.createElement("a"); a.href=selImg.urls.full; a.download="librarydesk-post.jpg"; a.target="_blank";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setDownloaded(true); setTimeout(()=>setDownloaded(false),4000);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>Marketing</h1><p>WhatsApp blasts & social media posts</p></div>
      </div>

      {/* Main tabs */}
      <div style={{display:"flex",gap:4,marginBottom:20,borderBottom:"1px solid var(--border)"}}>
        {[["whatsapp","💬 WhatsApp Blast"],["social","📸 Social Media Post"]].map(([id,label])=>(
          <button key={id} onClick={()=>setMainTab(id)} style={{
            padding:"10px 20px",background:mainTab===id?"var(--accent-dim)":"transparent",
            color:mainTab===id?"var(--accent2)":"var(--text3)",
            border:"none",borderRadius:"8px 8px 0 0",cursor:"pointer",fontWeight:600,fontSize:13,
            borderBottom:mainTab===id?"2px solid var(--accent)":"2px solid transparent",
          }}>{label}</button>
        ))}
      </div>

      {/* ══ SOCIAL MEDIA TAB ══ */}
      {mainTab==="social" && (
        <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            {/* Caption */}
            <div className="card">
              <div className="section-title" style={{marginBottom:10}}>✍️ Caption</div>
              <textarea className="input" rows={5}
                placeholder={`Write your post...

📚 Seats available at ${library?.library_name}!
🕐 Morning, Evening & Full-day shifts
💰 Affordable monthly plans
📞 Contact us to book your seat
#library #study #${library?.city||"india"}`}
                value={caption} onChange={e=>setCaption(e.target.value)}
                style={{resize:"vertical",lineHeight:1.7}}/>
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                {["📚 Seats Available","🎯 Limited Seats Left","💸 Special Offer","🏆 Success Story","📅 New Batch Starting"].map(t=>(
                  <button key={t} className="btn btn-secondary btn-sm" onClick={()=>setCaption(c=>c+(c?"\n":"")+t)}>{t}</button>
                ))}
              </div>
            </div>

            {/* Image picker */}
            <div className="card">
              <div className="section-title" style={{marginBottom:10}}>🖼️ Free Images (Unsplash)</div>
              <form onSubmit={e=>{e.preventDefault();fetchImages(imgQuery);}} style={{display:"flex",gap:8,marginBottom:12}}>
                <input className="input" style={{flex:1}} placeholder="Search: library, study, books, students…"
                  value={imgQuery} onChange={e=>setImgQuery(e.target.value)}/>
                <button className="btn btn-primary" type="submit">Search</button>
              </form>
              {imgLoading ? <div style={{textAlign:"center",padding:20}}><Spinner size={24}/></div> : (
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                  {images.map(img=>(
                    <div key={img.id} onClick={()=>setSelImg(img)} style={{
                      borderRadius:7,overflow:"hidden",cursor:"pointer",aspectRatio:"16/9",
                      border:`2px solid ${selImg?.id===img.id?"var(--accent)":"transparent"}`,transition:"border .15s",
                    }}>
                      <img src={img.urls.small} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                    </div>
                  ))}
                </div>
              )}
              {selImg && <div style={{marginTop:6,fontSize:11,color:"var(--text3)"}}>Photo by <a href={selImg.user.links.html+"?utm_source=librarydesk&utm_medium=referral"} target="_blank" rel="noreferrer" style={{color:"var(--accent2)"}}>{selImg.user.name}</a> on Unsplash</div>}
            </div>

            {/* Share buttons */}
            <div className="card">
              <div className="section-title" style={{marginBottom:10}}>🚀 Share</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <button className="btn btn-primary" onClick={shareToFacebook}
                  style={{background:"#1877F2",borderColor:"#1877F2",gap:8,flex:1}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
                  Post to Facebook
                </button>
                <button className="btn btn-primary" onClick={downloadPost}
                  style={{background:"linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",border:"none",gap:8,flex:1}}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
                  ⬇️ Download for Instagram
                </button>
              </div>
              <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
                {downloaded && (
                <div style={{width:"100%",padding:"10px 14px",background:"var(--green-dim)",border:"1px solid var(--green)",borderRadius:8,fontSize:13,color:"var(--green)",fontWeight:600,marginTop:4}}>
                  ✅ Image downloading + caption copied!
                </div>
              )}
              <div style={{width:"100%",padding:"10px 14px",background:"var(--surface2)",borderRadius:8,fontSize:12,color:"var(--text2)",lineHeight:1.7,marginTop:4}}>
                <strong style={{color:"var(--text)"}}>📱 Instagram:</strong> Download image → open Instagram app → tap + → select image → paste caption → Post
              </div>
              <div className="form-group" style={{flex:1,marginBottom:0}}>
                  <label className="label">Facebook Page</label>
                  <input className="input" placeholder="YourPageName" value={fbPage} onChange={e=>setFbPage(e.target.value)}/>
                </div>
                <div className="form-group" style={{flex:1,marginBottom:0}}>
                  <label className="label">Instagram Handle</label>
                  <input className="input" placeholder="@yourlibrary" value={igHandle} onChange={e=>setIgHandle(e.target.value)}/>
                </div>
                <button className="btn btn-secondary" style={{alignSelf:"flex-end"}} onClick={()=>{
                  localStorage.setItem("lib_fb_page",fbPage);
                  localStorage.setItem("lib_ig_handle",igHandle);
                  setSocialSaved(true); setTimeout(()=>setSocialSaved(false),2000);
                }}>{socialSaved?"✅ Saved":"Save"}</button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{position:"sticky",top:16}}>
            <div className="card" style={{padding:0,overflow:"hidden",border:"1px solid var(--border2)"}}>
              <div style={{padding:"10px 14px",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(45deg,var(--accent),var(--accent2))",display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:12}}>
                  {library?.library_name?.[0]||"L"}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:12}}>{library?.library_name||"Your Library"}</div>
                  <div style={{fontSize:10,color:"var(--text3)"}}>Sponsored</div>
                </div>
              </div>
              {selImg
                ? <img src={selImg.urls.regular} alt="" style={{width:"100%",aspectRatio:"1/1",objectFit:"cover"}}/>
                : <div style={{width:"100%",aspectRatio:"1/1",background:"var(--surface2)",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8,color:"var(--text3)"}}><span style={{fontSize:32}}>🖼️</span><span style={{fontSize:12}}>Pick an image</span></div>
              }
              <div style={{padding:"10px 14px"}}>
                <div style={{display:"flex",gap:12,marginBottom:8,fontSize:18}}>❤️ 💬 📤 <span style={{marginLeft:"auto"}}>🔖</span></div>
                <div style={{fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:100,overflow:"hidden",color:"var(--text2)"}}>
                  {caption||<span style={{color:"var(--text3)"}}>Caption appears here…</span>}
                </div>
              </div>
            </div>
            <div style={{marginTop:6,fontSize:11,color:"var(--text3)",textAlign:"center"}}>Post Preview</div>
          </div>
        </div>
      )}

      {/* ══ WHATSAPP TAB ══ */}
      {mainTab==="whatsapp" && (<>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
        {/* Filters */}
        <div className="card">
          <div className="section-title" style={{marginBottom:12}}><Icon name="users" size={13} color="var(--text3)"/>Filter Recipients</div>

          <div className="form-group">
            <label className="label">Subscription Status</label>
            <div className="pill-tabs" style={{marginBottom:0}}>
              {[["active","Active"],["expiring","Expiring (≤7d)"],["inactive","No Sub"],["all","All Students"]].map(([v,l])=>(
                <div key={v} className={`pill${statusFilter===v?" active":""}`} onClick={()=>setStatusFilter(v)}>{l}</div>
              ))}
            </div>
          </div>

          <div className="form-group" style={{marginTop:12}}>
            <label className="label">Filter by Shift (select multiple)</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:4}}>
              {(data.shifts||[]).map(sh=>(
                <div key={sh.id}
                  onClick={()=>toggleShift(sh.id)}
                  style={{padding:"6px 12px",borderRadius:20,fontSize:12,fontWeight:600,cursor:"pointer",border:`1.5px solid ${selectedShifts.includes(sh.id)?"var(--accent)":"var(--border)"}`,background:selectedShifts.includes(sh.id)?"var(--accent-dim)":"var(--surface2)",color:selectedShifts.includes(sh.id)?"var(--accent)":"var(--text2)",transition:"all 0.15s"}}>
                  {sh.name} <span style={{opacity:0.7,fontSize:11}}>{sh.start_time}–{sh.end_time}</span>
                </div>
              ))}
              {selectedShifts.length>0&&<div onClick={()=>setSelectedShifts([])} style={{padding:"6px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:"1px solid var(--border)",color:"var(--text3)"}}>Clear</div>}
            </div>
          </div>

          <div style={{marginTop:14,padding:"10px 14px",background:"var(--accent-dim)",borderRadius:8,border:"1px solid var(--accent)"}}>
            <span style={{fontSize:13,color:"var(--accent)",fontWeight:700}}>{recipients.length} students</span>
            <span style={{fontSize:12,color:"var(--text3)",marginLeft:6}}>will receive this message</span>
          </div>
        </div>

        {/* Message */}
        <div className="card">
          <div className="section-title" style={{marginBottom:12}}><Icon name="whatsapp" size={13} color="#25D366"/>Message</div>

          <div className="form-group">
            <label className="label">Template</label>
            <select className="input select" value={msgTemplate} onChange={e=>setMsgTemplate(e.target.value)}>
              <option value="custom">Custom message</option>
              <option value="renewal">Subscription renewal reminder</option>
              <option value="payment">Payment due reminder</option>
              <option value="announce">General announcement</option>
            </select>
          </div>

          <div className="form-group">
            <label className="label">{msgTemplate==="custom"?"Message (use {name} and {library} as placeholders)":"Additional text (appended to template)"}</label>
            <textarea className="input textarea" rows={4}
              placeholder={msgTemplate==="custom"?"Hi {name}, hope you are enjoying {library}...":"Any extra info to add..."}
              value={customMsg} onChange={e=>setCustomMsg(e.target.value)}
              style={{minHeight:90}}/>
          </div>

          {recipients.length>0&&customMsg&&(
            <div style={{marginTop:4}}>
              <div className="text-xs text-muted" style={{marginBottom:4}}>Preview (first recipient):</div>
              <div style={{background:"var(--surface3)",borderRadius:8,padding:"10px 12px",fontSize:12.5,color:"var(--text2)",lineHeight:1.6,fontStyle:"italic"}}>
                "{getMessage(recipients[0])}"
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recipient list */}
      {recipients.length>0&&(
        <div className="card" style={{padding:0}}>
          <div style={{padding:"14px 16px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div className="section-title" style={{margin:0}}><Icon name="users" size={13} color="var(--text3)"/>Recipients ({recipients.length})</div>
            <button className="btn btn-primary" onClick={sendAll} disabled={!customMsg&&msgTemplate==="custom"}
              style={{gap:8}}>
              <Icon name="whatsapp" size={15} color="white"/>Send to All ({recipients.length})
            </button>
          </div>
          <div className="table-container">
            <table className="table"><thead><tr><th>Student</th><th>Phone</th><th>Shift</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {recipients.map(st=>(
                <tr key={st.id}>
                  <td><div style={{fontWeight:600}}>{st.name}</div></td>
                  <td className="text-sm">{st.phone}</td>
                  <td>{st.shift_name?<span className="badge badge-purple" style={{fontSize:11}}>{st.shift_name}</span>:<span className="text-muted text-xs">—</span>}</td>
                  <td className="text-sm">{st.end_date?formatDate(st.end_date):<span className="text-muted">—</span>}</td>
                  <td>
                    <button className="btn btn-ghost btn-icon" title="Send individual WhatsApp"
                      disabled={!customMsg&&msgTemplate==="custom"}
                      onClick={()=>openWhatsApp(st.phone, getMessage(st))} style={{color:"#25D366"}}>
                      <Icon name="whatsapp" size={14} color="#25D366"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
      {recipients.length===0&&(
        <div className="card"><div className="empty-state">
          <div className="empty-icon"><Icon name="megaphone" size={24} color="var(--text3)"/></div>
          <div className="empty-title">No students match your filters</div>
          <div className="empty-sub">Adjust the shift or status filters above</div>
        </div></div>
      )}
      </>)}
    </div>
  );
}

// ─── SETTINGS PAGE ────────────────────────────────────────────────────────────
function Settings({ library, onUpdate }) {
  const [tab, setTab]           = useState("profile");
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [error, setError]       = useState("");

  // Profile form
  const [profile, setProfile]   = useState({ ownerName: library?.owner_name||"", libraryName: library?.library_name||"", city: library?.city||"" });

  // Password form
  const [pw, setPw]             = useState({ current:"", newPw:"", confirm:"" });
  const [showPw, setShowPw]     = useState({ current:false, newPw:false, confirm:false });

  const flash = (msg, isErr=false) => {
    if (isErr) { setError(msg); setSuccess(""); }
    else { setSuccess(msg); setError(""); }
    setTimeout(()=>{ setSuccess(""); setError(""); }, 3500);
  };

  const saveProfile = async () => {
    if (!profile.ownerName||!profile.libraryName) { flash("Name fields are required", true); return; }
    setSaving(true);
    try {
      const result = await api.auth.updateProfile(profile);
      onUpdate({ owner_name: result.owner_name, library_name: result.library_name, city: result.city });
      flash("Profile updated successfully!");
    } catch(e) { flash(e.message||"Failed to update", true); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!pw.current||!pw.newPw) { flash("All password fields required", true); return; }
    if (pw.newPw.length < 8)    { flash("New password must be at least 8 characters", true); return; }
    if (pw.newPw !== pw.confirm) { flash("New passwords do not match", true); return; }
    setSaving(true);
    try {
      await api.auth.changePassword({ currentPassword: pw.current, newPassword: pw.newPw });
      setPw({ current:"", newPw:"", confirm:"" });
      flash("Password changed successfully!");
    } catch(e) { flash(e.message||"Failed to change password", true); }
    finally { setSaving(false); }
  };

  const PwInput = ({ field, placeholder }) => (
    <div style={{position:"relative"}}>
      <input className="input" type={showPw[field]?"text":"password"} placeholder={placeholder}
        value={pw[field]} onChange={e=>setPw(p=>({...p,[field]:e.target.value}))}
        style={{paddingRight:42}}/>
      <button className="btn btn-ghost btn-icon" onClick={()=>setShowPw(p=>({...p,[field]:!p[field]}))}
        style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)"}}>
        <Icon name={showPw[field]?"eyeoff":"eye"} size={15} color="var(--text3)"/>
      </button>
    </div>
  );

  return (
    <div>
      <div className="page-header"><div className="page-header-left"><h1>Settings</h1></div></div>
      <div className="pill-tabs">
        {[["profile","Profile"],["password","Password"]].map(([v,l])=>(
          <div key={v} className={`pill${tab===v?" active":""}`} onClick={()=>{setTab(v);setError("");setSuccess("");}}>{l}</div>
        ))}
      </div>

      {success&&<div className="alert alert-success" style={{marginBottom:16}}><Icon name="check" size={14} color="var(--green)"/><span style={{fontSize:13}}>{success}</span></div>}
      {error  &&<div className="alert alert-warning" style={{marginBottom:16}}><Icon name="warn"  size={14} color="var(--red)"  /><span style={{fontSize:13,color:"var(--red)"}}>{error}</span></div>}

      {tab==="profile"&&(
        <div className="card" style={{maxWidth:520}}>
          <div className="section-title" style={{marginBottom:16}}><Icon name="settings" size={13} color="var(--text3)"/>Library Profile</div>
          <div className="form-group"><label className="label">Your Name</label>
            <input className="input" value={profile.ownerName} onChange={e=>setProfile(p=>({...p,ownerName:e.target.value}))}/></div>
          <div className="form-group"><label className="label">Library Name</label>
            <input className="input" value={profile.libraryName} onChange={e=>setProfile(p=>({...p,libraryName:e.target.value}))}/></div>
          <div className="form-group"><label className="label">City</label>
            <input className="input" value={profile.city} onChange={e=>setProfile(p=>({...p,city:e.target.value}))}/></div>
          <div style={{marginTop:8}}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>
              {saving?<Spinner size={15}/>:null}Save Profile
            </button>
          </div>
        </div>
      )}

      {tab==="password"&&(
        <div className="card" style={{maxWidth:520}}>
          <div className="section-title" style={{marginBottom:16}}><Icon name="key" size={13} color="var(--text3)"/>Change Password</div>
          <div className="form-group"><label className="label">Current Password</label><PwInput field="current" placeholder="Enter current password"/></div>
          <div className="form-group"><label className="label">New Password</label><PwInput field="newPw" placeholder="Min 8 characters"/></div>
          <div className="form-group"><label className="label">Confirm New Password</label><PwInput field="confirm" placeholder="Repeat new password"/></div>
          <div style={{marginTop:8}}>
            <button className="btn btn-primary" onClick={savePassword} disabled={saving}>
              {saving?<Spinner size={15}/>:null}Change Password
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AUTH PAGE ────────────────────────────────────────────────────────────────
function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ ownerName:"", email:"", password:"", libraryName:"", city:"" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      if (mode === "forgot") {
        const r = await api.auth.forgotPassword({ email: form.email });
        if (r.code) {
          // No email service — show code directly on screen
          set("token", r.code);
          setError(`⚠️ Email not configured. Your code: ${r.code}`);
        } else {
          setError("");
        }
        setMode("reset");
        return;
      }
      if (mode === "reset") {
        if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
        await api.auth.resetPassword({ email: form.email, token: form.token, newPassword: form.password });
        setMode("login");
        setError("");
        return;
      }
      const result = mode === "register" ? await api.auth.register(form) : await api.auth.login(form);
      setToken(result.token);
      onAuth(result.library);
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  const logoBlock = (
    <div className="auth-logo">
      <img src="/icons/icon-192.png" alt="LibraryDesk" style={{width:72,height:72,borderRadius:18,objectFit:"cover",boxShadow:"0 4px 24px rgba(232,168,56,0.35)",marginBottom:10}}/>
      <h1 className="auth-title" style={{letterSpacing:1,fontSize:26,fontWeight:800}}>LibraryDesk</h1>
      <p className="auth-sub">Library Management System</p>
    </div>
  );

  if (mode === "forgot") return (
    <div className="auth-page"><div className="auth-bg"/><div className="auth-card">
      {logoBlock}
      <h2 style={{fontSize:18,fontWeight:700,marginBottom:6,textAlign:"center"}}>Reset Password</h2>
      <p style={{fontSize:13,color:"var(--text3)",textAlign:"center",marginBottom:16}}>Enter your registered email. A 6-digit reset code will be sent to it.</p>
      {error&&<div className="alert alert-error"><Icon name="warn" size={15} color="var(--red)"/><span style={{fontSize:13}}>{error}</span></div>}
      <div className="form-group"><label className="label">Email</label><input className="input" type="email" placeholder="email@library.com" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
      <button className="btn btn-primary w-full" style={{justifyContent:"center",marginTop:6}} onClick={submit} disabled={loading}>{loading?<Spinner size={16}/>:null}Send Reset Code</button>
      <div className="auth-toggle"><a onClick={()=>{setMode("login");setError("");}}>Back to Sign In</a></div>
    </div></div>
  );

  if (mode === "reset") return (
    <div className="auth-page"><div className="auth-bg"/><div className="auth-card">
      {logoBlock}
      <h2 style={{fontSize:18,fontWeight:700,marginBottom:6,textAlign:"center"}}>Enter New Password</h2>
      <p style={{fontSize:13,color:"var(--text3)",textAlign:"center",marginBottom:16}}>Check your email for the reset code (or see it above if shown).</p>
      {error&&<div className="alert alert-error"><Icon name="warn" size={15} color="var(--red)"/><span style={{fontSize:13}}>{error}</span></div>}
      <div className="form-group"><label className="label">Reset Code (from email)</label><input className="input" placeholder="6-digit code" value={form.token||""} onChange={e=>set("token",e.target.value)}/></div>
      <div className="form-group"><label className="label">New Password</label><input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={e=>set("password",e.target.value)}/></div>
      <div className="form-group"><label className="label">Confirm Password</label><input className="input" type="password" placeholder="Repeat password" value={form.confirm||""} onChange={e=>set("confirm",e.target.value)}/></div>
      <button className="btn btn-primary w-full" style={{justifyContent:"center",marginTop:6}} onClick={submit} disabled={loading}>{loading?<Spinner size={16}/>:null}Set New Password</button>
      <div className="auth-toggle"><a onClick={()=>{setMode("forgot");setError("");}}>Resend code</a> · <a onClick={()=>{setMode("login");setError("");}}>Sign In</a></div>
    </div></div>
  );

  return (
    <div className="auth-page">
      <div className="auth-bg"/>
      <div className="auth-card">
        {logoBlock}
        <h2 style={{fontSize:19,fontWeight:700,marginBottom:18,textAlign:"center"}}>{mode==="login"?"Welcome back":"Register your library"}</h2>
        {error&&<div className="alert alert-error"><Icon name="warn" size={15} color="var(--red)"/><span style={{fontSize:13}}>{error}</span></div>}
        {mode==="register"&&<>
          <div className="form-row">
            <div className="form-group"><label className="label">Your Name</label><input className="input" placeholder="John Doe" value={form.ownerName} onChange={e=>set("ownerName",e.target.value)}/></div>
            <div className="form-group"><label className="label">Library Name</label><input className="input" placeholder="Central Library" value={form.libraryName} onChange={e=>set("libraryName",e.target.value)}/></div>
          </div>
          <div className="form-group"><label className="label">City</label><input className="input" placeholder="City" value={form.city} onChange={e=>set("city",e.target.value)}/></div>
        </>}
        <div className="form-group"><label className="label">Email</label><input className="input" type="email" placeholder="email@library.com" value={form.email} onChange={e=>set("email",e.target.value)}/></div>
        <div className="form-group"><label className="label">Password</label>
          <div style={{position:"relative"}}>
            <input className="input" type={showPass?"text":"password"} placeholder="••••••••" value={form.password} onChange={e=>set("password",e.target.value)} style={{paddingRight:42}} onKeyDown={e=>e.key==="Enter"&&submit()}/>
            <button className="btn btn-ghost btn-icon" onClick={()=>setShowPass(!showPass)} style={{position:"absolute",right:3,top:"50%",transform:"translateY(-50%)"}}><Icon name={showPass?"eyeoff":"eye"} size={15} color="var(--text3)"/></button>
          </div>
        </div>
        {mode==="login"&&<div style={{textAlign:"right",marginTop:-8,marginBottom:8}}><a style={{fontSize:12,color:"var(--text3)",cursor:"pointer"}} onClick={()=>{setMode("forgot");setError("");}}>Forgot password?</a></div>}
        <button className="btn btn-primary w-full" style={{justifyContent:"center",marginTop:6}} onClick={submit} disabled={loading}>
          {loading?<Spinner size={16}/>:null}{mode==="login"?"Sign In":"Create Account"}
        </button>
        <div className="auth-toggle">{mode==="login"?<>Don't have an account? <a onClick={()=>{setMode("register");setError("");}}>Register</a></>:<>Already registered? <a onClick={()=>{setMode("login");setError("");}}>Sign In</a></>}</div>
      </div>
    </div>
  );
}

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
function Sidebar({ library, active, onNav, onLogout, isOpen, onClose, urgentReminders }) {
  const items = [
    {id:"dashboard",icon:"home",label:"Dashboard",section:"main"},
    {id:"students",icon:"users",label:"Students",section:"manage"},
    {id:"plans",icon:"tag",label:"Plans & Pricing",section:"manage"},
    {id:"shifts",icon:"clock",label:"Shifts",section:"manage"},
    {id:"subscriptions",icon:"id",label:"Subscriptions",section:"manage"},
    {id:"seats",icon:"seat2",label:"Seat Map",section:"manage"},
    {id:"reminders",icon:"bell",label:"Reminders",section:"manage",badge:urgentReminders>0?urgentReminders:null},
    {id:"expenses",icon:"rupee",label:"Expenses",section:"manage"},
    {id:"reports",icon:"chart",label:"Reports",section:"manage"},
    {id:"attendance",icon:"attendance",label:"Attendance",section:"manage"},
    {id:"marketing",icon:"megaphone",label:"Marketing",section:"tools"},
    {id:"settings",icon:"settings",label:"Settings",section:"tools"},
    {id:"billing",icon:"payment",label:"Billing & Plans",section:"tools"},
  ];
  return(
    <>
      {isOpen&&<div className="sidebar-overlay" onClick={onClose}/>}
      <aside className={`sidebar${isOpen?" open":""}`}>
        <div className="sidebar-logo">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/icons/apple-touch-icon.png" alt="LibraryDesk" style={{width:36,height:36,borderRadius:10,objectFit:"cover",flexShrink:0}}/>
            <div><div className="logo-text" style={{letterSpacing:1,fontSize:16,fontWeight:800}}>LibraryDesk</div><div className="logo-sub">Library Manager</div></div>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-section"><div className="nav-section-title">Main</div>{items.filter(i=>i.section==="main").map(i=><button key={i.id} className={`nav-item${active===i.id?" active":""}`} onClick={()=>{onNav(i.id);onClose();}}><Icon name={i.icon} size={16}/>{i.label}</button>)}</div>
          <div className="nav-section"><div className="nav-section-title">Management</div>{items.filter(i=>i.section==="manage").map(i=><button key={i.id} className={`nav-item${active===i.id?" active":""}`} onClick={()=>{onNav(i.id);onClose();}}><Icon name={i.icon} size={16}/>{i.label}{i.badge&&<span className="nbadge">{i.badge}</span>}</button>)}</div>
          <div className="nav-section"><div className="nav-section-title">Tools</div>{items.filter(i=>i.section==="tools").map(i=><button key={i.id} className={`nav-item${active===i.id?" active":""}`} onClick={()=>{onNav(i.id);onClose();}}><Icon name={i.icon} size={16}/>{i.label}</button>)}</div>
        </nav>
        <div className="sidebar-footer">
          <div className="lib-info"><div className="lib-avatar">{library?.library_name?.[0]||"L"}</div><div><div style={{fontSize:13,fontWeight:600}}>{library?.library_name}</div><div style={{fontSize:11,color:"var(--text3)"}}>{library?.email}</div></div></div>
          <button className="nav-item" onClick={onLogout} style={{color:"var(--red)",marginTop:3}}><Icon name="logout" size={16}/>Logout</button>
        </div>
      </aside>
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ── TRIAL BANNER ─────────────────────────────────────────────────────────────
function TrialBanner({ library, onOpenBilling }) {
  const type = getTrialBannerType(library);
  if (!type || type === 'info') return null;

  const daysLeft = getTrialDaysLeft(library);
  const WA_NUMBER = "919807139295"; // ← update with real number
  const waMsg = `Hi LibraryDesk Team! I would like to activate my library account: ${library?.library_name}. Please help me with the plan options.`;
  const waUrl = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg)}`;

  const configs = {
    urgent: {
      bg: "linear-gradient(90deg,#2a1205,#3d1a06)", border:"var(--red)",
      icon:"⚠️",
      text: `Your free trial expires in ${daysLeft} day${daysLeft===1?"":"s"}!`,
      sub:  "After expiry, your account will become read-only.",
    },
    expired: {
      bg: "linear-gradient(90deg,#1a0505,#2a0808)", border:"var(--red)",
      icon:"🔒",
      text: "Your trial has ended — account is now read-only.",
      sub:  "You can view your data but cannot add or edit anything.",
    },
    suspended: {
      bg: "linear-gradient(90deg,#1a0505,#2a0808)", border:"var(--red)",
      icon:"🚫",
      text: "Your account has been suspended.",
      sub:  "Please contact us to reactivate your account.",
    },
  };

  const cfg = configs[type];
  if (!cfg) return null;

  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 10, padding: "12px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10, margin: "0 0 16px",
      animation: type==="urgent" ? "pulse 2s infinite" : undefined,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:18}}>{cfg.icon}</span>
        <div>
          <div style={{fontWeight:700,fontSize:13,color:"var(--red)"}}>{cfg.text}</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>{cfg.sub}</div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexShrink:0}}>
        <button className="btn btn-secondary btn-sm" onClick={onOpenBilling}>
          View Plans
        </button>
        <a href={waUrl} target="_blank" rel="noreferrer"
          style={{display:"inline-flex",alignItems:"center",gap:6,background:"#25D366",color:"#fff",fontWeight:700,fontSize:12,padding:"6px 14px",borderRadius:8,textDecoration:"none"}}>
          💬 Activate on WhatsApp
        </a>
      </div>
    </div>
  );
}

// ── BILLING PAGE ──────────────────────────────────────────────────────────────
function Billing({ library }) {
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const WA_NUMBER = "919807139295";

  useEffect(() => {
    api.auth.billing().then(setBilling).catch(()=>{}).finally(()=>setLoading(false));
  }, []);

  const daysLeft = getTrialDaysLeft(library);
  const status   = library?.subscription_status;
  const isActive = status === "active";
  const sub      = billing?.subscription;

  const waMsg = (plan) => `Hi LibraryDesk Team! I would like to activate my library "${library?.library_name}" on the ${plan} plan. Please help me with the payment process.`;
  const waUrl = (plan) => `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(waMsg(plan))}`;

  return (
    <div>
      {/* ── Status Card ── */}
      <div className="card" style={{marginBottom:16,borderColor:isActive?"var(--green)":isReadOnly(library)?"var(--red)":"var(--accent)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{
              width:56,height:56,borderRadius:14,fontSize:26,
              display:"flex",alignItems:"center",justifyContent:"center",
              background:isActive?"var(--green-dim)":isReadOnly(library)?"var(--red-dim)":"var(--accent-dim)",
              border:`1px solid ${isActive?"var(--green)":isReadOnly(library)?"var(--red)":"var(--accent)"}`,
            }}>
              {isActive?"✅":isReadOnly(library)?"🔒":"⏳"}
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:17}}>
                {isActive ? "Account Active" : isReadOnly(library) ? "Account Restricted" : "Free Trial"}
              </div>
              <div style={{fontSize:13,color:"var(--text3)",marginTop:4}}>
                {isActive && sub?.current_period_end && `Plan: ${sub.plan_name} · Active until ${formatDate(sub.current_period_end)}`}
                {isActive && !sub?.current_period_end && `Plan: ${sub?.plan_name||"Active"}`}
                {status==="trial" && daysLeft!==null && daysLeft>=0 && `${daysLeft} day${daysLeft===1?"":"s"} remaining in your free trial`}
                {status==="trial" && daysLeft!==null && daysLeft<0 && "Your free trial has ended"}
                {status==="expired" && "Your subscription has expired"}
                {status==="suspended" && "Your account has been suspended — contact support"}
              </div>
            </div>
          </div>
          {isActive && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
              <span className="badge badge-green" style={{fontSize:13,padding:"6px 14px"}}>{sub?.plan_name||"Active"}</span>
              {sub?.current_period_end && (
                <span style={{fontSize:11,color:"var(--text3)"}}>
                  Renews {formatDate(sub.current_period_end)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Active plan — renewal CTA */}
        {isActive && (
          <div style={{marginTop:16,paddingTop:16,borderTop:"1px solid var(--border)",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
            <div style={{fontSize:13,color:"var(--text3)"}}>
              Want to upgrade or renew early?
              <a href="https://www.librarydesk.in/#pricing" target="_blank" rel="noreferrer"
                style={{color:"var(--accent2)",marginLeft:6,textDecoration:"none",fontWeight:600}}>
                View all plans →
              </a>
            </div>
            <a href={waUrl("renewal/upgrade")} target="_blank" rel="noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:6,background:"#25D366",color:"#fff",fontWeight:700,fontSize:12,padding:"7px 14px",borderRadius:8,textDecoration:"none"}}>
              💬 Contact us on WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* ── Plans (only show when NOT active) ── */}
      {!isActive && (<>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
          <div className="section-title" style={{margin:0}}>Choose a Plan</div>
          <a href="https://www.librarydesk.in/#pricing" target="_blank" rel="noreferrer"
            style={{fontSize:12,color:"var(--accent2)",textDecoration:"none",fontWeight:600}}>
            See full plan details on website →
          </a>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:14,marginBottom:24}}>
          {/* Monthly */}
          <div className="card" style={{borderColor:"var(--accent)",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--accent),var(--accent2))"}}/> 
            <span className="badge badge-accent" style={{marginBottom:12,display:"inline-block"}}>Most Popular</span>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:4}}>Monthly Plan</div>
            <div style={{fontSize:32,fontWeight:800,color:"var(--accent)",marginBottom:4}}>₹1,000<span style={{fontSize:13,fontWeight:400,color:"var(--text3)"}}>/month</span></div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Full access · Cancel anytime</div>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {["Unlimited students","All features included","Seat map & shifts","WhatsApp reminders","Priority support"].map(f=>(
                <li key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--text2)"}}>
                  <span style={{color:"var(--green)",fontWeight:800}}>✓</span>{f}
                </li>
              ))}
            </ul>
            <a href={waUrl("Monthly ₹1,000/month")} target="_blank" rel="noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",fontWeight:700,fontSize:14,padding:"11px",borderRadius:9,textDecoration:"none"}}>
              💬 Activate via WhatsApp
            </a>
          </div>
          {/* Annual */}
          <div className="card" style={{borderColor:"var(--gold)"}}>
            <span className="badge badge-gold" style={{marginBottom:12,display:"inline-block"}}>Save ₹3,000</span>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:4}}>Annual Plan</div>
            <div style={{fontSize:32,fontWeight:800,color:"var(--gold)",marginBottom:4}}>₹9,000<span style={{fontSize:13,fontWeight:400,color:"var(--text3)"}}>/year</span></div>
            <div style={{fontSize:13,color:"var(--text3)",marginBottom:16}}>Best value · ₹750/month effective</div>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
              {["Everything in Monthly","Save ₹3,000/year","Dedicated support","Setup assistance","Invoice & GST receipt"].map(f=>(
                <li key={f} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:"var(--text2)"}}>
                  <span style={{color:"var(--green)",fontWeight:800}}>✓</span>{f}
                </li>
              ))}
            </ul>
            <a href={waUrl("Annual ₹9,000/year")} target="_blank" rel="noreferrer"
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,background:"#25D366",color:"#fff",fontWeight:700,fontSize:14,padding:"11px",borderRadius:9,textDecoration:"none"}}>
              💬 Activate via WhatsApp
            </a>
          </div>
        </div>
      </>)}

      {/* ── Payment History ── */}
      {loading ? <Spinner size={20}/> : billing?.payments?.length > 0 && (
        <div className="card" style={{marginBottom:16}}>
          <div className="section-title" style={{marginBottom:12}}>Payment History</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>{["Plan","Amount","Method","Invoice","Date"].map(h=>(
                  <th key={h} style={{padding:"8px 12px",textAlign:"left",fontSize:11,fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:.5,borderBottom:"1px solid var(--border)",background:"var(--surface2)"}}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {billing.payments.map((p,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid var(--border)"}}>
                    <td style={{padding:"10px 12px",fontSize:13,fontWeight:600}}>{p.plan_name||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:13,color:"var(--green)",fontWeight:700}}>₹{Number(p.amount).toLocaleString("en-IN")}</td>
                    <td style={{padding:"10px 12px"}}><span className="badge badge-gray" style={{textTransform:"capitalize",fontSize:11}}>{p.payment_method}</span></td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"var(--text3)"}}>{p.invoice_number||"—"}</td>
                    <td style={{padding:"10px 12px",fontSize:12,color:"var(--text3)"}}>{formatDate(p.paid_at||p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Help ── */}
      <div style={{padding:"14px 16px",background:"var(--accent-dim)",border:"1px solid var(--accent)",borderRadius:10,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <span style={{fontSize:20}}>💬</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:13,color:"var(--accent2)"}}>Need help? We're on WhatsApp</div>
          <div style={{fontSize:12,color:"var(--text3)",marginTop:2}}>Account activated within minutes of payment confirmation.</div>
        </div>
        <a href={`https://wa.me/${WA_NUMBER}`} target="_blank" rel="noreferrer"
          style={{flexShrink:0,background:"#25D366",color:"#fff",fontWeight:700,fontSize:12,padding:"8px 16px",borderRadius:8,textDecoration:"none"}}>
          Chat Now
        </a>
      </div>
    </div>
  );
}

function Dashboard({ data, library, onUpdate, onCreateSubscription }) {
  const [summary, setSummary] = useState(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [loadingSum, setLoadingSum] = useState(true);

  useEffect(() => {
    api.reports.summary().then(setSummary).catch(console.error).finally(() => setLoadingSum(false));
  }, [data]);   // re-fetch when data changes

  const totalSeats = library?.total_seats || 30;
  const { opStart, opEnd } = library ? getOperationWindow(library, data.shifts||[]) : { opStart: 8*60, opEnd: 21*60 };
  const freeCount  = Array.from({length:totalSeats},(_,i)=>i+1).filter(n=>getSeatStatus(n,data.subscriptions,data.shifts,library)==="available").length;
  const halfCount  = Array.from({length:totalSeats},(_,i)=>i+1).filter(n=>getSeatStatus(n,data.subscriptions,data.shifts,library)==="half").length;

  if (loadingSum) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:60}}><Spinner size={32}/></div>;

  const months = summary?.revenueByMonth || [];
  const maxRev = Math.max(...months.map(m=>Number(m.revenue||0)),1);

  return(
    <div>
      {Number(summary?.expired_subscriptions)>0&&<div className="alert alert-error"><Icon name="warn" size={15} color="var(--red)"/><span style={{fontSize:13}}><strong>{summary.expired_subscriptions}</strong> expired subscriptions need attention.</span></div>}
      <div className="stats-grid">
        <div className="stat-card blue"><div className="stat-icon"><Icon name="users" size={26} color="var(--blue)"/></div><div className="stat-label">Total Students</div><div className="stat-value">{summary?.total_students||0}</div><div className="stat-change">{summary?.active_students||0} active</div></div>
        <div className="stat-card green"><div className="stat-icon"><Icon name="id" size={26} color="var(--green)"/></div><div className="stat-label">Active Subs</div><div className="stat-value">{summary?.active_subscriptions||0}</div><div className="stat-change" style={{color:Number(summary?.expiring_soon)>0?"var(--yellow)":"var(--text3)"}}>{Number(summary?.expiring_soon)>0?`${summary.expiring_soon} expiring soon`:"All on track"}</div></div>
        <div className="stat-card gold"><div className="stat-icon"><Icon name="rupee" size={26} color="var(--accent)"/></div><div className="stat-label">Month Revenue</div><div className="stat-value">{formatCurrency(summary?.month_revenue||0)}</div><div className="stat-change">{formatCurrency((summary?.month_revenue||0)-(summary?.month_expenses||0))} net</div></div>
        <div className="stat-card red"><div className="stat-icon"><Icon name="rupee" size={26} color="var(--red)"/></div><div className="stat-label">Month Expenses</div><div className="stat-value">{formatCurrency(summary?.month_expenses||0)}</div></div>
        <div className="stat-card purple"><div className="stat-icon"><Icon name="seat2" size={26} color="var(--purple)"/></div><div className="stat-label">Seat Status</div><div className="stat-value">{freeCount+halfCount}/{totalSeats}</div><div className="stat-change">{freeCount} free · {halfCount} half</div></div>
        <div className="stat-card gold"><div className="stat-icon"><Icon name="clock" size={26} color="var(--accent)"/></div><div className="stat-label">Shifts</div><div className="stat-value">{data.shifts?.length||0}</div></div>
      </div>
      <div className="dashboard-grid" style={{display:"grid",gridTemplateColumns:"1fr 1.2fr",gap:18,marginBottom:22}}>
        <div className="card">
          <div className="section-title">Revenue (6 Months)</div>
          <div className="bar-chart">{months.map((m,i)=><div key={i} className="bar-col"><div className="bar-value">{Number(m.revenue)>0?`₹${(Number(m.revenue)/1000).toFixed(0)}k`:""}</div><div className="bar" style={{height:`${(Number(m.revenue)/maxRev)*80}px`}}/><div className="bar-label">{m.month}</div></div>)}</div>
        </div>
        <div className="card">
          <div className="section-title" style={{marginBottom:12}}>Seat Map — Click to Subscribe</div>
          <SeatPanel data={data} library={library} onUpdate={onUpdate} onCreateSubscription={onCreateSubscription}/>
        </div>
      </div>
      <div className="card" style={{padding:0}}>
        <div style={{padding:"18px 18px 0",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div className="section-title">Recent Subscriptions</div><button className="btn btn-ghost btn-icon" title={showAmounts?"Hide amounts":"Show amounts"} onClick={()=>setShowAmounts(p=>!p)}><Icon name={showAmounts?"eyeoff":"eye"} size={15} color="var(--text3)"/></button></div>
        <div className="table-container">
          <table className="table">
            <thead><tr><th>Student</th><th>Plan</th><th>Shift</th><th>Amount</th><th>Expiry</th><th>Status</th></tr></thead>
            <tbody>
              {(summary?.recentSubscriptions||[]).length===0?<tr><td colSpan={6}><div className="text-muted text-sm" style={{textAlign:"center",padding:32}}>No subscriptions yet</div></td></tr>
                :(summary?.recentSubscriptions||[]).map(s=>{
                  const diff=daysDiff(s.end_date);
                  return(<tr key={s.id}><td><div style={{fontWeight:600}}>{s.student_name}</div><div className="text-xs text-muted">{s.student_phone}</div></td><td className="text-sm">{s.plan_name}</td><td>{s.shift_name?<span className="badge badge-purple" style={{fontSize:11}}>{s.shift_name}</span>:<span className="text-muted text-xs">—</span>}</td><td><AmountCell amount={s.amount}/></td><td className="text-sm">{formatDate(s.end_date)}</td><td>{s.status!=="active"?<span className="badge badge-gray">{s.status}</span>:diff<0?<span className="badge badge-red">Expired</span>:diff<=5?<span className="badge badge-yellow">Exp {diff}d</span>:<span className="badge badge-green">Active</span>}</td></tr>);
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── GENERIC CRUD PAGES (condensed versions using API) ────────────────────────

function Shifts({ data, reload, readonly=false }) {
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({name:"",startTime:"",endTime:"",description:""});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  const open=(sh=null)=>{setEdit(sh);setForm(sh?{name:sh.name,startTime:sh.start_time,endTime:sh.end_time,description:sh.description||""}:{name:"",startTime:"",endTime:"",description:""});setShowModal(true);};
  const save=async()=>{if(!form.name||!form.startTime||!form.endTime)return;setSaving(true);try{if(edit)await api.shifts.update(edit.id,{name:form.name,startTime:form.startTime,endTime:form.endTime,description:form.description});else await api.shifts.create({name:form.name,startTime:form.startTime,endTime:form.endTime,description:form.description});await reload(["shifts"]);setShowModal(false);}finally{setSaving(false);}};
  const del=async(id)=>{await api.shifts.delete(id);await reload(["shifts"]);setConfirmDel(null);};

  return(
    <div>
      {confirmDel&&<ConfirmDialog title="Delete Shift?" message="Existing subscriptions won't be affected." confirmLabel="Delete" danger onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <div className="page-header"><div className="page-header-left"><h1>Shifts</h1><p>Define library time slots</p></div>{!readonly&&<button className="btn btn-primary" onClick={()=>open()}><Icon name="plus" size={15}/>Add Shift</button>}</div>
      {data.shifts.length===0?<div className="card"><div className="empty-state"><div className="empty-icon"><Icon name="clock" size={26} color="var(--text3)"/></div><div className="empty-title">No shifts defined</div><div className="empty-sub">Create shifts like Morning, Evening, Full Day</div></div></div>
        :<div className="plans-grid">{data.shifts.map(sh=>{const usedCount=(data.subscriptions||[]).filter(s=>s.shift_id===sh.id&&s.status==="active").length;return(<div key={sh.id} className="plan-card"><div style={{display:"flex",justifyContent:"space-between"}}><div className="lib-avatar" style={{width:36,height:36,borderRadius:10,background:"var(--purple-dim)",border:"1px solid var(--purple)",color:"var(--purple)"}}><Icon name="clock" size={16}/></div><span className="badge badge-gray">{usedCount} active</span></div><div style={{fontFamily:"'Playfair Display',serif",fontSize:17,marginTop:12,marginBottom:4}}>{sh.name}</div><div style={{fontSize:13,color:"var(--text2)"}}>{sh.start_time} — {sh.end_time}</div>{sh.description&&<div className="text-sm text-muted" style={{marginTop:4}}>{sh.description}</div>}<div style={{display:"flex",gap:8,marginTop:12}}><button className="btn btn-secondary btn-sm" onClick={()=>open(sh)}><Icon name="edit" size={13}/>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>setConfirmDel(sh.id)}><Icon name="trash" size={13}/></button></div></div>);})}</div>}
      {showModal&&<div className="modal-overlay"><div className="modal"><div className="modal-header"><h2 className="modal-title">{edit?"Edit":"Create"} Shift</h2><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Icon name="x" size={17}/></button></div><div className="modal-body"><div className="form-group"><label className="label">Shift Name *</label><input className="input" placeholder="Morning, Evening, Full Day…" value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="form-row"><div className="form-group"><label className="label">Start Time *</label><input className="input" type="time" value={form.startTime} onChange={e=>set("startTime",e.target.value)}/></div><div className="form-group"><label className="label">End Time *</label><input className="input" type="time" value={form.endTime} onChange={e=>set("endTime",e.target.value)}/></div></div><div className="form-group"><label className="label">Description</label><textarea className="input textarea" value={form.description} onChange={e=>set("description",e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Spinner size={15}/>:null}{edit?"Save":"Create"}</button></div></div></div>}
    </div>
  );
}

function Students({ data, reload, readonly=false }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({name:"",phone:"",email:"",address:"",idProof:"",notes:"",joinDate:today()});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  const open=(s=null)=>{setEdit(s);setForm(s?{name:s.name,phone:s.phone,email:s.email||"",address:s.address||"",idProof:s.id_proof||"",notes:s.notes||"",joinDate:s.join_date?.slice(0,10)||today()}:{name:"",phone:"",email:"",address:"",idProof:"",notes:"",joinDate:today()});setShowModal(true);};
  const save=async()=>{if(!form.name||!form.phone)return;setSaving(true);try{if(edit)await api.students.update(edit.id,{name:form.name,phone:form.phone,email:form.email,address:form.address,idProof:form.idProof,notes:form.notes,status:edit.status,joinDate:form.joinDate});else await api.students.create({name:form.name,phone:form.phone,email:form.email,address:form.address,idProof:form.idProof,notes:form.notes,joinDate:form.joinDate});await reload(["students"]);setShowModal(false);}finally{setSaving(false);}};
  const del=async(id)=>{await api.students.delete(id);await reload(["students"]);setConfirmDel(null);};
  const toggle=async(s)=>{await api.students.update(s.id,{name:s.name,phone:s.phone,email:s.email,address:s.address,idProof:s.id_proof,notes:s.notes,status:s.status==="active"?"inactive":"active"});await reload(["students"]);};

  const students=(data.students||[]).filter(s=>{const q=search.toLowerCase();return(s.name?.toLowerCase().includes(q)||s.phone?.includes(q))&&(filter==="all"||s.status===filter);});

  return(
    <div>
      {confirmDel&&reload&&<ConfirmDialog title="Delete Student?" message="This will permanently remove the student." confirmLabel="Delete" danger onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <div className="page-header"><div className="page-header-left"><h1>Students</h1><p>{data.students?.length||0} registered</p></div><div className="flex items-center gap-2"><div className="search-bar"><Icon name="search" size={15} color="var(--text3)"/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>{reload&&<button className="btn btn-primary" onClick={()=>open()}><Icon name="plus" size={15}/>Add</button>}</div></div>
      <div className="pill-tabs">{["all","active","inactive"].map(f=><div key={f} className={`pill${filter===f?" active":""}`} onClick={()=>setFilter(f)} style={{textTransform:"capitalize"}}>{f}</div>)}</div>
      <div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Email</th><th>Joined</th><th>Subscription</th><th>Status</th><th></th></tr></thead><tbody>
        {students.length===0?<tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Icon name="users" size={24} color="var(--text3)"/></div><div className="empty-title">No students</div></div></td></tr>
          :students.map((s,i)=>{
            const sub=s.active_subscription||(data.subscriptions||[]).filter(x=>x.student_id===s.id&&(x.status==="active"||daysDiff(x.end_date)>=-10)).sort((a,b)=>b.end_date>a.end_date?1:-1)[0];
            const diff=sub?daysDiff(sub.end_date):null;
            return(<tr key={s.id}><td className="text-xs text-muted">{i+1}</td><td><div style={{display:"flex",alignItems:"center",gap:9}}><div className="avatar" style={{background:"var(--accent-dim)",color:"var(--accent)"}}>{s.name?.[0]?.toUpperCase()}</div><div><div style={{fontWeight:600}}>{s.name}</div><div className="text-xs text-muted">{s.address||"—"}</div></div></div></td><td className="text-sm">{s.phone}</td><td className="text-sm text-muted">{s.email||"—"}</td><td className="text-sm text-muted">{formatDate(s.join_date)}</td><td>{sub?(diff<0?<span className="badge badge-red">Exp {Math.abs(diff)}d ago</span>:diff<=3?<span className="badge badge-red">Exp {diff}d</span>:diff<=7?<span className="badge badge-yellow">Exp {diff}d</span>:<span className="badge badge-green">{sub.plan_name}</span>):<span className="badge badge-gray">None</span>}</td><td><button onClick={()=>toggle(s)} className={`badge ${s.status==="active"?"badge-green":"badge-gray"}`} style={{cursor:"pointer",border:"none"}}>{s.status}</button></td><td><div className="flex gap-2"><button className="btn btn-ghost btn-icon" title="Send WhatsApp" onClick={()=>openWhatsApp(s.phone,`Hi ${s.name}, this is a message from ${s.address||'the library'}. Please contact us regarding your library membership.`)} style={{color:"#25D366"}}><Icon name="whatsapp" size={14} color="#25D366"/></button><button className="btn btn-ghost btn-icon" onClick={()=>open(s)}><Icon name="edit" size={14}/></button><button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(s.id)} style={{color:"var(--red)"}}><Icon name="trash" size={14}/></button></div></td></tr>);
          })}
      </tbody></table></div></div>
      {showModal&&<div className="modal-overlay"><div className="modal"><div className="modal-header"><h2 className="modal-title">{edit?"Edit":"Add"} Student</h2><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Icon name="x" size={17}/></button></div><div className="modal-body"><div className="form-row"><div className="form-group"><label className="label">Full Name *</label><input className="input" placeholder="Full name" value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="form-group"><label className="label">Phone *</label><input className="input" placeholder="Phone" value={form.phone} onChange={e=>set("phone",e.target.value)}/></div></div><div className="form-row"><div className="form-group"><label className="label">Email</label><input className="input" placeholder="Email" value={form.email} onChange={e=>set("email",e.target.value)}/></div><div className="form-group"><label className="label">ID Proof</label><input className="input" placeholder="Aadhar/PAN" value={form.idProof} onChange={e=>set("idProof",e.target.value)}/></div></div><div className="form-row"><div className="form-group"><label className="label">Address</label><input className="input" placeholder="Address" value={form.address} onChange={e=>set("address",e.target.value)}/></div><div className="form-group"><label className="label">Join Date</label><input className="input" type="date" value={form.joinDate} onChange={e=>set("joinDate",e.target.value)}/></div></div><div className="form-group"><label className="label">Notes</label><textarea className="input textarea" value={form.notes} onChange={e=>set("notes",e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Spinner size={15}/>:null}{edit?"Save":"Add"}</button></div></div></div>}
    </div>
  );
}

function Plans({ data, reload, readonly=false }) {
  const [showModal, setShowModal] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState({name:"",duration:30,price:"",shiftId:"",description:""});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  const open=(p=null)=>{setEdit(p);setForm(p?{name:p.name,duration:p.duration,price:p.price,shiftId:p.shift_id||"",description:p.description||""}:{name:"",duration:30,price:"",shiftId:"",description:""});setShowModal(true);};
  const save=async()=>{if(!form.name||!form.price)return;setSaving(true);try{if(edit)await api.plans.update(edit.id,{name:form.name,duration:form.duration,price:form.price,shiftId:form.shiftId,description:form.description});else await api.plans.create({name:form.name,duration:form.duration,price:form.price,shiftId:form.shiftId,description:form.description});await reload(["plans"]);setShowModal(false);}finally{setSaving(false);}};
  const del=async(id)=>{await api.plans.delete(id);await reload(["plans"]);setConfirmDel(null);};

  return(
    <div>
      {confirmDel&&<ConfirmDialog title="Delete Plan?" message="Existing subscriptions won't be affected." confirmLabel="Delete" danger onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <div className="page-header"><div className="page-header-left"><h1>Plans & Pricing</h1></div>{!readonly&&<button className="btn btn-primary" onClick={()=>open()}><Icon name="plus" size={15}/>New Plan</button>}</div>
      {data.shifts.length===0&&<div className="alert alert-warning"><Icon name="warn" size={15} color="var(--accent)"/><span style={{fontSize:13}}>No shifts defined yet. Go to Shifts first.</span></div>}
      {data.plans.length===0?<div className="card"><div className="empty-state"><div className="empty-icon"><Icon name="tag" size={24} color="var(--text3)"/></div><div className="empty-title">No plans yet</div></div></div>
        :<div className="plans-grid">{data.plans.map(plan=>{const shift=(data.shifts||[]).find(s=>s.id===plan.shift_id);const used=(data.subscriptions||[]).filter(s=>s.plan_id===plan.id&&s.status==="active").length;return(<div key={plan.id} className="plan-card"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{shift&&<span className="badge badge-purple" style={{fontSize:11}}>{shift.name}</span>}<span className="badge badge-gray">{plan.duration}d</span></div><div style={{fontFamily:"'Playfair Display',serif",fontSize:17,marginTop:12}}>{plan.name}</div><div style={{fontSize:26,fontWeight:700,color:"var(--accent)",margin:"10px 0 4px"}}>{formatCurrency(plan.price)}<span style={{fontSize:12,fontWeight:400,color:"var(--text3)"}}>/period</span></div>{plan.description&&<div className="text-sm text-muted" style={{marginBottom:8}}>{plan.description}</div>}<div className="text-sm text-muted"><strong style={{color:"var(--text)"}}>{used}</strong> active subscribers</div><div style={{display:"flex",gap:8,marginTop:14}}><button className="btn btn-secondary btn-sm" onClick={()=>open(plan)}><Icon name="edit" size={13}/>Edit</button><button className="btn btn-danger btn-sm" onClick={()=>setConfirmDel(plan.id)}><Icon name="trash" size={13}/></button></div></div>);})}</div>}
      {showModal&&<div className="modal-overlay"><div className="modal"><div className="modal-header"><h2 className="modal-title">{edit?"Edit":"New"} Plan</h2><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Icon name="x" size={17}/></button></div><div className="modal-body"><div className="form-row"><div className="form-group"><label className="label">Plan Name *</label><input className="input" placeholder="Monthly Premium" value={form.name} onChange={e=>set("name",e.target.value)}/></div><div className="form-group"><label className="label">Price (₹) *</label><input className="input" type="number" placeholder="999" value={form.price} onChange={e=>set("price",e.target.value)}/></div></div><div className="form-row"><div className="form-group"><label className="label">Duration (Days)</label><input className="input" type="number" value={form.duration} onChange={e=>set("duration",Number(e.target.value))}/></div><div className="form-group"><label className="label">Shift</label><select className="input select" value={form.shiftId} onChange={e=>set("shiftId",e.target.value)}><option value="">No specific shift</option>{(data.shifts||[]).map(s=><option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>)}</select></div></div><div className="form-group"><label className="label">Description</label><textarea className="input textarea" value={form.description} onChange={e=>set("description",e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Spinner size={15}/>:null}{edit?"Save":"Create"}</button></div></div></div>}
    </div>
  );
}

function Subscriptions({ data, reload, prefill, onClearPrefill, library }) {
  const [showModal, setShowModal] = useState(!!prefill);
  const [editSub, setEditSub]     = useState(null); // subscription being edited
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState("all");
  const emptyForm = {studentId:"",planId:"",startDate:today(),seatNumber:String(prefill?.seatNumber||""),shiftId:prefill?.shiftId||"",paymentMode:"cash",discount:0,notes:"",isRenewal:false};
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const set=(k,v)=>{ setForm(p=>({...p,[k]:v})); setError(""); };

  useEffect(()=>{if(prefill){setForm(p=>({...p,seatNumber:String(prefill.seatNumber||""),shiftId:prefill.shiftId||""}));setShowModal(true);}}, [prefill]);

  const selectedPlan   = (data.plans||[]).find(p=>p.id===form.planId);
  const effectiveAmount = selectedPlan ? Math.max(0,Number(selectedPlan.price)-Number(form.discount||0)) : 0;
  const endDate         = selectedPlan ? addDays(form.startDate, selectedPlan.duration) : "";

  // ── Time-overlap check for a seat ──────────────────────────────────────────
  // Returns true if the given shiftId's time overlaps ANY active sub on seatNum
  // (excluding the subscription being edited)
  const hasTimeOverlap = (seatNum, shiftId, excludeSubId=null) => {
    if (!seatNum || !shiftId) return false;
    const sh = (data.shifts||[]).find(s=>s.id===shiftId);
    if (!sh) return false;
    const newStart = toMins(sh.start_time), newEnd = toMins(sh.end_time);
    const activeSubs = (data.subscriptions||[]).filter(s=>
      s.status==="active" &&
      Number(s.seat_number)===Number(seatNum) &&
      daysDiff(s.end_date)>=0 &&
      s.id !== excludeSubId
    );
    return activeSubs.some(sub => {
      const existSh = (data.shifts||[]).find(s=>s.id===sub.shift_id);
      if (!existSh) return false;
      const exStart = toMins(existSh.start_time), exEnd = toMins(existSh.end_time);
      // Overlap if not (newEnd <= exStart || newStart >= exEnd)
      return !(newEnd <= exStart || newStart >= exEnd);
    });
  };

  // ── Duplicate active subscription check for student ───────────────────────
  const getActiveSubForStudent = (studentId, excludeSubId=null) =>
    (data.subscriptions||[]).find(s=>
      s.student_id===studentId &&
      s.status==="active" &&
      daysDiff(s.end_date)>=0 &&
      s.id!==excludeSubId
    );

  // ── Save (create or update) ───────────────────────────────────────────────
  const save = async () => {
    if (!form.studentId || !form.planId) { setError("Please select a student and plan."); return; }
    // Block duplicate active subscription
    if (!editSub && !form.isRenewal && getActiveSubForStudent(form.studentId)) {
      setError("This student already has an active subscription. Cancel it first or use Edit.");
      return;
    }
    // Block seat time overlap
    if (form.seatNumber && form.shiftId) {
      const excludeId = editSub?.id || null;
      if (hasTimeOverlap(form.seatNumber, form.shiftId, excludeId)) {
        setError("This shift overlaps with an existing subscription on that seat. Choose a different shift or seat.");
        return;
      }
    }
    setSaving(true);
    const selectedShift = (data.shifts||[]).find(s=>s.id===form.shiftId);
    try {
      if (editSub) {
        await api.subscriptions.update(editSub.id, {
          planId:form.planId, planName:selectedPlan.name,
          shiftId:form.shiftId||null, shiftName:selectedShift?.name||"",
          seatNumber:form.seatNumber?Number(form.seatNumber):null,
          amount:effectiveAmount, discount:Number(form.discount||0),
          paymentMode:form.paymentMode, startDate:form.startDate, endDate, notes:form.notes,
        });
      } else {
        await api.subscriptions.create({
          studentId:form.studentId, planId:form.planId, planName:selectedPlan.name,
          shiftId:form.shiftId||null, shiftName:selectedShift?.name||"",
          seatNumber:form.seatNumber?Number(form.seatNumber):null,
          amount:effectiveAmount, discount:Number(form.discount||0),
          paymentMode:form.paymentMode, startDate:form.startDate, endDate, notes:form.notes,
        });
      }
      await reload(["subscriptions","reminders"]);
      closeModal();
    } catch(e) {
      setError(e.message || "Failed to save.");
    } finally { setSaving(false); }
  };

  const closeModal = () => {
    setShowModal(false); setEditSub(null); setForm(emptyForm); setError("");
    if(onClearPrefill) onClearPrefill();
  };

  const openEdit = (sub) => {
    setEditSub(sub);
    setForm({
      studentId: sub.student_id,
      planId:    sub.plan_id||"",
      startDate: sub.start_date?.slice(0,10)||today(),
      seatNumber:String(sub.seat_number||""),
      shiftId:   sub.shift_id||"",
      paymentMode:sub.payment_mode||"cash",
      discount:  sub.discount||0,
      notes:     sub.notes||"",
    });
    setError("");
    setShowModal(true);
  };

  const cancel = async(id) => { await api.subscriptions.cancel(id); await reload(["subscriptions"]); };

  // ── Shift dropdown: disable shifts that overlap with existing seat bookings ─
  const shiftOption = (sh) => {
    if (!form.seatNumber) return { disabled: false, reason: "" };
    const overlap = hasTimeOverlap(form.seatNumber, sh.id, editSub?.id||null);
    return { disabled: overlap, reason: overlap ? " — Overlaps existing booking" : "" };
  };

  // ── Seat dropdown: disable fully occupied seats ────────────────────────────
  const seatStatus = (n) => getSeatStatus(n, data.subscriptions, data.shifts, library);
  const totalSeats  = library?.total_seats || 30;

  const subs = (data.subscriptions||[]).filter(s=>{
    const q=search.toLowerCase();
    const match=s.student_name?.toLowerCase().includes(q)||s.plan_name?.toLowerCase().includes(q);
    const f=filter==="all"
      ||(filter==="active"  && s.status==="active"  && daysDiff(s.end_date)>=0)
      ||(filter==="expiring"&& s.status==="active"  && daysDiff(s.end_date)>=0 && daysDiff(s.end_date)<=7)
      ||(filter==="expired" && (s.status!=="active" || daysDiff(s.end_date)<0));
    return match&&f;
  }).sort((a,b)=>b.created_at>a.created_at?1:-1);

  // Warn if selected student already has active sub (new sub only)
  const existingActiveSub = form.studentId && !editSub && !form.isRenewal ? getActiveSubForStudent(form.studentId) : null;

  return(
    <div>
      <div className="page-header">
        <div className="page-header-left"><h1>Subscriptions</h1><p>{(data.subscriptions||[]).filter(s=>s.status==="active"&&daysDiff(s.end_date)>=0).length} active</p></div>
        <div className="flex items-center gap-2">
          <div className="search-bar"><Icon name="search" size={15} color="var(--text3)"/><input placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
          <button className="btn btn-primary" onClick={()=>{setEditSub(null);setForm(emptyForm);setError("");setShowModal(true);}}><Icon name="plus" size={15}/>New</button>
        </div>
      </div>
      <div className="pill-tabs">{[["all","All"],["active","Active"],["expiring","Expiring"],["expired","Expired"]].map(([v,l])=><div key={v} className={`pill${filter===v?" active":""}`} onClick={()=>setFilter(v)}>{l}</div>)}</div>
      <div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>Student</th><th>Plan</th><th>Shift</th><th>Seat</th><th>Amount</th><th>Expires</th><th>Status</th><th></th></tr></thead><tbody>
        {subs.length===0
          ?<tr><td colSpan={8}><div className="empty-state"><div className="empty-icon"><Icon name="id" size={24} color="var(--text3)"/></div><div className="empty-title">No subscriptions</div></div></td></tr>
          :subs.map(s=>{
            const diff=daysDiff(s.end_date);const exp=s.status!=="active"||diff<0;
            return(<tr key={s.id}>
              <td><div style={{fontWeight:600}}>{s.student_name}</div><div className="text-xs text-muted">{s.student_phone}</div></td>
              <td className="text-sm">{s.plan_name}</td>
              <td>{s.shift_name?<span className="badge badge-purple" style={{fontSize:11}}>{s.shift_name}</span>:<span className="text-muted text-xs">—</span>}</td>
              <td>{s.seat_number?<span className="badge badge-blue">#{s.seat_number}</span>:<span className="text-muted text-xs">—</span>}</td>
              <td className="text-accent font-bold">{formatCurrency(s.amount)}</td>
              <td className="text-sm">{formatDate(s.end_date)}</td>
              <td>{exp?<span className="badge badge-red">Expired</span>:diff<=3?<span className="badge badge-red">Exp {diff}d</span>:diff<=7?<span className="badge badge-yellow">Exp {diff}d</span>:<span className="badge badge-green">Active</span>}</td>
              <td><div className="flex gap-2">
                <button className="btn btn-ghost btn-icon" title="Send WhatsApp" onClick={()=>openWhatsApp(s.student_phone,`Hi ${s.student_name}, your library subscription (${s.plan_name}) ${diff<0?"has expired":"will expire on "+formatDate(s.end_date)}. Please renew to continue your access. Thank you!`)} style={{color:"#25D366"}}><Icon name="whatsapp" size={14} color="#25D366"/></button>
                {!exp&&<button className="btn btn-secondary btn-sm" onClick={()=>openEdit(s)}><Icon name="edit" size={13}/>Edit</button>}
                <button className="btn btn-secondary btn-sm" onClick={()=>{
                  const expDate=s.end_date?.slice(0,10);
                  // If sub is expired, start from expiry date; if still active, start from day after expiry
                  const renewStart=expDate?(daysDiff(expDate)<0?expDate:addDays(expDate,1)):today();
                  setEditSub(null);setForm({...emptyForm,studentId:s.student_id,planId:s.plan_id||"",seatNumber:String(s.seat_number||""),shiftId:s.shift_id||"",startDate:renewStart,notes:"Renewal",isRenewal:true});setShowModal(true);}}>Renew</button>
                {!exp&&<button className="btn btn-danger btn-sm" onClick={()=>cancel(s.id)}>Cancel</button>}
              </div></td>
            </tr>);
          })}
      </tbody></table></div></div>

      {showModal&&<div className="modal-overlay"><div className="modal modal-lg">
        <div className="modal-header">
          <h2 className="modal-title">{editSub?"Edit Subscription":form.isRenewal?"Renew Subscription":"New Subscription"}{form.seatNumber?` — Seat #${form.seatNumber}`:""}</h2>
          <button className="btn btn-ghost btn-icon" onClick={closeModal}><Icon name="x" size={17}/></button>
        </div>
        <div className="modal-body">
          {/* Student — locked in edit mode */}
          <div className="form-row">
            <div className="form-group">
              <label className="label">Student *</label>
              {editSub
                ?<div className="input" style={{background:"var(--surface3)",cursor:"not-allowed",color:"var(--text2)"}}>{(data.students||[]).find(s=>s.id===form.studentId)?.name||"—"}</div>
                :<select className="input select" value={form.studentId} onChange={e=>set("studentId",e.target.value)}>
                  <option value="">Select student…</option>
                  {(data.students||[]).filter(s=>s.status==="active").map(s=><option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}
                </select>
              }
            </div>
            <div className="form-group">
              <label className="label">Plan *</label>
              <select className="input select" value={form.planId} onChange={e=>{set("planId",e.target.value);const pl=(data.plans||[]).find(p=>p.id===e.target.value);if(pl?.shift_id)set("shiftId",pl.shift_id);}}>
                <option value="">Select plan…</option>
                {(data.plans||[]).map(p=><option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} / {p.duration}d</option>)}
              </select>
            </div>
          </div>

          {/* Duplicate active sub warning */}
          {existingActiveSub&&<div className="alert alert-warning"><Icon name="warn" size={14} color="var(--accent)"/><span style={{fontSize:13}}>This student already has an active <strong>{existingActiveSub.plan_name}</strong> subscription expiring <strong>{formatDate(existingActiveSub.end_date)}</strong>. Cancel it first or use Edit.</span></div>}

          {selectedPlan&&<div className="alert alert-success"><Icon name="check" size={14} color="var(--green)"/><span style={{fontSize:13}}>Duration: <strong>{selectedPlan.duration}d</strong> · End: <strong>{formatDate(endDate)}</strong> · Payable: <strong>{formatCurrency(effectiveAmount)}</strong></span></div>}

          <div className="form-row">
            <div className="form-group">
              <label className="label">Shift</label>
              <select className="input select" value={form.shiftId} onChange={e=>set("shiftId",e.target.value)}>
                <option value="">No specific shift</option>
                {(data.shifts||[]).map(sh=>{const {disabled,reason}=shiftOption(sh);return<option key={sh.id} value={sh.id} disabled={disabled}>{sh.name} ({sh.start_time}–{sh.end_time}){reason}</option>;})}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Seat</label>
              <select className="input select" value={form.seatNumber} onChange={e=>set("seatNumber",e.target.value)}>
                <option value="">No seat</option>
                {Array.from({length:totalSeats},(_,i)=>i+1).map(n=>{
                  const st=seatStatus(n);
                  // In edit mode allow current seat; otherwise block occupied
                  const isCurrentSeat = editSub && Number(editSub.seat_number)===n;
                  const disabled = st==="occupied" && !isCurrentSeat;
                  return<option key={n} value={n} disabled={disabled}>Seat #{n}{st==="half"?" (Half free)":st==="occupied"?" (Full)":""}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group"><label className="label">Start Date</label><input className="input" type="date" value={form.startDate} onChange={e=>set("startDate",e.target.value)}/></div>
            <div className="form-group"><label className="label">Discount (₹)</label><input className="input" type="number" placeholder="0" value={form.discount} onChange={e=>set("discount",e.target.value)}/></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="label">Payment Mode</label><select className="input select" value={form.paymentMode} onChange={e=>set("paymentMode",e.target.value)}>{["cash","upi","card","netbanking","cheque"].map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select></div>
            <div className="form-group"><label className="label">Notes</label><input className="input" placeholder="Optional…" value={form.notes} onChange={e=>set("notes",e.target.value)}/></div>
          </div>

          {error&&<div className="alert alert-warning" style={{marginTop:8}}><Icon name="warn" size={14} color="var(--accent)"/><span style={{fontSize:13,color:"var(--red)"}}>{error}</span></div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={closeModal}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!!existingActiveSub}>{saving?<Spinner size={15}/>:null}{editSub?"Save Changes":form.isRenewal?"Renew Subscription":"Create Subscription"}</button>
        </div>
      </div></div>}
    </div>
  );
}

function SeatsPage({ data, library, reload, onUpdate, onCreateSubscription }) {
  return(
    <div>
      <div className="page-header"><div className="page-header-left"><h1>Seat Map</h1></div></div>
      <div className="card"><SeatPanel data={data} library={library} onUpdate={onUpdate} onCreateSubscription={onCreateSubscription} showControls={true}/></div>
    </div>
  );
}

function Reminders({ data, reload, readonly=false }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({studentId:"",message:"",dueDate:today(),type:"payment"});
  const [saving, setSaving] = useState(false);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));

  const save=async()=>{if(!form.message||!form.dueDate)return;setSaving(true);try{await api.reminders.create({studentId:form.studentId||null,message:form.message,type:form.type,dueDate:form.dueDate});await reload(["reminders"]);setShowModal(false);setForm({studentId:"",message:"",dueDate:today(),type:"payment"});}finally{setSaving(false);}};
  const toggle=async(id)=>{await api.reminders.toggle(id);await reload(["reminders"]);};
  const del=async(id)=>{await api.reminders.delete(id);await reload(["reminders"]);};

  const reminders=[...(data.reminders||[])].sort((a,b)=>a.due_date>b.due_date?1:-1);
  const pending=reminders.filter(r=>!r.done),done=reminders.filter(r=>r.done);
  const getClass=(r)=>{if(r.done)return"ok";const d=daysDiff(r.due_date);if(d<0||d<=3)return"urgent";if(d<=7)return"soon";return"ok";};
  const typeColor={payment:"badge-red",renewal:"badge-gold",custom:"badge-blue",followup:"badge-purple"};

  return(
    <div>
      <div className="page-header"><div className="page-header-left"><h1>Reminders</h1><p>{pending.length} pending</p></div><button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={15}/>Add</button></div>
      {pending.length>0&&<div style={{marginBottom:24}}><div className="section-title"><Icon name="bell" size={13} color="var(--text3)"/>Pending ({pending.length})</div>{pending.map(r=>{const diff=daysDiff(r.due_date);return(<div key={r.id} className={`reminder-chip ${getClass(r)}`}><div style={{flex:1}}><div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}><span className={`badge ${typeColor[r.type]||"badge-gray"}`} style={{textTransform:"capitalize",fontSize:11}}>{r.type}</span>{r.student_name&&<span style={{fontSize:13,fontWeight:600}}>{r.student_name}</span>}<span className="text-xs text-muted">{r.student_phone}</span></div><div style={{fontSize:13.5}}>{r.message}</div><div style={{display:"flex",gap:12,marginTop:5,flexWrap:"wrap"}}><span className="text-xs text-muted">Due: {formatDate(r.due_date)}</span>{diff<0?<span className="text-xs text-red font-bold">Overdue {Math.abs(diff)}d</span>:diff===0?<span className="text-xs text-accent font-bold">Due today</span>:<span className="text-xs" style={{color:diff<=3?"var(--red)":"var(--text3)"}}>in {diff}d</span>}{(()=>{const stuSub=(data.subscriptions||[]).find(sub=>sub.student_id===r.student_id&&sub.status==="active");return stuSub?<span className="text-xs text-muted">· Sub expires: <strong style={{color:daysDiff(stuSub.end_date)<=3?"var(--red)":"var(--text)"}}>{formatDate(stuSub.end_date)}</strong></span>:null;})()}</div></div><div className="flex gap-2">{r.student_phone&&<button className="btn btn-ghost btn-icon" title="Send WhatsApp" onClick={()=>openWhatsApp(r.student_phone,`Hi ${r.student_name||'there'}, ${r.message}. Please visit the library at your earliest convenience. Thank you!`)} style={{color:"#25D366"}}><Icon name="whatsapp" size={15} color="#25D366"/></button>}<button className="btn btn-ghost btn-icon" onClick={()=>toggle(r.id)}><Icon name="check" size={15} color="var(--green)"/></button><button className="btn btn-ghost btn-icon" onClick={()=>del(r.id)}><Icon name="trash" size={15} color="var(--red)"/></button></div></div>);})}</div>}
      {done.length>0&&<div><div className="section-title">Completed ({done.length})</div>{done.map(r=><div key={r.id} className="reminder-chip ok" style={{opacity:0.5}}><Icon name="check" size={14} color="var(--green)"/><div style={{flex:1}}><div style={{fontSize:13,textDecoration:"line-through"}}>{r.message}</div><div className="text-xs text-muted">Due {formatDate(r.due_date)}</div></div><button className="btn btn-ghost btn-icon" onClick={()=>del(r.id)}><Icon name="trash" size={14} color="var(--text3)"/></button></div>)}</div>}
      {reminders.length===0&&<div className="card"><div className="empty-state"><div className="empty-icon"><Icon name="bell" size={24} color="var(--text3)"/></div><div className="empty-title">No reminders</div><div className="empty-sub">Renewal reminders are auto-created on subscription</div></div></div>}
      {showModal&&<div className="modal-overlay"><div className="modal"><div className="modal-header"><h2 className="modal-title">Add Reminder</h2><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Icon name="x" size={17}/></button></div><div className="modal-body"><div className="form-group"><label className="label">Student (optional)</label><select className="input select" value={form.studentId} onChange={e=>set("studentId",e.target.value)}><option value="">No specific student</option>{(data.students||[]).map(s=><option key={s.id} value={s.id}>{s.name} — {s.phone}</option>)}</select></div><div className="form-row"><div className="form-group"><label className="label">Type</label><select className="input select" value={form.type} onChange={e=>set("type",e.target.value)}>{["payment","renewal","followup","custom"].map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div><div className="form-group"><label className="label">Due Date</label><input className="input" type="date" value={form.dueDate} onChange={e=>set("dueDate",e.target.value)}/></div></div><div className="form-group"><label className="label">Message *</label><textarea className="input textarea" placeholder="Reminder message…" value={form.message} onChange={e=>set("message",e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Spinner size={15}/>:null}Add</button></div></div></div>}
    </div>
  );
}

function Expenses({ data, reload, readonly=false }) {
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState({title:"",amount:"",category:"utilities",date:today(),description:"",paymentMode:"cash"});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const set=(k,v)=>setForm(p=>({...p,[k]:v}));
  const cats=["utilities","rent","salary","maintenance","supplies","marketing","taxes","other"];
  const catColor={utilities:"badge-blue",rent:"badge-red",salary:"badge-gold",maintenance:"badge-purple",supplies:"badge-green",marketing:"badge-blue",taxes:"badge-red",other:"badge-gray"};
  const thisMonth=new Date().toISOString().slice(0,7);

  const save=async()=>{if(!form.title||!form.amount)return;setSaving(true);try{await api.expenses.create({title:form.title,amount:Number(form.amount),category:form.category,date:form.date,paymentMode:form.paymentMode,description:form.description});await reload(["expenses"]);setShowModal(false);setForm({title:"",amount:"",category:"utilities",date:today(),description:"",paymentMode:"cash"});}finally{setSaving(false);}};
  const del=async(id)=>{await api.expenses.delete(id);await reload(["expenses"]);setConfirmDel(null);};

  const expenses=(data.expenses||[]).filter(e=>filter==="month"?e.date?.startsWith(thisMonth):true).sort((a,b)=>b.date>a.date?1:-1);
  const total=expenses.reduce((s,e)=>s+Number(e.amount||0),0);

  return(
    <div>
      {confirmDel&&<ConfirmDialog title="Delete Expense?" message="This record will be permanently deleted." confirmLabel="Delete" danger onConfirm={()=>del(confirmDel)} onCancel={()=>setConfirmDel(null)}/>}
      <div className="page-header"><div className="page-header-left"><h1>Expenses</h1></div>{!readonly&&<button className="btn btn-primary" onClick={()=>setShowModal(true)}><Icon name="plus" size={15}/>Add Expense</button>}</div>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:20}}>
        <div className="stat-card red"><div className="stat-label">Total Shown</div><div className="stat-value">{formatCurrency(total)}</div></div>
        <div className="stat-card gold"><div className="stat-label">This Month</div><div className="stat-value">{formatCurrency((data.expenses||[]).filter(e=>e.date?.startsWith(thisMonth)).reduce((s,e)=>s+Number(e.amount),0))}</div></div>
        <div className="stat-card blue"><div className="stat-label">Transactions</div><div className="stat-value">{expenses.length}</div></div>
      </div>
      <div className="pill-tabs"><div className={`pill${filter==="all"?" active":""}`} onClick={()=>setFilter("all")}>All Time</div><div className={`pill${filter==="month"?" active":""}`} onClick={()=>setFilter("month")}>This Month</div></div>
      <div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th><th>Payment</th><th></th></tr></thead><tbody>
        {expenses.length===0?<tr><td colSpan={6}><div className="empty-state"><div className="empty-icon"><Icon name="dollar" size={24} color="var(--text3)"/></div><div className="empty-title">No expenses</div></div></td></tr>
          :expenses.map(e=><tr key={e.id}><td><div style={{fontWeight:600}}>{e.title}</div>{e.description&&<div className="text-xs text-muted">{e.description}</div>}</td><td><span className={`badge ${catColor[e.category]||"badge-gray"}`} style={{textTransform:"capitalize",fontSize:11}}>{e.category}</span></td><td className="text-sm text-muted">{formatDate(e.date)}</td><td className="text-red font-bold">{formatCurrency(e.amount)}</td><td><span className="badge badge-gray" style={{textTransform:"capitalize",fontSize:11}}>{e.payment_mode}</span></td><td><button className="btn btn-ghost btn-icon" onClick={()=>setConfirmDel(e.id)} style={{color:"var(--red)"}}><Icon name="trash" size={14}/></button></td></tr>)}
      </tbody></table></div></div>
      {showModal&&<div className="modal-overlay"><div className="modal"><div className="modal-header"><h2 className="modal-title">Add Expense</h2><button className="btn btn-ghost btn-icon" onClick={()=>setShowModal(false)}><Icon name="x" size={17}/></button></div><div className="modal-body"><div className="form-group"><label className="label">Title *</label><input className="input" placeholder="Electricity bill" value={form.title} onChange={e=>set("title",e.target.value)}/></div><div className="form-row"><div className="form-group"><label className="label">Amount (₹) *</label><input className="input" type="number" placeholder="0" value={form.amount} onChange={e=>set("amount",e.target.value)}/></div><div className="form-group"><label className="label">Date</label><input className="input" type="date" value={form.date} onChange={e=>set("date",e.target.value)}/></div></div><div className="form-row"><div className="form-group"><label className="label">Category</label><select className="input select" value={form.category} onChange={e=>set("category",e.target.value)}>{cats.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}</select></div><div className="form-group"><label className="label">Payment Mode</label><select className="input select" value={form.paymentMode} onChange={e=>set("paymentMode",e.target.value)}>{["cash","upi","card","netbanking","cheque"].map(m=><option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}</select></div></div><div className="form-group"><label className="label">Notes</label><textarea className="input textarea" value={form.description} onChange={e=>set("description",e.target.value)}/></div></div><div className="modal-footer"><button className="btn btn-secondary" onClick={()=>setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?<Spinner size={15}/>:null}Add</button></div></div></div>}
    </div>
  );
}

function Reports({ data }) {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("all");
  const thisMonth=new Date().toISOString().slice(0,7);
  const filterP=(arr,key)=>{if(period==="month")return arr.filter(i=>i[key]?.startsWith(thisMonth));if(period==="year")return arr.filter(i=>i[key]?.startsWith(new Date().getFullYear().toString()));return arr;};
  const subs=filterP(data.subscriptions||[],"start_date");
  const expenses=filterP(data.expenses||[],"date");
  const totalRevenue=subs.reduce((s,x)=>s+Number(x.amount||0),0);
  const totalExpenses=expenses.reduce((s,x)=>s+Number(x.amount||0),0);
  const netProfit=totalRevenue-totalExpenses;
  const planStats=(data.plans||[]).map(p=>({name:p.name,count:subs.filter(s=>s.plan_id===p.id).length,revenue:subs.filter(s=>s.plan_id===p.id).reduce((sum,s)=>sum+Number(s.amount||0),0)})).sort((a,b)=>b.revenue-a.revenue);
  const maxPR=Math.max(...planStats.map(p=>p.revenue),1);
  const cats=["utilities","rent","salary","maintenance","supplies","marketing","taxes","other"];
  const expByCat=cats.map(c=>({cat:c,total:expenses.filter(e=>e.category===c).reduce((s,e)=>s+Number(e.amount),0)})).filter(e=>e.total>0).sort((a,b)=>b.total-a.total);
  const maxEC=Math.max(...expByCat.map(e=>e.total),1);

  return(
    <div>
      <div className="page-header"><div className="page-header-left"><h1>Reports & Analytics</h1></div><div className="pill-tabs" style={{marginBottom:0}}>{[["all","All Time"],["month","This Month"],["year","This Year"]].map(([v,l])=><div key={v} className={`pill${period===v?" active":""}`} onClick={()=>setPeriod(v)}>{l}</div>)}</div></div>
      <div className="stats-grid" style={{gridTemplateColumns:"repeat(4,1fr)",marginBottom:22}}>
        <div className="stat-card green"><div className="stat-label">Revenue</div><div className="stat-value">{formatCurrency(totalRevenue)}</div></div>
        <div className="stat-card red"><div className="stat-label">Expenses</div><div className="stat-value">{formatCurrency(totalExpenses)}</div></div>
        <div className="stat-card gold"><div className="stat-label">Net Profit</div><div className="stat-value" style={{color:netProfit>=0?"var(--green)":"var(--red)"}}>{formatCurrency(netProfit)}</div></div>
        <div className="stat-card blue"><div className="stat-label">Subscriptions</div><div className="stat-value">{subs.length}</div></div>
      </div>
      <div className="tabs">{[["overview","Overview"],["students","Students"],["subscriptions","Subscriptions"],["expenses","Expenses"]].map(([v,l])=><button key={v} className={`tab${tab===v?" active":""}`} onClick={()=>setTab(v)}>{l}</button>)}</div>
      {tab==="overview"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <div className="card"><div className="section-title">Revenue by Plan</div>{planStats.length===0?<div className="text-muted text-sm">No data</div>:planStats.map(p=><div key={p.name} style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span className="text-sm font-bold">{p.name}</span><span className="text-sm text-accent">{formatCurrency(p.revenue)}</span></div><div style={{height:7,background:"var(--surface3)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(p.revenue/maxPR)*100}%`,background:"var(--accent)",borderRadius:4,transition:"width 0.6s ease"}}/></div><div className="text-xs text-muted" style={{marginTop:3}}>{p.count} subscriptions</div></div>)}</div>
        <div className="card"><div className="section-title">Expenses by Category</div>{expByCat.length===0?<div className="text-muted text-sm">No data</div>:expByCat.map(e=><div key={e.cat} style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span className="text-sm font-bold" style={{textTransform:"capitalize"}}>{e.cat}</span><span className="text-sm text-red">{formatCurrency(e.total)}</span></div><div style={{height:7,background:"var(--surface3)",borderRadius:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(e.total/maxEC)*100}%`,background:"var(--red)",borderRadius:4,transition:"width 0.6s ease"}}/></div></div>)}</div>
      </div>}
      {tab==="students"&&<div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>#</th><th>Name</th><th>Phone</th><th>Joined</th><th>Subscriptions</th><th>Total Paid</th><th>Status</th></tr></thead><tbody>
        {(data.students||[]).length===0?<tr><td colSpan={7}><div className="text-muted text-sm" style={{textAlign:"center",padding:32}}>No students</div></td></tr>
          :(data.students||[]).map((s,i)=>{const stuSubs=(data.subscriptions||[]).filter(sub=>sub.student_id===s.id);return(<tr key={s.id}><td className="text-xs text-muted">{i+1}</td><td style={{fontWeight:600}}>{s.name}</td><td className="text-sm">{s.phone}</td><td className="text-sm text-muted">{formatDate(s.join_date)}</td><td><span className="badge badge-blue">{stuSubs.length}</span></td><td className="text-accent font-bold">{formatCurrency(stuSubs.reduce((sum,sub)=>sum+Number(sub.amount||0),0))}</td><td><span className={`badge ${s.status==="active"?"badge-green":"badge-gray"}`}>{s.status}</span></td></tr>);})}
      </tbody></table></div></div>}
      {tab==="subscriptions"&&<div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>Student</th><th>Plan</th><th>Shift</th><th>Start</th><th>End</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        {subs.length===0?<tr><td colSpan={7}><div className="text-muted text-sm" style={{textAlign:"center",padding:32}}>No subscriptions</div></td></tr>
          :subs.sort((a,b)=>b.start_date>a.start_date?1:-1).map(s=>{const diff=daysDiff(s.end_date);return(<tr key={s.id}><td style={{fontWeight:600}}>{s.student_name}</td><td>{s.plan_name}</td><td>{s.shift_name?<span className="badge badge-purple" style={{fontSize:11}}>{s.shift_name}</span>:"—"}</td><td className="text-sm text-muted">{formatDate(s.start_date)}</td><td className="text-sm">{formatDate(s.end_date)}</td><td className="text-accent font-bold">{formatCurrency(s.amount)}</td><td>{s.status!=="active"?<span className="badge badge-gray">{s.status}</span>:diff<0?<span className="badge badge-red">Expired</span>:<span className="badge badge-green">Active</span>}</td></tr>);})}
      </tbody></table></div></div>}
      {tab==="expenses"&&<div className="card" style={{padding:0}}><div className="table-container"><table className="table"><thead><tr><th>Title</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead><tbody>
        {expenses.length===0?<tr><td colSpan={4}><div className="text-muted text-sm" style={{textAlign:"center",padding:32}}>No expenses</div></td></tr>
          :expenses.sort((a,b)=>b.date>a.date?1:-1).map(e=><tr key={e.id}><td style={{fontWeight:600}}>{e.title}</td><td><span className="badge badge-gray" style={{textTransform:"capitalize",fontSize:11}}>{e.category}</span></td><td className="text-sm text-muted">{formatDate(e.date)}</td><td className="text-red font-bold">{formatCurrency(e.amount)}</td></tr>)}
      </tbody></table></div></div>}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [library, setLibrary]     = useState(null);
  const [checking, setChecking]   = useState(true);
  const [page, setPage]           = useState("dashboard");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pwaPrompt, setPwaPrompt]     = useState(false);

  // Show PWA install FAB after 10s, auto-hide tooltip after 4s
  const [pwaTooltip, setPwaTooltip] = useState(false);
  useEffect(()=>{
    const show = () => {
      setPwaPrompt(true);
      setPwaTooltip(true);
      setTimeout(()=>setPwaTooltip(false), 4000); // tooltip hides after 4s
    };
    const t = setTimeout(()=>{ if(window._pwaPrompt) show(); }, 10000);
    window.addEventListener('beforeinstallprompt', ()=>{ setTimeout(show, 10000); });
    return ()=>clearTimeout(t);
  },[]);
  const [subPrefill, setSubPrefill]   = useState(null);

  const { data, setData, reload, loading } = useLibraryData(!!library);

  // Restore session on mount
  useEffect(() => {
    const token = getToken();
    if (!token) { setChecking(false); return; }
    api.auth.me()
      .then(lib => setLibrary(lib))
      .catch(() => clearToken())
      .finally(() => setChecking(false));
  }, []);

  const handleAuth    = (lib) => { setLibrary(lib); };
  const handleLogout  = ()    => { clearToken(); setLibrary(null); setData({ shifts:[], plans:[], students:[], subscriptions:[], reminders:[], expenses:[], totalSeats:30 }); };
  const handleUpdate  = (upd) => {
    setLibrary(prev => ({
      ...prev,
      ...(upd.totalSeats   ? { total_seats:   upd.totalSeats   } : {}),
      ...(upd.open_time    ? { open_time:     upd.open_time    } : {}),
      ...(upd.close_time   ? { close_time:    upd.close_time   } : {}),
      ...(upd.owner_name   ? { owner_name:    upd.owner_name   } : {}),
      ...(upd.library_name ? { library_name:  upd.library_name } : {}),
      ...(upd.city         ? { city:          upd.city         } : {}),
    }));
  };
  const handleCreateSub = (pf) => { setSubPrefill(pf); setPage("subscriptions"); };

  const urgentReminders = (data.reminders || []).filter(r => !r.done && daysDiff(r.due_date) <= 3).length;

  const pageTitle = { dashboard:["Dashboard","Overview"], students:["Students","Management"], plans:["Plans","& Pricing"], shifts:["Shifts","& Time Slots"], subscriptions:["Subscriptions","Management"], seats:["Seat","Map"], reminders:["Reminders","& Alerts"], expenses:["Expenses","Tracking"], reports:["Reports","& Analytics"], attendance:["Attendance","& QR Check-in"], marketing:["Marketing","& WhatsApp"], settings:["Account","Settings"], billing:["Billing","& Subscription"] };
  const [t1,t2] = pageTitle[page] || ["",""];

  if (checking) return (
    <>
      <style>{styles}</style>
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"var(--bg)"}}>
        <Spinner size={40}/>
      </div>
    </>
  );

  if (!library) return (<><style>{styles}</style><AuthPage onAuth={handleAuth}/></>);

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        {sidebarOpen && <div className="sidebar-overlay" onClick={()=>setSidebarOpen(false)}/>}
        <Sidebar library={library} active={page} onNav={setPage} onLogout={handleLogout} isOpen={sidebarOpen} onClose={()=>setSidebarOpen(false)} urgentReminders={urgentReminders}/>
        <main className="main">
          <div className="topbar">
            <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
              <button className="btn btn-ghost btn-icon mobile-toggle" onClick={()=>setSidebarOpen(!sidebarOpen)}><Icon name="menu" size={20}/></button>
              <div style={{minWidth:0,overflow:"hidden"}}>
                <div className="topbar-lib-name" style={{fontSize:11,color:"var(--text3)",fontWeight:500,textTransform:"uppercase",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{library.library_name}</div>
                <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:17,lineHeight:1.2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t1} <span style={{color:"var(--accent)"}}>{t2}</span></h1>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {urgentReminders>0&&<button className="btn btn-ghost btn-icon" onClick={()=>setPage("reminders")} style={{position:"relative"}}><Icon name="bell" size={19} color="var(--accent)"/><span style={{position:"absolute",top:4,right:4,width:7,height:7,borderRadius:"50%",background:"var(--red)",border:"2px solid var(--surface)"}}/></button>}
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"5px 11px",background:"var(--surface2)",borderRadius:8,border:"1px solid var(--border)"}}>
                {(()=>{const t=getTrialBannerType(library);if(t==="urgent"||t==="expired"||t==="suspended")return<button onClick={()=>setPage("billing")} className="badge badge-red" style={{cursor:"pointer",border:"none",marginRight:4,fontSize:11}}>{t==="urgent"?`${getTrialDaysLeft(library)}d left`:"Upgrade"}</button>;return null;})()}
                <div className="lib-avatar" style={{width:26,height:26,fontSize:11}}>{library.owner_name?.[0]?.toUpperCase()||"U"}</div>
                <span style={{fontSize:12.5,fontWeight:600}}>{library.owner_name}</span>
              </div>
            </div>
          </div>
          <div className="content">
            {loading && page === "dashboard" && <div style={{position:"absolute",top:16,right:32}}><Spinner size={18}/></div>}
            {page!=="billing" && <TrialBanner library={library} onOpenBilling={()=>setPage("billing")}/>}
            {isReadOnly(library) && page!=="billing" && page!=="settings" && page!=="dashboard" && page!=="attendance" && (
              <div style={{background:"var(--red-dim)",border:"1px solid var(--red)",borderRadius:9,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10,fontSize:13}}>
                <span>🔒</span>
                <span style={{color:"var(--red)",fontWeight:600}}>Read-only mode</span>
                <span style={{color:"var(--text3)"}}>— You can view data but cannot make changes.</span>
                <button className="btn btn-secondary btn-sm" style={{marginLeft:"auto"}} onClick={()=>setPage("billing")}>Upgrade →</button>
              </div>
            )}
            {page==="dashboard"&&<Dashboard data={data} library={library} onUpdate={handleUpdate} onCreateSubscription={handleCreateSub}/>}
            {page==="students"&&<Students data={data} reload={reload} readonly={isReadOnly(library)}/>}
            {page==="plans"&&<Plans data={data} reload={reload} readonly={isReadOnly(library)}/>}
            {page==="shifts"&&<Shifts data={data} reload={reload} readonly={isReadOnly(library)}/>}
            {page==="subscriptions"&&<Subscriptions data={data} library={library} reload={reload} prefill={subPrefill} onClearPrefill={()=>setSubPrefill(null)} readonly={isReadOnly(library)}/>}
            {page==="seats"&&<SeatsPage data={data} library={library} reload={reload} onUpdate={handleUpdate} onCreateSubscription={handleCreateSub}/>}
            {page==="reminders"&&<Reminders data={data} reload={reload} readonly={isReadOnly(library)}/>}
            {page==="expenses"&&<Expenses data={data} reload={reload} readonly={isReadOnly(library)}/>}
            {page==="reports"&&<Reports data={data}/>}
            {page==="attendance"&&<Attendance library={library}/>}
            {page==="marketing"&&<Marketing data={data} library={library}/>}
            {page==="settings"&&<Settings library={library} onUpdate={(upd)=>setLibrary(prev=>({...prev,...upd}))}/>}
            {page==="billing"&&<Billing library={library}/>}
          </div>
        </main>

        {/* ── Bottom Nav (mobile) ── */}
        <nav className="bottom-nav">
          <div className="bottom-nav-inner">
            {[
              {id:"dashboard", icon:"home",       label:"Home"},
              {id:"students",  icon:"users",      label:"Students"},
              {id:"seats",     icon:"seat2",      label:"Seats"},
              {id:"attendance",icon:"attendance", label:"Attend"},
              {id:"billing",   icon:"payment",    label:"Account", badge: getTrialBannerType(library)==="urgent"||getTrialBannerType(library)==="expired" ? "!" : null},
            ].map(item=>(
              <button key={item.id} className={`bottom-nav-item ${page===item.id?"active":""}`}
                onClick={()=>{ setPage(item.id); setSidebarOpen(false); }}>
                {item.badge && <span className="bnbadge">{item.badge}</span>}
                <Icon name={item.icon} size={20} color={page===item.id?"var(--accent)":"var(--text3)"}/>
                {item.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── PWA Install Floating Button ── */}
        {pwaPrompt && (
          <>
            <button className="pwa-fab" title="Install LibraryDesk app"
              onClick={()=>{
                if(window._pwaPrompt){ window._pwaPrompt.prompt(); window._pwaPrompt.userChoice.then(()=>setPwaPrompt(false)); }
                else setPwaPrompt(false);
              }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v13M8 11l4 4 4-4"/><path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2"/>
              </svg>
            </button>
            {pwaTooltip && <div className="pwa-fab-tooltip">Install App</div>}
          </>
        )}
      </div>
    </>
  );
}
