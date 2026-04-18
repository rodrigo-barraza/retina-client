"use client";

import { FunctionSquare } from "lucide-react";
import styles from "./ToolCountBadgeComponent.module.css";

/**
 * ToolCountBadgeComponent — Compact badge displaying the number of tools
 * available to a given agent. Designed to sit below the AgentPickerComponent
 * trigger, mirroring how ModelPickerPopoverComponent stacks
 * triggerCapabilities under its trigger button.
 *
 * @param {number} count   - Number of tools the agent supports
 * @param {string} [color] - Optional accent color (defaults to --text-tertiary)
 */
export default function ToolCountBadgeComponent({ count, color }) {
  if (count == null || count === 0) return null;

  return (
    <div
      className={styles.badge}
      style={color ? { "--tool-badge-accent": color } : undefined}
    >
      <FunctionSquare size={9} className={styles.icon} />
      <span className={styles.label}>
        {count} {count !== 1 ? "Tools" : "Tool"}
      </span>
    </div>
  );
}
