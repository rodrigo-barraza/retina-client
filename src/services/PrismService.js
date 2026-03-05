// API Service for communicating with Prism AI Gateway

const API_BASE = process.env.NEXT_PUBLIC_PRISM_URL || "http://localhost:7777";
const SECRET = process.env.NEXT_PUBLIC_PRISM_SECRET || "banana";

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-secret": SECRET,
  };
}

export class PrismService {
  static async getConfig() {
    const res = await fetch(`${API_BASE}/config`, { headers: getHeaders() });
    if (!res.ok) throw new Error("Failed to fetch config");
    return res.json();
  }

  static async getConversations() {
    const res = await fetch(`${API_BASE}/conversations`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch conversations");
    return res.json();
  }

  static async getConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to fetch conversation");
    return res.json();
  }

  static async saveConversation(id, title, messages) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ id, title, messages }),
    });
    if (!res.ok) throw new Error("Failed to save conversation");
    return res.json();
  }

  static async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error("Failed to delete conversation");
    return res.json();
  }

  static async generateText(payload) {
    const res = await fetch(`${API_BASE}/text-to-text`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to generate text");
    }

    return res.json();
  }
}
