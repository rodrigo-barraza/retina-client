import { useState, useEffect, useReducer, useMemo } from "react";

/**
 * Staleness threshold: if the most recent backend-emitted
 * generation_progress event arrived more than this many
 * milliseconds ago, the request has likely completed.
 */
const PROGRESS_STALE_MS = 3000;

/**
 * Staleness threshold for frontend chunk-counting fallback
 * (used by non-agentic sessions that lack backend progress events).
 */
const CHUNK_STALE_MS = 2000;

/**
 * Burst-averaging reducer for tok/s display.
 *
 * While generating, shows the current burst rate. When generation
 * pauses (tool execution, processing), records that burst's final
 * rate and displays the running average across all bursts in the
 * turn. Clears when the turn fully ends.
 */
function tokPerSecReducer(prev, { computed, active }) {
  // Turn ended → clear everything
  if (!active) {
    return { current: null, history: [], lastComputed: null };
  }
  // Actively generating → show live rate, track for recording
  if (computed !== null) {
    return { ...prev, current: computed, lastComputed: computed };
  }
  // Paused mid-turn: record the burst that just ended (if any)
  if (prev.lastComputed !== null) {
    const newHistory = [...prev.history, prev.lastComputed];
    const avg = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
    return { current: avg, history: newHistory, lastComputed: null };
  }
  // Already paused, no new burst to record — keep showing average
  return prev;
}

const TOK_PER_SEC_INITIAL = { current: null, history: [], lastComputed: null };

/**
 * useTokenRate — live token throughput and elapsed-time computation
 * derived from a sessionStats object.
 *
 * Two data sources (in priority order):
 *
 *   1. **Backend-sourced** (`liveGenProgress`): Authoritative tok/s
 *      computed by Prism's SessionGenerationTracker at the provider
 *      level. Aggregates coordinator, worker, and tool sub-request
 *      throughput. Available for agentic sessions.
 *
 *   2. **Frontend chunk-counting** (fallback): For non-agentic
 *      sessions (regular conversations) that don't emit
 *      generation_progress events. Computes rates from SSE chunk
 *      inter-arrival timing.
 *
 * @param {object|null} sessionStats — the stats object from SettingsPanel props
 * @returns {{
 *   nowMs: number,
 *   perfNow: number,
 *   isStreaming: boolean,
 *   needsTicker: boolean,
 *   turnActive: boolean,
 *   totalElapsedTime: number,
 *   liveTokensPerSec: number|null,
 *   computedTokPerSec: number|null,
 *   hasActiveWorkers: boolean,
 * }}
 */
export default function useTokenRate(sessionStats) {
  // ── Live ticker ───────────────────────────────────────────────
  // Stores current wall-clock and performance timestamps so render
  // stays pure (no Date.now() calls in the render body).
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [perfNow, setPerfNow] = useState(() => performance.now());

  const isStreaming = !!(sessionStats?.liveStreamingStartTime);
  const turnActive = !!(sessionStats?.currentTurnStart);
  const needsTicker = turnActive || isStreaming;

  useEffect(() => {
    if (!needsTicker) return;
    // Immediate tick via microtask to avoid synchronous setState in effect body
    const immediate = setTimeout(() => { setNowMs(Date.now()); setPerfNow(performance.now()); }, 0);
    // 500ms interval for smoother tok/s updates during streaming
    const id = setInterval(() => { setNowMs(Date.now()); setPerfNow(performance.now()); }, 500);
    return () => { clearTimeout(immediate); clearInterval(id); };
  }, [needsTicker]);

  // ── Elapsed time ──────────────────────────────────────────────
  const completedTime = sessionStats?.completedElapsedTime || 0;
  const liveExtra = sessionStats?.currentTurnStart
    ? Math.max(0, (nowMs - sessionStats.currentTurnStart) / 1000)
    : 0;
  const totalElapsedTime = completedTime + liveExtra;

  // ── Live tok/s computation ────────────────────────────────────
  // Priority 1: Backend-sourced generation_progress from
  // SessionGenerationTracker (authoritative, includes all agents
  // and sub-requests).
  //
  // Priority 2: Frontend chunk-counting fallback for non-agentic
  // sessions that don't emit generation_progress events.
  let computedTokPerSec = null;
  let hasActiveWorkers = false;

  const genProgress = sessionStats?.liveGenProgress;
  const genProgressFresh = genProgress
    && genProgress.timestamp
    && (perfNow - genProgress.timestamp) < PROGRESS_STALE_MS;

  if (genProgressFresh && genProgress.tokPerSec != null) {
    // ── Backend-sourced (authoritative) ──────────────────────
    computedTokPerSec = genProgress.tokPerSec;
    hasActiveWorkers = (genProgress.activeRequests || 0) > 1;
  } else {
    // ── Frontend chunk-counting fallback ─────────────────────
    // Used by regular conversation sessions (HomePage) that
    // don't go through the agentic loop.
    let totalTokPerSec = 0;
    let generatingAgentCount = 0;

    // Coordinator's own generation rate
    const coordActive = isStreaming
      && sessionStats.liveStreamingLastChunkTime
      && (perfNow - sessionStats.liveStreamingLastChunkTime) < CHUNK_STALE_MS;
    if (coordActive) {
      const burstElapsed = (sessionStats.liveStreamingBurstElapsed || 0) / 1000;
      const burstTokens = sessionStats.liveStreamingBurstTokens || 0;
      if (burstElapsed > 0 && burstTokens > 0) {
        totalTokPerSec += burstTokens / burstElapsed;
        generatingAgentCount++;
      }
    }

    computedTokPerSec = generatingAgentCount > 0
      ? totalTokPerSec / generatingAgentCount
      : null;
  }

  // ── Burst-averaging reducer ───────────────────────────────────
  const [tokPerSecState, dispatchTokPerSec] = useReducer(
    tokPerSecReducer,
    TOK_PER_SEC_INITIAL,
  );
  const liveTokensPerSec = tokPerSecState.current;

  // Dispatch every tick to keep the reducer in sync
  useMemo(() => {
    dispatchTokPerSec({ computed: computedTokPerSec, active: needsTicker });
  }, [computedTokPerSec, needsTicker]);

  return {
    nowMs,
    perfNow,
    isStreaming,
    needsTicker,
    turnActive,
    totalElapsedTime,
    liveTokensPerSec,
    computedTokPerSec,
    hasActiveWorkers,
  };
}
