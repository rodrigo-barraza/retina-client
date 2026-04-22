import { useState, useEffect, useReducer, useMemo } from "react";

/**
 * Staleness threshold: if the most recent chunk arrived more than
 * this many milliseconds ago, the agent is no longer "generating".
 */
const CHUNK_STALE_MS = 2000;

/**
 * Worker generation_progress events are throttled to every 10 chunks
 * on the backend. On slower models (< 10 tok/s) this means events
 * can arrive every 1-3 seconds. Use a wider staleness window for
 * workers to prevent the tok/s badge from flickering.
 */
const WORKER_STALE_MS = 5000;

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
 * Encapsulates:
 * - A 500ms ticker (nowMs / perfNow) that drives all live calculations
 * - Per-agent tok/s aggregation (coordinator + worker burst rates)
 * - Burst-averaging reducer that smooths across generation pauses
 * - Elapsed time accumulation (completed + live current turn)
 *
 * @param {object|null} sessionStats — the stats object from SettingsPanel props
 * @returns {{
 *   nowMs: number,
 *   perfNow: number,
 *   isStreaming: boolean,
 *   needsTicker: boolean,
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
  const needsTicker = !!(sessionStats?.currentTurnStart) || isStreaming;

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
  // Average per-agent throughput: sum individual tok/s rates across
  // all agents (coordinator + workers) that are actively generating,
  // then divide by the count. Only the "generating" state counts —
  // thinking, processing, loading phases are excluded.
  let totalTokPerSec = 0;
  let generatingAgentCount = 0;

  // Coordinator's own generation rate (current burst only, resets on processing gaps)
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

  // Worker generation rates — workers with recent chunks (= generating state)
  // contribute their live rate; workers that are present but stale (= thinking/
  // processing) still contribute their last known burst rate so the badge
  // doesn't flicker to "stale" during non-generating phases.
  const workerProgress = sessionStats?.workerGenerationProgress;
  let hasActiveWorkers = false;
  if (workerProgress) {
    const workerEntries = Object.values(workerProgress);
    if (workerEntries.length > 0) hasActiveWorkers = true;
    for (const wp of workerEntries) {
      if (!wp.lastChunkTime || !wp.firstChunkTime) continue;
      const timeSinceLastChunk = nowMs - wp.lastChunkTime;
      const elapsed = (wp.lastChunkTime - wp.firstChunkTime) / 1000;
      if (elapsed > 0 && wp.outputTokens > 0) {
        if (timeSinceLastChunk < WORKER_STALE_MS) {
          // Actively generating — use live burst rate
          totalTokPerSec += wp.outputTokens / elapsed;
          generatingAgentCount++;
        } else {
          // Worker is still running (thinking/processing) — carry its
          // last burst rate so the badge stays active during pauses
          totalTokPerSec += wp.outputTokens / elapsed;
          generatingAgentCount++;
        }
      }
    }
  }

  const computedTokPerSec = generatingAgentCount > 0
    ? totalTokPerSec / generatingAgentCount
    : null;

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
    totalElapsedTime,
    liveTokensPerSec,
    computedTokPerSec,
    hasActiveWorkers,
  };
}
