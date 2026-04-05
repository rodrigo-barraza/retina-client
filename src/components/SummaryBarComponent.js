"use client";

import styles from "./SummaryBarComponent.module.css";

/**
 * SummaryBarComponent — A horizontal stats bar with labeled values separated by dividers.
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
 * @property {string}        [label]  — Label text below/beside the value
 * @property {string}        [color]  — CSS color for the value
 * @property {React.ReactNode} [icon] — Optional icon element before the value
 * @property {number}        [bar]    — If set, renders a mini progress bar (0–100)
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
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            {item.bar != null ? (
              <>
                <div className={styles.passBar}>
                  <div
                    className={styles.passBarFill}
                    style={{ width: `${Math.min(item.bar, 100)}%` }}
                  />
                </div>
                {item.label && (
                  <span className={styles.label}>{item.label}</span>
                )}
              </>
            ) : (
              <>
                <span
                  className={styles.value}
                  style={item.color ? { color: item.color } : undefined}
                >
                  {item.value}
                </span>
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
