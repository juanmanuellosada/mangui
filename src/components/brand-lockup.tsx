import Image from "next/image";
import { cn } from "@/lib/utils";

interface BrandLockupProps {
  /** Icon size in pixels (width and height). Defaults to 28. */
  size?: number;
  /** Whether to show the "mangui" wordmark next to the icon. Defaults to true. */
  showWord?: boolean;
  /**
   * Extra classes applied to the wordmark span.
   * Use e.g. "text-white" when the lockup sits on a fixed dark background
   * (overrides the default text-foreground token).
   */
  wordClassName?: string;
  className?: string;
}

/**
 * Brand lockup: original logo icon + "mangui" wordmark in iA Writer Quattro (bold, display weight).
 * Works on light and dark backgrounds via theme tokens.
 * The final "i" is accented in the brand orange (--color-accent).
 */
export function BrandLockup({ size = 28, showWord = true, wordClassName, className }: BrandLockupProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/logo-square.png"
        alt="mangui"
        width={size}
        height={size}
        className="rounded-[22%] flex-shrink-0"
        style={{ height: "auto" }}
      />
      {showWord && (
        <span
          className={cn("text-foreground leading-none select-none font-bold", wordClassName)}
          style={{
            fontFamily: "var(--font-display)",
            fontSize: size * 0.75,
            fontWeight: 700,
          }}
        >
          mangu<span className="text-accent">i</span>
        </span>
      )}
    </span>
  );
}
