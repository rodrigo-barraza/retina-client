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

  // ---------------------------------------------------------------------------
  // Agentic Tasks
  // ---------------------------------------------------------------------------

  static async _post(path, body) {
    const res = await fetch(`${TOOLS_API_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `tools-api error: ${res.status}`);
    }
    return res.json();
  }

  /**
   * List tasks for a project, optionally filtered by status.
   * @param {string} project
   * @param {object} [options]
   * @param {string} [options.status]
   * @param {number} [options.limit]
   * @returns {Promise<{ project, tasks, summary }>}
   */
  static async getAgenticTasks(project, { status, limit } = {}) {
    return ToolsApiService._post("/agentic/task/list", { project, status, limit });
  }

  /**
   * Create a new task.
   * @param {string} project
   * @param {object} data - { subject, description, status?, metadata? }
   * @returns {Promise<{ task, message }>}
   */
  static async createAgenticTask(project, data) {
    return ToolsApiService._post("/agentic/task/create", { project, ...data });
  }

  /**
   * Update a task.
   * @param {string} project
   * @param {number} taskId
   * @param {object} updates - { status?, subject?, description?, metadata? }
   * @returns {Promise<{ task, message }>}
   */
  static async updateAgenticTask(project, taskId, updates) {
    return ToolsApiService._post("/agentic/task/update", { project, taskId, ...updates });
  }

  /**
   * Delete a task.
   * @param {string} project
   * @param {number} taskId
   * @returns {Promise<{ deleted, taskId, message }>}
   */
  static async deleteAgenticTask(project, taskId) {
    return ToolsApiService._post("/agentic/task/delete", { project, taskId });
  }
}
