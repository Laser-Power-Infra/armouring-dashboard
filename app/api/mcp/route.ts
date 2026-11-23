import { db } from "@/lib/db";
import { originOf, verify } from "@/lib/mcp/oauth";
import { handleRpc } from "@/lib/mcp/server";

/** MCP endpoint for MD sir's rules. Claude connects here; sign-in is the OAuth flow under /oauth. */
export async function POST(req: Request) {
  const claims = verify(req.headers.get("authorization")?.replace(/^Bearer /i, ""), "access");
  // Looked up on every call, so taking away the admin role cuts the connection at once.
  const user = claims && (await db.user.findUnique({ where: { id: claims.sub }, select: { role: true } }));
  if (user?.role !== "admin") {
    return new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer resource_metadata="${originOf(req)}/.well-known/oauth-protected-resource"` },
    });
  }

  let msg: unknown;
  try {
    msg = await req.json();
  } catch {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 });
  }
  const reply = await handleRpc(msg, db);
  return reply ? Response.json(reply) : new Response(null, { status: 202 });
}

// No server-to-client stream: the spec lets a server answer GET with 405.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
