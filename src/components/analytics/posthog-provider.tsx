"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

/** useSearchParams requires a Suspense boundary in the App Router. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = `${window.origin}${pathname}`;
    const search = searchParams.toString();
    if (search) url += `?${search}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

/**
 * Inicializa PostHog (product analytics) solo si NEXT_PUBLIC_POSTHOG_KEY
 * está definida. Sin la key, es un no-op total — igual que Sentry sin DSN.
 * Envolvé la app entera con este provider (no requiere estar autenticado).
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || initialized) return;
    initialized = true;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false, // pageviews se capturan manualmente en cambios de ruta
      person_profiles: "identified_only",
    });
  }, []);

  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
