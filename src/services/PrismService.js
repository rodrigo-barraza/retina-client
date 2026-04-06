// API Service for communicating with Prism AI Gateway

import { PRISM_URL, PROJECT_NAME } from "../../config.js";

const API_BASE = PRISM_URL;

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-project": PROJECT_NAME,
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
   * Fetch local/self-hosted provider models (LM Studio, vLLM, Ollama).
   * Returns { models: { [provider]: [...] } } to merge into the main config.
   * @returns {Promise<{ models: object }>}
   */
  static async getLocalConfig() {
    return PrismService._request("/config-local", { method: "GET" });
  }

  /**
   * Merge local provider models into an existing config object (immutable).
   * Returns a new config with local models merged into textToText.models.
   * @param {object} config - The base config from getConfig()
   * @param {object} localModels - { [provider]: [...models] } from getLocalConfig()
   * @returns {object} Updated config
   */
  static mergeLocalModels(config, localModels) {
    if (!config || !localModels || Object.keys(localModels).length === 0) {
      return config;
    }
    const updated = { ...config };
    const textToText = { ...updated.textToText };
    const existingModels = { ...textToText.models };
    for (const [provider, providerModels] of Object.entries(localModels)) {
      const existing = existingModels[provider] || [];
      const existingKeys = new Set(existing.map((m) => m.name));
      const merged = [...existing];
      for (const m of providerModels) {
        if (!existingKeys.has(m.name)) merged.push(m);
      }
      existingModels[provider] = merged;
    }
    textToText.models = existingModels;
    updated.textToText = textToText;
    return updated;
  }

  /**
   * Progressive config loading: fetches cloud config immediately, then
   * lazily fetches local provider models and calls onLocalMerge with the
   * updated config when they arrive.
   *
   * @param {object} options
   * @param {Function} options.onConfig - Called immediately with cloud-only config
   * @param {Function} options.onLocalMerge - Called when local models arrive, with merged config
   * @param {typeof PrismService} [options.service] - Service to use (PrismService or IrisService)
   * @returns {Promise<object>} The initial cloud config
   */
  static async getConfigWithLocalModels({ onConfig, onLocalMerge, service } = {}) {
    const svc = service || PrismService;
    const config = await svc.getConfig();

    if (onConfig) onConfig(config);

    // Fire-and-forget local model fetch
    if (config?.localProviders?.length > 0) {
      svc.getLocalConfig()
        .then(({ models }) => {
          const merged = PrismService.mergeLocalModels(config, models);
          if (merged !== config && onLocalMerge) onLocalMerge(merged);
        })
        .catch(() => {}); // Local providers are optional
    }

    return config;
  }

  /**
   * Fetch all built-in tool schemas from Prism.
   * @returns {Promise<Array>}
   */
  static async getBuiltInToolSchemas() {
    return PrismService._request("/config/tools", { method: "GET" });
  }

  /**
   * Trigger Prism to re-fetch tool schemas from tools-api.
   * @returns {Promise<{ ok: boolean, count: number }>}
   */
  static async refreshBuiltInToolSchemas() {
    return PrismService._request("/config/tools/refresh", { method: "POST" });
  }



  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  /**
   * Fetch per-model usage stats for the current user.
   * @returns {Promise<Array<{ model, provider, totalRequests }>>}
   */
  static async getModelStats() {
    return PrismService._request("/stats/models", { method: "GET" });
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
      onToolOutput,
      onApprovalRequired,
      onPlanProposal,
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
                  result: data.result,
                  status: data.status,
                  thoughtSignature: data.thoughtSignature,
                });
              } else if (data.type === "tool_execution" && onToolExecution) {
                onToolExecution(data);
              } else if (data.type === "tool_output" && onToolOutput) {
                onToolOutput(data);
              } else if (data.type === "approval_required" && onApprovalRequired) {
                onApprovalRequired(data);
              } else if (data.type === "plan_proposal" && onPlanProposal) {
                onPlanProposal(data);
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
   * Load a model into LM Studio with optional configuration.
   * @param {string} model - model key to load
   * @param {object} [options] - load config { contextLength, flashAttention, offloadKvCache }
   * @returns {Promise<object>}
   */
  static async loadLmStudioModel(model, options = {}) {
    const body = { model };
    if (options.contextLength != null) body.context_length = options.contextLength;
    if (options.flashAttention != null) body.flash_attention = options.flashAttention;
    if (options.offloadKvCache != null) body.offload_kv_cache_to_gpu = options.offloadKvCache;
    return PrismService._request("/lm-studio/load", { body });
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

  /**
   * Estimate VRAM usage for an LM Studio model.
   * @param {string} model — model key/path
   * @param {object} config — { contextLength, gpuLayers, flashAttention, offloadKvCache }
   * @returns {Promise<{ gpuGiB: number, totalGiB: number, archParams: object, totalLayers: number }>}
   */
  static async estimateLmStudioMemory(model, config = {}) {
    return PrismService._request("/lm-studio/estimate", {
      body: { model, ...config },
    });
  }

  /**
   * Load an LM Studio model with streaming progress via SSE.
   * @param {string} model — model key/path
   * @param {object} options — { contextLength, flashAttention, offloadKvCache }
   * @param {object} callbacks — { onProgress(0-1), onComplete(), onError(err) }
   * @returns {Function} abort — call to cancel
   */
  static loadLmStudioModelStream(model, options = {}, callbacks = {}) {
    const { onProgress, onComplete, onError } = callbacks;
    const controller = new AbortController();

    const body = { model };
    if (options.contextLength != null) body.context_length = options.contextLength;
    if (options.flashAttention != null) body.flash_attention = options.flashAttention;
    if (options.offloadKvCache != null) body.offload_kv_cache_to_gpu = options.offloadKvCache;

    (async () => {
      // Client-side synthetic progress (asymptotic: approaches 95% over ~15s)
      const EXPECTED_LOAD_MS = 15_000;
      const startTime = Date.now();
      let lastPct = 0;
      const progressInterval = setInterval(() => {
        if (controller.signal.aborted) { clearInterval(progressInterval); return; }
        const elapsed = Date.now() - startTime;
        const pct = Math.min(0.95, elapsed / (elapsed + EXPECTED_LOAD_MS));
        if (pct > lastPct + 0.005) {
          lastPct = pct;
          if (onProgress) onProgress(pct);
        }
      }, 300);

      try {
        if (onProgress) onProgress(0);

        const res = await fetch(`${API_BASE}/lm-studio/load`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearInterval(progressInterval);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          if (onError) onError(new Error(err.message || `HTTP ${res.status}`));
          return;
        }

        if (onProgress) onProgress(1);
        if (onComplete) onComplete();
      } catch (err) {
        clearInterval(progressInterval);
        if (err.name === "AbortError") return;
        if (onError) onError(err);
      }
    })();

    return () => controller.abort();
  }

  // ---------------------------------------------------------------------------
  // Benchmarks
  // ---------------------------------------------------------------------------

  /**
   * List all benchmark tests.
   * @returns {Promise<{ benchmarks: Array, count: number }>}
   */
  static async getBenchmarks() {
    return PrismService._request("/benchmark", { method: "GET" });
  }

  /**
   * Get aggregated model performance stats across all benchmark runs.
   * @returns {Promise<{ models: Array, totalModels: number, totalBenchmarks: number }>}
   */
  static async getBenchmarkStats() {
    return PrismService._request("/benchmark/stats", { method: "GET" });
  }

  /**
   * Get available conversation models for benchmarking.
   * @returns {Promise<{ models: Array, count: number }>}
   */
  static async getBenchmarkModels() {
    return PrismService._request("/benchmark/models", { method: "GET" });
  }

  /**
   * Create a new benchmark test.
   * @param {object} data - { name, prompt, systemPrompt?, expectedValue, matchMode?, temperature?, maxTokens?, tags?, assertions?, assertionOperator? }
   * @returns {Promise<object>}
   */
  static async createBenchmark(data) {
    return PrismService._request("/benchmark", { body: data });
  }

  /**
   * Get a single benchmark test with its latest run.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async getBenchmark(id) {
    return PrismService._request(`/benchmark/${id}`, { method: "GET" });
  }


  /**
   * Delete a benchmark test and all its runs.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async deleteBenchmark(id) {
    return PrismService._request(`/benchmark/${id}`, { method: "DELETE" });
  }

  /**
   * Run a benchmark against selected models (or all).
   * @param {string} id - Benchmark ID
   * @param {Array} [models] - Optional array of { provider, model } to test
   * @returns {Promise<object>} The run result
   */
  static async runBenchmark(id, models) {
    return PrismService._request(`/benchmark/${id}/run`, {
      body: models ? { models } : {},
    });
  }

  /**
   * Stream a benchmark run via SSE, receiving per-model progress events.
   * @param {string} id - Benchmark ID
   * @param {Array}  [models] - Optional array of { provider, model }
   * @param {object} callbacks - { onModelStart, onModelComplete, onRunComplete, onError }
   * @returns {Function} abort — call to cancel the stream
   */
  static streamBenchmarkRun(id, models, callbacks = {}) {
    const { onRunInfo, onModelStart, onModelComplete, onRunComplete, onError } = callbacks;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/benchmark/${id}/run`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify(models ? { models } : {}),
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
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            if (!json) continue;

            try {
              const data = JSON.parse(json);
              if (data.type === "run_info" && onRunInfo) {
                onRunInfo(data);
              } else if (data.type === "model_start" && onModelStart) {
                onModelStart(data);
              } else if (data.type === "model_complete" && onModelComplete) {
                onModelComplete(data);
              } else if (data.type === "run_complete" && onRunComplete) {
                onRunComplete(data);
              } else if (data.type === "error" && onError) {
                onError(new Error(data.message));
              }
            } catch (parseErr) {
              if (json.length > 0) {
                console.warn(
                  `[PrismService] Benchmark SSE parse failed:`,
                  parseErr.message,
                );
              }
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (onError) onError(err);
      }
    })();

    return () => controller.abort();
  }

  /**
   * Get all past runs for a benchmark.
   * @param {string} id - Benchmark ID
   * @returns {Promise<{ runs: Array, count: number }>}
   */
  static async getBenchmarkRuns(id) {
    return PrismService._request(`/benchmark/${id}/runs`, { method: "GET" });
  }

  /**
   * Re-run a specific past run with the same model set.
   * @param {string} benchmarkId
   * @param {string} runId
   * @returns {Promise<object>}
   */
  static async rerunBenchmark(benchmarkId, runId) {
    return PrismService._request(
      `/benchmark/${benchmarkId}/runs/${runId}/rerun`,
      { body: {} },
    );
  }

  /**
   * Explicitly abort a running benchmark.
   * @param {string} benchmarkId
   * @returns {Promise<{ aborted: boolean }>}
   */
  static async abortBenchmarkRun(benchmarkId) {
    return PrismService._request(`/benchmark/${benchmarkId}/abort`, {
      body: {},
    });
  }

  /**
   * Fetch all benchmark IDs that currently have active (in-progress) runs.
   * @returns {Promise<{ activeIds: string[] }>}
   */
  static async getActiveBenchmarks() {
    return PrismService._request("/benchmark/active-list", { method: "GET" });
  }

  /**
   * Check if a benchmark has an active (in-progress) run.
   * @param {string} id - Benchmark ID
   * @returns {Promise<{ active: boolean, completedResults?, activeModel?, startedAt? }>}
   */
  static async getBenchmarkActive(id) {
    return PrismService._request(`/benchmark/${id}/active`, { method: "GET" });
  }

  /**
   * Follow an in-progress benchmark run via SSE.
   * Replays completed results first, then streams live events.
   * @param {string} id - Benchmark ID
   * @param {object} callbacks - { onModelStart, onModelComplete, onRunComplete, onError }
   * @returns {Function} abort — call to disconnect
   */
  static followBenchmarkRun(id, callbacks = {}) {
    const { onRunInfo, onModelStart, onModelComplete, onRunComplete, onError } = callbacks;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/benchmark/${id}/follow`, {
          method: "GET",
          headers: getHeaders(),
          signal: controller.signal,
        });

        if (!res.ok) {
          // No active run or server error
          if (onError) onError(new Error(`HTTP ${res.status}`));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6);
            if (!json) continue;

            try {
              const data = JSON.parse(json);
              if (data.type === "run_info" && onRunInfo) {
                onRunInfo(data);
              } else if (data.type === "model_start" && onModelStart) {
                onModelStart(data);
              } else if (data.type === "model_complete" && onModelComplete) {
                onModelComplete(data);
              } else if (data.type === "run_complete" && onRunComplete) {
                onRunComplete(data);
              } else if (data.type === "error" && onError) {
                onError(new Error(data.message));
              }
            } catch (parseErr) {
              if (json.length > 0) {
                console.warn(
                  `[PrismService] Benchmark follow SSE parse failed:`,
                  parseErr.message,
                );
              }
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError") return;
        if (onError) onError(err);
      }
    })();

    return () => controller.abort();
  }

  // ---------------------------------------------------------------------------
  // Synthesis
  // ---------------------------------------------------------------------------

  /**
   * List all synthesis runs for the current project.
   * @returns {Promise<Array>}
   */
  static async getSynthesisRuns() {
    return PrismService._request("/synthesis", { method: "GET" });
  }

  /**
   * Get a single synthesis run by ID.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async getSynthesisRun(id) {
    return PrismService._request(`/synthesis/${id}`, { method: "GET" });
  }

  /**
   * Create a new synthesis run.
   * @param {object} data - { id, title, systemPrompt, assistantPersona, userPersona, category, targetTurns, seedMessages, settings, conversationId }
   * @returns {Promise<object>}
   */
  static async createSynthesisRun(data) {
    return PrismService._request("/synthesis", { body: data });
  }

  /**
   * Delete a synthesis run.
   * @param {string} id
   * @returns {Promise<object>}
   */
  static async deleteSynthesisRun(id) {
    return PrismService._request(`/synthesis/${id}`, { method: "DELETE" });
  }

  // ---------------------------------------------------------------------------
  // VRAM Benchmarks
  // ---------------------------------------------------------------------------

  /**
   * Fetch VRAM benchmark entries with optional filters.
   * @param {object} [params] - { settings, hostname, ctx, provider, limit }
   * @returns {Promise<{ count: number, data: Array }>}
   */
  static async getVramBenchmarks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return PrismService._request(
      `/vram-benchmarks${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
  }

  /**
   * Fetch distinct machines that have run VRAM benchmarks.
   * @returns {Promise<Array<{ hostname, gpu, gpuVramGB, gpuVendor, cpu, ramGiB, platform, benchmarkCount, lastRun }>>}
   */
  static async getVramBenchmarkMachines() {
    return PrismService._request("/vram-benchmarks/machines", {
      method: "GET",
    });
  }

  /**
   * Fetch distinct settings labels available in benchmark data.
   * @returns {Promise<string[]>}
   */
  static async getVramBenchmarkSettings() {
    return PrismService._request("/vram-benchmarks/settings", {
      method: "GET",
    });
  }

  /**
   * Fetch distinct context lengths available in benchmark data.
   * @param {object} [params] - { settings }
   * @returns {Promise<number[]>}
   */
  static async getVramBenchmarkContexts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return PrismService._request(
      `/vram-benchmarks/contexts${query ? `?${query}` : ""}`,
      { method: "GET" },
    );
  }
}
