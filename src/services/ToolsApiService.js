import { TOOLS_API_URL } from "../../config.js";

/**
 * ToolsApiService — client-side service for querying the
 * tools-api admin endpoints (tool-call telemetry).
 */
export default class ToolsApiService {
  static async _fetch(path) {
    const res = await fetch(`${TOOLS_API_URL}${path}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `tools-api error: ${res.status}`);
    }
    return res.json();
  }

  /**
   * Query tool-call logs with optional filters.
   * @param {object} params - Query parameters
   * @returns {Promise<{ total, count, toolCalls }>}
   */
  static async getToolCalls(params = {}) {
    const query = new URLSearchParams(params).toString();
    return ToolsApiService._fetch(`/admin/tool-calls${query ? `?${query}` : ""}`);
  }

  /**
   * Get aggregated tool-call statistics.
   * @param {object} params - { since }
   * @returns {Promise<object>}
   */
  static async getToolCallStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return ToolsApiService._fetch(`/admin/tool-calls/stats${query ? `?${query}` : ""}`);
  }
}
