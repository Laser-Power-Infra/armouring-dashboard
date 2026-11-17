import { google, type sheets_v4 } from "googleapis";

let sheets: sheets_v4.Sheets | undefined;

function client() {
  if (!sheets) {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.replace(/\\n/g, "\n");
    if (!email || !key) throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_KEY not set");
    // Read-only. The alerts writer (spec §9) will need its own client with the spreadsheets scope.
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    sheets = google.sheets({ version: "v4", auth });
  }
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
