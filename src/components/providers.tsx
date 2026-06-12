"use client";

import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useState, useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { OfflineBanner } from "@/components/offline-banner";
import { OfflineSyncManager } from "@/components/offline-sync-manager";

// 24 hours in ms — previously fetched data survives offline for a day
const MAX_AGE = 1000 * 60 * 60 * 24

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 60s; stale for 5 min
        staleTime: 60 * 1000,
        // Don't throw on mount when offline — serve from cache
        networkMode: "offlineFirst",
      },
    },
  })
}

// Lazily build the persister only on the client (guard for SSR)
function makePersister() {
  if (typeof window === "undefined") return undefined
  return createSyncStoragePersister({
    storage: window.localStorage,
    key: "mangui-query-cache",
  })
}

export function Providers({ children }: { children: React.ReactNode }) {
  // useState so each request gets its own QueryClient (avoids cross-request state sharing in SSR)
  const [queryClient] = useState(makeQueryClient)
  const [persister] = useState(makePersister)

  useEffect(() => {
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null
      if (event === "SIGNED_OUT") {
        try { localStorage.removeItem("mangui-last-uid") } catch {}
        queryClient.clear()
        try { localStorage.removeItem("mangui-query-cache") } catch {}
        return
      }
      if (uid) {
        let prev: string | null = null
        try { prev = localStorage.getItem("mangui-last-uid") } catch {}
        if (prev && prev !== uid) {
          // a DIFFERENT user signed in on this browser → purge the previous user's cached data
          queryClient.clear()
          try { localStorage.removeItem("mangui-query-cache") } catch {}
        }
        try { localStorage.setItem("mangui-last-uid", uid) } catch {}
      }
    })
    return () => subscription.unsubscribe()
  }, [queryClient])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange={false}
    >
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={
          persister
            ? {
                persister,
                maxAge: MAX_AGE,
                // Only persist queries that succeeded (status === 'success')
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) =>
                    query.state.status === "success",
                },
              }
            : { persister: { persistClient: async () => {}, restoreClient: async () => undefined, removeClient: async () => {} }, maxAge: MAX_AGE }
        }
      >
        {children}
        <Toaster richColors position="top-right" />
        <ServiceWorkerRegister />
        <OfflineBanner />
        <OfflineSyncManager />
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}
