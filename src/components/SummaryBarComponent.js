"use client";

import styles from "./SummaryBarComponent.module.css";
import costBadgeStyles from "./CostBadgeComponent.module.css";

/**
 * SummaryBarComponent — A horizontal stats strip with stacked value/label pairs.
 *
 * Each item can be a simple value/label pair, or include an icon, color, or
 * a progress bar visualization.
 *
 * @param {Array<SummaryItem>} items — Stat items to display
 * @param {boolean} [live=false]     — Accent-bordered "live" variant (during active runs)
 * @param {string}  [className]      — Additional class on the wrapper
 *
 * @typedef {object} SummaryItem
 * @property {string|number} value    — Display value
 * @property {string}        [label]  — Label text below the value
 * @property {string}        [color]  — CSS color for the value
 * @property {React.ReactNode} [icon] — Optional icon element before the value
 * @property {number}        [bar]    — If set, renders a progress bar (0–100)
 */
export default function SummaryBarComponent({ items, live = false, className }) {
  if (!items || items.length === 0) return null;

  const wrapperClass = [
    styles.bar,
    live ? styles.live : "",
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      {items.map((item, i) => (
        <div key={i} className={styles.entry}>
          {i > 0 && <div className={styles.divider} />}
          <div className={styles.item}>
            {item.bar != null ? (
              <div className={styles.progressWrapper}>
                <div className={`${styles.passBar} ${item.bar != null ? styles.passBarHasRuns : ''}`}>
                  <div
                    className={styles.passBarFill}
                    style={{ width: `${Math.min(item.bar, 100)}%` }}
                  />
                </div>
                {item.label && (
                  <span className={styles.label}>{item.label}</span>
                )}
              </div>
            ) : (
              <>
                <div className={`${costBadgeStyles.badge} ${styles.valueRow}`}>
                  {item.icon && <span className={styles.icon}>{item.icon}</span>}
                  <span
                    className={styles.value}
                    style={item.color ? { color: item.color } : undefined}
                  >
                    {item.value}
                  </span>
                </div>
                {item.label && (
                  <span className={styles.label}>{item.label}</span>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
