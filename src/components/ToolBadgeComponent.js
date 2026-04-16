"use client";

import React from "react";
import { Wrench } from "lucide-react";
import { TOOL_ICON_MAP, TOOL_COLORS } from "./WorkflowNodeConstants";
import styles from "./ToolBadgeComponent.module.css";

/**
 * Map raw tool function names (snake_case) to human-friendly display names.
 */
const TOOL_DISPLAY_NAMES = {
  read_file: "Read",
  write_file: "Write",
  str_replace: "Replace",
  grep_search: "Grep",
  glob_files: "Glob",
  list_directory: "List Dir",
  web_search: "Web Search",
  fetch_url: "Fetch",
  execute_shell: "Shell",
  execute_python: "Python",
  execute_javascript: "JS",
  git_status: "Git Status",
  git_diff: "Git Diff",
  git_log: "Git Log",
  delete_file: "Delete",
  move_file: "Move",
  browser_action: "Browser",
  project_summary: "Summary",
  generate_image: "Image Gen",
};

/**
 * Resolve the icon and color for a raw tool name.
 */
function resolveToolVisuals(rawName) {
  if (TOOL_ICON_MAP[rawName]) {
    return { Icon: TOOL_ICON_MAP[rawName], color: TOOL_COLORS[rawName] || "#f59e0b" };
  }
  return {
    Icon: TOOL_ICON_MAP["Function Calling"] || Wrench,
    color: TOOL_COLORS["Function Calling"] || "#f97316",
  };
}

/**
 * Compact tool badge showing icon + short name.
 * Styled like SettingsPanel's statBadge, for inline use.
 *
 * @param {object} props
 * @param {string} props.name - Raw tool function name (e.g. "read_file")
 * @param {number} [props.count] - Optional usage count
 */
export default function ToolBadgeComponent({ name, count, active }) {
  const displayName = TOOL_DISPLAY_NAMES[name]
    || name.replace(/^(get_|mcp__\w+__)/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const { Icon, color } = resolveToolVisuals(name);

  return (
    <span className={`${styles.badge}${active ? ` ${styles.badgeActive}` : ""}`} title={name}>
      <Icon size={10} style={{ color }} />
      <span>{displayName}</span>
      {count != null && count > 1 && (
        <span className={styles.count}>×{count}</span>
      )}
    </span>
  );
}

/**
 * Row of tool badges from a Map/Object of toolName → count.
 *
 * @param {object} props
 * @param {Object<string, number>} props.tools - { toolName: count }
 */
export function ToolBadgeRow({ tools, activeTool }) {
  if (!tools || Object.keys(tools).length === 0) return null;

  return (
    <div className={styles.badgeRow}>
      {Object.entries(tools)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => (
          <ToolBadgeComponent key={name} name={name} count={count} active={name === activeTool} />
        ))}
    </div>
  );
}
