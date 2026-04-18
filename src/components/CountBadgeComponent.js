"use client";

import TooltipComponent from "./TooltipComponent";
import styles from "./CountBadgeComponent.module.css";

/**
 * CountBadgeComponent — numeric pill badge with state-driven coloring.
 *
 * States:
 *  - "default"  → pre-existing / already-read data (indigo)
 *  - "new"      → fresh data the user hasn't viewed yet (cyan pulse)
 *  - "disabled" → count is 0 (greyed out)
 *
 * @param {number|string} count    — the value to display
 * @param {"default"|"new"}  [state="default"] — visual state
 * @param {boolean} [disabled=false] — force disabled look (count = 0)
 * @param {boolean} [rainbow=false]  — rainbow hue-rotate (overrides state color)
 * @param {string}  [tooltip]        — optional tooltip label on hover
 * @param {string}  [className]      — additional class
 */
export default function CountBadgeComponent({
  count,
  state = "default",
  disabled = false,
  rainbow = false,
  tooltip,
  className,
}) {
  if (count == null) return null;

  const isDisabled = disabled || count === 0;

  const stateClass = rainbow
    ? styles.rainbow
    : isDisabled
      ? styles.stateDisabled
      : state === "new"
        ? styles.stateNew
        : styles.stateDefault;

  const badge = (
    <span
      className={`${styles.badge} ${stateClass}${className ? ` ${className}` : ""}`}
    >
      {count}
    </span>
  );

  if (tooltip) {
    return (
      <TooltipComponent label={tooltip} position="top">
        {badge}
      </TooltipComponent>
    );
  }

  return badge;
}
