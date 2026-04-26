import { NextResponse } from "next/server";

/**
 * Next.js Proxy — blocks /admin routes on production.
 * Prevents direct URL access to admin pages when served from clankerbox.com.
 */
export function proxy(request) {
  const hostname = request.headers.get("host") || "";
  const isProduction = hostname.endsWith("clankerbox.com");

  if (isProduction && request.nextUrl.pathname.startsWith("/admin")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
