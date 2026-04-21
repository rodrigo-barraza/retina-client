import { useMemo } from "react";
import {
  getUniqueModels,
  getUniqueProviders,
  getSessionCost,
  getSessionTokenStats,
  getUsedTools,
  getModalities,
  getSessionElapsedTime,
} from "../utils/utilities";

/**
 * useSessionStats — memoised session statistics from a messages array.
 *
 * Replaces the 5–6 line `useMemo` block that was copy-pasted across
 * HomePage, AgentComponent, AdminAgentViewerComponent, and
 * admin/conversations/page.
 *
 * @param {Array} messages — the messages array to derive stats from
 * @returns {{ uniqueModels, totalCost, totalTokens, requestCount, usedTools, modalities, elapsedTime }}
 */
export default function useSessionStats(messages) {
  const uniqueModels = useMemo(() => getUniqueModels(messages), [messages]);
  const uniqueProviders = useMemo(() => getUniqueProviders(messages), [messages]);
  const totalCost = useMemo(() => getSessionCost(messages), [messages]);
  const { totalTokens, requestCount, liveStreamingTokens, liveStreamingStartTime, liveStreamingLastChunkTime, liveStreamingBurstTokens, liveStreamingBurstElapsed, workerGenerationProgress, lastTimeToGeneration, liveProcessingStartTime, liveProcessingPhase, liveTtftSamples } = useMemo(
    () => getSessionTokenStats(messages),
    [messages],
  );
  const usedTools = useMemo(() => getUsedTools(messages), [messages]);
  const modalities = useMemo(() => getModalities(messages), [messages]);
  const elapsedTime = useMemo(
    () => getSessionElapsedTime(messages),
    [messages],
  );

  return {
    uniqueModels,
    uniqueProviders,
    totalCost,
    totalTokens,
    requestCount,
    usedTools,
    modalities,
    elapsedTime,
    liveStreamingTokens,
    liveStreamingStartTime,
    liveStreamingLastChunkTime,
    liveStreamingBurstTokens,
    liveStreamingBurstElapsed,
    workerGenerationProgress,
    lastTimeToGeneration,
    liveProcessingStartTime,
    liveProcessingPhase,
    liveTtftSamples,
  };
}
