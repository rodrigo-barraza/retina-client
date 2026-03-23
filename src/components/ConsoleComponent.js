"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send,
  Loader2,
  Terminal,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Zap,
  Paperclip,
  X,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import SunService from "../services/SunService.js";
import ThreePanelLayout from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import MessageList, { prepareDisplayMessages } from "./MessageList.js";
import ImagePreviewComponent from "./ImagePreviewComponent.js";
import { ALL_CONSOLE_PROMPTS } from "../arrays.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./ConsoleComponent.module.css";
import ChatInputButton from "./ChatInputButton.js";

const MAX_TOOL_ITERATIONS = 25;

/**
 * Truncate a tool result to avoid blowing up the model's context window.
 * Caps arrays at 10 items and the serialized JSON at ~8 000 chars.
 * The full result is still stored in the DB and shown in the UI;
 * this only affects what gets re-sent to the model.
 */
function truncateToolResult(result, maxChars = 8000) {
    if (!result || typeof result !== "object") return result;

    // If result has a known array wrapper, cap items at 10
    const trimmed = { ...result };
    const ARRAY_KEYS = ["events", "products", "trends", "articles", "earnings", "predictions", "commodities"];
    for (const key of ARRAY_KEYS) {
        if (Array.isArray(trimmed[key]) && trimmed[key].length > 10) {
            const total = trimmed[key].length;
            trimmed[key] = trimmed[key].slice(0, 10);
            trimmed[`_${key}Truncated`] = `Showing 10 of ${total}`;
        }
    }

    // Also handle top-level arrays (e.g. tides, earthquakes)
    if (Array.isArray(result) && result.length > 10) {
        const sliced = result.slice(0, 10);
        sliced.push({ _truncated: `Showing 10 of ${result.length}` });
        const str = JSON.stringify(sliced);
        return str.length > maxChars ? str.slice(0, maxChars) + '…}' : sliced;
    }

    const str = JSON.stringify(trimmed);
    if (str.length <= maxChars) return trimmed;
    return str.slice(0, maxChars) + '…}';
}
const PROJECT = "retina-console";

const SYSTEM_PROMPT = `You are Sun Console — an intelligent assistant with access to real-time data APIs. You have tools for weather, air quality, earthquakes, solar activity, aurora forecasts, sunrise/sunset times, tides, wildfires, ISS tracking, local events, commodity/market prices, trending topics, and product search.

Guidelines:
- When asked about weather, events, prices, trends, or similar data, ALWAYS use the appropriate tool to fetch real-time data. Never guess or make up data.
- You may call multiple tools in a single response if the question requires data from multiple sources.
- Present data clearly with relevant formatting — use tables, bullet points, and emojis where appropriate.
- When data includes numbers, format them appropriately (currencies, percentages, temperatures).
- If a tool returns an error, inform the user and suggest alternatives.
- Be conversational and helpful, not just a data dump.
- For questions that don't require API data, respond naturally without tool calls.
- The current local date/time is: ${new Date().toLocaleString()}`;

