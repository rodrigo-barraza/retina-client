"use client";

import { useEffect, useRef } from "react";

/**
 * PixelTransitionComponent — GPU-accelerated pixelation transition using
 * an SVG filter (feImage → feTile → feComposite → feMorphology). The same
 * sample-then-dilate technique used in the stickers project's PixelateFilter.
 *
 * Props:
 *   phase        — 'out' (sharp → pixelated), 'in' (pixelated → sharp), or null
 *   duration     — transition duration in ms (default 1000)
 *   maxBlockSize — maximum pixel block size at peak pixelation (default 24)
 *   onComplete   — callback fired when the transition finishes
 *   targetRef    — ref to the DOM element to apply the filter to
 */
export default function PixelTransitionComponent({
  phase = null,
  duration = 1000,
  maxBlockSize = 24,
  onComplete,
  targetRef,
}) {
  const rafRef = useRef(null);
  const filterRef = useRef(null);
  const startTimeRef = useRef(null);

  // Store latest props in refs so the rAF loop always sees current values
  const propsRef = useRef({ phase, duration, maxBlockSize, onComplete, targetRef });
  propsRef.current = { phase, duration, maxBlockSize, onComplete, targetRef };

  // Build the SVG filter elements for a given block size (imperative DOM manipulation)
  function updateFilter(blockSize) {
    const filter = filterRef.current;
    if (!filter) return;

    // Clear existing children
    while (filter.firstChild) filter.removeChild(filter.firstChild);

    if (blockSize <= 1) {
      // No pixelation — passthrough
      const merge = document.createElementNS("http://www.w3.org/2000/svg", "feMerge");
      const mergeNode = document.createElementNS("http://www.w3.org/2000/svg", "feMergeNode");
      mergeNode.setAttribute("in", "SourceGraphic");
      merge.appendChild(mergeNode);
      filter.appendChild(merge);
      return;
    }

    const center = Math.floor(blockSize / 2);
    const radius = Math.ceil((blockSize - 1) / 2);

    // Create the SVG pattern for sampling
    const patternSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${blockSize}" height="${blockSize}"><rect x="${center}" y="${center}" width="1" height="1" fill="black"/></svg>`;
    const encoded = btoa(patternSvg);
    const href = `data:image/svg+xml;base64,${encoded}`;

    // feImage — the tiling pattern source
    const feImage = document.createElementNS("http://www.w3.org/2000/svg", "feImage");
    feImage.setAttribute("href", href);
    feImage.setAttribute("result", "patternSource");
    feImage.setAttribute("x", "0");
    feImage.setAttribute("y", "0");
    feImage.setAttribute("width", String(blockSize));
    feImage.setAttribute("height", String(blockSize));
    filter.appendChild(feImage);

    // feTile — tile the pattern across the element
    const feTile = document.createElementNS("http://www.w3.org/2000/svg", "feTile");
    feTile.setAttribute("in", "patternSource");
    feTile.setAttribute("result", "patternTile");
    filter.appendChild(feTile);

    // feComposite — sample the source at pattern points
    const feComposite = document.createElementNS("http://www.w3.org/2000/svg", "feComposite");
    feComposite.setAttribute("in", "SourceGraphic");
    feComposite.setAttribute("in2", "patternTile");
    feComposite.setAttribute("operator", "in");
    feComposite.setAttribute("result", "sampledPixels");
    filter.appendChild(feComposite);

    // feMorphology — dilate the sampled pixels to fill blocks
    const feMorph = document.createElementNS("http://www.w3.org/2000/svg", "feMorphology");
    feMorph.setAttribute("in", "sampledPixels");
    feMorph.setAttribute("operator", "dilate");
    feMorph.setAttribute("radius", String(radius));
    feMorph.setAttribute("result", "pixelated");
    filter.appendChild(feMorph);
  }

  // Easing: ease-in-out cubic
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // rAF tick — defined as a plain function, stored in a ref for self-scheduling
  const tickRef = useRef(null);
  tickRef.current = (timestamp) => {
    if (!startTimeRef.current) startTimeRef.current = timestamp;

    const p = propsRef.current;
    const elapsed = timestamp - startTimeRef.current;
    const rawProgress = Math.min(elapsed / p.duration, 1);
    const progress = ease(rawProgress);

    let blockSize;
    if (p.phase === "out") {
      blockSize = Math.round(1 + (p.maxBlockSize - 1) * progress);
    } else if (p.phase === "in") {
      blockSize = Math.round(p.maxBlockSize - (p.maxBlockSize - 1) * progress);
    } else {
      return;
    }

    updateFilter(blockSize);

    if (rawProgress < 1) {
      rafRef.current = requestAnimationFrame(tickRef.current);
    } else {
      // Animation complete — remove inline filter
      const el = p.targetRef?.current;
      if (el) el.style.filter = "";
      p.onComplete?.();
    }
  };

  useEffect(() => {
    if (!phase) {
      // Clear any active animation
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (targetRef?.current) {
        targetRef.current.style.filter = "";
      }
      return;
    }

    // Apply filter to target element
    if (targetRef?.current) {
      targetRef.current.style.filter = "url(#pixel-transition)";
    }

    startTimeRef.current = null;
    rafRef.current = requestAnimationFrame(tickRef.current);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Initialize the filter as a passthrough on mount
  useEffect(() => {
    updateFilter(1);
  }, []);

  return (
    <svg
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <defs>
        <filter
          id="pixel-transition"
          ref={filterRef}
          x="0"
          y="0"
          width="100%"
          height="100%"
          colorInterpolationFilters="sRGB"
        >
          {/* Populated dynamically via updateFilter() */}
          <feMerge>
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  );
}
