"use client";

import React from "react";
import { Wrench } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import { TOOL_ICON_MAP, TOOL_COLORS } from "./WorkflowNodeConstants";
import styles from "./ToolCallBadgeComponent.module.css";

// ═══════════════════════════════════════════════════════════════════════
// Canonical display names — maps raw tool function names to short labels.
// ═══════════════════════════════════════════════════════════════════════

const TOOL_CALL_DISPLAY_NAMES = {
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
  // Coordinator tools
  team_create: "Team",
  team_delete: "Team Stop",
  sleep: "Sleep",
  enter_plan_mode: "Plan",
  exit_plan_mode: "Execute",
  tool_search: "Tool Search",
  cron_create: "Schedule",
  remote_trigger: "Trigger",
  notebook_edit: "Notebook",
  // Skill tools
  skill_create: "Skill Create",
  skill_execute: "Skill Run",
  skill_list: "Skills",
  skill_delete: "Skill Delete",
  // Structured output
  synthetic_output: "Output",
  // Worktree isolation
  enter_worktree: "Isolate",
  exit_worktree: "Restore",
};

/**
 * Resolve a raw tool function name to a human-readable display label.
 */
function resolveDisplayName(name) {
  if (TOOL_CALL_DISPLAY_NAMES[name]) return TOOL_CALL_DISPLAY_NAMES[name];
  // Fallback: strip common prefixes and title-case
  return name
    .replace(/^(get_|mcp__\w+__)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolve a tool call name to its icon and color.
 */
function resolveToolVisuals(name) {
  if (TOOL_ICON_MAP[name]) {
    return { Icon: TOOL_ICON_MAP[name], color: TOOL_COLORS[name] || "#f59e0b" };
  }
  return {
    Icon: TOOL_ICON_MAP["Tool Calling"] || Wrench,
    color: TOOL_COLORS["Tool Calling"] || "#f97316",
  };
}

// ═══════════════════════════════════════════════════════════════════════
// ToolCallBadgeComponent — A single badge for an individual tool call.
// Distinguished from ToolBadgeComponent which represents the
// Tool Calling *capability*. This component renders badges for the
// actual function-level tool calls (read_file, write_file, etc.).
// ═══════════════════════════════════════════════════════════════════════

/**
 * ToolCallBadgeComponent — renders a badge for an individual tool call invocation.
 *
 * Props:
 *   name    — raw tool function name (e.g. "read_file", "grep_search")
 *   count   — invocation count (shown as ×N when > 1)
 *   active  — whether the tool is currently executing (pulses)
 *   size    — icon size in px (default 11)
 *   tooltip — optional tooltip override (defaults to raw name)
 */
export default function ToolCallBadgeComponent({
  name,
  count,
  active,
  size = 11,
  tooltip,
}) {
  const displayName = resolveDisplayName(name);
  const { Icon, color } = resolveToolVisuals(name);
  const tooltipLabel = tooltip || name;

  const badge = (
    <span
      className={`${styles.badge}${active ? ` ${styles.badgeActive}` : ""}`}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 20%, transparent)`,
        background: `color-mix(in srgb, ${color} 4%, var(--bg-tertiary))`,
      }}
    >
      <Icon size={size} />
      <span className={styles.label}>{displayName}</span>
      {count != null && count > 1 && (
        <span className={styles.count}>×{count}</span>
      )}
    </span>
  );

  // Only wrap in tooltip if there's useful extra info beyond what's visible
  if (tooltipLabel !== displayName) {
    return (
      <TooltipComponent label={tooltipLabel} position="top">
        {badge}
      </TooltipComponent>
    );
  }

  return badge;
}

/**
 * ToolCallBadgeRow — renders a row of individual tool call badges
 * from a { toolName: count } map.
 */
export function ToolCallBadgeRow({ tools, activeTool }) {
  if (!tools || Object.keys(tools).length === 0) return null;

  return (
    <div className={styles.badgeRow}>
      {Object.entries(tools)
        .sort(([, a], [, b]) => b - a)
        .map(([name, count]) => (
          <ToolCallBadgeComponent key={name} name={name} count={count} active={name === activeTool} />
        ))}
    </div>
  );
}
