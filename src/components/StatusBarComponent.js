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
 *   progress={0.45}           // optional 0-1 progress (LM Studio prompt processing / model loading)
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
 * @param {number|null} [props.progress]  – Progress value 0-1 (LM Studio prompt processing / model loading).
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
  progress,
  iteration,
  maxIterations,
  idleIcon,
  idleLabel,
}) {
  // Strip trailing " 45%" / " done" from label when structured progress is shown via chip
  const rawLabel = label || PHASE_LABELS[phase] || "Starting...";
  const resolvedLabel = (progress != null && progress >= 0)
    ? rawLabel.replace(/[\u2026.]+\s*\d+%$/, "\u2026").replace(/[\u2026.]+\s*done$/i, "\u2026")
    : rawLabel;
  const resolvedIcon = icon !== undefined
    ? icon
    : (PHASE_ICONS[phase] || null);

  // Rainbow visuals: colour only when the model is actively generating tokens
  const isColorPhase = phase === "generating";

  // Progress percentage (only show when we have a real value)
  const hasProgress = progress != null && progress >= 0;
  const progressPct = hasProgress ? Math.round(progress * 100) : null;

  return (
    <div className={`${styles.statusBar}${active ? ` ${styles.statusBarActive}` : ""}`}>
      <RainbowCanvasComponent
        turbo={active}
        animate={!active}
        greyscale={active ? !isColorPhase : true}
        className={styles.statusBarCanvas}
      />
      {/* Progress fill bar — slides right as prompt processing advances */}
      {active && hasProgress && (
        <div
          className={styles.statusBarProgressFill}
          style={{ width: `${progressPct}%` }}
        />
      )}
      <div className={`${styles.statusBarOverlay}${phase ? ` ${styles[`phase_${phase}`] || ""}` : ""}`}>
        {active ? (
          <>
            {resolvedIcon && (
              <span className={styles.statusBarEmoji}>{resolvedIcon}</span>
            )}
            <span className={styles.statusBarMessage}>
              {resolvedLabel}
              {hasProgress && (
                <span className={styles.statusBarProgress}>
                  {progressPct}%
                </span>
              )}
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
