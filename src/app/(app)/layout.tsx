import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppSidebar } from "@/components/app-sidebar";
import { AppBottomNav } from "@/components/app-bottom-nav";

/**
 * Protected app shell layout.
 * Middleware (src/proxy.ts) ensures only authenticated users reach here,
 * but we do a server-side check as defense-in-depth and to get user data.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Usuario";
  const email = user.email ?? "";
  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar — active state handled client-side via usePathname */}
      <AppSidebar name={name} email={email} avatarUrl={avatarUrl} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen lg:pl-64">
        <main className="flex-1 p-4 md:p-6 pb-24 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <AppBottomNav />
    </div>
  );
}
