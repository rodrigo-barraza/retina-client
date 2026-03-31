// API Service for communicating with Prism AI Gateway

import { PRISM_URL } from "../../config.js";

const API_BASE = PRISM_URL;

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-project": "retina",
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
    return `${API_BASE}/files/${key}`;
  }
  return ref;
}

export default class PrismService {
  /**
   * Shared fetch helper — centralises request / error handling.
   * @param {string} endpoint - URL path (e.g. "/chat?stream=false")
   * @param {object} [options]
   * @param {string} [options.method="POST"]
   * @param {object} [options.body]
   * @returns {Promise<any>}
   */
  static async _request(endpoint, { method = "POST", body } = {}) {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: getHeaders(),
      ...(body && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Prism API error: ${res.status}`);
    }

    return res.json();
  }

  /**
   * Resolve a file reference (minio:// or data URL) to a renderable URL.
   */
  static getFileUrl(ref) {
    return resolveFileRef(ref);
  }

  // ---------------------------------------------------------------------------
  // Config
  // ---------------------------------------------------------------------------

  /**
   * Fetch the Prism configuration (providers, models, defaults).
   * @returns {Promise<object>}
   */
  static async getConfig() {
    return PrismService._request("/config", { method: "GET" });
  }

  /**
   * Fetch all built-in tool schemas from Prism.
   * @returns {Promise<Array>}
   */
  static async getBuiltInToolSchemas() {
    return PrismService._request("/config/tools", { method: "GET" });
  }



  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  /**
   * List all conversations.
   * @returns {Promise<Array>}
   */
  static async getConversations() {
    return PrismService._request("/conversations", { method: "GET" });
  }

  /**
   * Get a single conversation by ID.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async getConversation(id) {
    return PrismService._request(`/conversations/${id}`, { method: "GET" });
  }

  /**
   * Delete a conversation.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async deleteConversation(id) {
    return PrismService._request(`/conversations/${id}`, { method: "DELETE" });
  }

  /**
   * Patch a conversation — update fields without generation (edit/delete messages, rename, etc.).
   * @param {string} id
   * @param {object} fields - { title?, messages?, systemPrompt?, settings? }
   * @returns {Promise<object>}
   */
  static async patchConversation(id, fields) {
    return PrismService._request(`/conversations/${id}`, {
      method: "PATCH",
      body: fields,
    });
  }

  /**
   * Get workflows that include this conversation.
   * @param {string} id - Conversation ID
   * @returns {Promise<Array<{ _id, workflowName, updatedAt }>>}
   */
  static async getConversationWorkflows(id) {
    return PrismService._request(`/conversations/${id}/workflows`, {
      method: "GET",
    });
  }

  /**
   * List conversations for a specific project.
   * @param {string} project - Project identifier (e.g. "retina-console")
   * @returns {Promise<Array>}
   */
  static async getConversationsByProject(project) {
    return PrismService._request(
      `/conversations?project=${encodeURIComponent(project)}`,
      { method: "GET" },
    );
  }

  /**
   * Get a single conversation by ID within a specific project.
   * @param {string} id
   * @param {string} project
   * @returns {Promise<object>}
   */
  static async getConversationByProject(id, project) {
    return PrismService._request(
      `/conversations/${id}?project=${encodeURIComponent(project)}`,
      { method: "GET" },
    );
  }

  /**
   * Delete a conversation within a specific project.
   * @param {string} id
   * @param {string} project
   * @returns {Promise<object>}
   */
  static async deleteConversationByProject(id, project) {
    return PrismService._request(
      `/conversations/${id}?project=${encodeURIComponent(project)}`,
      { method: "DELETE" },
    );
  }

  /**
   * Append messages to a conversation, auto-creating it if it doesn't exist.
   * @param {string} id - Conversation ID
   * @param {Array} messages - Messages to append
   * @param {string} [project] - Project identifier
   * @param {object} [conversationMeta] - Optional metadata ({ title, systemPrompt, settings })
   * @returns {Promise<object>}
   */
  static async appendMessages(id, messages, project, conversationMeta) {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";
    const body = { messages };
    if (conversationMeta) body.conversationMeta = conversationMeta;
    return PrismService._request(`/conversations/${id}/messages${qs}`, {
      body,
    });
  }

  // ---------------------------------------------------------------------------
  // Custom Tools
  // ---------------------------------------------------------------------------

  /**
   * Fetch favorites, optionally filtered by type.
   * @param {string} [type] - e.g. "model"
   * @returns {Promise<Array>}
   */
  static async getFavorites(type) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return PrismService._request(`/favorites${qs}`, { method: "GET" });
  }

  /**
   * Add a favorite.
   * @param {string} type - e.g. "model"
   * @param {string} key - unique identifier (e.g. "openai:gpt-4o")
   * @param {object} [meta] - optional metadata
   * @returns {Promise<object>}
   */
  static async addFavorite(type, key, meta) {
    return PrismService._request("/favorites", { body: { type, key, meta } });
  }

  /**
   * Remove a favorite.
   * @param {string} type
   * @param {string} key
   * @returns {Promise<object>}
   */
  static async removeFavorite(type, key) {
    return PrismService._request(
      `/favorites?type=${encodeURIComponent(type)}&key=${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
  }

  // ---------------------------------------------------------------------------
  // Custom Tools
  // ---------------------------------------------------------------------------

  /**
   * List all custom tools for a project.
   * @param {string} [project]
   * @returns {Promise<Array>}
   */
  static async getCustomTools(project) {
    const qs = project ? `?project=${encodeURIComponent(project)}` : "";
    return PrismService._request(`/custom-tools${qs}`, { method: "GET" });
  }

  /**
   * Create a new custom tool.
   * @param {object} tool
   * @returns {Promise<object>}
   */
  static async createCustomTool(tool) {
    return PrismService._request("/custom-tools", {
      method: "POST",
      body: tool,
    });
  }

  /**
   * Update an existing custom tool.
   * @param {string} id
   * @param {object} updates
   * @returns {Promise<object>}
   */
  static async updateCustomTool(id, updates) {
    return PrismService._request(`/custom-tools/${id}`, {
      method: "PUT",
      body: updates,
    });
  }

  /**
   * Delete a custom tool.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async deleteCustomTool(id) {
    return PrismService._request(`/custom-tools/${id}`, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // Chat
  // ---------------------------------------------------------------------------

  /**
   * Generate text (non-streaming).
   * @param {object} payload - { provider, model, messages, temperature?, maxTokens?, tools?, conversationId?, conversationMeta? }
   * @returns {Promise<object>}
   */
  static async generateText(payload) {
    return PrismService._request("/chat?stream=false", { body: payload });
  }

  /**
   * Stream text generation via SSE (Server-Sent Events).
   * @param {object} payload - { provider, model, messages, temperature?, maxTokens?, tools?, conversationId?, conversationMeta? }
   * @param {object} callbacks - { onChunk, onThinking, onImage(data, mimeType, minioRef), onExecutableCode, onCodeExecutionResult, onWebSearchResult, onStatus, onDone, onError }
   * @returns {Function} abort - Call to cancel the stream early
   */
  static streamText(payload, callbacks) {
    const {
      onChunk,
      onThinking,
      onImage,
      onAudio,
      onExecutableCode,
      onCodeExecutionResult,
      onWebSearchResult,
      onToolCall,
      onToolExecution,
      onStatus,
      onDone,
      onError,
    } = callbacks;

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (onError) onError(new Error(err.message || `HTTP ${res.status}`));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE lines: "data: {...}\n\n"
          const lines = buffer.split("\n");
          buffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6); // Remove "data: " prefix
            if (!json) continue;

            try {
              const data = JSON.parse(json);
              if (data.type === "chunk" && onChunk) {
                onChunk(data.content);
              } else if (data.type === "thinking" && onThinking) {
                onThinking(data.content);
              } else if (data.type === "image" && onImage) {
                onImage(data.data, data.mimeType, data.minioRef);
              } else if (data.type === "executableCode" && onExecutableCode) {
                onExecutableCode(data.code, data.language);
              } else if (
                data.type === "codeExecutionResult" &&
                onCodeExecutionResult
              ) {
                onCodeExecutionResult(data.output, data.outcome);
              } else if (data.type === "webSearchResult" && onWebSearchResult) {
                onWebSearchResult(data.results);
              } else if (data.type === "audio" && onAudio) {
                onAudio(data.data, data.mimeType);
              } else if (data.type === "toolCall" && onToolCall) {
                onToolCall({
                  id: data.id,
                  name: data.name,
                  args: data.args,
                  thoughtSignature: data.thoughtSignature,
                });
              } else if (data.type === "tool_execution" && onToolExecution) {
                onToolExecution(data);
              } else if (data.type === "status" && onStatus) {
                onStatus(data.message);
              } else if (data.type === "done" && onDone) {
                onDone(data);
              } else if (data.type === "error" && onError) {
                onError(new Error(data.message));
              }
            } catch (parseErr) {
              // Log parse errors on non-empty data lines for diagnosis
              if (json.length > 0) {
                console.warn(
                  `[PrismService] SSE JSON parse failed (${json.length} chars):`,
                  parseErr.message,
                  json.slice(0, 120),
                );
              }
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return; // Cancelled by caller
        if (onError) onError(err);
      }
    })();

