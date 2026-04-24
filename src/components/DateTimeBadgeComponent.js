"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Calendar } from "lucide-react";
import { DateTime } from "luxon";
import TooltipComponent from "./TooltipComponent";
import styles from "./DateTimeBadgeComponent.module.css";

/**
 * Computes the short relative/absolute label and the optimal
 * refresh interval (adaptive tick rate) for the next update.
 *
 * Returns { label: string, intervalMs: number }
 */
function computeLabel(dt, relative) {
  if (!dt || !dt.isValid) return { label: "", intervalMs: 0, isJustNow: false };

  const now = DateTime.now();
  const diff = now.diff(dt, ["days", "hours", "minutes", "seconds"]);
  const totalSeconds = diff.as("seconds");

  // Relative for recent timestamps (< 24h)
  // Also treat small negative values (clock skew — server slightly ahead) as "just now"
  if (relative && totalSeconds > -10 && totalSeconds < 86400) {
    if (totalSeconds < 5) return { label: "just now", intervalMs: 1_000, isJustNow: true };
    if (totalSeconds < 60)
      return {
        label: `${Math.floor(totalSeconds)}s ago`,
        intervalMs: 1_000,
        isJustNow: false,
      };
    const mins = Math.floor(totalSeconds / 60);
    if (mins < 60)
      return { label: `${mins}m ago`, intervalMs: 60_000, isJustNow: false };
    const hrs = Math.floor(mins / 60);
    return { label: `${hrs}h ago`, intervalMs: 3_600_000, isJustNow: false };
  }

  // Relative for slightly older (days)
  if (relative && totalSeconds >= 0) {
    const days = Math.floor(totalSeconds / 86400);
    if (days === 1) return { label: "yesterday", intervalMs: 3_600_000, isJustNow: false };
    if (days < 7) return { label: `${days}d ago`, intervalMs: 3_600_000, isJustNow: false };
  }

  // Absolute short form — no live refresh needed
  if (dt.year === now.year) {
    return { label: dt.toFormat("MMM d, h:mm a"), intervalMs: 0, isJustNow: false };
  }
  return { label: dt.toFormat("MMM d, yyyy"), intervalMs: 0, isJustNow: false };
}

/**
 * DateTimeBadgeComponent — a compact datetime pill badge with
 * adaptive live-refresh (adaptive tick rate).
 *
 * Refreshes every 1 s when < 60 s old, every 1 min when < 60 min,
 * every 1 h when < 24 h, then stops refreshing for older dates.
 *
 * Props:
 *   date       — ISO string, Date, or epoch ms
 *   mini       — smaller variant
 *   showIcon   — show Calendar icon (default: true)
 *   relative   — show relative time (default: true for recent, absolute otherwise)
 *   highlightNew — pulse glow when "just now", fade out on transition
 *   className  — additional class
 */
export default function DateTimeBadgeComponent({
  date,
  mini = false,
  showIcon = true,
  relative = true,
  highlightNew = false,
  className = "",
}) {
  const dt = useMemo(() => {
    if (!date) return null;
    if (date instanceof Date) return DateTime.fromJSDate(date);
    if (typeof date === "number") return DateTime.fromMillis(date);
    return DateTime.fromISO(date);
  }, [date]);

  const fullDateTime = useMemo(() => {
    if (!dt || !dt.isValid) return "";
    return dt.toFormat("EEEE, MMMM d, yyyy 'at' h:mm:ss a");
  }, [dt]);

  // --- Adaptive tick rate ---
  // A monotonic counter that forces re-computation of the label.
  // The effect only bumps this counter — no synchronous setState in the body.
  const [tick, setTick] = useState(0);

  const { label: shortLabel, intervalMs, isJustNow } = useMemo(
    () => computeLabel(dt, relative),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dt, relative, tick],
  );

  // Track "just now" → stale transition for fade-out
  const prevJustNowRef = useRef(isJustNow);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Was "just now", now it's not → trigger fade-out
    if (prevJustNowRef.current && !isJustNow && highlightNew) {
      setFading(true);
      const timer = setTimeout(() => setFading(false), 1000);
      return () => clearTimeout(timer);
    }
    prevJustNowRef.current = isJustNow;
  }, [isJustNow, highlightNew]);

  // Keep ref in sync for non-transition renders
  useEffect(() => {
    prevJustNowRef.current = isJustNow;
  }, [isJustNow]);

  useEffect(() => {
    if (!dt || !dt.isValid || !intervalMs) return;

    let timerId;

    const schedule = () => {
      const { intervalMs: nextMs } = computeLabel(dt, relative);
      if (!nextMs) return;
      timerId = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, nextMs);
    };

    schedule();

    return () => clearTimeout(timerId);
  }, [dt, relative, intervalMs]);

  if (!dt || !dt.isValid) return null;

  const highlightClass = highlightNew && isJustNow
    ? styles.justNow
    : fading
      ? styles.justNowFadeOut
      : "";

  return (
    <TooltipComponent label={fullDateTime} position="top">
      <span
        className={`${styles.badge} ${mini ? styles.mini : ""} ${highlightClass} ${className}`}
      >
        {showIcon && <Calendar size={mini ? 8 : 10} />}
        {shortLabel}
      </span>
    </TooltipComponent>
  );
}
