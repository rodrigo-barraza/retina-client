"use client";

import { useRef, useCallback, useState } from "react";
import styles from "./SliderComponent.module.css";

/**
 * SliderComponent — Premium custom slider with gradient fill, glow knob,
 * and smooth GPU-accelerated interactions.
 *
 * Props:
 *  value      : number
 *  min        : number   (default 0)
 *  max        : number   (default 1)
 *  step       : number   (default 0.1)
 *  onChange   : (value: number) => void
 *  disabled?  : boolean
 *  compact?   : boolean  — smaller track + knob for inline contexts
 *  showTicks? : boolean  — show subtle min/max tick marks
 */
export default function SliderComponent({
  value,
  min = 0,
  max = 1,
  step = 0.1,
  onChange,
  disabled = false,
  compact = false,
  showTicks = false,
}) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Calculate percentage for fill & knob position
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;

  const clampAndSnap = useCallback(
    (clientX) => {
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(
        0,
        Math.min(1, (clientX - rect.left) / rect.width),
      );
      let raw = min + ratio * (max - min);
      // Snap to step
      raw = Math.round(raw / step) * step;
      // Clamp
      raw = Math.max(min, Math.min(max, raw));
      // Fix floating point
      const decimals = (step.toString().split(".")[1] || "").length;
      return parseFloat(raw.toFixed(decimals));
    },
    [min, max, step],
  );

  const handlePointerDown = (e) => {
    if (disabled) return;
    e.preventDefault();
    trackRef.current.setPointerCapture(e.pointerId);
    setDragging(true);
    onChange(clampAndSnap(e.clientX));
  };

  const handlePointerMove = (e) => {
    if (disabled) return;
    if (!trackRef.current.hasPointerCapture(e.pointerId)) return;
    onChange(clampAndSnap(e.clientX));
  };

  const handlePointerUp = (e) => {
    if (trackRef.current.hasPointerCapture(e.pointerId)) {
      trackRef.current.releasePointerCapture(e.pointerId);
    }
    setDragging(false);
  };

  const rootCls = [
    styles.slider,
    disabled && styles.disabled,
    compact && styles.compact,
    dragging && styles.dragging,
    hovered && styles.hovered,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={rootCls}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        ref={trackRef}
        className={styles.track}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Filled gradient portion */}
        <div className={styles.fill} style={{ width: `${pct}%` }} />

        {/* Knob */}
        <div className={styles.knobWrap} style={{ left: `${pct}%` }}>
          <div className={styles.knob} />
          {/* Active glow ring on drag */}
          {dragging && <div className={styles.knobGlow} />}
        </div>
      </div>

      {/* Optional tick marks */}
      {showTicks && (
        <div className={styles.ticks}>
          <span className={styles.tick}>{min}</span>
          <span className={styles.tick}>{max}</span>
        </div>
      )}
    </div>
  );
}
