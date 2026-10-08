import { NextResponse, type NextRequest } from "next/server";

/*
 * Fast redirect for signed-out visitors. This only checks that a session cookie exists; every page
 * and action still validates the session itself (src/server/auth/session.ts), so a stale or forged
 * cookie gets no further than here.
 */
const SESSION_COOKIES = ["__Host-oya_session", "oya_session"];

export function proxy(request: NextRequest) {
  const hasCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasCookie) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/ops/:path*"],
};
