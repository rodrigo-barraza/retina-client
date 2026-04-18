"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  ChevronDown,
  Plus,
  Brain,
  Code,
  Search,
  Globe,
  FileText,
  Terminal,
  GitBranch,
  Dog,
  Image,
  CloudSun,
  TrendingUp,
} from "lucide-react";
import CloseButtonComponent from "./CloseButtonComponent";
import AgentBadgeComponent from "./AgentBadgeComponent";
import styles from "./AgentPickerPopoverComponent.module.css";

/**
 * Available agent personas for benchmarking.
 * Each agent maps to a registered AgentPersonaRegistry entry on the server.
 */
const AVAILABLE_AGENTS = [
  {
    id: "CODING",
    name: "Coding Agent",
    description: "File system, git, command execution, and web tools",
    icon: Code,
    tools: [
      { name: "File Ops", icon: FileText },
      { name: "Search", icon: Search },
      { name: "Terminal", icon: Terminal },
      { name: "Git", icon: GitBranch },
      { name: "Web", icon: Globe },
      { name: "Compute", icon: Brain },
    ],
  },
  {
    id: "LUPOS",
    name: "Lupos",
    description: "Image generation, web search, trends, media, and weather",
    icon: Dog,
    tools: [
      { name: "Image Gen", icon: Image },
      { name: "Web Search", icon: Search },
      { name: "Trends", icon: TrendingUp },
      { name: "Weather", icon: CloudSun },
      { name: "Media", icon: Globe },
      { name: "Compute", icon: Brain },
    ],
  },
];

/**
 * AgentPickerPopoverComponent — trigger pill + dropdown for selecting
 * agent personas to include in benchmark runs.
 *
 * Styled identically to ModelPickerPopoverComponent's trigger pill.
 *
 * Props:
 *   agentCount      — number of agent instances currently selected
 *   onAddAgent      — (agentDef) => void — called when user clicks an agent to add
 */
export default function AgentPickerPopoverComponent({
  agentCount = 0,
  onAddAgent,
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState({});
  const triggerRef = useRef(null);

  // Position the popover below the trigger
  const positionPopover = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverW = 320;
    let left = rect.left + rect.width / 2 - popoverW / 2;

    // Clamp to viewport
    if (left < 16) left = 16;
    if (left + popoverW > window.innerWidth - 16) {
      left = window.innerWidth - 16 - popoverW;
    }

    setPopoverStyle({
      top: rect.bottom + 8,
      left,
      width: popoverW,
    });
  }, []);

  const openPopover = useCallback(() => {
    positionPopover();
    setOpen(true);
  }, [positionPopover]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        !e.target.closest("[data-agent-picker-popover]") &&
        !e.target.closest("[data-agent-picker-trigger]")
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!open) return;
    const reposition = () => positionPopover();
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, { capture: true });
    };
  }, [open, positionPopover]);

  const handleAdd = useCallback((agentDef) => {
    onAddAgent?.(agentDef);
  }, [onAddAgent]);

  // Build display label
  const displayLabel = agentCount === 0
    ? "Add Agent"
    : agentCount === 1
      ? "1 Agent"
      : `${agentCount} Agents`;

  return (
    <>
      {/* ── Trigger pill ─────────────────────────────────────── */}
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${agentCount > 0 ? styles.triggerActive : ""}`}
        onClick={open ? () => setOpen(false) : openPopover}
        data-agent-picker-trigger
        title="Add agent to benchmark"
      >
        <span className={styles.triggerContent}>
          <Bot size={14} className={styles.triggerIcon} />
          <span className={styles.triggerLabel}>
            {displayLabel}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {/* ── Popover portal ───────────────────────────────────── */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.popover}
            style={popoverStyle}
            data-agent-picker-popover
          >
            <div className={styles.popoverHeader}>
              <Bot size={14} className={styles.headerIcon} />
              <span className={styles.headerTitle}>Agents</span>
              <CloseButtonComponent onClick={() => setOpen(false)} size={14} />
            </div>

            <div className={styles.popoverBody}>
              {AVAILABLE_AGENTS.map((agent) => {
                return (
                  <button
                    key={agent.id}
                    className={styles.agentRow}
                    onClick={() => handleAdd(agent)}
                  >
                    <div className={styles.agentRowLeft}>
                      <AgentBadgeComponent agent={agent} size={32} iconSize={16} />
                      <div className={styles.agentInfo}>
                        <span className={styles.agentName}>{agent.name}</span>
                        <span className={styles.agentDesc}>{agent.description}</span>
                      </div>
                    </div>
                    <div className={styles.agentRowRight}>
                      <div className={styles.toolIcons}>
                        {agent.tools.slice(0, 4).map((tool) => {
                          const ToolIcon = tool.icon;
                          return (
                            <span
                              key={tool.name}
                              className={styles.toolIcon}
                              title={tool.name}
                            >
                              <ToolIcon size={10} />
                            </span>
                          );
                        })}
                        {agent.tools.length > 4 && (
                          <span className={styles.toolMore}>
                            +{agent.tools.length - 4}
                          </span>
                        )}
                      </div>
                      <span className={styles.addBtn}>
                        <Plus size={12} />
                        Add
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
