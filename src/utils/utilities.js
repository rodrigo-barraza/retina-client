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

export function formatLatency(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds >= 60) return `${(seconds / 60).toFixed(1)}m`;
  if (seconds >= 1) return `${seconds.toFixed(1)}s`;
  return `${Math.round(seconds * 1000)}ms`;
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
 * e.g. "get_stock_price" → "Stock Price"
 */
export function renderToolName(name) {
  return name
    .replace(/^get_/, "")
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
    // In-flight streaming messages: use client-side chunk counter
    // as an approximate output token count until the final usage arrives
    else if (m._streamingOutputTokens > 0) {
      output += m._streamingOutputTokens;
      liveStreamingTokens = m._streamingOutputTokens;
      liveStreamingStartTime = m._streamingStartTime || null;
      liveStreamingLastChunkTime = m._streamingLastChunkTime || null;
      liveStreamingBurstTokens = m._streamingBurstTokens || 0;
      liveStreamingBurstElapsed = m._streamingBurstElapsed || 0;
    }
    // Track live processing phase and start time for TTFT estimation
    if (m._processingStartTime) {
      liveProcessingStartTime = m._processingStartTime;
    }
    if (m.statusPhase) {
      liveProcessingPhase = m.statusPhase;
    }
    // Worker live generation progress (keyed by workerId)
    if (m._workerGenerationProgress) {
      workerGenerationProgress = m._workerGenerationProgress;
      // Sum live worker output tokens so the token badge increments
      // in real-time during worker generation (before completion)
      for (const wp of Object.values(m._workerGenerationProgress)) {
        if (wp.outputTokens > 0) {
          output += wp.outputTokens;
        }
      }
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
    workerGenerationProgress,
    // TTFT tracking
    lastTimeToGeneration,
    liveProcessingStartTime,
    liveProcessingPhase,
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

