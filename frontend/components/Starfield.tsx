"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  z: number;
  r: number;
  tw: number;
  speed: number;
};

/**
 * Interactive particle field inspired by Fireflies' dark hero sky.
 * Original FireMe implementation — mouse parallax + gentle drift.
 */
export function Starfield({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let stars: Star[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const parent = canvas.parentElement;
      w = parent?.clientWidth || window.innerWidth;
      h = parent?.clientHeight || window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(160, Math.floor((w * h) / 9000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random(),
        r: 0.4 + Math.random() * 1.6,
        tw: Math.random() * Math.PI * 2,
        speed: 0.08 + Math.random() * 0.25,
      }));
    };

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      // Track over the whole hero (text overlays sit above the canvas).
      mouse.current.tx = (e.clientX - rect.left) / Math.max(rect.width, 1);
      mouse.current.ty = (e.clientY - rect.top) / Math.max(rect.height, 1);
    };

    const tick = () => {
      mouse.current.x += (mouse.current.tx - mouse.current.x) * 0.06;
      mouse.current.y += (mouse.current.ty - mouse.current.y) * 0.06;
      const mx = (mouse.current.x - 0.5) * 28;
      const my = (mouse.current.y - 0.5) * 18;

      ctx.clearRect(0, 0, w, h);
      // soft vignette glow
      const glow = ctx.createRadialGradient(
        w * 0.5 + mx * 0.3,
        h * 0.15 + my * 0.2,
        20,
        w * 0.5,
        h * 0.35,
        Math.max(w, h) * 0.7,
      );
      glow.addColorStop(0, "rgba(90, 70, 180, 0.18)");
      glow.addColorStop(0.45, "rgba(40, 28, 90, 0.08)");
      glow.addColorStop(1, "rgba(7, 5, 26, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        if (!reduced) {
          s.tw += 0.02 + s.speed * 0.04;
          s.y += s.speed * (0.35 + s.z);
          if (s.y > h + 4) {
            s.y = -4;
            s.x = Math.random() * w;
          }
        }
        const parallax = 0.35 + s.z * 1.2;
        const x = s.x + mx * parallax;
        const y = s.y + my * parallax * 0.7;
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.tw)) * (0.4 + s.z);
        ctx.beginPath();
        ctx.fillStyle = `rgba(230, 220, 255, ${alpha})`;
        ctx.arc(x, y, s.r * (0.7 + s.z), 0, Math.PI * 2);
        ctx.fill();
      }

      // cursor-near sparkle ring
      const cx = mouse.current.x * w;
      const cy = mouse.current.y * h;
      const ring = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
      ring.addColorStop(0, "rgba(180, 150, 255, 0.12)");
      ring.addColorStop(1, "rgba(180, 150, 255, 0)");
      ctx.fillStyle = ring;
      ctx.fillRect(cx - 90, cy - 90, 180, 180);

      raf = requestAnimationFrame(tick);
    };

    resize();
    const host = canvas.parentElement || window;
    window.addEventListener("resize", resize);
    host.addEventListener("pointermove", onMove as EventListener);
    if (!reduced) raf = requestAnimationFrame(tick);
    else tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      host.removeEventListener("pointermove", onMove as EventListener);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fm-starfield ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
