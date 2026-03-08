// API Service for communicating with Prism AI Gateway

const API_BASE = process.env.NEXT_PUBLIC_PRISM_URL || "http://localhost:7777";
const WS_BASE = process.env.NEXT_PUBLIC_PRISM_WS_URL || "ws://localhost:7777";
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

    static async saveConversation(id, title, messages, systemPrompt, settings) {
        const res = await fetch(`${API_BASE}/conversations`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify({ id, title, messages, systemPrompt, settings }),
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
        const { onChunk, onThinking, onImage, onExecutableCode, onCodeExecutionResult, onWebSearchResult, onDone, onError } = callbacks;
        const ws = new WebSocket(
            `${WS_BASE}/text-to-text/stream?secret=${encodeURIComponent(SECRET)}`,
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
                } else if (data.type === "codeExecutionResult" && onCodeExecutionResult) {
                    onCodeExecutionResult(data.output, data.outcome);
                } else if (data.type === "webSearchResult" && onWebSearchResult) {
                    onWebSearchResult(data.results);
                } else if (data.type === "done" && onDone) {
                    onDone(data);
                    ws.close();
                } else if (data.type === "error" && onError) {
                    onError(new Error(data.message));
                    ws.close();
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
}
