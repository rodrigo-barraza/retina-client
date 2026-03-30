"use client";

import styles from "./ProportionBarComponent.module.css";

/**
 * ProportionBarComponent — a proportional bar with percentage label.
 * Used for usage share, cost share, or any value-vs-total visualization.
 *
 * Props:
 *   value    — the item's count/value
 *   total    — the total to compute percentage against
 *   color    — fill color (defaults to accent)
 */
export default function ProportionBarComponent({ value = 0, total = 1, color }) {
  const pct = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className={styles.container}>
      <div className={styles.track}>
        <div
          className={styles.fill}
          style={{
            width: `${pct}%`,
            ...(color ? { background: color } : {}),
          }}
        />
      </div>
      <span className={styles.label}>{pct.toFixed(1)}%</span>
    </div>
  );
}