    // Return abort function (same interface as the old ws.close())
    return () => controller.abort();
  }

  /**
   * Generate an image from text.
   * @param {object} payload - { provider, model, prompt, images?, systemPrompt?, conversationId?, conversationMeta? }
   * @returns {Promise<{ images: string[], text?: string }>}
   */
  static async generateImage(payload) {
    const {
      prompt,
      images,
      systemPrompt,
      conversationId,
      conversationMeta,
      ...rest
    } = payload;
    const userMessage = {
      role: "user",
      content: prompt || "",
    };

    if (images?.length > 0) {
      userMessage.images = images.map((img) => {
        if (typeof img === "string") return img;
        return `data:${img.mimeType || "image/png"};base64,${img.imageData}`;
      });
    }

    const body = {
      ...rest,
      messages: [userMessage],
    };
    if (systemPrompt) body.systemPrompt = systemPrompt;
    if (conversationId) body.conversationId = conversationId;
    if (conversationMeta) body.conversationMeta = conversationMeta;

    return PrismService._request("/chat?stream=false", { body });
  }

  /**
   * Caption / describe an image (image-to-text).
   * @param {object} payload - { provider, model, images, prompt? }
   * @returns {Promise<{ text: string }>}
   */
  static async captionImage(payload) {
    return PrismService._request("/chat?stream=false", { body: payload });
  }

  /**
   * Transcribe an audio file to text.
   * @param {object} payload - { provider, audio, mimeType?, model?, language?, prompt?, conversationId?, conversationMeta? }
   * @returns {Promise<{ text, usage?, estimatedCost?, totalTime? }>}
   */
  static async transcribeAudio(payload) {
    return PrismService._request("/audio-to-text", { body: payload });
  }

  // ---------------------------------------------------------------------------
  // Audio
  // ---------------------------------------------------------------------------

  /**
   * Generate speech from text (TTS).
   * @param {object} payload - { provider, text, voice?, model?, conversationId?, conversationMeta? }
   * @returns {Promise<{ audioDataUrl: string }>}
   */
  static async generateSpeech(payload) {
    const res = await fetch(`${API_BASE}/text-to-audio`, {
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

  // ---------------------------------------------------------------------------
  // Embeddings
  // ---------------------------------------------------------------------------

  /**
   * Generate embeddings from any modality.
   * @param {object} payload - { provider, model?, text?, images?, audio?, video?, pdf?, taskType?, dimensions? }
   * @returns {Promise<{ embedding: number[], dimensions: number, provider: string, model: string }>}
   */
  static async generateEmbedding(payload) {
    return PrismService._request("/embed", { body: payload });
  }

  // ---------------------------------------------------------------------------
  // Workflows
  // ---------------------------------------------------------------------------

  /**
   * List all saved workflows (metadata only).
   * @returns {Promise<Array>}
   */
  static async getWorkflows() {
    return PrismService._request("/workflows?source=retina", { method: "GET" });
  }

  /**
   * Get a single workflow by ID (full document).
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async getWorkflow(id) {
    return PrismService._request(`/workflows/${id}`, { method: "GET" });
  }

  /**
   * Create a new workflow.
   * @param {object} workflow - { name, nodes, connections, nodeResults?, nodeStatuses? }
   * @returns {Promise<{ success: boolean, id: string }>}
   */
  static async saveWorkflow(workflow) {
    return PrismService._request("/workflows", {
      body: { ...workflow, source: "retina" },
    });
  }

  /**
   * Update an existing workflow.
   * @param {string} id
   * @param {object} workflow - fields to update
   * @returns {Promise<{ success: boolean }>}
   */
  static async updateWorkflow(id, workflow) {
    return PrismService._request(`/workflows/${id}`, {
      method: "PUT",
      body: workflow,
    });
  }

  /**
   * Delete a workflow.
   * @param {string} id
   * @returns {Promise<{ success: boolean }>}
   */
  static async deleteWorkflow(id) {
    return PrismService._request(`/workflows/${id}`, { method: "DELETE" });
  }

  /**
   * Append conversation IDs to a workflow (generated during execution).
   * @param {string} id - Workflow ID
   * @param {string[]} conversationIds - Conversation IDs to append
   * @returns {Promise<{ success: boolean }>}
   */
  static async patchWorkflowConversations(id, conversationIds) {
    return PrismService._request(`/workflows/${id}/conversations`, {
      method: "PATCH",
      body: { conversationIds },
    });
  }

  // ---------------------------------------------------------------------------
  // Media
  // ---------------------------------------------------------------------------

  /**
   * List media items from the caller's project conversations.
   * @param {object} [params] - { page, limit, type, origin, search, provider, model }
   * @returns {Promise<{ data, total, page, limit, providers, models }>}
   */
  static async getMedia(params = {}) {
    const query = new URLSearchParams(params).toString();
    return PrismService._request(`/media${query ? `?${query}` : ""}`, {
      method: "GET",
    });
  }

  // ---------------------------------------------------------------------------
  // Text
  // ---------------------------------------------------------------------------

  /**
   * List text content from the caller's project conversations.
   * @param {object} [params] - { page, limit, origin, search, provider, model }
   * @returns {Promise<{ data, total, page, limit, providers, models }>}
   */
  static async getText(params = {}) {
    const query = new URLSearchParams(params).toString();
    return PrismService._request(`/text${query ? `?${query}` : ""}`, {
      method: "GET",
    });
  }

  // ---------------------------------------------------------------------------
  // LM Studio
  // ---------------------------------------------------------------------------

  /**
   * List all LM Studio models (loaded + downloaded).
   * @returns {Promise<{ models: Array }>}
   */
  static async getLmStudioModels() {
    return PrismService._request("/lm-studio/models", { method: "GET" });
  }

  /**
   * Load a model into LM Studio.
   * @param {string} model - model key to load
   * @returns {Promise<object>}
   */
  static async loadLmStudioModel(model) {
    return PrismService._request("/lm-studio/load", { body: { model } });
  }

  /**
   * Unload a model from LM Studio memory.
   * @param {string} instanceId - instance ID to unload
   * @returns {Promise<object>}
   */
  static async unloadLmStudioModel(instanceId) {
    return PrismService._request("/lm-studio/unload", {
      body: { instance_id: instanceId },
    });
  }
}
