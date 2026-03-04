// src/db/migrate.js
// Run: node src/db/migrate.js
require('dotenv').config();
const pool = require('./pool');

const migrations = `

-- Libraries (one per registered owner)
CREATE TABLE IF NOT EXISTS libraries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_name  VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,           -- bcrypt hash
  library_name VARCHAR(255) NOT NULL,
  city        VARCHAR(255),
  total_seats INTEGER NOT NULL DEFAULT 30,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Shifts (custom time slots per library)
CREATE TABLE IF NOT EXISTS shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plans (pricing plans per library)
CREATE TABLE IF NOT EXISTS plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  duration    INTEGER NOT NULL DEFAULT 30,     -- days
  price       NUMERIC(10,2) NOT NULL,
  shift_id    UUID REFERENCES shifts(id) ON DELETE SET NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  phone       VARCHAR(50) NOT NULL,
  email       VARCHAR(255),
  address     TEXT,
  id_proof    VARCHAR(255),
  notes       TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | inactive
  join_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id    UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_id       UUID REFERENCES plans(id) ON DELETE SET NULL,
  plan_name     VARCHAR(255) NOT NULL,
  shift_id      UUID REFERENCES shifts(id) ON DELETE SET NULL,
  shift_name    VARCHAR(100),
  seat_number   INTEGER,
  amount        NUMERIC(10,2) NOT NULL,
  discount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_mode  VARCHAR(50) NOT NULL DEFAULT 'cash',
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | cancelled | expired
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id  UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_id  UUID REFERENCES students(id) ON DELETE SET NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(50) NOT NULL DEFAULT 'custom',  -- payment | renewal | followup | custom
  due_date    DATE NOT NULL,
  done        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  title        VARCHAR(255) NOT NULL,
  amount       NUMERIC(10,2) NOT NULL,
  category     VARCHAR(100) NOT NULL DEFAULT 'other',
  date         DATE NOT NULL,
  payment_mode VARCHAR(50) NOT NULL DEFAULT 'cash',
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_students_library    ON students(library_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_lib   ON subscriptions(library_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stud  ON subscriptions(student_id);
CREATE INDEX IF NOT EXISTS idx_reminders_library   ON reminders(library_id);
CREATE INDEX IF NOT EXISTS idx_expenses_library    ON expenses(library_id);
CREATE INDEX IF NOT EXISTS idx_shifts_library      ON shifts(library_id);
CREATE INDEX IF NOT EXISTS idx_plans_library       ON plans(library_id);

`;

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running migrations...');
    await client.query(migrations);
    console.log('✅ Migrations complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
