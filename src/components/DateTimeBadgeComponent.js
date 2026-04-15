"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { DateTime } from "luxon";
import TooltipComponent from "./TooltipComponent";
import styles from "./DateTimeBadgeComponent.module.css";

/**
 * DateTimeBadgeComponent — a compact datetime pill badge.
 *
 * Renders a relative or short-form timestamp; on hover,
 * a TooltipComponent shows the full date and time.
 *
 * Props:
 *   date       — ISO string, Date, or epoch ms
 *   mini       — smaller variant
 *   showIcon   — show Calendar icon (default: true)
 *   relative   — show relative time (default: true for recent, absolute otherwise)
 *   className  — additional class
 */
export default function DateTimeBadgeComponent({
  date,
  mini = false,
  showIcon = true,
  relative = true,
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

  const shortLabel = useMemo(() => {
    if (!dt || !dt.isValid) return "";
    const now = DateTime.now();
    const diff = now.diff(dt, ["days", "hours", "minutes", "seconds"]);
    const totalSeconds = diff.as("seconds");

    // Relative for recent timestamps
    if (relative && totalSeconds >= 0 && totalSeconds < 86400) {
      if (totalSeconds < 5) return "just now";
      if (totalSeconds < 60) return `${Math.floor(totalSeconds)}s ago`;
      const mins = Math.floor(totalSeconds / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      return `${hrs}h ago`;
    }

    // Relative for slightly older
    if (relative && totalSeconds >= 0) {
      const days = Math.floor(totalSeconds / 86400);
      if (days === 1) return "yesterday";
      if (days < 7) return `${days}d ago`;
    }

    // Absolute short form
    if (dt.year === now.year) {
      return dt.toFormat("MMM d, h:mm a");
    }
    return dt.toFormat("MMM d, yyyy");
  }, [dt, relative]);

  if (!dt || !dt.isValid) return null;

  return (
    <TooltipComponent label={fullDateTime} position="top">
      <span
        className={`${styles.badge} ${mini ? styles.mini : ""} ${className}`}
      >
        {showIcon && <Calendar size={mini ? 8 : 10} />}
        {shortLabel}
      </span>
    </TooltipComponent>
  );
}
