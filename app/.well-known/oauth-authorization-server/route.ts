import { originOf } from "@/lib/mcp/oauth";

/** Where the OAuth endpoints are (RFC 8414). */
export function GET(req: Request) {
  const origin = originOf(req);
  return Response.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
}
