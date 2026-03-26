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

-- Add operation hours columns if not already present
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='open_time') THEN
    ALTER TABLE libraries ADD COLUMN open_time TIME DEFAULT '08:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='close_time') THEN
    ALTER TABLE libraries ADD COLUMN close_time TIME DEFAULT '21:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='reset_token') THEN
    ALTER TABLE libraries ADD COLUMN reset_token VARCHAR(10);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='reset_token_expires') THEN
    ALTER TABLE libraries ADD COLUMN reset_token_expires TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='phone') THEN
    ALTER TABLE libraries ADD COLUMN phone VARCHAR(20);
  END IF;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SAAS ADMIN TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Admin users (your internal team)
CREATE TABLE IF NOT EXISTS admin_users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(50)  NOT NULL DEFAULT 'admin',  -- admin | superadmin
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- SaaS plans (Monthly, Annual, Trial etc.)
CREATE TABLE IF NOT EXISTS saas_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  price         NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 30,
  description   TEXT,
  is_trial      BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SaaS subscriptions (one per library)
CREATE TABLE IF NOT EXISTS saas_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id      UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  saas_plan_id    UUID REFERENCES saas_plans(id) ON DELETE SET NULL,
  plan_name       VARCHAR(255) NOT NULL,
  status          VARCHAR(50)  NOT NULL DEFAULT 'trial',  -- trial | active | expired | suspended
  trial_ends_at   TIMESTAMPTZ,
  current_period_start DATE,
  current_period_end   DATE,
  amount_paid     NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  coupon_code     VARCHAR(50),
  razorpay_sub_id VARCHAR(255),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payments
CREATE TABLE IF NOT EXISTS saas_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id        UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  saas_sub_id       UUID REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
  amount            NUMERIC(10,2) NOT NULL,
  currency          VARCHAR(10)   NOT NULL DEFAULT 'INR',
  status            VARCHAR(50)   NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded
  payment_method    VARCHAR(50)   NOT NULL DEFAULT 'manual',   -- manual | razorpay | upi | card
  razorpay_order_id VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  invoice_number    VARCHAR(100),
  notes             TEXT,
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50)   UNIQUE NOT NULL,
  description     VARCHAR(255),
  discount_type   VARCHAR(20)   NOT NULL DEFAULT 'percent',  -- percent | flat
  discount_value  NUMERIC(10,2) NOT NULL,
  max_uses        INTEGER,
  used_count      INTEGER NOT NULL DEFAULT 0,
  valid_from      DATE,
  valid_until     DATE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  VARCHAR(100) UNIQUE NOT NULL,
  library_id      UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  payment_id      UUID REFERENCES saas_payments(id) ON DELETE SET NULL,
  amount          NUMERIC(10,2) NOT NULL,
  tax_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL,
  status          VARCHAR(50)   NOT NULL DEFAULT 'draft',  -- draft | sent | paid
  due_date        DATE,
  paid_at         TIMESTAMPTZ,
  line_items      JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add SaaS fields to libraries table
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='is_active') THEN
    ALTER TABLE libraries ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='trial_ends_at') THEN
    ALTER TABLE libraries ADD COLUMN trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='subscription_status') THEN
    ALTER TABLE libraries ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trial';
  END IF;
END $$;

-- Default SaaS plans (insert only if empty)
INSERT INTO saas_plans (name, price, duration_days, description, is_trial, is_active)
SELECT * FROM (VALUES
  ('Free Trial',   0,    14, '14-day free trial with full access', TRUE,  TRUE),
  ('Monthly',      1000, 30, 'Full access — ₹1000/month',          FALSE, TRUE),
  ('Annual',       9000, 365,'Full access — ₹9000/year (save ₹3000)', FALSE, TRUE)
) AS v(name, price, duration_days, description, is_trial, is_active)
WHERE NOT EXISTS (SELECT 1 FROM saas_plans LIMIT 1);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saas_subs_library  ON saas_subscriptions(library_id);
CREATE INDEX IF NOT EXISTS idx_saas_payments_lib  ON saas_payments(library_id);
CREATE INDEX IF NOT EXISTS idx_invoices_library    ON invoices(library_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code        ON coupons(code);

-- ═══════════════════════════════════════════════════════════════════════════════
-- WHATSAPP SETTINGS (WaBulk API credentials per library)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID UNIQUE NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  api_key      VARCHAR(255) NOT NULL,
  session_id   VARCHAR(255) NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- EMAIL SETTINGS (SMTP per library for email blast)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS email_settings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id   UUID UNIQUE NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  smtp_host    VARCHAR(255) NOT NULL DEFAULT 'smtp.gmail.com',
  smtp_port    INTEGER      NOT NULL DEFAULT 587,
  smtp_user    VARCHAR(255) NOT NULL,
  smtp_pass    VARCHAR(255) NOT NULL,
  from_name    VARCHAR(255),
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- LIBRARY SLUG + PUBLIC BOOKING FEATURE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add slug to libraries (auto-generated from library name)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='slug') THEN
    ALTER TABLE libraries ADD COLUMN slug VARCHAR(100) UNIQUE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='tagline') THEN
    ALTER TABLE libraries ADD COLUMN tagline VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='address') THEN
    ALTER TABLE libraries ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='contact_phone') THEN
    ALTER TABLE libraries ADD COLUMN contact_phone VARCHAR(20);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='libraries' AND column_name='amenities') THEN
    ALTER TABLE libraries ADD COLUMN amenities TEXT; -- comma separated: wifi,ac,parking etc
  END IF;
END $$;

-- Auto-generate slug for existing libraries that don't have one
DO $$
DECLARE
  lib RECORD;
  base_slug TEXT;
  final_slug TEXT;
  counter INT;
BEGIN
  FOR lib IN SELECT id, library_name FROM libraries WHERE slug IS NULL LOOP
    -- Convert name to slug: lowercase, replace spaces/special chars with hyphens
    base_slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(lib.library_name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'));
    base_slug := TRIM(BOTH '-' FROM base_slug);
    final_slug := base_slug;
    counter := 2;
    -- Handle duplicates
    WHILE EXISTS (SELECT 1 FROM libraries WHERE slug = final_slug AND id != lib.id) LOOP
      final_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;
    UPDATE libraries SET slug = final_slug WHERE id = lib.id;
  END LOOP;
END $$;

-- Booking requests (from public landing page)
CREATE TABLE IF NOT EXISTS booking_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id    UUID NOT NULL REFERENCES libraries(id) ON DELETE CASCADE,
  student_name  VARCHAR(255) NOT NULL,
  phone         VARCHAR(50) NOT NULL,
  email         VARCHAR(255),
  plan_id       UUID REFERENCES plans(id) ON DELETE SET NULL,
  plan_name     VARCHAR(255) NOT NULL,
  shift_id      UUID REFERENCES shifts(id) ON DELETE SET NULL,
  shift_name    VARCHAR(100),
  amount        NUMERIC(10,2) NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | declined
  notes         TEXT,
  decline_reason TEXT,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_library ON booking_requests(library_id);
CREATE INDEX IF NOT EXISTS idx_booking_phone   ON booking_requests(phone);
CREATE INDEX IF NOT EXISTS idx_booking_status  ON booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_libraries_slug  ON libraries(slug);

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
