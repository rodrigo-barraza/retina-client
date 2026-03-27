"use client";

import { CircleCheck, Circle } from "lucide-react";
import styles from "./ToolCardComponent.module.css";

/**
 * ToolCardComponent — A compact card showing a tool's icon, name, and description.
 * Used in the empty state to display which tools are actively enabled.
 *
 * @param {React.ReactNode} icon — Lucide icon element
 * @param {string} title — Tool name
 * @param {string} subtitle — Short description
 * @param {string} color — Accent color (hex or CSS var)
 * @param {number} [count] — Optional count badge (e.g. number of functions)
 * @param {boolean} [enabled=true] — Whether the tool is currently enabled
 * @param {Function} [onClick] — Click handler to toggle the tool
 */
export default function ToolCardComponent({
  icon,
  title,
  subtitle,
  color,
  count,
  enabled = true,
  onClick,
}) {
  return (
    <div
      className={`${styles.card}${!enabled ? ` ${styles.cardDisabled}` : ""}`}
      style={{ "--tool-color": color }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      <div className={styles.icon}>{icon}</div>
      <div className={styles.info}>
        <span className={styles.title}>
          {title}
          {count != null && (
            <span className={styles.count}>{count}</span>
          )}
        </span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      <div className={`${styles.badge}${!enabled ? ` ${styles.badgeDisabled}` : ""}`}>
        {enabled ? <CircleCheck size={12} /> : <Circle size={12} />}
        {enabled ? "Enabled" : "Disabled"}
      </div>
    </div>
  );
}
