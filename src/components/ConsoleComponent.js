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
import MessageList from "./MessageList.js";
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
  const [showToolsList, setShowToolsList] = useState(false);
  const [conversationId, setConversationId] = useState(() => crypto.randomUUID());
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("Sun Console");

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
  const inputRef = useRef(null);
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

  // ── Orchestration loop ───────────────────────────────────────
  const runOrchestrationLoop = useCallback(
    async (conversationMessages) => {
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
              tools: SunService.getToolSchemas(),
              maxTokens: settings.maxTokens,
            },
          };

          // Only send conversationId/userMessage on the first iteration
          if (iterations === 1) {
            payload.conversationId = conversationId;
            payload.userMessage = currentMessages[currentMessages.length - 1];
            payload.conversationMeta = {
              title: title,
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
          const results = await SunService.executeToolCalls(pendingToolCalls);

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
    [settings.provider, settings.model, settings.maxTokens, conversationId, title],
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
      if (messages.length === 0) {
        const autoTitle = text.length > 60 ? text.slice(0, 57) + "..." : text;
        setTitle(autoTitle);
      }

      const userMessage = { role: "user", content: text };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

      try {
        const finalMessages = await runOrchestrationLoop(updatedMessages);
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
    [inputValue, isGenerating, messages, runOrchestrationLoop, loadConversations],
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
    setTitle("Sun Console");
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
        setTitle(full.title || "Sun Console");
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

  // ── Left sidebar: SettingsPanel + collapsible tools ──────────
  const leftPanel = (
    <>
      <SettingsPanel
        config={filteredConfig}
        settings={settings}
        onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
        hasAssistantImages={false}
      />
      <div className={styles.toolsSection}>
        <button
          className={styles.toolsToggle}
          onClick={() => setShowToolsList((v) => !v)}
        >
          <Zap size={12} className={styles.toolsToggleIcon} />
          <span>Available Tools ({SunService.getToolSchemas().length})</span>
          {showToolsList ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {showToolsList && (
          <div className={styles.toolsList}>
            {SunService.getToolSchemas().map((tool) => (
              <div key={tool.name} className={styles.toolItem}>
                <CheckCircle2 size={10} className={styles.toolItemIcon} />
                <span className={styles.toolItemName}>{renderToolName(tool.name)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
            <h2 className={styles.emptyTitle}>Sun Console</h2>
            <p className={styles.emptySubtitle}>
              Ask about weather, events, commodities, trends, or anything
              powered by the Sun ecosystem.
            </p>
            <div className={styles.quickPrompts}>
              {[
                "What's the weather like right now?",
                "What are the top commodity movers today?",
                "Are there any events this weekend?",
                "What's trending on Reddit?",
                "What's the UV index and air quality?",
              ].map((prompt) => (
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
