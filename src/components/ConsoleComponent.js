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
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import SunService from "../services/SunService.js";
import ThreePanelLayout from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import MessageList from "./MessageList.js";
import { ALL_CONSOLE_PROMPTS } from "../arrays.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./ConsoleComponent.module.css";

const MAX_TOOL_ITERATIONS = 5;
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

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);

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
    const custom = customTools
      .filter((t) => t.enabled)
      .map((t) => ({
        name: t.name,
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

  // Build a lookup for custom tools by name for execution
  const customToolMap = useMemo(() => {
    const map = new Map();
    for (const t of customTools) {
      if (t.enabled) map.set(t.name, t);
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

  // ── Orchestration loop ───────────────────────────────────────
  const runOrchestrationLoop = useCallback(
    async (conversationMessages, resolvedTitle) => {
      const currentMessages = [...conversationMessages];
      let iterations = 0;

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
            project: PROJECT,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              ...currentMessages,
            ],
            options: {
              tools: allToolSchemas,
              maxTokens: settings.maxTokens,
            },
          };

          // Always send conversationId so Prism persists every response
          payload.conversationId = conversationId;

          // Only send userMessage/meta on the first iteration
          // (subsequent iterations are tool-result follow-ups)
          if (iterations === 1) {
            payload.userMessage = currentMessages[currentMessages.length - 1];
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
          // Execute tool calls — route custom tools through SunService.executeCustomTool
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

          const assistantMsg = {
            role: "assistant",
            content: streamedText || "",
            toolCalls: pendingToolCalls.map((tc) => ({
              name: tc.name,
              args: tc.args,
              thoughtSignature: tc.thoughtSignature || undefined,
            })),
          };
          currentMessages.push(assistantMsg);

          for (const result of results) {
            currentMessages.push({
              role: "tool",
              name: result.name,
              content: JSON.stringify(result.result),
            });
          }

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
      if (!text || isGenerating) return;

      setInputValue("");
      setIsGenerating(true);
      setToolActivity([]);

      // Auto-generate title from first message
      let resolvedTitle = title;
      if (messages.length === 0) {
        resolvedTitle = text.length > 60 ? text.slice(0, 57) + "..." : text;
        setTitle(resolvedTitle);
      }

      const userMessage = { role: "user", content: text };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        const finalMessages = await runOrchestrationLoop(updatedMessages, resolvedTitle);
        setMessages(
          finalMessages.filter(
            (m) =>
              m.role !== "tool" &&
              m.role !== "system" &&
              !(m.role === "assistant" && !m.content?.trim()),
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
    [inputValue, isGenerating, messages, title, runOrchestrationLoop, loadConversations],
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
        const displayMessages = (full.messages || []).filter(
          (m) =>
            m.role !== "tool" &&
            m.role !== "system" &&
            !(m.role === "assistant" && !m.content?.trim()),
        );
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
        <form onSubmit={handleSend} className={chatStyles.inputBox}>
          <div className={chatStyles.inputRow}>
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
              disabled={!inputValue.trim() || isGenerating}
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
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────
  return (
    <ThreePanelLayout
      navSidebar={<NavigationSidebarComponent mode="user" />}
      leftPanel={leftPanel}
      leftTitle="Settings"
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
