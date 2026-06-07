import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const rawNext = searchParams.get("next") ?? "/inicio";

  // Sanitize `next` — must be a relative path, not a protocol-relative or absolute URL.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/inicio";

  // Build the base origin, respecting Vercel's reverse-proxy headers.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = forwardedHost
    ? `${proto}://${forwardedHost}`
    : request.nextUrl.origin;

  // OAuth provider returned an error (e.g. user denied consent).
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      return NextResponse.redirect(`${origin}/login?error=oauth`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No code, no error — shouldn't happen in normal flow.
  return NextResponse.redirect(`${origin}/login`);
}