export default function ConsoleComponent() {
  // ── State ────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolActivity, setToolActivity] = useState([]);
  const [showToolPanel, setShowToolPanel] = useState(false);
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("Console");
  const [leftTab, setLeftTab] = useState("settings"); // "settings" | "tools"
  const [customTools, setCustomTools] = useState([]);
  const [disabledBuiltIns, setDisabledBuiltIns] = useState(new Set());
  const [offlineTools, setOfflineTools] = useState(
    () => new Set(SunService.getToolSchemas().map((t) => t.name)),
  );

  const [settings, setSettings] = useState({
    provider: "google",
    model: "gemini-3-flash-preview",
    systemPrompt: SYSTEM_PROMPT,
    temperature: 1.0,
    maxTokens: 8192,
    topP: 1,
    topK: 0,
    frequencyPenalty: 0,
    presencePenalty: 0,
    stopSequences: "",
    thinkingEnabled: false,
    reasoningEffort: "high",
    thinkingLevel: "high",
    thinkingBudget: "",
    webSearchEnabled: false,
    verbosity: "",
    reasoningSummary: "",
  });

  const [pendingImages, setPendingImages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Filtered config: only function-calling models ────────────
  const filteredConfig = useMemo(() => {
    if (!config) return null;
    const textModelsMap = config.textToText?.models || {};
    const filteredTextModels = {};

    for (const [provider, models] of Object.entries(textModelsMap)) {
      const fcModels = models.filter(
        (m) => m.tools?.includes("Function Calling"),
      );
      if (fcModels.length > 0) filteredTextModels[provider] = fcModels;
    }

    // Only include providers that have FC models
    const filteredProviderList = (config.providerList || []).filter(
      (p) => filteredTextModels[p],
    );

    return {
      ...config,
      providerList: filteredProviderList,
      textToText: {
        ...config.textToText,
        models: filteredTextModels,
      },
      // Strip non-text model maps so SettingsPanel only shows FC text models
      textToImage: { models: {} },
      textToSpeech: { models: {}, voices: {}, defaultVoices: {} },
      audioToText: { models: {} },
    };
  }, [config]);

  // ── Model capability detection ──────────────────────────────
  const supportsImageInput = useMemo(() => {
    if (!filteredConfig) return false;
    const models = filteredConfig.textToText?.models?.[settings.provider] || [];
    const modelDef = models.find((m) => m.name === settings.model);
    return modelDef?.inputTypes?.includes("image") ?? false;
  }, [filteredConfig, settings.provider, settings.model]);

  // ── Effects ──────────────────────────────────────────────────

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [inputValue]);

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Fetch Prism config
  useEffect(() => {
    PrismService.getConfig().then(setConfig).catch(console.error);
  }, []);

  // Load conversation history
  const loadConversations = useCallback(async () => {
    try {
      const convs = await PrismService.getConversationsByProject(PROJECT);
      setConversations(convs);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load custom tools
  const loadCustomTools = useCallback(async () => {
    try {
      const tools = await PrismService.getCustomTools(PROJECT);
      setCustomTools(tools);
    } catch (err) {
      console.error("Failed to load custom tools:", err);
    }
  }, []);

  useEffect(() => {
    loadCustomTools();
  }, [loadCustomTools]);

  // Check API health on mount
  useEffect(() => {
    SunService.checkApiHealth()
      .then(({ offline }) => setOfflineTools(offline))
      .catch(console.error);
  }, []);

  // Merge enabled built-in + enabled custom tool schemas
  const allToolSchemas = useMemo(() => {
    const builtIn = SunService.getToolSchemas().filter(
      (t) => !disabledBuiltIns.has(t.name) && !offlineTools.has(t.name),
    );

    // Google's function calling API requires names to be alphanumeric + _ . : -
    // starting with a letter or underscore, max 128 chars.
    const sanitizeName = (name) =>
      name
        .replace(/[^a-zA-Z0-9_.:/-]/g, "_")
        .replace(/^[^a-zA-Z_]/, "_$&")
        .slice(0, 128);

    const custom = customTools
      .filter((t) => t.enabled)
      .map((t) => ({
        name: sanitizeName(t.name),
        description: t.description,
        parameters: {
          type: "object",
          properties: Object.fromEntries(
            (t.parameters || []).map((p) => [
              p.name,
              {
                type: p.type || "string",
                description: p.description || "",
                ...(p.enum?.length ? { enum: p.enum } : {}),
              },
            ]),
          ),
          required: (t.parameters || [])
            .filter((p) => p.required)
            .map((p) => p.name),
        },
      }));
    return [...builtIn, ...custom];
  }, [customTools, disabledBuiltIns, offlineTools]);

  // Build a lookup for custom tools by sanitized name for execution
  const customToolMap = useMemo(() => {
    const sanitizeName = (name) =>
      name
        .replace(/[^a-zA-Z0-9_.:/-]/g, "_")
        .replace(/^[^a-zA-Z_]/, "_$&")
        .slice(0, 128);
    const map = new Map();
    for (const t of customTools) {
      if (t.enabled) map.set(sanitizeName(t.name), t);
    }
    return map;
  }, [customTools]);

  // Pick 5 random prompt suggestions — re-shuffles on new chat (client-only to avoid hydration mismatch)
  const [randomPrompts, setRandomPrompts] = useState([]);

  useEffect(() => {
    const pool = [...ALL_CONSOLE_PROMPTS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setRandomPrompts(pool.slice(0, 5));
  }, [conversationId]);

  // ── Image handlers ──────────────────────────────────────────
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const removeImage = useCallback((index) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (supportsImageInput && e.dataTransfer?.items?.length > 0) {
      setIsDragging(true);
    }
  }, [supportsImageInput]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (!supportsImageInput) return;
    const files = Array.from(e.dataTransfer?.files || []);
    const images = files.filter((f) => f.type.startsWith("image/"));
    for (const file of images) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
  }, [supportsImageInput]);

  const handlePaste = useCallback((e) => {
    if (!supportsImageInput) return;
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
  }, [supportsImageInput]);

  // ── Orchestration loop ───────────────────────────────────────
  const runOrchestrationLoop = useCallback(
    async (conversationMessages, resolvedTitle) => {
      const currentMessages = [...conversationMessages];
      let iterations = 0;
      // For local providers: after the first tool round, omit tools to force text
      let hasCalledTools = false;

      while (iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        let streamedText = "";
        const pendingToolCalls = [];

        // Clean up any stale empty assistant placeholders
        setMessages((prev) =>
          prev.filter((m) => !(m.role === "assistant" && !m.content?.trim())),
        );

        await new Promise((resolve, reject) => {
          const payload = {
            provider: settings.provider,
            model: settings.model,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...currentMessages.flatMap((m) => {
                // Expand assistant messages with toolCalls into
                // [assistant(tool_calls), tool(result1), tool(result2), ...]
                // per the OpenAI Chat Completions spec
                if (m.role === "assistant" && m.toolCalls?.length > 0) {
                  const assistantMsg = {
                    role: "assistant",
                    content: m.content?.trim() || null,
                    toolCalls: m.toolCalls.map((tc) => ({
                      id: tc.id,
                      name: tc.name,
                      args: tc.args,
                      ...(tc.thoughtSignature ? { thoughtSignature: tc.thoughtSignature } : {}),
                    })),
                  };
                  const toolMsgs = m.toolCalls
                    .filter((tc) => tc.result !== undefined)
                    .map((tc) => ({
                      role: "tool",
                      name: tc.name,
                      tool_call_id: tc.id,
                      content: typeof tc.result === "string" ? tc.result : JSON.stringify(truncateToolResult(tc.result)),
                    }));
                  return [assistantMsg, ...toolMsgs];
                }
                if (m.role === "tool") {
                  return [{ role: "tool", tool_call_id: m.tool_call_id, name: m.name, content: m.content }];
                }
                return [{
                  role: m.role,
                  content: m.content,
                  ...(m.images?.length > 0 ? { images: m.images } : {}),
                }];
              }),
            ],
            // Local models (LM Studio, Ollama) should stop receiving tools
            // after their first tool round to force a text response.
            // Cloud providers handle multi-step tool calling natively.
            ...((settings.provider === "lm-studio" || settings.provider === "ollama")
              ? (!hasCalledTools ? { tools: allToolSchemas } : {})
              : { tools: allToolSchemas }),
            maxTokens: settings.maxTokens,
            conversationId,
          };

          // Only send meta on the first iteration
          // (subsequent iterations are tool-result follow-ups)
          if (iterations === 1) {
            payload.conversationMeta = {
              title: resolvedTitle,
              systemPrompt: SYSTEM_PROMPT,
            };
          }

          abortRef.current = PrismService.streamText(payload, {
            onChunk: (content) => {
              streamedText += content;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg?.role === "assistant") {
                  lastMsg.content = streamedText;
                } else {
                  updated.push({ role: "assistant", content: streamedText });
                }
                return updated;
              });
            },
            onToolCall: (toolCall) => {
              pendingToolCalls.push(toolCall);
              setToolActivity((prev) => [
                ...prev,
                {
                  id: toolCall.id || `tc-${Date.now()}-${Math.random()}`,
                  name: toolCall.name,
                  args: toolCall.args,
                  status: "calling",
                  timestamp: Date.now(),
                },
              ]);
              setShowToolPanel(true);
            },
            onDone: () => resolve(),
            onError: (err) => reject(err),
            onThinking: () => {},
          });
        });

        if (pendingToolCalls.length > 0) {
          const results = await Promise.all(
            pendingToolCalls.map(async (tc) => {
              const customDef = customToolMap.get(tc.name);
              if (customDef) {
                return {
                  name: tc.name,
                  id: tc.id,
                  result: await SunService.executeCustomTool(customDef, tc.args),
                };
              }
              return {
                name: tc.name,
                id: tc.id,
                result: await SunService.executeTool(tc.name, tc.args),
              };
            }),
          );

          setToolActivity((prev) =>
            prev.map((activity) => {
              const result = results.find(
                (r) =>
                  (r.id && r.id === activity.id) ||
                  (!r.id && r.name === activity.name && activity.status === "calling"),
              );
              if (result) {
                return {
                  ...activity,
                  status: result.result?.error ? "error" : "done",
                  result: result.result,
                };
              }
              return activity;
            }),
          );

          // Persist tool result messages to the conversation
          const toolResultMessages = results.map((result) => ({
            role: "tool",
            name: result.name,
            tool_call_id: result.id,
            content: JSON.stringify(result.result),
            timestamp: new Date().toISOString(),
          }));
          PrismService.appendMessages(conversationId, toolResultMessages, PROJECT).catch((err) =>
            console.error("Failed to append tool results:", err),
          );

          const assistantMsg = {
            role: "assistant",
            content: streamedText || "",
            toolCalls: pendingToolCalls.map((tc) => {
              const match = results.find((r) => r.id === tc.id);
              return {
                id: tc.id || null,
                name: tc.name,
                args: tc.args,
                thoughtSignature: tc.thoughtSignature || undefined,
                result: match ? match.result : null,
              };
            }),
          };
          currentMessages.push(assistantMsg);

          for (const result of results) {
            currentMessages.push({
              role: "tool",
              name: result.name,
              content: JSON.stringify(truncateToolResult(result.result)),
            });
          }

          hasCalledTools = true;

          streamedText = "";
          setMessages((prev) =>
            prev.filter((m) => !(m.role === "assistant" && !m.content?.trim())),
          );
          continue;
        }

        if (streamedText) {
          currentMessages.push({ role: "assistant", content: streamedText });
          break;
        }
      }

      return currentMessages;
    },
    [settings.provider, settings.model, settings.maxTokens, conversationId, allToolSchemas, customToolMap],
  );

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      const text = inputValue.trim();
      if ((!text && pendingImages.length === 0) || isGenerating) return;

      const currentImages = [...pendingImages];
      setInputValue("");
      setPendingImages([]);
      setIsGenerating(true);
      setToolActivity([]);

      // Auto-generate title from first message
      let resolvedTitle = title;
      if (messages.length === 0) {
        const titleText = text || "Image conversation";
        resolvedTitle = titleText.length > 60 ? titleText.slice(0, 57) + "..." : titleText;
        setTitle(resolvedTitle);
      }

      const userMessage = {
        role: "user",
        content: text,
        ...(currentImages.length > 0 ? { images: currentImages } : {}),
      };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        const finalMessages = await runOrchestrationLoop(updatedMessages, resolvedTitle);
        setMessages(
          finalMessages.filter(
            (m) =>
              m.role !== "tool" &&
              m.role !== "system" &&
              !(m.role === "assistant" && !m.content?.trim() && !m.toolCalls?.length),
          ),
        );
        loadConversations();
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error: ${err.message}`,
            isError: true,
          },
        ]);
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [inputValue, pendingImages, isGenerating, messages, title, runOrchestrationLoop, loadConversations],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Conversation management ──────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    setMessages([]);
    setToolActivity([]);
    setShowToolPanel(false);
    setPendingImages([]);
    setConversationId(crypto.randomUUID());
    setActiveId(null);
    setTitle("Console");
    textareaRef.current?.focus();
  }, [isGenerating]);

  const handleSelectConversation = useCallback(
    async (conv) => {
      if (isGenerating) return;
      try {
        const full = await PrismService.getConversationByProject(conv.id, PROJECT);
        const displayMessages = prepareDisplayMessages(full.messages || []);
        setMessages(displayMessages);
        setConversationId(conv.id);
        setActiveId(conv.id);
        setTitle(full.title || "Console");
        setToolActivity([]);
        setShowToolPanel(false);
      } catch (err) {
        console.error("Failed to load conversation:", err);
      }
    },
    [isGenerating],
  );

  const handleDeleteConversation = useCallback(
    async (convId) => {
      try {
        await PrismService.deleteConversationByProject(convId, PROJECT);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeId === convId) {
          handleNewChat();
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [activeId, handleNewChat],
  );

  // ── Render helpers ──────────────────────────────────────────

  function renderToolName(name) {
    return name
      .replace(/^get_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Left sidebar: tab bar + content ──────────────────────────
  const handleToggleBuiltIn = useCallback((toolName) => {
    setDisabledBuiltIns((prev) => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  }, []);

  const leftPanel = (
    <>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${leftTab === "settings" ? styles.tabActive : ""}`}
          onClick={() => setLeftTab("settings")}
        >
          Settings
        </button>
        <button
          className={`${styles.tab} ${leftTab === "tools" ? styles.tabActive : ""}`}
          onClick={() => setLeftTab("tools")}
        >
          Tools
          <span className={styles.tabBadge}>{allToolSchemas.length}</span>
        </button>
      </div>

      {leftTab === "settings" && (
        <SettingsPanel
          config={filteredConfig}
          settings={settings}
          onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
          hasAssistantImages={false}
        />
      )}

      {leftTab === "tools" && (
        <CustomToolsPanel
          tools={customTools}
          onToolsChange={loadCustomTools}
          builtInTools={SunService.getToolSchemas()}
          disabledBuiltIns={disabledBuiltIns}
          onToggleBuiltIn={handleToggleBuiltIn}
          offlineTools={offlineTools}
        />
      )}
    </>
  );

  // ── Center: chat area ───────────────────────────────────────
  const chatContent = (
    <div className={chatStyles.container}>
      {/* Messages */}
      <div className={chatStyles.messagesList}>
        {messages.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Terminal size={40} />
            </div>
            <h2 className={styles.emptyTitle}>Console</h2>
            <p className={styles.emptySubtitle}>
              Ask about weather, events, commodities, trends, or anything
              powered by the Sun ecosystem.
            </p>
            <div className={styles.quickPrompts}>
              {randomPrompts.map((prompt) => (
                <button
                  key={prompt}
                  className={styles.quickPrompt}
                  onClick={() => {
                    setInputValue(prompt);
                    textareaRef.current?.focus();
                  }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <MessageList
          messages={messages.filter(
            (m) => m.role === "user" || m.role === "assistant",
          )}
          isGenerating={isGenerating}
        />

        <div ref={endRef} />
      </div>

      {/* Tool Activity Panel */}
      {toolActivity.length > 0 && (
        <div className={styles.toolPanel}>
          <button
            className={styles.toolPanelHeader}
            onClick={() => setShowToolPanel(!showToolPanel)}
          >
            <Zap size={14} className={styles.toolPanelIcon} />
            <span>
              Tool Activity ({toolActivity.filter((t) => t.status === "done").length}/
              {toolActivity.length})
            </span>
            {showToolPanel ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </button>
          {showToolPanel && (
            <div className={styles.toolPanelBody}>
              {toolActivity.map((activity) => (
                <div key={activity.id} className={styles.toolActivityItem}>
                  <span className={styles.toolStatusIcon}>
                    {activity.status === "calling" && (
                      <Loader2 size={12} className={styles.spinner} />
                    )}
                    {activity.status === "done" && (
                      <CheckCircle2 size={12} className={styles.toolSuccess} />
                    )}
                    {activity.status === "error" && (
                      <AlertCircle size={12} className={styles.toolError} />
                    )}
                  </span>
                  <span className={styles.toolName}>
                    {renderToolName(activity.name)}
                  </span>
                  {Object.keys(activity.args || {}).length > 0 && (
                    <span className={styles.toolArgs}>
                      ({Object.entries(activity.args)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(", ")})
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Input area — same as ChatArea */}
      <div className={chatStyles.inputWrapper}>
        <form
          onSubmit={handleSend}
          className={`${chatStyles.inputBox} ${isDragging ? chatStyles.inputBoxDragActive : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {isDragging && (
            <div className={chatStyles.dragOverlay}>
              <Paperclip size={20} />
              <span>Drop images here</span>
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className={chatStyles.pendingImages}>
              {pendingImages.map((dataUrl, i) => (
                <div key={i} className={chatStyles.pendingAttachmentWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dataUrl}
                    alt="Attached"
                    className={chatStyles.pendingImg}
                    onClick={() => setLightboxSrc(dataUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className={chatStyles.removeAttachment}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={chatStyles.inputRow}>
            {supportsImageInput && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleImageSelect}
                />
                <ChatInputButton
                  onClick={() => fileInputRef.current?.click()}
                  label="Attach image"
                  icon="paperclip"
                />
              </>
            )}
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about weather, events, commodities, trends..."
              rows={1}
            />
            <button
              type="submit"
              className={isGenerating ? chatStyles.submitGenerating : ""}
              disabled={(!inputValue.trim() && pendingImages.length === 0) || isGenerating}
            >
              {isGenerating ? (
                <Loader2 size={18} className={chatStyles.spin} />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </form>
        <div className={chatStyles.hint}>
          Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd>{" "}
          for new line
        </div>
      </div>
      {lightboxSrc && (
        <ImagePreviewComponent
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
          onUseAnnotated={(dataUrl) => {
            setPendingImages((prev) => [...prev, dataUrl]);
            setLightboxSrc(null);
          }}
        />
      )}
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────
  return (
    <ThreePanelLayout
      navSidebar={<NavigationSidebarComponent mode="user" isGenerating={isGenerating} />}
      leftPanel={leftPanel}
      leftTitle={null}
      rightPanel={
        <HistoryPanel
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
        />
      }
      rightTitle="History"
      headerTitle={title}
      headerMeta={
        messages.length > 0 ? (
          <div className={styles.headerMeta}>
            <span>
              {messages.filter((m) => m.role === "user" || m.role === "assistant").length}{" "}
              messages
            </span>
          </div>
        ) : null
      }
      headerControls={
        <div className={styles.headerControls}>
          <span className={styles.headerBadge}>
            <Zap size={10} />
            Tool Calling
          </span>
        </div>
      }
    >
      {chatContent}
    </ThreePanelLayout>
  );
}
