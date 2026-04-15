"use client";

import { useState, useEffect } from "react";
import { Timer } from "lucide-react";
import { formatElapsedTime } from "../utils/utilities";
import styles from "./StopwatchComponent.module.css";

/**
 * StopwatchComponent — displays an elapsed duration badge.
 *
 * Can operate in two modes:
 *   1. Static: pass `seconds` for a fixed duration display.
 *   2. Live: pass `startTime` (ISO or epoch ms) for a ticking timer.
 *
 * Props:
 *   seconds    — elapsed time in seconds (static mode)
 *   startTime  — ISO string or epoch ms to start ticking from (live mode)
 *   live       — force the live pulsing style (e.g. external ticker)
 *   showIcon   — show Timer icon (default: true)
 *   className  — additional class
 */
export default function StopwatchComponent({
  seconds,
  startTime,
  live: externalLive,
  showIcon = true,
  className = "",
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isLive = !!startTime && seconds == null;

  useEffect(() => {
    if (!isLive) return;
    const immediate = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearTimeout(immediate); clearInterval(id); };
  }, [isLive, startTime]);

  let displaySeconds;
  if (isLive) {
    const start = typeof startTime === "number"
      ? startTime
      : new Date(startTime).getTime();
    displaySeconds = Math.max(0, (nowMs - start) / 1000);
  } else {
    displaySeconds = seconds || 0;
  }

  if (displaySeconds <= 0 && !isLive) return null;

  const showPulse = isLive || externalLive;

  return (
    <span
      className={`${styles.badge} ${showPulse ? styles.live : ""} ${className}`}
    >
      {showIcon && <Timer size={11} />}
      {formatElapsedTime(displaySeconds)}
    </span>
  );
}
