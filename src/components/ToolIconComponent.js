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
 *   toolDisplayNames      — string[] of canonical tool names (e.g. "Web Search", "Thinking")
 *   toolApiNames  — string[] of raw tool function names (e.g. "get_web_content", "generate_image")
 *   size           — icon size in px (default 12)
 *   className      — extra root class name
 */
export default function ToolIconComponent({
  toolDisplayNames,
  toolApiNames,
  size = 12,
  className,
}) {
  if (!toolDisplayNames || toolDisplayNames.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  // Collect raw names that don't map to known canonical icons → shown in FC tooltip
  const functionCallRawNames = [];
  for (const raw of toolDisplayNames) {
    if (!TOOL_ICON_MAP[raw]) {
      functionCallRawNames.push(raw);
    }
  }

  // If toolApiNames provided, use those for the Function Calling tooltip
  // (they're the actual function names like get_web_content, generate_image)
  const fcRawDisplay = toolApiNames?.length
    ? toolApiNames
    : functionCallRawNames;

  // De-duplicate and resolve unknown tools → "Function Calling"
  const resolved = new Map();
  for (const raw of toolDisplayNames) {
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
      {[...resolved.entries()].map(([label, Icon]) => {
        // Build rich tooltip for "Function Calling" showing actual tool names
        const tooltipLabel =
          label === "Function Calling" && fcRawDisplay.length > 0
            ? `Function Calling: ${fcRawDisplay.join(", ")}`
            : label;

        return (
          <TooltipComponent key={label} label={tooltipLabel} position="top">
            <span className={styles.toolPill}>
              <Icon
                size={size}
                style={{ color: TOOL_COLORS[label] || "#f97316" }}
              />
            </span>
          </TooltipComponent>
        );
      })}
    </span>
  );
}
