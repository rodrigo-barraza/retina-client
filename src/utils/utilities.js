import { DateTime } from "luxon";

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

export function formatLatency(ms) {
  if (ms === null || ms === undefined) return "-";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
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
 * Read a File as a data URL string (base64-encoded).
 * Replaces the repeated FileReader → onload → readAsDataURL boilerplate
 * used across ~11 call sites.
 */
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}



/**
 * Get unique model names from assistant messages.
 * Shared between HomePage and admin/conversations.
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
 * Sum estimatedCost across all messages.
 */
export function getConversationCost(messages) {
  return messages.reduce((sum, m) => sum + (m.estimatedCost || 0), 0);
}

/**
 * Aggregate input/output tokens and request count from assistant messages.
 * Returns { totalTokens: { input, output, total }, requestCount }.
 */
export function getConversationTokenStats(messages) {
  let input = 0;
  let output = 0;
  let requests = 0;
  for (const m of messages) {
    if (m.role !== "assistant" || !m.usage) continue;
    requests += m.usage.requests || 1;
    input += getTotalInputTokens(m.usage);
    output += m.usage.outputTokens || 0;
  }
  return {
    totalTokens: { input, output, total: input + output },
    requestCount: requests,
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
      counts.set("Function Calling", (counts.get("Function Calling") || 0) + 1);
      for (const tc of m.toolCalls) {
        if (tc.name) counts.set(tc.name, (counts.get(tc.name) || 0) + 1);
      }
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}
