import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ACCESS_COOKIE, cookieAllowsAccess, passwordRequired, safeNextPath } from "@/lib/siteAccess";

export async function proxy(request: NextRequest) {
  if (!passwordRequired()) return NextResponse.next();
  if (await cookieAllowsAccess(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the password first." }, { status: 401 });
  }

  const login = new URL("/login", request.url);
  login.searchParams.set("next", safeNextPath(request.nextUrl.pathname));
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/generate", "/api/generate-paper"],
};
