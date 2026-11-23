import { randomUUID } from "node:crypto";
import { redirectAllowed } from "@/lib/mcp/oauth";

/** Client registration (RFC 7591). Nothing is stored: the redirect list in lib/mcp/oauth.ts is the real check. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { redirect_uris?: unknown; client_name?: unknown } | null;
  const uris = body?.redirect_uris;
  if (!Array.isArray(uris) || !uris.length || !uris.every((u) => typeof u === "string" && redirectAllowed(u))) {
    return Response.json({ error: "invalid_redirect_uri", error_description: "Only Claude and localhost callbacks are allowed." }, { status: 400 });
  }
  return Response.json(
    {
      client_id: randomUUID(),
      client_name: typeof body?.client_name === "string" ? body.client_name.slice(0, 100) : undefined,
      redirect_uris: uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    { status: 201 },
  );
}
