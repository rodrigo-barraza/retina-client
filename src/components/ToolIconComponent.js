"use client";

import { Wrench } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import { TOOL_ICON_MAP, TOOL_COLORS } from "./WorkflowNodeConstants";
import styles from "./ToolIconComponent.module.css";

/**
 * ToolIconComponent — renders a row of compact tool-icon pills from an
 * array of tool name strings.  Unknown names are grouped under the
 * canonical "Function Calling" icon.
 *
 * Props:
 *   toolNames  — string[] of canonical tool names (e.g. "Web Search", "Thinking")
 *   size       — icon size in px (default 12)
 *   className  — extra root class name
 */
export default function ToolIconComponent({
  toolNames,
  size = 12,
  className,
}) {
  if (!toolNames || toolNames.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  // De-duplicate and resolve unknown tools → "Function Calling"
  const resolved = new Map();
  for (const raw of toolNames) {
    if (TOOL_ICON_MAP[raw]) {
      if (!resolved.has(raw)) resolved.set(raw, TOOL_ICON_MAP[raw]);
    } else {
      const fallbackIcon = TOOL_ICON_MAP["Function Calling"] || Wrench;
      if (!resolved.has("Function Calling")) {
        resolved.set("Function Calling", fallbackIcon);
      }
    }
  }

  return (
    <span className={`${styles.toolPills} ${className || ""}`}>
      {[...resolved.entries()].map(([label, Icon]) => (
        <TooltipComponent key={label} label={label} position="top">
          <span className={styles.toolPill}>
            <Icon
              size={size}
              style={{ color: TOOL_COLORS[label] || "#f97316" }}
            />
          </span>
        </TooltipComponent>
      ))}
    </span>
  );
}
