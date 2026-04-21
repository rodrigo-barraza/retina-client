import { useReducer, useMemo } from "react";

/**
 * TTFT reducer — burst-averaging pattern, mirroring tokPerSecReducer.
 *
 * Each agentic loop iteration and each worker emits a `generation_started`
 * event with a server-computed TTFT sample. This reducer tracks the number
 * of samples seen so far and computes a running average. When a new sample
 * arrives (samples.length > prev.seenCount), it folds the new value in.
 * When the turn ends (active=false), it resets.
 *
 * For the client-side fallback (LM Studio native path), it live-counts
 * during the "processing" phase and latches on phase transition.
 */
function ttftReducer(prev, { phase, startTime, perfNow, active, samples }) {
  // Turn ended → clear
  if (!active) {
    if (prev.value === null && !prev.live && prev.seenCount === 0) return prev;
    return { value: null, live: false, prevPhase: null, seenCount: 0 };
  }

  // New server-computed TTFT sample(s) arrived — fold into running average
  if (samples && samples.length > prev.seenCount) {
    const newSamples = samples.slice(prev.seenCount);
    // Compute new running average incorporating all new samples
    const prevTotal = (prev.value || 0) * prev.seenCount;
    const newTotal = newSamples.reduce((a, b) => a + b, 0);
    const avg = (prevTotal + newTotal) / samples.length;
    return { value: avg, live: false, prevPhase: phase, seenCount: samples.length };
  }

  // Active processing → live counting (client-side fallback for LM Studio native)
  if (phase === "processing" && startTime) {
    return {
      value: (perfNow - startTime) / 1000,
      live: true,
      prevPhase: "processing",
      seenCount: prev.seenCount,
    };
  }

  // Phase just transitioned away from processing → latch final value
  if (prev.prevPhase === "processing" && phase !== "processing" && prev.live) {
    return {
      value: prev.value,
      live: false,
      prevPhase: phase,
      seenCount: prev.seenCount,
    };
  }

  // Still latched mid-turn — preserve
  if (prev.value !== null && !prev.live) {
    if (prev.prevPhase !== phase) return { ...prev, prevPhase: phase };
    return prev;
  }

  // No data yet
  if (prev.prevPhase !== phase) {
    return { ...prev, prevPhase: phase };
  }
  return prev;
}

const TTFT_INITIAL = { value: null, live: false, prevPhase: null, seenCount: 0 };

/**
 * useTtft — Time To First Token tracking with burst averaging.
 *
 * Accumulates TTFT samples from:
 * - Coordinator per-iteration `generation_started` events
 * - Worker `generation_started` events (forwarded via worker_status)
 *
 * Displays a running average across all samples, same pattern as tok/s
 * burst averaging. Falls back to client-side phase tracking for LM Studio
 * native path which provides real processing progress events.
 *
 * After the turn completes, the consumer falls back to the static
 * `avgTimeToGeneration` from backend session stats.
 *
 * @param {object|null} sessionStats — the sessionStats prop
 * @param {number} perfNow — current performance.now() snapshot (from useTokenRate ticker)
 * @param {boolean} needsTicker — whether a turn is active (from useTokenRate)
 * @returns {{ liveTtft: number|null, isLiveTtft: boolean }}
 */
export default function useTtft(sessionStats, perfNow, needsTicker) {
  const phase = sessionStats?.liveProcessingPhase || null;
  const startTime = sessionStats?.liveProcessingStartTime || null;
  const samples = sessionStats?.liveTtftSamples || null;

  const [state, dispatch] = useReducer(ttftReducer, TTFT_INITIAL);

  // Dispatch on every tick to keep in sync (same pattern as tok/s reducer)
  useMemo(() => {
    dispatch({ phase, startTime, perfNow, active: needsTicker, samples });
  }, [phase, startTime, perfNow, needsTicker, samples]);

  return {
    liveTtft: state.value,
    isLiveTtft: state.live,
  };
}
