const SESSION_COOKIE = "wn_session";
const OAUTH_COOKIE = "wn_oauth";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export interface WhatsnotEnv {
  DB?: D1Database;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  picture: string | null;
};

type OAuthState = {
  state: string;
  nonce: string;
  verifier: string;
  returnTo: string;
  expires: number;
};

function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), {
    status,
    headers: responseHeaders,
  });
}

function configured(env: WhatsnotEnv) {
  return Boolean(env.DB && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.SESSION_SECRET);
}

function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? null;
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function digest(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function encodeSigned(payload: OAuthState, secret: string) {
  const body = base64Url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

async function decodeSigned(value: string | null, secret: string): Promise<OAuthState | null> {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature || await sign(body, secret) !== signature) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(body))) as OAuthState;
    return payload.expires > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

async function verifyGoogleIdToken(idToken: string, clientId: string, expectedNonce: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid Google identity token");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0]))) as { alg?: string; kid?: string };
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1]))) as {
    sub?: string; aud?: string; iss?: string; exp?: number; nonce?: string; email?: string; email_verified?: boolean; name?: string; picture?: string;
  };
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Google token signature");
  const certsResponse = await fetch("https://www.googleapis.com/oauth2/v3/certs", { headers: { accept: "application/json" } });
  if (!certsResponse.ok) throw new Error("Unable to retrieve Google signing keys");
  const certs = await certsResponse.json() as { keys: Array<JsonWebKey & { kid?: string }> };
  const jwk = certs.keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Google signing key not found");
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  const validSignature = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  const validIssuer = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
  if (!validSignature || !validIssuer || claims.aud !== clientId || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000) || claims.nonce !== expectedNonce || !claims.email || !claims.email_verified || !claims.sub) {
    throw new Error("Google identity token validation failed");
  }
  return { googleId: claims.sub, email: claims.email, name: claims.name || claims.email.split("@")[0], picture: claims.picture ?? null };
}

async function currentUser(request: Request, env: WhatsnotEnv): Promise<UserRow | null> {
  if (!env.DB) return null;
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const now = Math.floor(Date.now() / 1000);
  return env.DB.prepare(`
    SELECT users.id, users.email, users.name, users.picture
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?1 AND sessions.expires_at > ?2
    LIMIT 1
  `).bind(tokenHash, now).first<UserRow>();
}

async function startGoogle(request: Request, env: WhatsnotEnv) {
  if (!configured(env)) return new Response(null, { status: 302, headers: { location: "/login?error=google_not_configured" } });
  const url = new URL(request.url);
  const state: OAuthState = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48), returnTo: safeReturnTo(url.searchParams.get("returnTo")), expires: Date.now() + 10 * 60 * 1000 };
  const challenge = await digest(state.verifier);
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorization.search = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", scope: "openid email profile", state: state.state, nonce: state.nonce, code_challenge: challenge, code_challenge_method: "S256", prompt: "select_account" }).toString();
  return new Response(null, { status: 302, headers: { location: authorization.toString(), "set-cookie": secureCookie(OAUTH_COOKIE, await encodeSigned(state, env.SESSION_SECRET!), 600), "cache-control": "no-store" } });
}

async function finishGoogle(request: Request, env: WhatsnotEnv) {
  if (!configured(env)) return new Response(null, { status: 302, headers: { location: "/login?error=google_not_configured" } });
  const url = new URL(request.url);
  const state = await decodeSigned(readCookie(request, OAUTH_COOKIE), env.SESSION_SECRET!);
  if (!state || state.state !== url.searchParams.get("state") || !url.searchParams.get("code")) return new Response(null, { status: 302, headers: { location: "/login?error=invalid_oauth_state" } });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code: url.searchParams.get("code")!, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code", code_verifier: state.verifier }),
  });
  if (!tokenResponse.ok) return new Response(null, { status: 302, headers: { location: "/login?error=token_exchange_failed" } });
  const token = await tokenResponse.json() as { id_token?: string };
  if (!token.id_token) return new Response(null, { status: 302, headers: { location: "/login?error=missing_identity" } });
  try {
    const profile = await verifyGoogleIdToken(token.id_token, env.GOOGLE_CLIENT_ID!, state.nonce);
    const existing = await env.DB!.prepare("SELECT id FROM users WHERE google_id = ?1 OR email = ?2 LIMIT 1").bind(profile.googleId, profile.email).first<{ id: string }>();
    const userId = existing?.id ?? crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.DB!.prepare(`INSERT INTO users (id, google_id, email, name, picture, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)
      ON CONFLICT(email) DO UPDATE SET google_id = excluded.google_id, name = excluded.name, picture = excluded.picture, updated_at = excluded.updated_at`).bind(userId, profile.googleId, profile.email, profile.name, profile.picture, now).run();
    const sessionToken = randomToken(48);
    await env.DB!.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5)").bind(crypto.randomUUID(), userId, await digest(sessionToken), now + SESSION_SECONDS, now).run();
    const headers = new Headers({ location: state.returnTo, "cache-control": "no-store" });
    headers.append("set-cookie", secureCookie(SESSION_COOKIE, sessionToken, SESSION_SECONDS));
    headers.append("set-cookie", secureCookie(OAUTH_COOKIE, "", 0));
    return new Response(null, { status: 302, headers });
  } catch {
    return new Response(null, { status: 302, headers: { location: "/login?error=identity_verification_failed" } });
  }
}

