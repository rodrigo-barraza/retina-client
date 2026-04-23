import { DateTime } from "luxon";

/**
 * Build the JSON body for LM Studio load requests.
 * Maps camelCase options to the snake_case API contract.
 * Used by PrismService.loadLmStudioModel, loadLmStudioModelStream,
 * and IrisService.loadLmStudioModel.
 */
export function buildLmStudioLoadBody(model, options = {}) {
  const body = { model };
  if (options.contextLength != null) body.context_length = options.contextLength;
  if (options.flashAttention != null) body.flash_attention = options.flashAttention;
  if (options.offloadKvCache != null) body.offload_kv_cache_to_gpu = options.offloadKvCache;
  return body;
}

/**
 * Format a number with K/M abbreviation (truncated, no decimals).
 * @see {@link formatCompact} — similar but with adaptive decimal precision
 * @see {@link formatTokenCount} — full numeric display with separators
 * @see {@link formatContextTokens} — context-window-specific formatting
 */
export function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

/**
 * Format a token count as full value with thousands separators.
 * Unlike formatNumber, this never abbreviates to K/M.
 * e.g. 1234567 → "1,234,567"
 */
export function formatTokenCount(n) {
  if (n === null || n === undefined || n === 0) return "0";
  return Number(n).toLocaleString();
}

/**
 * Get the total input token count from a usage object.
 * Providers like Anthropic and Google split prompt tokens into
 * new + cache_read + cache_write. This aggregates all three.
 */
export function getTotalInputTokens(usage) {
  if (!usage) return 0;
  return (
    (usage.inputTokens || 0) +
    (usage.cacheReadInputTokens || 0) +
    (usage.cacheCreationInputTokens || 0)
  );
}

export function formatCost(n) {
  if (n === null || n === undefined) return "$0.00";
  return `$${n.toFixed(5)}`;
}

/**
 * Format a USD cost with adaptive precision.
 * Costs < $0.01 show 4 decimals, otherwise 2.
 * E.g. 0.0034 → "$0.0034", 1.50 → "$1.50"
 */
