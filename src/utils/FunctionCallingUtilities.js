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



/**
 * Build a merged array of tool schemas from built-in and custom tools.
 * Shared between HomePage and ConsoleComponent.
 *
 * @param {Array}  builtInTools     — server-provided built-in tool schemas
 * @param {Set}    disabledBuiltIns — names of disabled built-in tools
 * @param {Array}  customTools      — user-defined custom tools
 * @returns {Array} merged tool schema array
 */
export function buildToolSchemas(builtInTools, disabledBuiltIns, customTools) {
  const builtIn = builtInTools.filter((t) => !disabledBuiltIns.has(t.name));
  const custom = customTools
    .filter((t) => t.enabled)
    .map((t) => ({
      name: sanitizeToolName(t.name),
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          (t.parameters || []).map((p) => [
            p.name,
            {
              type: p.type || "string",
              description: p.description || "",
              ...(p.enum?.length ? { enum: p.enum } : {}),
            },
          ]),
        ),
        required: (t.parameters || [])
          .filter((p) => p.required)
          .map((p) => p.name),
      },
    }));
  return [...builtIn, ...custom];
}

/**
 * Build a name → schema Map from built-in tools.
 * Build a name → schema Map for data source badge lookups.
 */
export function buildToolSchemaMap(builtInTools) {
  const map = new Map();
  for (const t of builtInTools) {
    map.set(t.name, t);
  }
  return map;
}
