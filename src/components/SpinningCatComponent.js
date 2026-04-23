"use client";

import { useRef, useEffect, useState } from "react";
import { parseGIF, decompressFrames } from "gifuct-js";
import styles from "./SpinningCatComponent.module.css";

/**
 * SpinningCatComponent — Shows cat.gif (static) by default.
 * During generation, switches to a canvas-rendered cat-spinning.gif
 * with quadratic speed acceleration (starts at ~20% speed, ramps up).
 * When generation stops, the cat smoothly decelerates before swapping
 * back to the static image.
 *
 * GIF frames are pre-decoded into ImageBitmap textures at mount time,
 * enabling GPU-composited drawImage calls during playback instead of
 * per-frame putImageData CPU blits.
 *
 * Props:
 *   animate  – whether the cat is spinning (default false)
 *   className – optional extra class
 */

const BASE_SPEED = 0.2; // Start at 20% of original GIF speed
const ACCEL_COEFFICIENT = 0.08; // Quadratic ramp: speedMultiplier = BASE_SPEED + ACCEL × t²
const DECEL_SMOOTHING = 0.03; // Exponential decay back to base when stopping
const SETTLED_THRESHOLD = 0.01; // Speed delta below which we consider fully stopped
const MAX_SPEED_FOR_FX = 5; // Speed at which scale/glow effects reach full intensity
const MAX_SCALE = 1.5; // Maximum scale multiplier
const MAX_BRIGHTNESS = 3.0; // Maximum CSS brightness value
const MAX_GLOW_RADIUS = 12; // Maximum glow drop-shadow blur radius (px)
const MAX_GLOW_OPACITY = 0.9; // Maximum glow drop-shadow opacity

/**
 * Render a single pre-decoded ImageBitmap frame onto the canvas.
 * GPU-composited — no pixel data manipulation at draw time.
 */
function renderFrame(canvas, frames, bitmaps, index) {
  if (!canvas || !bitmaps?.length) return;

  const ctx = canvas.getContext("2d");
  const frame = frames[index];
  const bitmap = bitmaps[index];
  if (!frame || !bitmap) return;

  if (frame.disposalType === 2) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  ctx.drawImage(bitmap, frame.dims.left, frame.dims.top);
}

