"use client";

import { useEffect, useRef } from "react";

/**
 * AnimatedFaviconComponent — Renders the 8-bit dithered rainbow animation
 * (matching the sidebar header RainbowCanvas) into a tiny offscreen canvas,
 * converts each frame to a Base64 data URL, and cycles it as the favicon.
 *
 * Uses the same RAINBOW palette + dithered pixel grid as NavigationSidebarComponent.
 */

const FAVICON_SIZE = 32;
const PIXEL_SIZE = 4; // pixelated block size inside 32×32
const FRAME_COUNT = 16;
const FRAME_INTERVAL = 180; // ms between frames

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

function rainbowAt(t) {
  const scaled = (((t % 1) + 1) % 1) * RAINBOW.length;
  const i = Math.floor(scaled);
  const f = scaled - i;
  return lerpColor(
    RAINBOW[i % RAINBOW.length],
    RAINBOW[(i + 1) % RAINBOW.length],
    f,
  );
}

/**
 * Pre-render all frames as Base64 PNG data URLs so the animation
 * never hits the server — everything stays in memory.
 */
function generateFrames() {
  const canvas = document.createElement("canvas");
  canvas.width = FAVICON_SIZE;
  canvas.height = FAVICON_SIZE;
  const ctx = canvas.getContext("2d", { alpha: false });
  const cols = Math.ceil(FAVICON_SIZE / PIXEL_SIZE);
  const rows = Math.ceil(FAVICON_SIZE / PIXEL_SIZE);
  const frames = [];

  for (let frame = 0; frame < FRAME_COUNT; frame++) {
    const offset = frame / FRAME_COUNT;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = (x / cols + y / rows) * 0.5 + offset;
        const dither = ((x * 7 + y * 13) % 5) / 40;
        const [r, g, b] = rainbowAt(t + dither);
        ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    frames.push(canvas.toDataURL("image/png"));
  }

  return frames;
}

function changeFavicon(src) {
  let link = document.getElementById("dynamic-favicon");
  if (!link) {
    link = document.createElement("link");
    link.id = "dynamic-favicon";
    link.rel = "icon";
    link.type = "image/png";
    document.head.appendChild(link);
  }
  link.href = src;

  // Remove any static favicon <link> so browsers don't show a stale .ico
  const oldLinks = document.querySelectorAll(
    'link[rel="icon"]:not(#dynamic-favicon), link[rel="shortcut icon"]:not(#dynamic-favicon)',
  );
  oldLinks.forEach((el) => el.remove());
}

export default function AnimatedFaviconComponent() {
  const framesRef = useRef(null);
  const indexRef = useRef(0);

  useEffect(() => {
    // Generate all Base64 frames once on mount
    framesRef.current = generateFrames();

    const interval = setInterval(() => {
      if (!framesRef.current) return;
      changeFavicon(framesRef.current[indexRef.current]);
      indexRef.current = (indexRef.current + 1) % FRAME_COUNT;
    }, FRAME_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return null; // Purely side-effect component — no DOM output
}
