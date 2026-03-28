"use client";

import { CircleCheck, Circle, Lock } from "lucide-react";
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
 * @param {boolean} [glowing=false] — Whether to show a cross-component glow effect
 * @param {Function} [onHover] — (hovering: boolean) => void
 * @param {boolean} [locked=false] — Whether the tool is locked on (always enabled, non-toggleable)
 */
export default function ToolCardComponent({
  icon,
  title,
  subtitle,
  color,
  count,
  enabled = true,
  onClick,
  glowing = false,
  onHover,
  locked = false,
}) {
  return (
    <div
      className={`${styles.card}${!enabled ? ` ${styles.cardDisabled}` : ""}${glowing ? ` ${styles.cardGlow}` : ""}${locked ? ` ${styles.cardLocked}` : ""}`}
      style={{ "--tool-color": color }}
      onClick={locked ? undefined : onClick}
      role={onClick && !locked ? "button" : undefined}
      tabIndex={onClick && !locked ? 0 : undefined}
      onKeyDown={
        onClick && !locked
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
    >
      <div className={styles.icon}>{icon}</div>
      <div className={styles.info}>
        <span className={styles.title}>
          {title}
          {count != null && <span className={styles.count}>{count}</span>}
        </span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
      {locked ? (
        <div className={styles.badgeLocked}>
          <Lock size={10} />
          Always On
        </div>
      ) : (
        <div
          className={`${styles.badge}${!enabled ? ` ${styles.badgeDisabled}` : ""}`}
        >
          {enabled ? <CircleCheck size={12} /> : <Circle size={12} />}
          {enabled ? "Enabled" : "Disabled"}
        </div>
      )}
    </div>
  );
}
