import { originOf } from "@/lib/mcp/oauth";

/** Tells an MCP client which server signs people in for /api/mcp (RFC 9728). */
export function GET(req: Request) {
  const origin = originOf(req);
  return Response.json({ resource: `${origin}/api/mcp`, authorization_servers: [origin] });
}
