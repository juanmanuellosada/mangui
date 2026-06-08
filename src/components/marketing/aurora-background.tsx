"use client";

/**
 * AuroraBackground — Canvas 2D aurora for the landing hero.
 *
 * Five slowly-drifting radial-gradient blobs in lime #84CC16 and orange
 * #F97316 over a dark base #1A1F1A. Ported from demos/hero-bg/option-b-aurora.html.
 *
 * Perf / a11y:
 *  - devicePixelRatio-aware (capped at 2×) for Retina crispness.
 *  - ResizeObserver keeps canvas size fresh without layout shift.
 *  - prefers-reduced-motion → single static frame, no animation loop.
 *  - Pauses rAF when tab is hidden (document.hidden) and on unmount.
 *  - pointer-events-none, z-0 — never blocks content interaction.
 */

import { useEffect, useRef } from "react";

// Blob definitions — each drifts independently via sine/cosine offsets.
const BLOBS = [
  /* lime — large, left-center */
  {
    baseX: 0.18, baseY: 0.45,
    r: 0.42,
    color: [132, 204, 22] as [number, number, number],
    alpha: 0.22,
    speedX: 0.00018, speedY: 0.00013,
    phaseX: 0, phaseY: 1.2,
    ampX: 0.12, ampY: 0.10,
  },
  /* orange — medium, right-upper */
  {
    baseX: 0.78, baseY: 0.30,
    r: 0.32,
    color: [249, 115, 22] as [number, number, number],
    alpha: 0.18,
    speedX: 0.00014, speedY: 0.00020,
    phaseX: 2.5, phaseY: 0.8,
    ampX: 0.10, ampY: 0.13,
  },
  /* lime — small, right-bottom accent */
  {
    baseX: 0.85, baseY: 0.72,
    r: 0.22,
    color: [132, 204, 22] as [number, number, number],
    alpha: 0.13,
    speedX: 0.00022, speedY: 0.00016,
    phaseX: 4.1, phaseY: 3.0,
    ampX: 0.08, ampY: 0.08,
  },
  /* orange — small, left-upper accent */
  {
    baseX: 0.08, baseY: 0.18,
    r: 0.20,
    color: [249, 115, 22] as [number, number, number],
    alpha: 0.10,
    speedX: 0.00010, speedY: 0.00024,
    phaseX: 5.5, phaseY: 1.7,
    ampX: 0.07, ampY: 0.09,
  },
  /* lime — large, center-bottom */
  {
    baseX: 0.50, baseY: 0.85,
    r: 0.35,
    color: [132, 204, 22] as [number, number, number],
    alpha: 0.12,
    speedX: 0.00012, speedY: 0.00009,
    phaseX: 1.0, phaseY: 4.2,
    ampX: 0.14, ampY: 0.07,
  },
] as const;

function drawFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number
) {
  // Dark base fill
  ctx.fillStyle = "#1A1F1A";
  ctx.fillRect(0, 0, w, h);

  for (const b of BLOBS) {
    const cx = (b.baseX + Math.sin(t * b.speedX + b.phaseX) * b.ampX) * w;
    const cy = (b.baseY + Math.cos(t * b.speedY + b.phaseY) * b.ampY) * h;
    const radius = b.r * Math.max(w, h);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    const [r, g, bv] = b.color;
    grad.addColorStop(0, `rgba(${r},${g},${bv},${b.alpha})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${bv},${b.alpha * 0.55})`);
    grad.addColorStop(1, `rgba(${r},${g},${bv},0)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Size the canvas to fill its container at device pixel ratio.
    function resize() {
      if (!canvas) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * DPR;
      canvas.height = h * DPR;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    if (reduceMotion) {
      // Single static frame — no loop
      drawFrame(ctx, canvas.offsetWidth, canvas.offsetHeight, 4000);
      return;
    }

    let rafId: number | null = null;

    function tick(t: number) {
      if (!canvas) return;
      ctx!.setTransform(DPR, 0, 0, DPR, 0, 0);
      drawFrame(ctx!, canvas.offsetWidth, canvas.offsetHeight, t);
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    // Pause when tab is hidden
    function handleVisibility() {
      if (document.hidden) {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else {
        if (rafId === null) {
          rafId = requestAnimationFrame(tick);
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    // Keep canvas size fresh
    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(canvas);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", handleVisibility);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
