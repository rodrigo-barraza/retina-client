import { PRISM_URL, ADMIN_SECRET } from "../../secrets.js";

const API_BASE = PRISM_URL;
const SECRET = ADMIN_SECRET;

function getHeaders() {
    return {
        "Content-Type": "application/json",
        "x-admin-secret": SECRET,
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

export class IrisService {
    // ── Requests ──────────────────────────────────────────────
    static async getRequests(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/requests${query ? `?${query}` : ""}`);
    }

    static async getRequest(id) {
        return fetchJSON(`/requests/${id}`);
    }

    // ── Stats ─────────────────────────────────────────────────
    static async getStats(params = {}) {
        const query = new URLSearchParams(params).toString();
        return fetchJSON(`/stats${query ? `?${query}` : ""}`);
    }

    static async getProjectStats() {
        return fetchJSON("/stats/projects");
    }

    static async getModelStats() {
        return fetchJSON("/stats/models");
    }

    static async getEndpointStats() {
        return fetchJSON("/stats/endpoints");
    }

    static async getTimeline(hours = 24) {
        return fetchJSON(`/stats/timeline?hours=${hours}`);
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
}
