// src/api.js  –  Centralised API client
// All fetch calls go here. Components never hit fetch() directly.

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ─── Token management ─────────────────────────────────────────────────────────
export const getToken  = ()        => localStorage.getItem('libra_token');
export const setToken  = (token)   => localStorage.setItem('libra_token', token);
export const clearToken = ()       => localStorage.removeItem('libra_token');

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    register: (body) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login:    (body) => request('/api/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
    me:       ()     => request('/api/auth/me'),
    updateSeats:   (totalSeats)          => request('/api/auth/seats',    { method: 'PATCH', body: JSON.stringify({ totalSeats }) }),
    updateOpHours: (openTime, closeTime) => request('/api/auth/ophours', { method: 'PATCH', body: JSON.stringify({ openTime, closeTime }) }),
  },

  // ─── Shifts ──────────────────────────────────────────────────────────────
  shifts: {
    list:   ()        => request('/api/shifts'),
    create: (body)    => request('/api/shifts',      { method: 'POST',   body: JSON.stringify(body) }),
    update: (id,body) => request(`/api/shifts/${id}`,{ method: 'PUT',    body: JSON.stringify(body) }),
    delete: (id)      => request(`/api/shifts/${id}`,{ method: 'DELETE' }),
  },

  // ─── Plans ───────────────────────────────────────────────────────────────
  plans: {
    list:   ()        => request('/api/plans'),
    create: (body)    => request('/api/plans',      { method: 'POST',  body: JSON.stringify(body) }),
    update: (id,body) => request(`/api/plans/${id}`,{ method: 'PUT',   body: JSON.stringify(body) }),
    delete: (id)      => request(`/api/plans/${id}`,{ method: 'DELETE' }),
  },

  // ─── Students ─────────────────────────────────────────────────────────────
  students: {
    list:   ()        => request('/api/students'),
    create: (body)    => request('/api/students',      { method: 'POST',  body: JSON.stringify(body) }),
    update: (id,body) => request(`/api/students/${id}`,{ method: 'PUT',   body: JSON.stringify(body) }),
    delete: (id)      => request(`/api/students/${id}`,{ method: 'DELETE' }),
  },

  // ─── Subscriptions ────────────────────────────────────────────────────────
  subscriptions: {
    list:   ()    => request('/api/subscriptions'),
    create: (b)   => request('/api/subscriptions',           { method: 'POST',  body: JSON.stringify(b) }),
    cancel: (id)  => request(`/api/subscriptions/${id}/cancel`,{ method: 'PATCH' }),
  },

  // ─── Reminders ────────────────────────────────────────────────────────────
  reminders: {
    list:   ()    => request('/api/reminders'),
    create: (b)   => request('/api/reminders',            { method: 'POST',  body: JSON.stringify(b) }),
    toggle: (id)  => request(`/api/reminders/${id}/toggle`,{ method: 'PATCH' }),
    delete: (id)  => request(`/api/reminders/${id}`,      { method: 'DELETE' }),
  },

  // ─── Expenses ─────────────────────────────────────────────────────────────
  expenses: {
    list:   ()    => request('/api/expenses'),
    create: (b)   => request('/api/expenses',      { method: 'POST',   body: JSON.stringify(b) }),
    delete: (id)  => request(`/api/expenses/${id}`,{ method: 'DELETE' }),
  },

  // ─── Reports ──────────────────────────────────────────────────────────────
  reports: {
    summary: () => request('/api/reports/summary'),
  },
};
