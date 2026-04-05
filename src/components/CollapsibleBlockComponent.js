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
 * @param {boolean} [props.open]                   — Controlled open state (overrides internal)
 * @param {Function} [props.onToggle]              — Callback when toggled (for controlled mode)
 * @param {React.ReactNode} [props.headerActions]  — Extra elements in the header (right side)
 * @param {string}  [props.className]              — Additional container class
 * @param {React.ReactNode} props.children         — Collapsible body content
 */
export default function CollapsibleBlockComponent({
  icon,
  label,
  badge,
  defaultCollapsed = false,
  open: controlledOpen,
  onToggle,
  headerActions,
  className = "",
  children,
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);

  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : !internalCollapsed;

  const handleToggle = () => {
    if (isControlled) {
      onToggle?.(!controlledOpen);
    } else {
      setInternalCollapsed((v) => !v);
    }
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <button className={styles.header} onClick={handleToggle}>
        <span className={styles.chevron}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.label}>{label}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
        {headerActions && (
          <div
            className={styles.actions}
            onClick={(e) => e.stopPropagation()}
          >
            {headerActions}
          </div>
        )}
      </button>
      {isOpen && <div className={styles.body}>{children}</div>}
    </div>
  );
}
