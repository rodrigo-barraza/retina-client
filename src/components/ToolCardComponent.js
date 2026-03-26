"use client";

import styles from "./ToolCardComponent.module.css";

/**
 * ToolCardComponent — A compact card showing a tool's icon, name, and description.
 * Used in the empty state to display which tools are actively enabled.
 *
 * @param {React.ReactNode} icon — Lucide icon element
 * @param {string} title — Tool name
 * @param {string} subtitle — Short description
 * @param {string} color — Accent color (hex or CSS var)
 */
export default function ToolCardComponent({ icon, title, subtitle, color }) {
  return (
    <div
      className={styles.card}
      style={{ "--tool-color": color }}
    >
      <div className={styles.icon}>{icon}</div>
      <div className={styles.info}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
    </div>
  );
}
