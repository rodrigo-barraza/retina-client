"use client";

import React, { useState, useEffect, useRef } from "react";
import RainbowCanvasComponent from "./RainbowCanvasComponent.js";
import styles from "./StatusBarComponent.module.css";

// ── Shared phase vocabulary ──────────────────────────────────────────
const PHASE_LABELS = {
  starting:   "Starting...",
  loading:    "Loading...",
  processing: "Processing...",
  generating: "Generating...",
  thinking:   "Thinking...",
  awaiting:   "Awaiting For User Input...",
};

const PHASE_ICONS = {
  starting:   "⚡",
  loading:    "📦",
  processing: "⚙️",
  generating: "✨",
  thinking:   "🧠",
  awaiting:   "⏸️",
};

// ── Synthetic asymptotic progress ────────────────────────────────────
// When the backend doesn't emit real progress events (e.g. OpenAI-compat
// path used by agentic mode), we generate a client-side asymptotic curve
// that approaches 95% over ~20s. This gives the user visual feedback
// that something is happening during prompt prefill.
const SYNTHETIC_EXPECTED_MS = 20_000;
const SYNTHETIC_TICK_MS = 200;

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
 * @param {"orchestrator"|"worker"} [props.variant="orchestrator"] – Bar variant. "orchestrator" collapses to 4px when inactive; "worker" maintains 28px height.
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
  variant = "orchestrator",
  phase,
  label,
  icon,
  progress,
  iteration,
  maxIterations,
  idleIcon,
  idleLabel,
}) {
  const isWorker = variant === "worker";
  // ── Synthetic progress when backend reports 0 ──────────────
  // The OpenAI-compat path (agentic mode) doesn't receive
  // prompt_processing.progress events from LM Studio, so progress
  // stays at 0. We fill in an asymptotic estimate client-side.
  const [syntheticProgress, setSyntheticProgress] = useState(0);
  const syntheticStartRef = useRef(null);

  const isProgressPhase = phase === "processing" || phase === "loading";
  const backendStuck = isProgressPhase && progress != null && progress === 0;

  useEffect(() => {
    if (!active || !backendStuck) {
      setSyntheticProgress(0);
      syntheticStartRef.current = null;
      return;
    }

    // Start synthetic timer
    if (!syntheticStartRef.current) {
      syntheticStartRef.current = performance.now();
    }

    const id = setInterval(() => {
      const elapsed = performance.now() - syntheticStartRef.current;
      // Asymptotic: approaches 0.95 over SYNTHETIC_EXPECTED_MS
      const pct = Math.min(0.95, elapsed / (elapsed + SYNTHETIC_EXPECTED_MS));
      setSyntheticProgress(pct);
    }, SYNTHETIC_TICK_MS);

    return () => clearInterval(id);
  }, [active, backendStuck]);

  // Use real backend progress when available, synthetic when stuck at 0
  const effectiveProgress = (isProgressPhase && progress != null)
    ? (progress > 0 ? progress : syntheticProgress)
    : null;

  // Strip trailing " 45%" / " done" from label when structured progress is shown via chip
  const rawLabel = label || PHASE_LABELS[phase] || "Starting...";
  const hasEffectiveProgress = effectiveProgress != null && effectiveProgress >= 0;
  const resolvedLabel = hasEffectiveProgress
    ? rawLabel.replace(/[\u2026.]+\s*\d+%$/, "\u2026").replace(/[\u2026.]+\s*done$/i, "\u2026")
    : rawLabel;
  const resolvedIcon = icon !== undefined
    ? icon
    : (PHASE_ICONS[phase] || null);

  // Rainbow visuals: colour only when the model is actively generating tokens
  const isColorPhase = phase === "generating";
  // Awaiting phase: greyscale + frozen canvas (no animation)
  const isAwaitingPhase = phase === "awaiting";

  // Progress percentage
  const progressPct = hasEffectiveProgress ? Math.round(effectiveProgress * 100) : null;

  return (
    <div className={`${styles.statusBar}${isWorker ? ` ${styles.statusBarWorker}` : ""}${active ? ` ${styles.statusBarActive}` : ""}${isAwaitingPhase ? ` ${styles.statusBarAwaiting}` : ""}`}>
      <RainbowCanvasComponent
        turbo={active && !isAwaitingPhase}
        animate={!active || isAwaitingPhase ? false : true}
        greyscale={active ? (!isColorPhase || isAwaitingPhase) : true}
        className={styles.statusBarCanvas}
      />
      {/* Progress fill bar — slides right as prompt processing advances */}
      {active && hasEffectiveProgress && (
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
              {hasEffectiveProgress && (
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
            {!isAwaitingPhase && <span className={styles.statusBarPulse} />}
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
