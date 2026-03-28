/**
 * Shared utilities for function calling (FC) message expansion.
 *
 * Both HomePage.js and ConsoleComponent.js need to expand assistant messages
 * with toolCalls into the [assistant(tool_calls), tool(result), ...] format
 * expected by the OpenAI Chat Completions spec. This module centralises that
 * logic to avoid duplication.
 */

/**
 * Sanitize a tool name for LLM function calling APIs.
 * Google's function calling API requires names to be alphanumeric + _ . : -
 * starting with a letter or underscore, max 128 chars.
 */
export function sanitizeToolName(name) {
  return name
    .replace(/[^a-zA-Z0-9_.:/-]/g, "_")
    .replace(/^[^a-zA-Z_]/, "_$&")
    .slice(0, 128);
}

// ── Array keys whose entries get capped during truncation ─────
const TRUNCATABLE_ARRAY_KEYS = [
  "events",
  "products",
  "trends",
  "articles",
  "earnings",
  "predictions",
  "commodities",
];

/**
 * Truncate a tool result to avoid blowing up the model's context window.
 * Caps arrays at 10 items and the serialized JSON at ~maxChars.
 * The full result is still stored in the DB and shown in the UI;
 * this only affects what gets re-sent to the model.
 */
export function truncateToolResult(result, maxChars = 8000) {
  if (!result || typeof result !== "object") return result;

  // If result has a known array wrapper, cap items at 10
  const trimmed = { ...result };
  for (const key of TRUNCATABLE_ARRAY_KEYS) {
    if (Array.isArray(trimmed[key]) && trimmed[key].length > 10) {
      const total = trimmed[key].length;
      trimmed[key] = trimmed[key].slice(0, 10);
      trimmed[`_${key}Truncated`] = `Showing 10 of ${total}`;
    }
  }

  // Also handle top-level arrays (e.g. tides, earthquakes)
  if (Array.isArray(result) && result.length > 10) {
    const sliced = result.slice(0, 10);
    sliced.push({ _truncated: `Showing 10 of ${result.length}` });
    const str = JSON.stringify(sliced);
    return str.length > maxChars ? str.slice(0, maxChars) + "…}" : sliced;
  }

  const str = JSON.stringify(trimmed);
  if (str.length <= maxChars) return trimmed;
  return str.slice(0, maxChars) + "…}";
}

/**
 * Expand a messages array into the format expected by LLM providers for
 * function calling. Assistant messages with toolCalls are expanded into
 * [assistant(tool_calls), tool(result1), tool(result2), ...] per the
 * OpenAI Chat Completions spec.
 *
 * @param {Array} messages - Raw conversation messages (may include deleted, tool, assistant w/ toolCalls)
 * @param {object} [options]
 * @param {boolean} [options.filterDeleted=true] - Strip soft-deleted messages
 * @returns {Array} Provider-ready messages
 */
export function expandMessagesForFC(messages, { filterDeleted = true } = {}) {
  const filtered = filterDeleted
    ? messages.filter(
        (m) =>
          !m.deleted &&
          (m.role !== "assistant" || m.content?.trim() || m.toolCalls?.length),
      )
    : messages;

  return filtered.flatMap((m) => {
    // Expand assistant messages with toolCalls into
    // [assistant(tool_calls), tool(result1), tool(result2), ...]
    if (m.role === "assistant" && m.toolCalls?.length > 0) {
      const assistantMsg = {
        role: "assistant",
        content: m.content?.trim() || null,
        toolCalls: m.toolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          args: tc.args,
          ...(tc.thoughtSignature
            ? { thoughtSignature: tc.thoughtSignature }
            : {}),
        })),
      };
      const toolMsgs = m.toolCalls
        .filter((tc) => tc.result !== undefined)
        .map((tc) => ({
          role: "tool",
          name: tc.name,
          tool_call_id: tc.id,
          content:
            typeof tc.result === "string"
              ? tc.result
              : JSON.stringify(truncateToolResult(tc.result)),
        }));
      return [assistantMsg, ...toolMsgs];
    }

    // Pass through tool messages with their required fields
    if (m.role === "tool") {
      return [
        {
          role: "tool",
          tool_call_id: m.tool_call_id,
          name: m.name,
          content: m.content,
        },
      ];
    }

    // Standard message — include images if present
    return [
      {
        role: m.role,
        ...(m.content?.trim() ? { content: m.content } : { content: " " }),
        ...(m.images?.length > 0 ? { images: m.images } : {}),
      },
    ];
  });
}
