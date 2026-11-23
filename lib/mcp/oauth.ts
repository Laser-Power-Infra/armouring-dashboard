import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// OAuth for the MCP endpoint (app/api/mcp). Codes and tokens are signed with AUTH_SECRET and not stored.
// shortcut: a token cannot be revoked on its own and a code works until it expires (60 s, PKCE-bound);
// add a tokens table when one connection must be cut off without removing the user's admin role.

type Kind = "code" | "access" | "refresh";
const TTL_S: Record<Kind, number> = { code: 60, access: 3600, refresh: 30 * 24 * 3600 };
export const ACCESS_TTL_S = TTL_S.access;

export type Claims = { k: Kind; sub: string; exp: number; cc?: string; ru?: string; cid?: string };

function mac(body: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update("mcp." + body).digest("base64url");
}

export function sign(k: Kind, sub: string, extra: Pick<Claims, "cc" | "ru" | "cid"> = {}, now = Date.now()) {
  const claims: Claims = { ...extra, k, sub, exp: Math.floor(now / 1000) + TTL_S[k] };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** The claims when the token is ours, of this kind and not expired; otherwise null. */
export function verify(token: string | null | undefined, k: Kind, now = Date.now()): Claims | null {
  const [body, sig, ...rest] = (token ?? "").split(".");
  if (!body || !sig || rest.length) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as Claims;
  return claims.k === k && claims.exp > now / 1000 ? claims : null;
}

export function pkceOk(verifier: string, challenge: string) {
  return createHash("sha256").update(verifier).digest("base64url") === challenge;
}

// Clients are not stored, so this list is what stops a code going to a stranger's site.
const CLAUDE_CALLBACKS = ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"];

/** Claude's own callback, or a loopback address (Claude Code, MCP Inspector) on the user's machine. */
export function redirectAllowed(uri: string) {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return CLAUDE_CALLBACKS.includes(u.origin + u.pathname);
    return u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

/** Public address of this app. Set AUTH_URL when a proxy hides it from the request. */
export function originOf(req: Request) {
  return process.env.AUTH_URL ? new URL(process.env.AUTH_URL).origin : new URL(req.url).origin;
}

export function tokenResponse(sub: string) {
  return { access_token: sign("access", sub), token_type: "Bearer", expires_in: ACCESS_TTL_S, refresh_token: sign("refresh", sub) };
}
