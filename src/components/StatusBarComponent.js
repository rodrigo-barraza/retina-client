"use client";

import React from "react";
import RainbowCanvasComponent from "./RainbowCanvasComponent.js";
import styles from "./StatusBarComponent.module.css";

// ── Shared phase vocabulary ──────────────────────────────────────────
const PHASE_LABELS = {
  starting:   "Starting...",
  loading:    "Loading...",
  processing: "Processing...",
  generating: "Generating...",
  thinking:   "Thinking...",
};

const PHASE_ICONS = {
  starting:   "⚡",
  loading:    "📦",
  processing: "⚙️",
  generating: "✨",
  thinking:   "🧠",
};

/**
 * Unified rainbow status bar shared by the main orchestrator and worker agents.
 *
 * ### Orchestrator usage (AgentComponent)
 * ```jsx
 * <StatusBarComponent
 *   active={isGenerating}
 *   phase={effectivePhase}    // "starting" | "loading" | "processing" | "generating" | "thinking"
 *   label={statusText}        // optional override — falls back to PHASE_LABELS[phase]
 * />
 * ```
 *
 * ### Worker usage (ToolResultRenderers → SpawnAgentRenderer)
 * ```jsx
 * <StatusBarComponent
 *   active={isToolActive || hasPhase}
 *   phase={phase}
 *   label={label}
 *   icon={icon}               // override emoji icon or pass null for default phase icon
 *   iteration={iteration}
 *   maxIterations={maxIterations}
 *   idleIcon={<Users size={10} />}
 *   idleLabel="3 tools used"
 * />
 * ```
 *
 * @param {object}  props
 * @param {boolean} props.active          – Whether the bar is expanded (28px) or collapsed (4px).
 * @param {string}  [props.phase]         – Current lifecycle phase key.
 * @param {string}  [props.label]         – Text label override. Falls back to `PHASE_LABELS[phase]`.
 * @param {string|null} [props.icon]      – Emoji override. `null` = no icon. Undefined = auto from phase.
 * @param {number}  [props.iteration]     – Current iteration number (worker bar).
 * @param {number}  [props.maxIterations] – Max iterations (worker bar).
 * @param {React.ReactNode} [props.idleIcon]  – Icon shown when bar is inactive (worker idle state).
 * @param {string}  [props.idleLabel]     – Label shown when bar is inactive.
 */
export default function StatusBarComponent({
  active = false,
  phase,
  label,
  icon,
  iteration,
  maxIterations,
  idleIcon,
  idleLabel,
}) {
  const resolvedLabel = label || PHASE_LABELS[phase] || "Starting...";
  const resolvedIcon = icon !== undefined
    ? icon
    : (PHASE_ICONS[phase] || null);

  // Rainbow visuals: colour only when the model is actively generating tokens
  const isColorPhase = phase === "generating";

  return (
    <div className={`${styles.statusBar}${active ? ` ${styles.statusBarActive}` : ""}`}>
      <RainbowCanvasComponent
        turbo={active}
        animate={!active}
        greyscale={active ? !isColorPhase : true}
        className={styles.statusBarCanvas}
      />
      <div className={styles.statusBarOverlay}>
        {active ? (
          <>
            {resolvedIcon && (
              <span className={styles.statusBarEmoji}>{resolvedIcon}</span>
            )}
            <span className={styles.statusBarMessage}>
              {resolvedLabel}
              {iteration > 0 && (
                <span className={styles.statusBarIter}>
                  Iteration {iteration}{maxIterations ? `/${maxIterations}` : ""}
                </span>
              )}
            </span>
            <span className={styles.statusBarPulse} />
          </>
        ) : (
          <>
            {idleIcon && (
              <span className={styles.statusBarIcon}>{idleIcon}</span>
            )}
            {idleLabel && (
              <span className={styles.statusBarMessage}>
                {idleLabel}
                {iteration > 0 && (
                  <span className={styles.statusBarIter}>
                    Iteration {iteration}{maxIterations ? `/${maxIterations}` : ""}
                  </span>
                )}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Re-export phase maps for consumers that need custom logic
export { PHASE_LABELS, PHASE_ICONS };
