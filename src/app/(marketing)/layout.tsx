import { AuroraBackground } from "@/components/marketing/aurora-background";
import { FloatingIcons } from "@/components/marketing/floating-icons";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /*
     * dark class: activates all dark-theme CSS variable overrides (--background,
     * --foreground, --card, etc.) so every section that uses theme tokens
     * automatically renders in dark mode without touching the rest of the app.
     *
     * bg-[#1A1F1A]: sets the base page fill that shows beneath the fixed aurora
     * canvas (before the canvas paints, on very slow devices, or in reduced-motion).
     */
    <div className="dark bg-[#1A1F1A] min-h-[100dvh]">
      {/* Fixed background layers (back to front): aurora → floating icons → content */}
      <AuroraBackground />
      <FloatingIcons />
      {children}
    </div>
  );
}
