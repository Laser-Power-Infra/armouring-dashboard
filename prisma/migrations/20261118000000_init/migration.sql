-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password_hash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "refresh_log" (
    "id" BIGSERIAL NOT NULL,
    "job" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "rows" INTEGER,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "triggered_by" TEXT,

    CONSTRAINT "refresh_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" BIGSERIAL NOT NULL,
    "rule" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "first_seen" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "resolved_at" TIMESTAMPTZ,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "machine_alias" (
    "alias" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,

    CONSTRAINT "machine_alias_pkey" PRIMARY KEY ("alias")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "prod_order" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "sfg_item" TEXT NOT NULL,
    "customer" TEXT,
    "cable" TEXT,
    "cores_per_cable" DOUBLE PRECISION,
    "ordered_qty" DOUBLE PRECISION NOT NULL,
    "done_qty" DOUBLE PRECISION NOT NULL,
    "qty_unit" TEXT NOT NULL,
    "approved" BOOLEAN,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("prod_order","stage","sfg_item")
);

-- CreateTable
CREATE TABLE "production_entries" (
    "id" TEXT NOT NULL,
    "machine_raw" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,
    "prod_order_raw" TEXT,
    "prod_orders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cable" TEXT,
    "drum_no" TEXT,
    "qty_m" DOUBLE PRECISION NOT NULL,
    "entered_at" TIMESTAMPTZ NOT NULL,
    "entered_by" TEXT,
    "shift_day" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "men_posted" (
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "emp_code" TEXT NOT NULL,
    "cost_code" TEXT NOT NULL,
    "name" TEXT,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "men_posted_pkey" PRIMARY KEY ("date","shift","emp_code","cost_code")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" BIGSERIAL NOT NULL,
    "item_code" TEXT NOT NULL,
    "item" TEXT,
    "batch" TEXT,
    "godown" TEXT,
    "qty" DOUBLE PRECISION NOT NULL,
    "mfg_date" DATE,
    "is_dead" BOOLEAN NOT NULL DEFAULT false,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sfg_unconsumed" (
    "id" BIGSERIAL NOT NULL,
    "prod_order" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "prev_stage" TEXT,
    "item" TEXT,
    "customer" TEXT,
    "unconsumed_km" DOUBLE PRECISION NOT NULL,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sfg_unconsumed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_jobs" (
    "machine_code" TEXT NOT NULL,
    "row_no" INTEGER NOT NULL,
    "plan_date" DATE,
    "cable_item" TEXT,
    "armour_type" TEXT,
    "armour_size" TEXT,
    "cable_length_m" DOUBLE PRECISION,
    "priority" INTEGER,
    "mark_complete" BOOLEAN NOT NULL DEFAULT false,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_jobs_pkey" PRIMARY KEY ("machine_code","row_no")
);

-- CreateTable
CREATE TABLE "lots" (
    "lot_no" TEXT NOT NULL,
    "machine_code" TEXT NOT NULL,
    "cable_item" TEXT,
    "armour_type" TEXT,
    "armour_size" TEXT,
    "bobbins_needed" INTEGER NOT NULL,
    "bobbins_wound" INTEGER NOT NULL DEFAULT 0,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("lot_no")
);

-- CreateTable
CREATE TABLE "bobbin_log" (
    "date" DATE NOT NULL,
    "shift" TEXT NOT NULL,
    "bobbin_no" TEXT NOT NULL,
    "off_time" TEXT NOT NULL,
    "spooling_machine" TEXT,
    "operator" TEXT,
    "lot_no" TEXT,
    "item" TEXT,
    "turns" INTEGER,
    "outer_dia_mm" DOUBLE PRECISION,
    "length_m" DOUBLE PRECISION,
    "weight_kg" DOUBLE PRECISION,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bobbin_log_pkey" PRIMARY KEY ("date","shift","bobbin_no","off_time")
);

-- CreateTable
CREATE TABLE "bobbin_status" (
    "date" DATE NOT NULL,
    "state" TEXT NOT NULL,
    "item" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bobbin_status_pkey" PRIMARY KEY ("date","state","item")
);

-- CreateTable
CREATE TABLE "bobbins_owned" (
    "from_date" DATE NOT NULL,
    "owned" INTEGER NOT NULL,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bobbins_owned_pkey" PRIMARY KEY ("from_date")
);

-- CreateTable
CREATE TABLE "machine_speeds" (
    "machine_code" TEXT NOT NULL,
    "stage" TEXT,
    "km_per_day" DOUBLE PRECISION NOT NULL,
    "days_per_week" INTEGER,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_speeds_pkey" PRIMARY KEY ("machine_code")
);

-- CreateTable
CREATE TABLE "machine_daily" (
    "machine_code" TEXT NOT NULL,
    "name" TEXT,
    "erp_cost_code" TEXT,
    "must_run" BOOLEAN NOT NULL DEFAULT false,
    "shifts_per_day" INTEGER,
    "men_per_shift" INTEGER,
    "loaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_daily_pkey" PRIMARY KEY ("machine_code")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_log_source_started_at_idx" ON "refresh_log"("source", "started_at");

-- CreateIndex
CREATE INDEX "production_entries_machine_code_shift_day_idx" ON "production_entries"("machine_code", "shift_day");

-- CreateIndex
CREATE INDEX "stock_item_code_idx" ON "stock"("item_code");

-- CreateIndex
CREATE INDEX "sfg_unconsumed_stage_idx" ON "sfg_unconsumed"("stage");


-- Hand-written: rules Prisma cannot express (no enums; CHECK constraints instead).
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" IN ('viewer', 'admin'));
ALTER TABLE "refresh_log" ADD CONSTRAINT "refresh_log_status_check" CHECK ("status" IN ('running', 'ok', 'error', 'skipped'));
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_qty_unit_check" CHECK ("qty_unit" IN ('CORE_KM', 'CABLE_KM'));
ALTER TABLE "production_entries" ADD CONSTRAINT "production_entries_shift_check" CHECK ("shift" IN ('DAY', 'NIGHT'));

-- One open alert per rule and machine.
CREATE UNIQUE INDEX "alerts_open_rule_machine_key" ON "alerts" ("rule", "machine_code") WHERE "resolved_at" IS NULL;
