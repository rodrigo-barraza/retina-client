"use client";

import styles from "./CycleButton.module.css";

/**
 * CycleButton — a compact clickable pill that cycles through a set of values.
 *
 *  value       : current value (string | number)
 *  displayValue: optional formatted display string (defaults to String(value))
 *  isActive    : boolean — whether to show the highlighted/active state
 *  onClick     : () => void — called on click to advance to next value
 *  title       : optional tooltip string
 */
export default function CycleButton({
  value,
  displayValue,
  isActive = false,
  onClick,
  title,
}) {
  const label = displayValue ?? (Number.isFinite(value) ? String(value) : "∞");

  return (
    <button
      type="button"
      className={`${styles.cycleButton} ${isActive ? styles.cycleButtonActive : ""}`}
      onClick={onClick}
      title={title}
    >
      {label}
    </button>
  );
}
