import { google, type sheets_v4 } from "googleapis";

function auth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY not set");
  // Read-only. The alerts writer (spec §9) will need its own client with the spreadsheets scope.
  // drive.metadata.readonly: only to find a sheet by its title (the roster's ID changes with every revision).
  return new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly"],
  });
}

let sheets: sheets_v4.Sheets | undefined;

function client() {
  sheets ??= google.sheets({ version: "v4", auth: auth() });
  return sheets;
}

/** Fetch several ranges in one request. Dates come back as Sheets serial numbers. */
export async function batchGet(spreadsheetId: string, ranges: string[]): Promise<unknown[][][]> {
  const res = await client().spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "SERIAL_NUMBER",
  });
  return (res.data.valueRanges ?? []).map((v) => v.values ?? []);
}

/** The newest (last created) Google Sheet shared with the service account whose title contains `part`; null when there is none. */
export async function newestSheetTitled(part: string): Promise<{ id: string; name: string } | null> {
  const res = await google.drive({ version: "v3", auth: auth() }).files.list({
    q: `name contains '${part.replace(/['\\]/g, "\\$&")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    orderBy: "createdTime desc",
    pageSize: 1,
    fields: "files(id,name)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const f = res.data.files?.[0];
  return f?.id ? { id: f.id, name: f.name ?? part } : null;
}