export function formatCostAdaptive(cost) {
  if (!cost || cost === 0) return "$0.00";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatLatency(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds >= 1) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds * 1000)}ms`;
}

/**
 * Format a latency value given in **milliseconds**.
 * Thin wrapper over formatLatency(seconds) for call sites that have ms values.
 */
export function formatLatencyMs(ms) {
  if (!ms) return "—";
  return formatLatency(ms / 1000);
}

/**
 * Format an ISO timestamp as a compact human-readable datetime.
 * Shows "Mar 30, 3:32 PM" for current year, "Mar 30, 2025, 3:32 PM" otherwise.
 * Returns "—" for null/undefined values.
 */
export function formatDateTime(isoString) {
  if (!isoString) return "—";
  const dt = DateTime.fromISO(isoString);
  if (!dt.isValid) return "—";
  const now = DateTime.now();
  if (dt.year === now.year) {
    return dt.toFormat("MMM d, h:mm:ss a");
  }
  return dt.toFormat("MMM d, yyyy, h:mm:ss a");
}


/**
 * Convert a snake_case function name to a human-readable title.
 * Strips common prefixes: get_, mcp__<server>__
 * e.g. "get_stock_price" → "Stock Price", "mcp__github__list_repos" → "List Repos"
 */
export function renderToolName(name) {
  return name
    .replace(/^(get_|mcp__\w+__)/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extended tool name humanization — strips a broad set of verb prefixes
 * before title-casing. Use for display contexts where the action verb
 * is redundant (e.g. tool catalog pages).
 * e.g. "search_web_results" → "Web Results", "execute_python" → "Python"
 */
export function humanizeToolName(name) {
  return name
    .replace(/^(get|set|search|list|create|delete|update|fetch|read|write|check|run|execute|find|query|rank|lookup|send|track|stop|cancel|submit|browse|navigate|click|scroll|type|clear|wait|close|open|save|load|ask|plan|log|emit|extract|consolidate|manage|add|remove|use|exit|enter)_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build ISO date range params from a { from, to } object.
 * Returns an object with optional `from` and `to` keys.
 */
export function buildDateRangeParams(dateRange) {
  const p = {};
  if (dateRange?.from) {
    // ISO datetime (sub-day presets) passes through; day-only gets midnight
    p.from = dateRange.from.includes("T")
      ? dateRange.from
      : new Date(dateRange.from).toISOString();
  }
  if (dateRange?.to) {
    p.to = dateRange.to.includes("T")
      ? dateRange.to
      : new Date(dateRange.to + "T23:59:59").toISOString();
  }
  return p;
}

/**
 * Format a context window token count (e.g. 128000 → "128K", 1000000 → "1M").
 * @see {@link formatNumber} — general-purpose K/M abbreviation
 * @see {@link formatCompact} — adaptive precision for arbitrary numbers
 */
export function formatContextTokens(tokens) {
  if (!tokens) return null;
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

/**
 * Format a byte count as human-readable file size (GB, MB, KB).
 */
export function formatFileSize(bytes) {
  if (!bytes) return null;
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Format tokens-per-second with consistent precision.
 * Returns "X.X" or "—" for null/zero values.
 */
export function formatTokensPerSec(value) {
  if (value === null || value === undefined || value === 0) return "—";
  return `${Number(value).toFixed(1)}`;
}

/**
 * Copy text to clipboard with error handling.
 * Returns true on success, false on failure.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Format a large number compactly with adaptive decimal precision.
 * e.g. 10000000 → "10M", 3500 → "3.5K", 42 → "42"
 *
 * Unlike formatNumber, this keeps a decimal when the value isn't
 * a clean multiple (3.5K vs 4K) and uses toLocaleString for
 * values under 1 000.
 *
 * @see {@link formatNumber} — simpler version without adaptive decimals
 * @see {@link formatContextTokens} — context-window-specific formatting
 */
export function formatCompact(n) {
  if (n == null) return "—";
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000)
    return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return n.toLocaleString();
}

/**
 * Human-readable relative timestamp from an ISO date string.
 * Covers both fine-grained ("just now", "30s ago") and
 * coarse-grained ("today", "yesterday", "3d ago") ranges.
 */
export function formatTimeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}



/**
 * Get unique model names from assistant messages.
 * Shared between HomePage, AgentComponent, and admin/conversations.
 */
export function getUniqueModels(messages) {
  return [
    ...new Set(
      messages
        .filter((m) => m.role === "assistant" && m.model)
        .map((m) => m.model),
    ),
  ];
}

/**
 * Get unique provider keys from assistant messages.
 * Shared between useSessionStats and SettingsPanel.
 */
export function getUniqueProviders(messages) {
  return [
    ...new Set(
      messages
        .filter((m) => m.role === "assistant" && m.provider)
        .map((m) => m.provider),
    ),
  ];
}

/**
 * Sum estimatedCost across all messages.
 */
export function getSessionCost(messages) {
  return messages.reduce((sum, m) => sum + (m.estimatedCost || 0), 0);
}

/**
 * Aggregate input/output tokens and request count from assistant messages.
 * Returns { totalTokens: { input, output, total }, requestCount }.
 */
export function getSessionTokenStats(messages) {
  let input = 0;
  let output = 0;
  let requests = 0;
  let liveStreamingTokens = 0;
  let liveStreamingStartTime = null;
  let liveStreamingLastChunkTime = null;
  let liveStreamingBurstTokens = 0;
  let liveStreamingBurstElapsed = 0;
  let workerGenerationProgress = null;
  let lastTimeToGeneration = null;     // retroactive TTFT from completed messages (seconds)
  let liveProcessingStartTime = null;  // performance.now() when processing phase started
  let liveProcessingPhase = null;      // current phase of in-flight message (processing/loading/generating)
  let liveTtftSamples = null;          // server-computed TTFT samples (seconds[]) from generation_started events
  let liveOutputCharacters = 0;         // real character count from streaming chunks
  let liveGenProgress = null;          // backend-computed tok/s from SessionGenerationTracker
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    // Finalized messages have usage from the provider
    if (m.usage) {
      requests += m.usage.requests || 1;
      input += getTotalInputTokens(m.usage);
      output += m.usage.outputTokens || 0;
    }
    // Retroactive TTFT from completed messages
    if (m.timeToGeneration != null) {
      lastTimeToGeneration = m.timeToGeneration;
    }
    // Intermediate authoritative usage from backend usage_update events.
    // Priority: usage (done) > _intermediateUsage (per-iteration) > _liveGenProgress (tracker)
    //
    // _liveGenProgress.outputTokens may exceed _intermediateUsage when
    // a new iteration completes — use whichever is higher so the token
    // count never stalls between iterations.
    if (!m.usage && m._intermediateUsage) {
      const intermediateOutput = m._intermediateUsage.outputTokens || 0;
      // Use tracker's real token count if it exceeds intermediate (new iteration completed)
      const trackerOutput = m._liveGenProgress?.outputTokens || 0;
      const effectiveOutput = Math.max(intermediateOutput, trackerOutput);

      requests += m._intermediateUsage.requests || 1;
      input += getTotalInputTokens(m._intermediateUsage);
      output += effectiveOutput;
      // Still expose streaming metadata for tok/s computation
      liveStreamingTokens = effectiveOutput;
      liveStreamingStartTime = m._streamingStartTime || null;
      liveStreamingLastChunkTime = m._streamingLastChunkTime || null;
      liveStreamingBurstTokens = m._streamingBurstTokens || 0;
      liveStreamingBurstElapsed = m._streamingBurstElapsed || 0;
    }
    // In-flight streaming messages: use tracker's real token count
    // (fed exclusively by provider-reported usage, never per-chunk estimates)
    else if (!m.usage && m._liveGenProgress?.outputTokens > 0) {
      output += m._liveGenProgress.outputTokens;
      liveStreamingTokens = m._liveGenProgress.outputTokens;
      liveStreamingStartTime = m._streamingStartTime || null;
      liveStreamingLastChunkTime = m._streamingLastChunkTime || null;
      liveStreamingBurstTokens = m._streamingBurstTokens || 0;
      liveStreamingBurstElapsed = m._streamingBurstElapsed || 0;
    }
    // Track live output characters (real data, always increasing during streaming)
    if (m._streamingOutputCharacters > 0) {
      liveOutputCharacters = m._streamingOutputCharacters;
    }
    // Track live processing phase and start time for TTFT estimation
    if (m._processingStartTime) {
      liveProcessingStartTime = m._processingStartTime;
    }
    if (m.statusPhase) {
      liveProcessingPhase = m.statusPhase;
    }
    // Server-computed TTFT samples from generation_started events (per-iteration, per-worker)
    if (m._ttftSamples?.length) {
      liveTtftSamples = m._ttftSamples;
    }
    // Worker live generation progress (keyed by workerId)
    if (m._workerGenerationProgress) {
      workerGenerationProgress = m._workerGenerationProgress;
      // Sum live worker output tokens so the token badge increments
      // in real-time during worker generation (before completion).
      // Use cumulative totalOutputTokens (not burst-scoped outputTokens)
      // so the count doesn't reset when workers transition between phases.
      for (const wp of Object.values(m._workerGenerationProgress)) {
        const count = wp.totalOutputTokens || wp.outputTokens || 0;
        if (count > 0) {
          output += count;
        }
      }
    }
    // Backend-computed tok/s from SessionGenerationTracker
    if (m._liveGenProgress) {
      liveGenProgress = m._liveGenProgress;
    }
    // Accumulated worker tokens (from worker_status complete events)
    // These arrive independently of the coordinator's own usage.
    // Only add completed worker tokens that aren't already counted
    // from _workerGenerationProgress (which is removed on completion).
    if (m._workerTokens) {
      input += m._workerTokens.input || 0;
      output += m._workerTokens.output || 0;
      requests += m._workerTokens.requests || 0;
    }
  }
  return {
    totalTokens: { input, output, total: input + output },
    requestCount: requests,
    // Live streaming metadata for real-time tok/s computation
    liveStreamingTokens,
    liveStreamingStartTime,
    liveStreamingLastChunkTime,
    liveStreamingBurstTokens,
    liveStreamingBurstElapsed,
    liveOutputCharacters,
    workerGenerationProgress,
    // TTFT tracking
    lastTimeToGeneration,
    liveProcessingStartTime,
    liveProcessingPhase,
    liveTtftSamples,
    liveGenProgress,
  };
}

/**
 * Count tool invocations across all messages.
 * Returns [{ name, count }] sorted by count.
 */
export function getUsedTools(messages) {
  const counts = new Map();
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    if (m.thinking) counts.set("Thinking", (counts.get("Thinking") || 0) + 1);
    if (m.toolCalls?.length > 0) {
      counts.set("Tool Calling", (counts.get("Tool Calling") || 0) + 1);
      for (const tc of m.toolCalls) {
        if (tc.name) counts.set(tc.name, (counts.get(tc.name) || 0) + 1);
      }
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/**
 * Tool names that represent provider capabilities rather than
 * function-level tool calls. Used to separate capability badges
 * (Thinking, Tool Calling, Web Search, etc.) from individual
 * tool-call badges (read_file, grep_search, etc.) in the stats UI.
 */
export const CAPABILITY_TOOL_NAMES = new Set([
  "Thinking", "Tool Calling", "Web Search", "Google Search",
  "Code Execution", "Computer Use", "File Search", "URL Context",
  "Image Generation",
]);

/**
 * Convert a backend toolCounts map ({ name: count }) into the
 * usedTools array format ([{ name, count }]) sorted by count desc.
 */
export function toolCountsToUsedTools(toolCounts) {
  if (!toolCounts || Object.keys(toolCounts).length === 0) return [];
  return Object.entries(toolCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Merge multiple tool-count sources into a single usedTools array
 * for display in the stats badges. Handles three layers:
 *
 * 1. **clientTools** — from getUsedTools(messages), includes both
 *    capability-level entries (Thinking, Tool Calling) and
 *    coordinator function-level entries (read_file, etc.)
 * 2. **backendToolCounts** — optional { name: count } map from
 *    backend session stats (authoritative post-completion)
 * 3. **workerToolActivity** — optional { [workerId]: { toolNames: { name: count } } }
 *    from live SSE events (real-time during generation)
 *
 * When both backend and live worker counts exist for the same tool,
 * the higher count wins (prevents badges from appearing to decrease
 * as backend catches up).
 *
 * @param {Array<{name: string, count: number}>} clientTools
 * @param {{ [name: string]: number }} [backendToolCounts]
 * @param {{ [workerId: string]: { toolNames?: { [name: string]: number } } }} [workerToolActivity]
 * @returns {Array<{name: string, count: number}>} sorted by count desc
 */
export function mergeUsedToolsWithWorkers(clientTools, backendToolCounts, workerToolActivity) {
  // Separate capabilities from function-level tool calls
  const capabilities = clientTools.filter((t) => CAPABILITY_TOOL_NAMES.has(t.name));

  // Start with authoritative source (backend if available, else client function-level)
  const merged = new Map();
  if (backendToolCounts) {
    for (const t of toolCountsToUsedTools(backendToolCounts)) {
      merged.set(t.name, t.count);
    }
  } else {
    for (const t of clientTools) {
      if (CAPABILITY_TOOL_NAMES.has(t.name)) continue;
      merged.set(t.name, (merged.get(t.name) || 0) + t.count);
    }
  }

  // Overlay live worker tool counts (real-time during generation)
  if (workerToolActivity) {
    for (const w of Object.values(workerToolActivity)) {
      if (!w.toolNames) continue;
      for (const [name, count] of Object.entries(w.toolNames)) {
        if (CAPABILITY_TOOL_NAMES.has(name)) continue;
        merged.set(name, Math.max(merged.get(name) || 0, count));
      }
    }
  }

  const mergedTools = [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return [...capabilities, ...mergedTools];
}

/**
 * Shuffle an array in-place using the Fisher–Yates algorithm.
 * Returns a new shuffled copy — does not mutate the original.
 */
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Derive modality flags from a session's messages array.
 * Returns an object with boolean flags for each modality
 * (textIn, textOut, imageIn, imageOut, audioIn, audioOut,
 * videoIn, docIn, webSearch, codeExecution, functionCalling, thinking).
 */
export function getModalities(messages) {
  const modalities = {
    textIn: false,
    textOut: false,
    imageIn: false,
    imageOut: false,
    audioIn: false,
    audioOut: false,
    videoIn: false,
    docIn: false,
    webSearch: false,
    codeExecution: false,
    functionCalling: false,
    thinking: false,
  };

  const WEB_SEARCH_NAMES = new Set(["web_search", "web_search_preview"]);
  const CODE_EXEC_NAMES = new Set(["code_execution"]);

  for (const m of messages || []) {
    const isUser = m.role === "user";
    const isAssistant = m.role === "assistant";
    if (m.content && (isUser || isAssistant)) {
      if (isUser && !m.liveTranscription) modalities.textIn = true;
      if (isAssistant) modalities.textOut = true;
    }
    // Tool calls are structured text output
    if (isAssistant && m.toolCalls?.length > 0) {
      modalities.textOut = true;
    }
    if (m.audio) {
      if (isUser) modalities.audioIn = true;
      if (isAssistant) modalities.audioOut = true;
    }
    if (m.images?.length > 0) {
      for (const ref of m.images) {
        if (typeof ref !== "string") continue;
        const isDoc =
          ref.startsWith("data:application/") ||
          ref.startsWith("data:text/") ||
          ref.endsWith(".pdf") ||
          ref.endsWith(".txt");
        const isVideo =
          ref.startsWith("data:video/") ||
          [".mp4", ".mov", ".avi", ".webm"].some((ext) => ref.endsWith(ext));
        if (isDoc) {
          modalities.docIn = true;
        } else if (isVideo) {
          if (isUser) modalities.videoIn = true;
        } else {
          // Actual image ref
          if (isUser) modalities.imageIn = true;
          if (isAssistant) modalities.imageOut = true;
        }
      }
    }
    // Standalone image field (not from images array)
    if (m.image && !m.images?.length) {
      if (isUser) modalities.imageIn = true;
      if (isAssistant) modalities.imageOut = true;
    }
    if (m.documents?.length > 0) {
      modalities.docIn = true;
    }

    // Classify tool calls by type
    if (m.toolCalls?.length > 0) {
      for (const tc of m.toolCalls) {
        const name = (tc.name || "").toLowerCase();
        if (WEB_SEARCH_NAMES.has(name)) {
          modalities.webSearch = true;
        } else if (CODE_EXEC_NAMES.has(name)) {
          modalities.codeExecution = true;
        } else {
          modalities.functionCalling = true;
        }
      }
    }

    // Detect inline web search results (from streaming)
    if (
      isAssistant &&
      typeof m.content === "string" &&
      m.content.includes("> **Sources:**")
    ) {
      modalities.webSearch = true;
    }

    // Detect inline code execution blocks (from streaming)
    if (
      isAssistant &&
      typeof m.content === "string" &&
      m.content.includes("```exec-")
    ) {
      modalities.codeExecution = true;
    }

    // Tool result messages → function calling
    if (m.role === "tool") {
      modalities.functionCalling = true;
    }

    // Detect thinking / reasoning
    if (isAssistant && m.thinking) {
      modalities.thinking = true;
    }
  }
  return modalities;
}

/**
 * Compute cumulative wall-clock elapsed time across all user→assistant turns.
 * Each user message with a `timestamp` paired with a subsequent assistant
 * message's `completedAt` (or `timestamp`) constitutes one turn.
 * Works for both live sessions (client-side `completedAt`) and restored
 * sessions from the DB (server-side `timestamp` on assistant messages).
 * Returns total elapsed seconds.
 */
export function getSessionElapsedTime(messages) {
  let total = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user" || !m.timestamp) continue;
    // Find the next assistant message that completed
    for (let j = i + 1; j < messages.length; j++) {
      const a = messages[j];
      if (a.role !== "assistant") continue;
      const endTs = a.completedAt || a.timestamp;
      if (!endTs) break;
      const start = new Date(m.timestamp).getTime();
      const end = new Date(endTs).getTime();
      if (end > start) total += (end - start) / 1000;
      break;
    }
  }
  return total;
}

/**
 * Format an elapsed duration (in seconds) into a human-readable string.
 * e.g. 5 → "5s", 65 → "1m 5s", 3665 → "1h 1m"
 */
export function formatElapsedTime(seconds) {
  if (seconds == null || seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

