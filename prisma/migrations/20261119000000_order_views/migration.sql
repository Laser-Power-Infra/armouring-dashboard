-- Hand-written: views that own the per-order waiting and pending rules (md §5 blocks 1-5, 9),
-- so every list can be paged, sorted and filtered in the database.
-- Parity with the TypeScript rules they replace is proved in tests/db/views.test.ts.

-- One row per Kharagpur order: km done per step, armouring ordered, and what the insulated cores can make.
CREATE VIEW "order_summary" AS
WITH kgp AS (
  SELECT l.*,
         array_position(ARRAY['CONDUCTOR', 'INSULATION', 'LAYING', 'INNER_SHEATH', 'ARMOURING', 'OUTER_SHEATH'], l."stage") AS pos
  FROM "order_lines" l
  -- Kharagpur orders start with the kgp_order_prefix setting (md §7.1). No such setting: every order.
  LEFT JOIN "settings" s ON s."key" = 'kgp_order_prefix' AND jsonb_typeof(s."value") = 'string'
  WHERE s."key" IS NULL OR starts_with(l."prod_order", s."value" #>> '{}')
)
SELECT
  "prod_order",
  -- The first line that names a customer or cable wins, in step order then item, so the answer never changes between loads.
  coalesce((array_agg("customer" ORDER BY pos, "sfg_item") FILTER (WHERE "customer" <> ''))[1], '') AS "customer",
  coalesce((array_agg("cable" ORDER BY pos, "sfg_item") FILTER (WHERE "cable" <> ''))[1], '') AS "cable",
  coalesce(bool_or("approved"), false) AS "approved",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'CONDUCTOR'), 0) AS "done_conductor",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'INSULATION'), 0) AS "done_insulation",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'LAYING'), 0) AS "done_laying",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'INNER_SHEATH'), 0) AS "done_inner_sheath",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'ARMOURING'), 0) AS "done_armouring",
  coalesce(sum("done_qty") FILTER (WHERE "stage" = 'OUTER_SHEATH'), 0) AS "done_outer_sheath",
  coalesce(sum("ordered_qty") FILTER (WHERE "stage" = 'ARMOURING'), 0) AS "ordered_armouring",
  -- 3 full cores + 1 half core are separate lines; the scarcest core line limits the cable (md §5 block 3).
  min("done_qty" / "cores_per_cable") FILTER (WHERE "stage" = 'INSULATION' AND "cores_per_cable" > 0) AS "insulated_cable_km"
FROM kgp
GROUP BY "prod_order";

-- Cable waiting in front of each step. Below half a metre counts as nothing waiting.
CREATE VIEW "order_waiting" AS
SELECT w.step, s."prod_order", s."customer", s."cable", w.km
FROM "order_summary" s
CROSS JOIN LATERAL (
  VALUES
    ('insulation', s."done_conductor" - s."done_insulation"),
    ('laying', s."insulated_cable_km" - s."done_laying"),
    ('inner', s."done_laying" - s."done_inner_sheath"),
    ('armouring', s."done_inner_sheath" - s."done_armouring"),
    ('outer', s."done_armouring" - s."done_outer_sheath")
) AS w(step, km)
WHERE w.km > 0.0005;

-- Armouring still to do, per order (md §5 block 9).
-- in_plan matches by cable name only: plans carry no order number yet.
CREATE VIEW "armouring_pending" AS
WITH planned AS (
  SELECT lower(btrim("cable_item", E' \t\r\n')) AS cable FROM "lots" WHERE NOT "completed"
  UNION
  SELECT lower(btrim("cable_item", E' \t\r\n')) FROM "plan_jobs" WHERE NOT "mark_complete"
)
SELECT
  s."prod_order",
  s."customer",
  s."cable",
  s."ordered_armouring" - s."done_armouring" AS km,
  s."approved",
  EXISTS (SELECT 1 FROM planned p WHERE p.cable <> '' AND p.cable = lower(btrim(s."cable", E' \t\r\n'))) AS "in_plan"
FROM "order_summary" s
WHERE s."ordered_armouring" - s."done_armouring" > 0.0005;
