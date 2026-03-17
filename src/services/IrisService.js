import { PRISM_URL, ADMIN_SECRET, PRISM_SECRET } from "../../config.js";

const API_BASE = PRISM_URL;
const SECRET = ADMIN_SECRET;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "x-admin-secret": SECRET,
        "x-project": "retina",
        "x-username": "admin",
    };
}

async function fetchJSON(path, options = {}) {
    const res = await fetch(`${API_BASE}/admin${path}`, {
        headers: getHeaders(),
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Request failed: ${res.status}`);
    }
    return res.json();
}

/**
 * Fetch a user-scoped route (behind x-api-secret) but with admin identity.
 * Used for routes like /config that don't live under /admin.
 */
async function fetchUserRouteAsAdmin(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            "Content-Type": "application/json",
            "x-api-secret": PRISM_SECRET,
            "x-project": "retina",
            "x-username": "admin",
        },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Request failed: ${res.status}`);
    }
    return res.json();
}

export default class IrisService {
    // ── Requests ──────────────────────────────────────────────
    static async getRequests(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/requests${query ? `?${query}` : ""}`);
    }

    static async getRequest(id) {
        return fetchJSON(`/requests/${id}`);
    }

    static async getRequestAssociations(id) {
        return fetchJSON(`/requests/${id}/associations`);
    }

    // ── Stats ─────────────────────────────────────────────────
    static async getStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/stats${query ? `?${query}` : ""}`);
    }

    static async getProjectStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/stats/projects${query ? `?${query}` : ""}`);
    }

    static async getModelStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/stats/models${query ? `?${query}` : ""}`);
    }

    static async getEndpointStats() {
        return fetchJSON("/stats/endpoints");
    }

    static async getTimeline(hours = 24, params = {}) {
        const allParams = { hours, ...params };
        const query = new URLSearchParams(allParams).toString();
        return fetchJSON(`/stats/timeline?${query}`);
    }

    static async getCostStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/stats/costs${query ? `?${query}` : ""}`);
    }

    // ── Conversations ─────────────────────────────────────────
    static async getConversations(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/conversations${query ? `?${query}` : ""}`);
    }

    static async getConversation(id) {
        return fetchJSON(`/conversations/${id}`);
    }

    static async getConversationWorkflows(id) {
        return fetchUserRouteAsAdmin(`/conversations/${id}/workflows`);
    }

    // ── Live ──────────────────────────────────────────────────
    static async getLiveActivity(minutes = 5) {
        return fetchJSON(`/live?minutes=${minutes}`);
    }

    // ── Health ────────────────────────────────────────────────
    static async getHealth() {
        return fetchJSON("/health");
    }

    // ── LM Studio Model Management ──────────────────────────
    static async getLmStudioModels() {
        return fetchJSON("/lm-studio/models");
    }

    static async loadLmStudioModel(model) {
        return fetchJSON("/lm-studio/load", {
            method: "POST",
            body: JSON.stringify({ model }),
        });
    }

    static async unloadLmStudioModel(instanceId) {
        return fetchJSON("/lm-studio/unload", {
            method: "POST",
            body: JSON.stringify({ instance_id: instanceId }),
        });
    }

    // ── Workflows ─────────────────────────────────────────────
    static async getWorkflows(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/workflows${query ? `?${query}` : ""}`);
    }

    static async getWorkflow(id) {
        return fetchJSON(`/workflows/${id}`);
    }

    // ── Media ─────────────────────────────────────────────────
    static async getMedia(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/media${query ? `?${query}` : ""}`);
    }

    // ── Text ──────────────────────────────────────────────────
    static async getText(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/text${query ? `?${query}` : ""}`);
    }

    // ── Config (user route, admin identity) ───────────────────
    static async getConfig() {
        return fetchUserRouteAsAdmin("/config");
    }
}
