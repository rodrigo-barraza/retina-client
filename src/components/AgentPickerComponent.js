"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, ChevronDown, Wrench, Check, Skull, Sticker, Apple, Lightbulb, Hammer } from "lucide-react";
import { resolveIconComponent } from "./CustomAgentsPanel";
import ToolCountBadgeComponent from "./ToolCountBadgeComponent";
import styles from "./AgentPickerComponent.module.css";

/**
 * Icon mapping per agent ID — built-in agents only.
 * Custom agents use the `icon` field stored in their data.
 */
const AGENT_ICONS = {
  CODING: Bot,
  LUPOS: Skull,
  STICKERS: Sticker,
  DIGEST: Apple,
  LIGHTS: Lightbulb,
  OOG: Hammer,
};

/** Render the correct icon for an agent — custom icon field takes priority. */
export function renderAgentIcon(agent, size = 15) {
  // Custom agents store an icon name string
  if (agent?.icon) {
    const Resolved = resolveIconComponent(agent.icon);
    return <Resolved size={size} />;
  }
  // Built-in agents use the hardcoded map
  const BuiltIn = AGENT_ICONS[agent?.id] || Bot;
  return <BuiltIn size={size} />;
}

/** Build an inline style for the agent icon background when a custom color is set. */
function agentIconStyle(agent) {
  if (!agent?.color) return undefined;
  return {
    background: `linear-gradient(135deg, ${agent.color} 0%, color-mix(in srgb, ${agent.color} 70%, #fff) 100%)`,
  };
}

/**
 * AgentPickerComponent — Compact popover for selecting the active agent persona.
 *
 * @param {Array<{ id, name, project, toolCount, icon?, color? }>} agents - Available agent personas
 * @param {string} activeAgentId - Currently selected agent ID
 * @param {Function} onSelect - Called with agent ID when user picks an agent
 * @param {boolean} [disabled] - Disable interaction during generation
 */
export default function AgentPickerComponent({
  agents = [],
  activeAgentId,
  onSelect,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) || agents[0];

  const handleSelect = useCallback(
    (agentId) => {
      if (agentId !== activeAgentId) {
        onSelect(agentId);
      }
      setOpen(false);
    },
    [activeAgentId, onSelect],
  );

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  if (agents.length === 0) return null;

  return (
    <div style={{ position: "relative" }}>
      <div className={styles.triggerWrap}>
        <button
          ref={triggerRef}
          className={styles.trigger}
          onClick={() => !disabled && setOpen((v) => !v)}
          title={`Active agent: ${activeAgent?.name || activeAgentId}`}
          disabled={disabled}
          type="button"
        >
          <span className={styles.triggerIcon} style={agentIconStyle(activeAgent)}>
            {renderAgentIcon(activeAgent, 13)}
          </span>
          <span className={styles.triggerLabel}>
            {activeAgent?.name || activeAgentId}
          </span>
          <ChevronDown
            size={13}
            className={styles.triggerChevron}
            data-open={open}
          />
        </button>
        <ToolCountBadgeComponent
          count={activeAgent?.toolCount}
          color={activeAgent?.color}
        />
      </div>

      {open && (
        <>
          <div className={styles.backdrop} onClick={() => setOpen(false)} />
          <div className={styles.popover}>
            {agents.map((agent) => {
              const isActive = agent.id === activeAgentId;

              return (
                <button
                  key={agent.id}
                  className={styles.agentItem}
                  data-active={isActive}
                  onClick={() => handleSelect(agent.id)}
                  type="button"
                  style={agent.color ? { "--agent-accent": agent.color } : undefined}
                >
                  <span
                    className={styles.agentIcon}
                    data-agent={agent.id}
                    style={agentIconStyle(agent)}
                  >
                    {renderAgentIcon(agent)}
                  </span>
                  <div className={styles.agentInfo}>
                    <div className={styles.agentName}>{agent.name}</div>
                    <div className={styles.agentMeta}>
                      <span className={styles.toolBadge}>
                        <Wrench size={9} />
                        {agent.toolCount} tools
                      </span>
                      <span>{agent.project}</span>
                    </div>
                  </div>
                  {isActive && (
                    <Check size={14} className={styles.activeCheck} style={agent.color ? { color: agent.color } : undefined} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
