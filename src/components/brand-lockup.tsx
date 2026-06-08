import Image from "next/image";
import { cn } from "@/lib/utils";

// logo.png intrinsic size: 655x240 (aspect ratio ≈ 2.729)
const LOGO_INTRINSIC_W = 655;
const LOGO_INTRINSIC_H = 240;

// logo-mark.png intrinsic size: 256x256 (square after trim)
const MARK_INTRINSIC_W = 256;
const MARK_INTRINSIC_H = 256;

interface BrandLockupProps {
  /**
   * Rendered height of the wordmark image in pixels. Defaults to 28.
   * Width is computed automatically to preserve the image's aspect ratio.
   */
  size?: number;
  /** Kept for API compatibility — no longer used (wordmark colour is baked in). */
  showWord?: boolean;
  /** Kept for API compatibility — applied to the wrapper span if provided. */
  wordClassName?: string;
  className?: string;
}

/**
 * Brand lockup: [mango mascot] [mangui wordmark] side by side.
 * Designed for dark backgrounds only.
 *
 * Proportions: mascot height = size × 1.25 (optically balanced — the mascot's
 * orange mass reads heavier than the slim wordmark, so slightly taller keeps
 * visual weight even). Gap = size × 0.35 (~10 px at size=28).
 */
export function BrandLockup({ size = 28, showWord: _showWord, wordClassName, className }: BrandLockupProps) {
  const wordmarkW = Math.round(size * (LOGO_INTRINSIC_W / LOGO_INTRINSIC_H));
  const markH = Math.round(size * 1.25);
  const markW = Math.round(markH * (MARK_INTRINSIC_W / MARK_INTRINSIC_H));
  const gap = Math.round(size * 0.35);
  return (
    <span className={cn("inline-flex items-center", wordClassName, className)} style={{ gap }}>
      <Image
        src="/logo-mark.png"
        alt=""
        aria-hidden
        width={MARK_INTRINSIC_W}
        height={MARK_INTRINSIC_H}
        style={{ height: markH, width: markW, flexShrink: 0 }}
        priority
      />
      <Image
        src="/logo.png"
        alt="mangui"
        width={LOGO_INTRINSIC_W}
        height={LOGO_INTRINSIC_H}
        style={{ height: size, width: wordmarkW, flexShrink: 0 }}
        priority
      />
    </span>
  );
}
