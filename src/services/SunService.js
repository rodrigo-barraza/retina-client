// ============================================================
// Sun Service — Dynamic Tool Client
// ============================================================
// Fetches tool schemas from tools-api at startup and provides
// a generic executor for the Console's tool-calling orchestration.
//
// tools-api is the single source of truth for:
//   - Tool names, descriptions, parameters (JSON Schema)
//   - Available fields per tool
//   - Endpoint routing metadata (path, pathParams, queryParams)
//
// This service:
//   - Fetches schemas once at module load (eager init)
//   - Strips endpoint metadata before passing to the LLM
//   - Builds URLs dynamically from endpoint metadata
// ============================================================

import { TOOLS_API_URL } from "../../config.js";

// ────────────────────────────────────────────────────────────
// Schema Cache — fetched from tools-api at startup
// ────────────────────────────────────────────────────────────

/** @type {Array} Full tool schemas (with endpoint metadata) */
let cachedSchemas = [];

/** @type {Array} Clean schemas for LLM (without endpoint metadata) */
let cachedAISchemas = [];

/** @type {Map<string, object>} Tool name → full schema (for executor lookup) */
const toolMap = new Map();

/** @type {boolean} Whether initial fetch has completed */
let initialized = false;

/**
 * Fetch tool schemas from tools-api and populate caches.
 * Called eagerly at module load — non-blocking, graceful fallback.
 */
