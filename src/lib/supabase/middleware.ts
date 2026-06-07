import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Refreshes the Supabase session on every request and enforces route protection.
 *
 * Public routes: /, /login, /register, /forgot-password, /reset-password, /offline
 * /api/* is also bypassed — each API route handles its own auth (e.g. cron and AI routes
 * are called without a user session).
 * Everything else requires authentication → redirect to /login.
 *
 * NOTE: Must be called from src/proxy.ts — not a standalone middleware.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — IMPORTANT: do not add logic between createServerClient
  // and getUser(), as per @supabase/ssr docs to avoid session desync.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Demo session: sign out when returning to the public landing/legal pages so the
  // visitor is not still logged in as demo. Uses user_metadata from the JWT — no DB query.
  const DEMO_PUBLIC_PATHS = ["/", "/privacidad", "/terminos"];
  if (
    user?.user_metadata?.is_demo === true &&
    DEMO_PUBLIC_PATHS.some((p) => pathname === p)
  ) {
    await supabase.auth.signOut();
    return supabaseResponse; // respond as anonymous visitor
  }

  // Safety net: if a ?code= lands on a non-/auth path (Supabase fell back to the Site URL),
  // redirect to /auth/callback so the code is properly exchanged before the user continues.
  const strayCode = request.nextUrl.searchParams.get("code");
  if (strayCode && !pathname.startsWith("/auth")) {
    const sensibleNext =
      pathname.startsWith("/") && !pathname.startsWith("//") && pathname !== "/"
        ? pathname
        : "/inicio";
    const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);
    callbackUrl.searchParams.set("code", strayCode);
    callbackUrl.searchParams.set("next", sensibleNext);
    return NextResponse.redirect(callbackUrl);
  }

  // Public paths — accessible without authentication
  const PUBLIC_EXACT = ["/"];
  const PUBLIC_PREFIX = ["/api", "/auth", "/login", "/register", "/forgot-password", "/reset-password", "/offline", "/privacidad", "/terminos", "/demo"];
  const isPublic =
    PUBLIC_EXACT.includes(pathname) ||
    PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"));

  // Protect all non-public routes
  if (!isPublic && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === "/login" || pathname === "/register")) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/inicio";
    return NextResponse.redirect(dashboardUrl);
  }

  return supabaseResponse;
}
