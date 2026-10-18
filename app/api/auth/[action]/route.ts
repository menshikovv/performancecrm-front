import { NextRequest, NextResponse } from "next/server";

const AUTH_API_BASE = (process.env.SCOUTSCOPE_API_URL || "http://localhost:8090").replace(/\/$/, "");
const SESSION_COOKIE = "performance_ecosystem_session";
const SESSION_MAX_AGE_SECONDS = 2 * 60 * 60;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function boundedString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const host = request.headers.get("host");
  if (!host || /[\s/\\@?#,]/.test(host)) return false;
  try {
    // NextURL normalizes loopback hosts to localhost. Compare the browser's
    // origin against the actual Host without widening the same-origin policy.
    const expected = new URL(`${request.nextUrl.protocol}//${host}`);
    const supplied = new URL(origin);
    return ["http:", "https:"].includes(expected.protocol) && supplied.origin === origin && supplied.origin === expected.origin;
  } catch { return false; }
}

function publicPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "token" && key !== "profileMeta")
      .map(([key, nested]) => [key, publicPayload(nested)]),
  );
}

function clearSession(response: NextResponse) {
  response.cookies.set({ name: SESSION_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
}

function setSession(response: NextResponse, token: string) {
  response.cookies.set({ name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_MAX_AGE_SECONDS });
}

function registrationBody(body: Record<string, unknown>) {
  const access = body.access === "team" ? "team" : "personal";
  const role = body.role === "staff" ? "staff" : body.role === "player" ? "player" : null;
  return {
    name: boundedString(body.name, 120),
    email: boundedString(body.email, 254),
    password: boundedString(body.password, 128),
    profileMeta: {
      registration_source: "performance_crm",
      apps: {
        performance_crm: {
          accessMode: access,
          role: access === "team" ? role : null,
          faceitUrl: boundedString(body.faceit, 500) || null,
          teamCode: boundedString(body.teamCode, 64) || null,
        },
      },
    },
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: { message: "Cross-origin request rejected" } }, { status: 403 });
  const { action } = await params;
  if (action === "logout") {
    const response = NextResponse.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    clearSession(response);
    return response;
  }
  if (action !== "login" && action !== "register") return NextResponse.json({ error: { message: "Route not found" } }, { status: 404 });
  if (!request.headers.get("content-type")?.includes("application/json")) return NextResponse.json({ error: { message: "Expected application/json" } }, { status: 415 });

  const body = asRecord(await request.json().catch(() => null));
  const upstreamBody = action === "login"
    ? { loginOrEmail: boundedString(body.loginOrEmail, 254), password: boundedString(body.password, 128) }
    : registrationBody(body);
  try {
    const upstream = await fetch(`${AUTH_API_BASE}/api/ecosystem/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(upstreamBody),
      cache: "no-store",
    });
    const payload = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(publicPayload(payload), { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    const token = asRecord(payload).token;
    if (upstream.ok && typeof token === "string") setSession(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: { message: "Authentication service is unavailable" } }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  if (action !== "me") return NextResponse.json({ error: { message: "Route not found" } }, { status: 404 });
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: { message: "Authentication required" } }, { status: 401 });
  try {
    const upstream = await fetch(`${AUTH_API_BASE}/api/ecosystem/auth/me`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
    const payload = await upstream.json().catch(() => ({}));
    const response = NextResponse.json(publicPayload(payload), { status: upstream.status, headers: { "Cache-Control": "no-store" } });
    if (upstream.status === 401) clearSession(response);
    return response;
  } catch {
    return NextResponse.json({ error: { message: "Authentication service is unavailable" } }, { status: 502 });
  }
}