async function fetchSchemas() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${TOOLS_API_URL}/admin/tool-schemas`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(
        `[SunService] Failed to fetch tool schemas: ${res.status} ${res.statusText}`,
      );
      return;
    }

    const schemas = await res.json();

    if (!Array.isArray(schemas) || schemas.length === 0) {
      console.warn("[SunService] Tool schemas response was empty or invalid");
      return;
    }

    cachedSchemas = schemas;

    // Strip endpoint metadata for LLM consumption
    cachedAISchemas = schemas.map(({ endpoint: _endpoint, ...rest }) => rest);

    // Build lookup map for executor
    toolMap.clear();
    for (const schema of schemas) {
      toolMap.set(schema.name, schema);
    }

    initialized = true;
    console.log(
      `[SunService] Loaded ${schemas.length} tool schemas from tools-api`,
    );
  } catch (err) {
    console.warn(
      `[SunService] Could not reach tools-api for schemas: ${err.message}`,
    );
  }
}

// Kick off schema fetch immediately at module load
fetchSchemas();

// ────────────────────────────────────────────────────────────
// Generic URL Builder — uses endpoint metadata
// ────────────────────────────────────────────────────────────

/**
 * Build a URL from a tool's endpoint metadata and the given args.
 * Handles path params (:param interpolation), query params, and fields.
 *
 * @param {object} endpoint - { path, pathParams?, queryParams?, conditionalPath? }
 * @param {object} args - Arguments from the AI tool call
 * @returns {string} Complete URL with query string
 */
function buildUrlFromEndpoint(endpoint, args = {}) {
  // Resolve path — check conditionalPath first
  let path = endpoint.path;
  if (endpoint.conditionalPath) {
    const { param, template } = endpoint.conditionalPath;
    if (args[param]) {
      path = template;
    }
  }

  // Interpolate path params (e.g. /finance/quote/:symbol)
  const pathParams = new Set(endpoint.pathParams || []);
  for (const param of pathParams) {
    if (args[param] !== undefined && args[param] !== null) {
      path = path.replace(`:${param}`, encodeURIComponent(String(args[param])));
    }
  }

  // Build query string from declared queryParams + fields
  const params = new URLSearchParams();

  // Forward declared query params
  const queryParams = endpoint.queryParams || [];
  for (const key of queryParams) {
    // Handle param name remapping (e.g. "query" → "q" for search_events)
    const value = args[key];
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, value);
    }
  }

  // Always forward fields if present
  if (args.fields) {
    const fieldsStr = Array.isArray(args.fields)
      ? args.fields.join(",")
      : args.fields;
    params.set("fields", fieldsStr);
  }

  const qs = params.toString();
  return `${TOOLS_API_URL}${path}${qs ? `?${qs}` : ""}`;
}

// ────────────────────────────────────────────────────────────
// Generic Executor
// ────────────────────────────────────────────────────────────

/**
 * Build arg remapping for tools where LLM param names
 * differ from the API query param names.
 * Only needed for a few tools with "query" → "q" mapping.
 */
const ARG_REMAPS = {
  search_events: { query: "q" },
  search_products: { query: "q" },
};

/**
 * Execute a tool call dynamically using endpoint metadata.
 *
 * @param {string} name - Tool name
 * @param {object} args - Arguments from the AI
 * @returns {Promise<object>} JSON result
 */
async function executeToolGeneric(name, args = {}) {
  const schema = toolMap.get(name);
  if (!schema || !schema.endpoint) {
    return { error: `Unknown tool: ${name}` };
  }

  // Apply arg remapping if needed
  const remaps = ARG_REMAPS[name];
  let resolvedArgs = args;
  if (remaps) {
    resolvedArgs = { ...args };
    for (const [from, to] of Object.entries(remaps)) {
      if (resolvedArgs[from] !== undefined) {
        resolvedArgs[to] = resolvedArgs[from];
        delete resolvedArgs[from];
      }
    }
  }

  const url = buildUrlFromEndpoint(schema.endpoint, resolvedArgs);
  return fetchJson(url);
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { error: `API returned ${res.status}: ${res.statusText}` };
    }
    return await res.json();
  } catch (err) {
    return { error: `Failed to reach API: ${err.message}` };
  }
}

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────

export default class SunService {
  /**
   * Get all tool schemas for passing to Prism (stripped of endpoint metadata).
   * Returns synchronously from cache — schemas are pre-fetched at module load.
   * @returns {Array} Tool definition objects (without endpoint metadata)
   */
  static getToolSchemas() {
    return cachedAISchemas;
  }

  /**
   * Get available fields for a specific tool (useful for UI/debugging).
   * @param {string} toolName - Tool name
   * @returns {string[]|null} Available field names or null
   */
  static getToolFields(toolName) {
    const tool = cachedAISchemas.find((t) => t.name === toolName);
    if (!tool) return null;
    return tool.parameters?.properties?.fields?.items?.enum || null;
  }

  /**
   * Check whether the tools-api is online.
   * @returns {Promise<{ offline: Set<string>, apiStatus: Record<string, boolean> }>}
   */
  static async checkApiHealth() {
    const toolNames = cachedSchemas.map((t) => t.name);

    let online = false;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${TOOLS_API_URL}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      online = res.ok;
    } catch {
      online = false;
    }

    const apiStatus = { [TOOLS_API_URL]: online };

    const offline = new Set();
    if (!online) {
      for (const name of toolNames) {
        offline.add(name);
      }
    }

    return { offline, apiStatus };
  }

  /**
   * Force a re-fetch of schemas from tools-api.
   * Useful after tools-api restarts or deploys new tools.
   * @returns {Promise<number>} Number of schemas loaded
   */
  static async refreshSchemas() {
    await fetchSchemas();
    return cachedSchemas.length;
  }

  /**
   * Check if schemas have been loaded.
   * @returns {boolean}
   */
  static isInitialized() {
    return initialized;
  }

  /**
   * Execute a tool call by name with given arguments.
   * @param {string} name - Tool function name
   * @param {object} args - Arguments for the tool
   * @returns {Promise<object>} Tool execution result
   */
  static async executeTool(name, args = {}) {
    return executeToolGeneric(name, args);
  }

  /**
   * Execute multiple tool calls in parallel.
   * @param {Array<{ name: string, args: object }>} toolCalls
   * @returns {Promise<Array<{ name: string, result: object }>>}
   */
  static async executeToolCalls(toolCalls) {
    return Promise.all(
      toolCalls.map(async (tc) => ({
        name: tc.name,
        id: tc.id,
        result: await SunService.executeTool(tc.name, tc.args),
      })),
    );
  }

  /**
   * Execute a custom user-defined tool by calling its configured endpoint.
   * @param {object} toolDef - { endpoint, method, parameters, name }
   * @param {object} args - Arguments from the AI
   * @returns {Promise<object>} JSON result
   */
  static async executeCustomTool(toolDef, args = {}) {
    try {
      const headers = { "Content-Type": "application/json" };
      if (toolDef.bearerToken) {
        headers["Authorization"] = `Bearer ${toolDef.bearerToken}`;
      }

      if (toolDef.method === "POST") {
        const res = await fetch(toolDef.endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(args),
        });
        if (!res.ok) {
          return { error: `API returned ${res.status}: ${res.statusText}` };
        }
        return await res.json();
      }

      // GET — append args as query params
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(args)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, value);
        }
      }
      const qs = params.toString();
      const url = `${toolDef.endpoint}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url, { headers });
      if (!res.ok) {
        return { error: `API returned ${res.status}: ${res.statusText}` };
      }
      return await res.json();
    } catch (err) {
      return { error: `Failed to reach API: ${err.message}` };
    }
  }
}
