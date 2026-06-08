"use client";

/**
 * FloatingIcons — full-viewport fixed decorative background layer.
 *
 * Mounted once in the marketing layout (same pattern as AuroraBackground)
 * so the icons bounce across the entire page, not just the hero.
 * Layer order: aurora (z-0) → floating icons (z-[2]) → page content.
 *
 * rAF bounce physics: each tile has position + velocity and bounces off
 * the viewport edges. GPU-friendly — only `transform` is animated,
 * `will-change: transform` on each element.
 *
 * Accessibility / perf:
 *  - prefers-reduced-motion → static scattered render, no rAF.
 *  - cancelAnimationFrame on unmount.
 *  - Pauses on document.hidden (visibilitychange) to save CPU.
 *  - Resize observer keeps bounds fresh without layout thrash.
 *
 * Visual design:
 *  - Each icon is a 44px square rounded-xl tile with translucent dark
 *    background + hairline border. Logo is object-contain + padded.
 *  - Tile opacity ~0.55 — subtle ambient decoration behind all sections.
 *  - pointer-events-none: never blocks clicks anywhere on the page.
 *  - Mobile-light: icons with mobile:false are hidden on xs screens.
 */

import { useEffect, useRef } from "react";

// Tile size (px) — all icons share the same square dimension.
const TILE = 44;

// Speed range (px per frame at 60fps). Gentle drift: ~0.4–0.8.
const SPEED_MIN = 0.4;
const SPEED_MAX = 0.8;

const ICONS: Array<{
  file: string;
  // Initial scatter position as % of container (used for static fallback too)
  top: number;
  left: number;
  mobile: boolean; // false = hidden on xs screens
}> = [
  { file: "mercadopago",     top:  8, left:  4,  mobile: true  },
  { file: "uala",            top: 15, left: 88,  mobile: true  },
  { file: "brubank",         top: 72, left:  7,  mobile: false },
  { file: "lemon",           top: 82, left: 92,  mobile: true  },
  { file: "naranja-x",       top: 35, left:  2,  mobile: false },
  { file: "modo",            top: 55, left: 95,  mobile: true  },
  { file: "cocos",           top: 90, left: 45,  mobile: false },
  { file: "banco-galicia",   top: 22, left: 78,  mobile: true  },
  { file: "banco-nacion",    top: 60, left: 18,  mobile: false },
  { file: "banco-bbva",      top:  5, left: 55,  mobile: false },
  { file: "banco-santander", top: 45, left: 90,  mobile: false },
  { file: "prex",            top: 78, left: 62,  mobile: true  },
  { file: "belo",            top: 28, left: 12,  mobile: false },
  { file: "buenbit",         top: 68, left: 80,  mobile: false },
  { file: "banco-provincia", top: 12, left: 32,  mobile: false },
  { file: "banco-ciudad",    top: 50, left: 50,  mobile: false },
];

function randomSpeed(): number {
  return SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
}

export function FloatingIcons() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tilesRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // Respect reduced-motion: render static, never start rAF.
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const container = containerRef.current;
    if (!container) return;

    // --- State per tile (position + velocity) ---
    let bounds = container.getBoundingClientRect();

    const states = ICONS.map((icon) => {
      // Clamp initial position inside bounds
      const x = Math.max(
        0,
        Math.min(
          (icon.left / 100) * bounds.width - TILE / 2,
          bounds.width - TILE
        )
      );
      const y = Math.max(
        0,
        Math.min(
          (icon.top / 100) * bounds.height - TILE / 2,
          bounds.height - TILE
        )
      );
      // Random direction, guaranteed non-zero on both axes
      const angle = Math.random() * Math.PI * 2;
      const speed = randomSpeed();
      return {
        x,
        y,
        vx: Math.cos(angle) * speed || speed, // avoid vx=0
        vy: Math.sin(angle) * speed || speed,
      };
    });

    // --- Animation loop ---
    const animate = () => {
      const w = bounds.width;
      const h = bounds.height;

      states.forEach((s, i) => {
        const el = tilesRef.current[i];
        if (!el) return;

        s.x += s.vx;
        s.y += s.vy;

        // Bounce off edges
        if (s.x <= 0) {
          s.x = 0;
          s.vx = Math.abs(s.vx);
        } else if (s.x >= w - TILE) {
          s.x = w - TILE;
          s.vx = -Math.abs(s.vx);
        }
        if (s.y <= 0) {
          s.y = 0;
          s.vy = Math.abs(s.vy);
        } else if (s.y >= h - TILE) {
          s.y = h - TILE;
          s.vy = -Math.abs(s.vy);
        }

        el.style.transform = `translate(${s.x}px, ${s.y}px)`;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    // Set initial transform before first frame to avoid flash
    states.forEach((s, i) => {
      const el = tilesRef.current[i];
      if (el) el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    });

    rafRef.current = requestAnimationFrame(animate);

    // --- Pause on hidden tab ---
    const handleVisibility = () => {
      if (document.hidden) {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        // Refresh bounds in case window was resized while hidden
        bounds = container.getBoundingClientRect();
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // --- Keep bounds fresh on resize ---
    const ro = new ResizeObserver(() => {
      bounds = container.getBoundingClientRect();
      // Clamp tiles that are now out of new bounds
      states.forEach((s) => {
        s.x = Math.min(s.x, bounds.width - TILE);
        s.y = Math.min(s.y, bounds.height - TILE);
      });
    });
    ro.observe(container);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
      style={{ filter: "blur(3px)", zIndex: 2 }}
    >
      {ICONS.map(({ file, top, left, mobile }, index) => (
        <div
          key={file}
          ref={(el) => {
            tilesRef.current[index] = el;
          }}
          className={[
            // Position: absolute at top-left; rAF drives transform.
            // Static fallback (reduced-motion): stays at percentage position.
            "absolute top-0 left-0",
            // Hide on mobile if not mobile-visible
            mobile ? "" : "hidden sm:block",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            // Static fallback position for reduced-motion users.
            // rAF will overwrite transform immediately on motion-ok.
            transform: `translate(${left}%, ${top}%)`,
            width: TILE,
            height: TILE,
            willChange: "transform",
            // Tile visual: translucent rounded square.
            // opacity is NOT set on the container — that would make the
            // border invisible. Instead, alpha is baked into the colors.
            borderRadius: "0.75rem", // rounded-xl
            overflow: "hidden",      // clips img to rounded corners
            background: "rgba(255, 255, 255, 0.10)",
            border: "1px solid rgba(255, 255, 255, 0.22)",
            opacity: 0.35,
            // Tile is behind hero content
            zIndex: 0,
          }}
        >
          {/* Logo centered with padding inside the tile */}
          <img
            src={`/icons/ar/bancos-billeteras/${file}.svg`}
            alt=""
            width={TILE - 14}
            height={TILE - 14}
            className="absolute inset-0 m-auto block object-contain"
            style={{
              width: TILE - 14,
              height: TILE - 14,
            }}
          />
        </div>
      ))}
    </div>
  );
}
