"use client";

import { useRef, useEffect, useCallback } from "react";

/** 8-bit dithered rainbow — auto-animates, turbo during LLM generation */
const PIXEL_SIZE = 6;
const BASE_SPEED = 30; // degrees/sec
const TURBO_ACCEL = 20; // quadratic coefficient — velocity = TURBO_ACCEL × t²
const TURBO_RELEASE = 0.02; // per-frame smoothing toward zero (at 60fps ≈ 3s wind-down)
const RAINBOW = [
  [255, 0, 0],
  [255, 127, 0],
  [255, 255, 0],
  [0, 200, 80],
  [0, 120, 255],
  [100, 0, 255],
  [255, 0, 150],
];

function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function paletteAt(colors, t) {
  const scaled = (((t % 1) + 1) % 1) * colors.length;
  const i = Math.floor(scaled);
  const f = scaled - i;
  return lerpColor(
    colors[i % colors.length],
    colors[(i + 1) % colors.length],
    f,
  );
}

export default function RainbowCanvasComponent({ turbo = false, animate = false, greyscale = false, palette, className, style }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    offset: 0,
    turboVelocity: 0,
    turboTime: 0,
    lastTime: 0,
  });
  const turboRef = useRef(turbo);
  const animateRef = useRef(animate);
  const paletteRef = useRef(palette || null);
  const rafRef = useRef(null);

  useEffect(() => {
    turboRef.current = turbo;
  }, [turbo]);

  useEffect(() => {
    animateRef.current = animate;
  }, [animate]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    const { width, height } = canvas;
    const cols = Math.ceil(width / PIXEL_SIZE);
    const rows = Math.ceil(height / PIXEL_SIZE);
    const s = stateRef.current;
    const colors = paletteRef.current || RAINBOW;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = (x / cols + y / rows) * 0.5 + s.offset / 360;
        const dither = ((x * 7 + y * 13) % 5) / 40;
        const [r, g, b] = paletteAt(colors, t + dither);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }
  }, []);

  // Sync palette ref and redraw static canvases on palette change
  useEffect(() => {
    paletteRef.current = palette || null;
    if (!rafRef.current) draw();
  }, [palette, draw]);

  // Start/stop animation loop based on turbo or animate prop
  useEffect(() => {
    const shouldRun = turbo || animate;
    if (!shouldRun && !rafRef.current) return;

    if (shouldRun && !rafRef.current) {
      stateRef.current.lastTime = 0;
      const tick = (now) => {
        const s = stateRef.current;
        if (!s.lastTime) s.lastTime = now;
        const dt = (now - s.lastTime) / 1000;
        s.lastTime = now;

        if (turboRef.current) {
          s.turboTime += dt;
          s.turboVelocity = TURBO_ACCEL * s.turboTime * s.turboTime;
        } else if (s.turboVelocity > 0.5) {
          s.turboTime = 0;
          const smoothing = 1 - Math.pow(1 - TURBO_RELEASE, dt * 60);
          s.turboVelocity += (0 - s.turboVelocity) * smoothing;
        } else if (animateRef.current) {
          // Idle animation — constant slow speed, no turbo deceleration
          s.turboVelocity = 0;
          s.turboTime = 0;
        } else {
          s.turboVelocity = 0;
          s.turboTime = 0;
          draw();
          rafRef.current = null;
          return;
        }

        const speed = BASE_SPEED + s.turboVelocity;
        s.offset = (s.offset + speed * dt) % 360;
        draw();
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [turbo, animate, draw]);

  // Resize handling + initial static draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      draw();
    };

    resize();
    window.addEventListener("resize", resize);

    let ro;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(resize);
      ro.observe(parent);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      window.removeEventListener("resize", resize);
      ro?.disconnect();
    };
  }, [draw]);

  const canvasStyle = {
    ...style,
    filter: greyscale ? "grayscale(1)" : "none",
    transition: "filter 0.6s ease",
    willChange: "filter",
  };

  return <canvas ref={canvasRef} className={className} style={canvasStyle} />;
}
