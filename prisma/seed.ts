// Run with `npx prisma db seed` (after `prisma migrate deploy`). Safe to re-run: upserts only.
// Users are not seeded (no password). Admins come from ADMIN_EMAILS at sign-up.
import { PrismaNeon } from "@prisma/adapter-neon";
import { Prisma, PrismaClient } from "../lib/generated/prisma/client.ts";

const db = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL }),
});

const aliases: Record<string, string> = {
  "ARMOURING NO- 5": "ARM5", // production entries, exact spacing (md §7.1)
  AR005: "ARM5", // ERP men posting cost code
  "Armouring 5": "ARM5",
  "Arm 5": "ARM5",
};

// md §7.5: every number that may change lives here, not in code.
const settings: { key: string; value: unknown; description: string }[] = [
  { key: "day_shift_start", value: "08:00", description: "Shift day starts 08:00 (md §7.1)" },
  { key: "night_shift_start", value: "20:00", description: "Night shift from 20:00 to 08:00 (md §7.1)" },
  { key: "kgp_order_prefix", value: "P7", description: "Kharagpur production orders start with P7 (md §7.1)" },
  { key: "nd_batch_name", value: "N.D.", description: "Stock batch never counted (md §7.1)" },
  { key: "men_per_shift", value: { ARM5: 3 }, description: "Men needed per shift, set by the MD only (md §3, §10.6)" },
  { key: "machine_speed_km_day", value: { ARM5: { big: 7, small: 10 } }, description: "Daily output by cable size (md §7.2, §10.3). Open point 4: one table still to be fixed" },
  { key: "avg_lookback_days", value: 14, description: "Average km per working day uses the last two weeks (md §5 block 7)" },
  { key: "stage_chart_days", value: 10, description: "Output by step chart, last N shift days (md §5 block 6)" },
  { key: "latest_entries_shift_days", value: 7, description: "Latest entries list, last N shift days (md §5)" },
  { key: "pace_margin_pct", value: 30, description: "Earlier steps may run at most this % faster than the slowest step (md §7.2)" },
  { key: "bobbin_early_amber_days", value: 10, description: "Bobbins ready more than N days early = AMBER (md §6)" },
  { key: "bobbin_centre_dia_mm", value: 196, description: "Empty bobbin centre diameter for length from turns (md §6)" },
  { key: "bobbin_filled_max_age_days", value: 7, description: "Flag a filled bobbin older than N days (md §7.3)" },
  { key: "bobbin_workshop_max_days", value: 7, description: "Flag a bobbin in the workshop longer than N days (md §7.3)" },
  { key: "bobbin_bad_wound_per_day", value: 3, description: "Flag more than N badly wound bobbins in a day (md §7.3)" },
  { key: "bobbin_unlotted_max_pct", value: 30, description: "Flag bobbins wound without a lot above this % of a day's winding (md §7.3)" },
  { key: "bobbin_turns_min_pct", value: 90, description: "Flag turns below this % of target (md §7.3)" },
  { key: "strip_weight_tolerance_pct", value: 5, description: "Flag strip weight used differing by more than this % (md §7.3)" },
  { key: "stale_data_hours", value: 18, description: "Source older than this is red and alerts (md §4, §8)" },
  { key: "no_entry_alert_hours", value: 6, description: "Men posted but no production entry in this window (md §8)" },
  { key: "erp_entry_mismatch_km", value: 0.5, description: "ERP vs production entries armouring km difference that alerts (md §8)" },
  { key: "feed_cover_alert_days", value: null, description: "TBD: alert when days of cable ready falls below this (md §8, limit not yet set)" },
  { key: "alert_escalation", value: null, description: "TBD by the MD: first and next person per alert (md §8, open point 7)" },
  { key: "drum_length_m", value: 500, description: "Usual cable length per finished drum (md §10.7)" },
  { key: "drum_ready_days_before_outer", value: 4, description: "Finished drums ready N days before outer sheath (md §7.2, §10.7)" },
  { key: "plan_horizon_days", value: 15, description: "Card plan length in days (md §10.3)" },
  { key: "insulated_core_drum_limit", value: 24, description: "Drums available for insulated cores (md §10.3)" },
];

async function main() {
  for (const [alias, machineCode] of Object.entries(aliases)) {
    await db.machineAlias.upsert({ where: { alias }, create: { alias, machineCode }, update: { machineCode } });
  }
  // Only create missing settings: never overwrite values an admin has changed.
  for (const s of settings) {
    await db.setting.upsert({
      where: { key: s.key },
      create: { key: s.key, value: s.value === null ? Prisma.JsonNull : (s.value as Prisma.InputJsonValue), description: s.description, updatedBy: "seed" },
      update: {},
    });
  }
  // 145 bobbins owned from 10-Nov-26 (md §6).
  const fromDate = new Date("2026-11-10");
  await db.bobbinsOwned.upsert({ where: { fromDate }, create: { fromDate, owned: 145 }, update: {} });
  console.log(`Seeded ${Object.keys(aliases).length} aliases, ${settings.length} settings, bobbins owned.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
