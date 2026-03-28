"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import styles from "./CollapsibleBlockComponent.module.css";

/**
 * CollapsibleBlockComponent
 *
 * A disclosure widget with chevron toggle. Wraps any content
 * behind a clickable header with an icon, label, and optional badge.
 *
 * @param {object}  props
 * @param {React.ReactNode} props.icon             — Icon element for the header
 * @param {string}  props.label                    — Header text
 * @param {string}  [props.badge]                  — Optional badge text (e.g. count)
 * @param {boolean} [props.defaultCollapsed=false]  — Initial collapsed state
 * @param {string}  [props.className]              — Additional container class
 * @param {React.ReactNode} props.children         — Collapsible body content
 */
export default function CollapsibleBlockComponent({
  icon,
  label,
  badge,
  defaultCollapsed = false,
  className = "",
  children,
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={`${styles.container} ${className}`}>
      <button className={styles.header} onClick={() => setCollapsed((v) => !v)}>
        <span className={styles.chevron}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </span>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </button>
      {!collapsed && <div className={styles.body}>{children}</div>}
    </div>
  );
}
