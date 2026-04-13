"use client";

import { useRef, useEffect, useState } from "react";
import styles from "./CycleButton.module.css";

/** Duration of the count-up tween in ms. */
const TWEEN_MS = 500;

/** Ease-out cubic — fast start, gentle landing. */
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * CycleButton — a compact clickable pill that cycles through a set of values.
 * Features a counting animation (number tween) when the value changes,
 * inspired by CostBadgeComponent's rolling numbers.
 *
 * When transitioning to Infinity, the counter rolls up to 999 then flips to ∞.
 *
 *  value       : current value (number | Infinity)
 *  isActive    : boolean — whether to show the highlighted/active state
 *  onClick     : () => void — called on click to advance to next value
 *  title       : optional tooltip string
 */
export default function CycleButton({
  value,
  isActive = false,
  onClick,
  title,
}) {
  const prevValueRef = useRef(value);
  const rafRef = useRef(null);
  const [displayNum, setDisplayNum] = useState(() =>
    Number.isFinite(value) ? value : 999,
  );
  const [showInfinity, setShowInfinity] = useState(
    () => !Number.isFinite(value),
  );
  const [tweening, setTweening] = useState(false);

  useEffect(() => {
    const from = prevValueRef.current;
    prevValueRef.current = value;

    // Same value — no animation
    if (from === value) return;

    // Cancel any in-flight animation
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const isToInfinity = !Number.isFinite(value);
    const isFromInfinity = !Number.isFinite(from);

    // ── Transition TO Infinity: count from current → 999, then flip to ∞
    if (isToInfinity) {
      const startNum = isFromInfinity ? 0 : from;
      const targetNum = 999;
      setShowInfinity(false);
      setTweening(true);

      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / TWEEN_MS, 1);
        const eased = easeOutCubic(progress);
        setDisplayNum(Math.round(startNum + (targetNum - startNum) * eased));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Reached 999 — flip to ∞
          setShowInfinity(true);
          setTweening(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setTweening(false);
      };
    }

    // ── Transition FROM Infinity: snap ∞ off, count from 999 → target
    if (isFromInfinity) {
      setShowInfinity(false);
      setTweening(true);
      setDisplayNum(999);

      const start = performance.now();
      function tick(now) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / TWEEN_MS, 1);
        const eased = easeOutCubic(progress);
        setDisplayNum(Math.round(999 + (value - 999) * eased));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplayNum(value);
          setTweening(false);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        setTweening(false);
      };
    }

    // ── Normal number → number transition
    setShowInfinity(false);
    setTweening(true);
    const start = performance.now();
    const delta = value - from;

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / TWEEN_MS, 1);
      const eased = easeOutCubic(progress);
      setDisplayNum(Math.round(from + delta * eased));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplayNum(value);
        setTweening(false);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setTweening(false);
    };
  }, [value]);

  const label = showInfinity ? "∞" : String(displayNum);

  return (
    <button
      type="button"
      className={`${styles.cycleButton} ${isActive ? styles.cycleButtonActive : ""} ${tweening ? styles.tweening : ""} ${showInfinity ? styles.infinity : ""}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );
}
