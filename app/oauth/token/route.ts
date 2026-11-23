import { pkceOk, tokenResponse, verify } from "@/lib/mcp/oauth";

const noStore = { "Cache-Control": "no-store" };
const refuse = (error: string) => Response.json({ error }, { status: 400, headers: noStore });

/** Swaps a sign-in code, or a refresh token, for an access token. */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const get = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" ? v : "";
  };

  if (get("grant_type") === "authorization_code") {
    const code = verify(get("code"), "code");
    const sameClient = code?.cid === get("client_id") && code.ru === get("redirect_uri");
    if (!code || !sameClient || !code.cc || !pkceOk(get("code_verifier"), code.cc)) return refuse("invalid_grant");
    return Response.json(tokenResponse(code.sub), { headers: noStore });
  }
  if (get("grant_type") === "refresh_token") {
    const refresh = verify(get("refresh_token"), "refresh");
    if (!refresh) return refuse("invalid_grant");
    return Response.json(tokenResponse(refresh.sub), { headers: noStore });
  }
  return refuse("unsupported_grant_type");
}