async function dashboard(env: WhatsnotEnv, user: UserRow) {
  const systems = await env.DB!.prepare("SELECT id, name, goals_json, provider, monthly_cost, status, progress, last_event, destination FROM systems WHERE user_id = ?1 ORDER BY created_at DESC").bind(user.id).all();
  const delivered = await env.DB!.prepare("SELECT COUNT(*) AS count FROM message_events WHERE user_id = ?1 AND status IN ('delivered','read')").bind(user.id).first<{ count: number }>();
  const attention = await env.DB!.prepare("SELECT COUNT(*) AS count FROM systems WHERE user_id = ?1 AND status IN ('attention','failed')").bind(user.id).first<{ count: number }>();
  const recent = await env.DB!.prepare("SELECT id, event_type, status, created_at FROM message_events WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 5").bind(user.id).all();
  const rows = systems.results as Array<Record<string, unknown>>;
  const active = rows.filter((row) => row.status === "live").length;
  const maxProgress = rows.reduce((maximum, row) => Math.max(maximum, Number(row.progress ?? 0)), 0);
  return json({ user, metrics: { delivered: delivered?.count ?? 0, active, attention: attention?.count ?? 0 }, setup: { progress: maxProgress, completedSteps: Math.floor(maxProgress / 20) }, systems: rows, recent: recent.results });
}

async function changeSystem(request: Request, env: WhatsnotEnv, user: UserRow, id: string) {
  if (request.method === "DELETE") {
    await env.DB!.prepare("DELETE FROM systems WHERE id = ?1 AND user_id = ?2").bind(id, user.id).run();
    return json({ ok: true });
  }
  const body = await request.json() as { status?: string };
  if (!body.status || !["live", "paused", "setting_up"].includes(body.status)) return json({ error: "Invalid system status." }, 400);
  await env.DB!.prepare("UPDATE systems SET status = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4").bind(body.status, Math.floor(Date.now() / 1000), id, user.id).run();
  return json({ ok: true });
}

async function createSystem(request: Request, env: WhatsnotEnv, user: UserRow) {
  const body = await request.json() as { name?: string; goals?: string[]; provider?: string; monthlyCost?: number };
  const goals = Array.isArray(body.goals) ? [...new Set(body.goals.filter((goal) => typeof goal === "string"))].slice(0, 8) : [];
  if (!body.name?.trim() || goals.length === 0 || !body.provider) return json({ error: "Name, provider and at least one goal are required." }, 400);
  const id = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  await env.DB!.prepare("INSERT INTO systems (id, user_id, name, goals_json, provider, monthly_cost, status, progress, last_event, destination, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'setting_up', 20, 'Waiting for WhatsApp connection', 'Not connected', ?7, ?7)").bind(id, user.id, body.name.trim().slice(0, 100), JSON.stringify(goals), body.provider.slice(0, 40), Math.max(0, Number(body.monthlyCost ?? 0)), now).run();
  return json({ id }, 201);
}

export async function handleApi(request: Request, env: WhatsnotEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) return null;
  if (url.pathname === "/api/auth/config" && request.method === "GET") return json({ google: configured(env), database: Boolean(env.DB) });
  if (url.pathname === "/api/auth/google/start" && request.method === "GET") return startGoogle(request, env);
  if (url.pathname === "/api/auth/google/callback" && request.method === "GET") return finishGoogle(request, env);
  if (url.pathname === "/api/session" && request.method === "GET") {
    const user = await currentUser(request, env);
    return user ? json({ user }) : json({ user: null }, 401);
  }
  if (url.pathname === "/api/logout" && request.method === "POST") {
    const token = readCookie(request, SESSION_COOKIE);
    if (token && env.DB) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await digest(token)).run();
    return json({ ok: true }, 200, { "set-cookie": secureCookie(SESSION_COOKIE, "", 0) });
  }
  const user = await currentUser(request, env);
  if (!user) return json({ error: "Authentication required" }, 401);
  if (!env.DB) return json({ error: "Database is not configured" }, 503);
  try {
    if (url.pathname === "/api/dashboard" && request.method === "GET") return dashboard(env, user);
    if (url.pathname === "/api/systems" && request.method === "POST") return createSystem(request, env, user);
    if (url.pathname === "/api/systems" && request.method === "GET") {
      const result = await env.DB.prepare("SELECT id, name, goals_json, provider, monthly_cost, status, progress, last_event, destination FROM systems WHERE user_id = ?1 ORDER BY created_at DESC").bind(user.id).all();
      return json({ systems: result.results });
    }
    const systemMatch = url.pathname.match(/^\/api\/systems\/([^/]+)$/);
    if (systemMatch && (request.method === "PATCH" || request.method === "DELETE")) return changeSystem(request, env, user, decodeURIComponent(systemMatch[1]));
    if (url.pathname === "/api/activity" && request.method === "GET") {
      const result = await env.DB.prepare("SELECT id, event_type, status, customer_reference, system_name, created_at FROM message_events WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 250").bind(user.id).all();
      return json({ events: result.results });
    }
  } catch {
    return json({ error: "The database schema is not ready. Apply the included D1 migration." }, 503);
  }
  return json({ error: "Not found" }, 404);
}
