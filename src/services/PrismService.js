// API Service for communicating with Prism AI Gateway

import { PRISM_URL, PRISM_WS_URL, PRISM_SECRET } from "../../secrets.js";

const API_BASE = PRISM_URL;
const WS_BASE = PRISM_WS_URL;
const SECRET = PRISM_SECRET;

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-secret": SECRET,
    "x-project": "retina",
    "x-username": "default",
  };
}

/**
 * Resolve a file reference to a usable URL.
 * - `minio://files/abc.png` → `http://prism.clankerbox.com/files/files/abc.png?secret=...`
 * - data URLs and http URLs pass through unchanged.
 */
function resolveFileRef(ref) {
  if (typeof ref === "string" && ref.startsWith("minio://")) {
    const key = ref.replace("minio://", "");
    return `${API_BASE}/files/${key}?secret=${encodeURIComponent(SECRET)}`;
  }
  return ref;
}

export class PrismService {
  /**
   * Resolve a file reference (minio:// or data URL) to a renderable URL.
   */
  static getFileUrl(ref) {
    return resolveFileRef(ref);
  }

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

  static async saveConversation(
    id,
    title,
    messages,
    systemPrompt,
    settings,
    isGenerating,
  ) {
    const body = { id, title, messages, systemPrompt, settings };
    if (isGenerating !== undefined) body.isGenerating = isGenerating;
    const res = await fetch(`${API_BASE}/conversations`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
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

  /**
   * Stream text generation via WebSocket.
   * @param {Object} payload - { provider, model, messages, options }
   * @param {Object} callbacks - { onChunk, onThinking, onDone, onError }
   * @returns {Function} close - Call to close the WebSocket early
   */
  static streamText(payload, callbacks) {
    const {
      onChunk,
      onThinking,
      onImage,
      onExecutableCode,
      onCodeExecutionResult,
      onWebSearchResult,
      onStatus,
      onDone,
      onError,
    } = callbacks;
    const ws = new WebSocket(
      `${WS_BASE}/text-to-text/stream?secret=${encodeURIComponent(SECRET)}&project=retina&username=default`,
    );

    ws.onopen = () => {
      ws.send(JSON.stringify(payload));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chunk" && onChunk) {
          onChunk(data.content);
        } else if (data.type === "thinking" && onThinking) {
          onThinking(data.content);
        } else if (data.type === "image" && onImage) {
          onImage(data.data, data.mimeType);
        } else if (data.type === "executableCode" && onExecutableCode) {
          onExecutableCode(data.code, data.language);
        } else if (
          data.type === "codeExecutionResult" &&
          onCodeExecutionResult
        ) {
          onCodeExecutionResult(data.output, data.outcome);
        } else if (data.type === "webSearchResult" && onWebSearchResult) {
          onWebSearchResult(data.results);
        } else if (data.type === "done" && onDone) {
          onDone(data);
          ws.close();
        } else if (data.type === "error" && onError) {
          onError(new Error(data.message));
          ws.close();
        } else if (data.type === "status" && onStatus) {
          onStatus(data.message);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onerror = () => {
      if (onError) onError(new Error("WebSocket connection error"));
    };

    ws.onclose = () => {
      // Connection closed
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }

  /**
   * Transcribe an audio file to text.
   * @param {Object} payload - { provider, audio (base64 or data URL), mimeType?, model?, language?, prompt? }
   * @returns {Promise<{ text, usage?, estimatedCost?, totalTime? }>}
   */
  static async transcribeAudio(payload) {
    const res = await fetch(`${API_BASE}/audio-to-text`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Failed to transcribe audio");
    }

    return res.json();
  }

  /**
   * Generate speech from text (TTS).
   * @param {Object} payload - { provider, text, voice?, model?, options? }
   * @returns {Promise<{ audioDataUrl: string }>}
   */
  static async generateSpeech(payload) {
    const res = await fetch(`${API_BASE}/text-to-speech`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = "Failed to generate speech";
      try {
        const err = JSON.parse(text);
        message = err.message || message;
      } catch {
        /* ignore */
      }
      throw new Error(message);
    }

    const contentType = res.headers.get("content-type") || "audio/mpeg";
    const arrayBuffer = await res.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        "",
      ),
    );
    return { audioDataUrl: `data:${contentType};base64,${base64}` };
  }
}
