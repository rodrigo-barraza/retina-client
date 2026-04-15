"use client";

import TooltipComponent from "./TooltipComponent";
import styles from "./BenchmarkBarComponent.module.css";

/**
 * BenchmarkBarComponent — a pass/fail progress bar with tooltip.
 *
 * On hover, shows a tooltip with passed/total (percentage).
 *
 * Props:
 *   passed    — number of passed tests
 *   total     — total number of tests
 *   mini      — compact variant (sidebar-sized)
 *   label     — optional label text below the bar
 *   className — additional class
 */
export default function BenchmarkBarComponent({
  passed = 0,
  total = 0,
  mini = false,
  label,
  className = "",
}) {
  const passRate = total > 0 ? (passed / total) * 100 : 0;
  const hasRuns = total > 0;

  const tooltipLabel = hasRuns
    ? `${passed}/${total} (${Math.round(passRate)}%)`
    : "No runs";

  return (
    <TooltipComponent label={tooltipLabel} position="top">
      <div
        className={`${styles.wrapper} ${mini ? styles.mini : ""} ${className}`}
      >
        <div className={`${styles.bar} ${hasRuns ? styles.barHasRuns : ""}`}>
          <div
            className={styles.fill}
            style={{ width: `${passRate}%` }}
          />
        </div>
        {label && !mini && (
          <span className={styles.label}>{label}</span>
        )}
      </div>
    </TooltipComponent>
  );
}
