import { useReducer, useMemo } from "react";

/**
 * TTFT reducer — latches the final TTFT value when the processing phase ends.
 *
 * States:
 * - `{ live: true, value }` — actively counting during processing
 * - `{ live: false, value }` — latched after processing ended, turn still active
 * - `{ live: false, value: null }` — idle / turn ended
 */
function ttftReducer(prev, { phase, startTime, perfNow, active }) {
  // Turn ended → clear
  if (!active) {
    if (prev.value === null && !prev.live) return prev;
    return { value: null, live: false, prevPhase: null };
  }

  // Active processing → live counting
  if (phase === "processing" && startTime) {
    return {
      value: (perfNow - startTime) / 1000,
      live: true,
      prevPhase: "processing",
    };
  }

  // Phase just transitioned away from processing → latch final value
  if (prev.prevPhase === "processing" && phase !== "processing" && prev.live) {
    return {
      value: prev.value,
      live: false,
      prevPhase: phase,
    };
  }

  // Still latched mid-turn — preserve
  if (prev.value !== null && !prev.live) {
    return { ...prev, prevPhase: phase };
  }

  // No data yet
  if (prev.prevPhase !== phase) {
    return { ...prev, prevPhase: phase };
  }
  return prev;
}

const TTFT_INITIAL = { value: null, live: false, prevPhase: null };

/**
 * useTtft — Time To First Token tracking with latching.
 *
 * Computes and holds the TTFT value across three lifecycle phases:
 *
 * 1. **Processing** (prompt evaluation): returns a live-counting value
 *    derived from `perfNow - liveProcessingStartTime`.
 * 2. **Generating** (first token arrived): latches the final TTFT from
 *    the processing phase so the badge remains visible mid-turn instead
 *    of vanishing when the phase transitions.
 * 3. **Idle** (turn complete / no turn): returns `null` so the consumer
 *    can fall back to the static `avgTimeToGeneration` from backend stats.
 *
 * @param {object|null} sessionStats — the sessionStats prop
 * @param {number} perfNow — current performance.now() snapshot (from useTokenRate ticker)
 * @param {boolean} needsTicker — whether a turn is active (from useTokenRate)
 * @returns {{ liveTtft: number|null, isLiveTtft: boolean }}
 *   - `liveTtft`: the TTFT value in seconds, or null when no live data
 *   - `isLiveTtft`: true when actively counting (processing phase), false when latched
 */
export default function useTtft(sessionStats, perfNow, needsTicker) {
  const phase = sessionStats?.liveProcessingPhase || null;
  const startTime = sessionStats?.liveProcessingStartTime || null;

  const [state, dispatch] = useReducer(ttftReducer, TTFT_INITIAL);

  // Dispatch on every tick to keep in sync (same pattern as tok/s reducer)
  useMemo(() => {
    dispatch({ phase, startTime, perfNow, active: needsTicker });
  }, [phase, startTime, perfNow, needsTicker]);

  return {
    liveTtft: state.value,
    isLiveTtft: state.live,
  };
}
