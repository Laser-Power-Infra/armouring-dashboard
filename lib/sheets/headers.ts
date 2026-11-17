// Maps sheet rows to objects by header name, not column position (spec §0.2, §6).

export type FieldSpec = Record<string, { headers: string[]; optional?: boolean }>;

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export class MissingHeaderError extends Error {}

/** values[0] is the header row. Blank rows are skipped; empty strings become null. */
export function mapRows(values: unknown[][], fields: FieldSpec): Record<string, unknown>[] {
  const [headerRow = [], ...rows] = values;
  const index = new Map(headerRow.map((h, i) => [norm(h), i] as const));

  const cols: [string, number][] = [];
  const missing: string[] = [];
  for (const [field, { headers, optional }] of Object.entries(fields)) {
    const i = headers.map(norm).map((h) => index.get(h)).find((i) => i !== undefined);
    if (i !== undefined) cols.push([field, i]);
    else if (!optional) missing.push(`${field} (${headers.join(" | ")})`);
  }
  if (missing.length) throw new MissingHeaderError(`Missing required headers: ${missing.join(", ")}`);

  return rows
    .filter((r) => r.some((c) => norm(c) !== ""))
    .map((r) =>
      Object.fromEntries(
        cols.map(([field, i]) => {
          const v = r[i];
          return [field, typeof v === "string" && v.trim() === "" ? null : (v ?? null)];
        }),
      ),
    );
}
