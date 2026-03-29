export function formatNumber(n) {
  if (n === null || n === undefined) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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
  if (dateRange?.from) p.from = new Date(dateRange.from).toISOString();
  if (dateRange?.to) p.to = new Date(dateRange.to + "T23:59:59").toISOString();
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
 * Build the function-calling system prompt with the current timestamp.
 * Shared between HomePage (FC_SYSTEM_PROMPT) and ConsoleComponent (SYSTEM_PROMPT).
 */
export function buildFCSystemPrompt() {
  return `You are a helpful AI assistant with access to real-time data APIs. You have tools for weather, air quality, earthquakes, solar activity, aurora forecasts, sunrise/sunset times, tides, wildfires, ISS tracking, local events, commodity/market prices, trending topics, and product search.

Guidelines:
- When asked about weather, events, prices, trends, or similar data, ALWAYS use the appropriate tool to fetch real-time data. Never guess or make up data.
- You may call multiple tools in a single response if the question requires data from multiple sources.
- Present data clearly with relevant formatting — use tables, bullet points, and emojis where appropriate.
- When data includes numbers, format them appropriately (currencies, percentages, temperatures).
- If a tool returns an error, inform the user and suggest alternatives.
- Be conversational and helpful, not just a data dump.
- For questions that don't require API data, respond naturally without tool calls.
- The current local date/time is: ${new Date().toLocaleString()}`;
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