export default function SpinningCatComponent({
  animate = false,
  className = "",
}) {
  const canvasRef = useRef(null);
  const framesRef = useRef(null); // Raw frame metadata (dims, delay, disposalType)
  const bitmapsRef = useRef(null); // Pre-decoded ImageBitmap textures
  const rafRef = useRef(null);
  // visuallyActive stays true during the wind-down deceleration
  const [visuallyActive, setVisuallyActive] = useState(false);
  const stateRef = useRef({
    frameIndex: 0,
    elapsed: 0,
    accelTime: 0,
    speedMultiplier: BASE_SPEED,
    lastTimestamp: 0,
    windingDown: false,
  });
  const animateRef = useRef(animate);

  useEffect(() => {
    animateRef.current = animate;
    if (animate) {
      setVisuallyActive(true);
      stateRef.current.windingDown = false;
    } else if (
      stateRef.current.speedMultiplier >
      BASE_SPEED + SETTLED_THRESHOLD
    ) {
      // Start wind-down — keep canvas visible
      stateRef.current.windingDown = true;
    }
  }, [animate]);

  // ── Decode the spinning GIF into ImageBitmap textures on mount ──
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/cat-spinning.gif");
        const buffer = await res.arrayBuffer();
        const gif = parseGIF(buffer);
        const frames = decompressFrames(gif, true);
        if (cancelled) return;

        // Pre-decode every frame into a GPU-ready ImageBitmap
        const bitmaps = await Promise.all(
          frames.map((frame) => {
            const imageData = new ImageData(
              new Uint8ClampedArray(frame.patch),
              frame.dims.width,
              frame.dims.height,
            );
            return createImageBitmap(imageData);
          }),
        );
        if (cancelled) {
          bitmaps.forEach((b) => b.close());
          return;
        }

        framesRef.current = frames;
        bitmapsRef.current = bitmaps;

        const canvas = canvasRef.current;
        if (canvas && frames.length > 0) {
          canvas.width = frames[0].dims.width;
          canvas.height = frames[0].dims.height;
          renderFrame(canvas, frames, bitmaps, 0);
        }
      } catch (err) {
        console.error("SpinningCatComponent: failed to decode GIF", err);
      }
    })();

    return () => {
      cancelled = true;
      // Release ImageBitmap GPU resources on unmount
      bitmapsRef.current?.forEach((b) => b.close());
      bitmapsRef.current = null;
    };
  }, []);

  // ── Main animation loop (always running, speed-controlled) ───
  const tickRef = useRef(null);

  useEffect(() => {
    const loop = (now) => {
      const frames = framesRef.current;
      const bitmaps = bitmapsRef.current;
      if (!frames?.length || !bitmaps?.length) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const s = stateRef.current;
      if (!s.lastTimestamp) s.lastTimestamp = now;
      const dt = now - s.lastTimestamp;
      s.lastTimestamp = now;

      if (animateRef.current) {
        s.accelTime += dt / 1000;
        s.speedMultiplier =
          BASE_SPEED + ACCEL_COEFFICIENT * s.accelTime * s.accelTime;
      } else if (s.speedMultiplier > BASE_SPEED + SETTLED_THRESHOLD) {
        s.accelTime = 0;
        const smoothing = 1 - Math.pow(1 - DECEL_SMOOTHING, dt / 16.67);
        s.speedMultiplier += (BASE_SPEED - s.speedMultiplier) * smoothing;
      } else if (s.windingDown) {
        s.speedMultiplier = BASE_SPEED;
        s.accelTime = 0;
        s.windingDown = false;
        setVisuallyActive(false);
        // Reset inline FX styles
        const wrapper = canvasRef.current?.parentElement;
        if (wrapper) {
          wrapper.style.transform = "translate(-50%, -50%)";
          wrapper.style.filter = "";
        }
      }

      const frame = frames[s.frameIndex];
      const baseDelay = frame?.delay || 100;
      const effectiveDelay = baseDelay / s.speedMultiplier;

      s.elapsed += dt;

      if (s.elapsed >= effectiveDelay) {
        s.elapsed = 0;
        s.frameIndex = (s.frameIndex + 1) % frames.length;

        if (s.frameIndex === 0) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        renderFrame(canvasRef.current, frames, bitmaps, s.frameIndex);
      }

      // ── Compute visual FX intensity (0 → 1) ──
      if (
        animateRef.current ||
        s.windingDown ||
        s.speedMultiplier > BASE_SPEED + SETTLED_THRESHOLD
      ) {
        const intensity = Math.min(
          (s.speedMultiplier - BASE_SPEED) / (MAX_SPEED_FOR_FX - BASE_SPEED),
          1,
        );
        const scale = 1 + intensity * (MAX_SCALE - 1);
        const brightness = 1 + intensity * (MAX_BRIGHTNESS - 1);
        const glowRadius = intensity * MAX_GLOW_RADIUS;
        const glowOpacity = intensity * MAX_GLOW_OPACITY;

        const wrapper = canvasRef.current?.parentElement;
        if (wrapper) {
          wrapper.style.transform = `translate(-50%, -50%) scale(${scale})`;
          wrapper.style.filter = `brightness(${brightness}) drop-shadow(0 0 ${glowRadius}px rgba(255,255,255,${glowOpacity}))`;
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    tickRef.current = loop;
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className={`${styles.wrapper} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cat.gif"
        alt="Cat"
        className={`${styles.staticCat} ${visuallyActive ? styles.hidden : ""}`}
      />
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${visuallyActive ? "" : styles.hidden}`}
      />
    </div>
  );
}
