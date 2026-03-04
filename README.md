# 📚 Libra — Library Management System

Full-stack application deployable on AWS.

## Project Structure

```
libra/
├── backend/              Node.js + Express REST API
│   ├── src/
│   │   ├── index.js      Express server entry point
│   │   ├── db/
│   │   │   ├── pool.js   PostgreSQL connection pool
│   │   │   └── migrate.js DB schema migrations
│   │   ├── middleware/
│   │   │   └── auth.js   JWT authentication middleware
│   │   └── routes/
│   │       ├── auth.js   Register / Login / Me
│   │       └── api.js    All CRUD endpoints (shifts, plans, students, etc.)
│   ├── .ebextensions/    Elastic Beanstalk config
│   └── package.json
│
├── frontend/             React + Vite single-page app
│   ├── src/
│   │   ├── api.js        Centralised API client (replaces localStorage)
│   │   ├── App.jsx       Full application UI
│   │   └── main.jsx
│   ├── .env.development  Local dev config
│   ├── .env.production   Production config template
│   └── package.json
│
├── infra/
│   └── cloudformation.yml  AWS infrastructure (VPC, RDS, S3, CloudFront)
│
└── DEPLOYMENT.md         Step-by-step AWS deployment guide
```

## What Changed from the localStorage Version

| Before | After |
|--------|-------|
| Data in browser localStorage | Data in PostgreSQL on AWS RDS |
| Fake auth (plain text passwords) | Real JWT auth with bcrypt |
| Data lost if browser cleared | Data persists, accessible from any device |
| Single device only | Any browser, any device, anywhere |

## Quick Start (Local Development)

```bash
# Terminal 1: Start backend
cd backend
cp .env.example .env     # fill in local Postgres details
npm install
node src/db/migrate.js   # create tables
npm run dev              # starts on :8080

# Terminal 2: Start frontend
cd frontend
npm install
npm run dev              # starts on :5173, proxies /api to :8080
```

## Deploy to AWS

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

## API Endpoints

```
POST   /api/auth/register       Register library
POST   /api/auth/login          Login
GET    /api/auth/me             Current library info
PATCH  /api/auth/seats          Update total seats

GET    /api/shifts              List shifts
POST   /api/shifts              Create shift
PUT    /api/shifts/:id          Update shift
DELETE /api/shifts/:id          Delete shift

GET    /api/plans               List plans
POST   /api/plans               Create plan
PUT    /api/plans/:id           Update plan
DELETE /api/plans/:id           Delete plan

GET    /api/students            List students (with active subscription)
POST   /api/students            Add student
PUT    /api/students/:id        Update student
DELETE /api/students/:id        Delete student

GET    /api/subscriptions       List subscriptions
POST   /api/subscriptions       Create subscription (auto-creates reminder)
PATCH  /api/subscriptions/:id/cancel  Cancel subscription

GET    /api/reminders           List reminders
POST   /api/reminders           Create reminder
PATCH  /api/reminders/:id/toggle  Toggle done
DELETE /api/reminders/:id       Delete reminder

GET    /api/expenses            List expenses
POST   /api/expenses            Add expense
DELETE /api/expenses/:id        Delete expense

GET    /api/reports/summary     Dashboard summary stats
```
