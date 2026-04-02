"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Terminal, Paperclip, X, Zap } from "lucide-react";
import PrismService from "../services/PrismService.js";
import ThreePanelLayout from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import MessageList, { prepareDisplayMessages } from "./MessageList.js";
import ImagePreviewComponent from "./ImagePreviewComponent.js";
import TabBarComponent from "./TabBarComponent.js";
import EmptyStateComponent from "./EmptyStateComponent.js";

import { ALL_CONSOLE_PROMPTS } from "../arrays.js";
import {
  buildToolSchemas,
} from "../utils/FunctionCallingUtilities.js";
import { PROJECT_CONSOLE, SETTINGS_DEFAULTS } from "../constants.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./ConsoleComponent.module.css";
import ChatInputButton from "./ChatInputButton.js";
import useToolToggles from "../hooks/useToolToggles.js";

export default function ConsoleComponent() {
  // ── State ────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolActivity, setToolActivity] = useState([]);
  const [streamingOutputs, setStreamingOutputs] = useState(new Map());
  const [conversationId, setConversationId] = useState(() =>
    crypto.randomUUID(),
  );
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("Console");
  const [leftTab, setLeftTab] = useState("settings"); // "settings" | "tools"
  const [customTools, setCustomTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn } =
    useToolToggles(builtInTools);
  const [settings, setSettings] = useState({
    ...SETTINGS_DEFAULTS,
    systemPrompt: "You are a helpful AI assistant.",
    maxTokens: 8192,
  });

  const [pendingImages, setPendingImages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  // ── Filtered config: only function-calling models ────────────
  const filteredConfig = useMemo(() => {
    if (!config) return null;
    const textModelsMap = config.textToText?.models || {};
    const filteredTextModels = {};

    for (const [provider, models] of Object.entries(textModelsMap)) {
      const fcModels = models.filter((m) =>
        m.tools?.includes("Function Calling"),
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
    PrismService.getConfig().then((cfg) => {
      setConfig(cfg);
      if (cfg.fcSystemPrompt) {
        setSettings((s) => ({ ...s, systemPrompt: cfg.fcSystemPrompt }));
      }
    }).catch(console.error);
  }, []);

  // Load conversation history
  const loadConversations = useCallback(async () => {
    try {
      const convs =
        await PrismService.getConversationsByProject(PROJECT_CONSOLE);
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
      const tools = await PrismService.getCustomTools(PROJECT_CONSOLE);
      setCustomTools(tools);
    } catch (err) {
      console.error("Failed to load custom tools:", err);
    }
  }, []);

  useEffect(() => {
    loadCustomTools();
  }, [loadCustomTools]);

  // Fetch built-in tools on mount
  useEffect(() => {
    PrismService.getBuiltInToolSchemas()
      .then(setBuiltInTools)
      .catch(console.error);
  }, []);

  // Merge enabled built-in + enabled custom tool schemas
  const allToolSchemas = useMemo(
    () => buildToolSchemas(builtInTools, disabledBuiltIns, customTools),
    [customTools, builtInTools, disabledBuiltIns],
  );



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

  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (supportsImageInput && e.dataTransfer?.items?.length > 0) {
        setIsDragging(true);
      }
    },
    [supportsImageInput],
  );

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

  const handleDrop = useCallback(
    (e) => {
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
    },
    [supportsImageInput],
  );

  const handlePaste = useCallback(
    (e) => {
      if (!supportsImageInput) return;
      const items = Array.from(e.clipboardData?.items || []);
      const files = items
        .filter(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        )
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
    },
    [supportsImageInput],
  );

  // ── Orchestration loop ───────────────────────────────────────
  const runOrchestrationLoop = useCallback(
    async (conversationMessages, resolvedTitle) => {
      const currentMessages = [...conversationMessages];

      // Clean up any stale empty assistant placeholders
      setMessages((prev) =>
        prev.filter((m) => !(m.role === "assistant" && !m.content?.trim())),
      );

      await new Promise((resolve, reject) => {
        const systemPromptText = settings.systemPrompt.replace("{{CURRENT_DATE_TIME}}", new Date().toLocaleString());
        const payload = {
          provider: settings.provider,
          model: settings.model,
          messages: [
            { role: "system", content: systemPromptText },
            ...currentMessages,
          ],
          functionCallingEnabled: true,
          enabledTools: allToolSchemas.map(t => t.name),
          maxTokens: settings.maxTokens,
          conversationId,
          conversationMeta: {
            title: resolvedTitle,
            systemPrompt: systemPromptText,
          },
        };

        let streamedText = "";
        let streamedThinking = "";

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
          onThinking: (content) => {
            streamedThinking += content;
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg?.role === "assistant") {
                lastMsg.thinking = streamedThinking;
              } else {
                updated.push({
                  role: "assistant",
                  content: "",
                  thinking: streamedThinking,
                });
              }
              return updated;
            });
          },
          onToolExecution: (data) => {
            const tc = data.tool;
            setToolActivity((prev) => {
              let updated = [];
              if (data.status === "calling") {
                updated = [
                  ...prev,
                  {
                    id: tc.id || `tc-${Date.now()}-${Math.random()}`,
                    name: tc.name,
                    args: tc.args,
                    status: "calling",
                    timestamp: Date.now(),
                  },
                ];
              } else {
                updated = prev.map((activity) => {
                  if (
                    (tc.id && activity.id === tc.id) ||
                    (!tc.id && activity.name === tc.name && activity.status === "calling")
                  ) {
                    return { ...activity, status: data.status, result: tc.result };
                  }
                  return activity;
                });
              }
              setMessages((msgPrev) => {
                const arr = [...msgPrev];
                const last = arr[arr.length - 1];
                if (last?.role === "assistant") {
                  arr[arr.length - 1] = { ...last, toolCalls: updated };
                }
                return arr;
              });
              return updated;
            });
          },
          onToolOutput: (data) => {
            // Append streaming stdout/stderr chunks per toolCallId
            if (data.event === "stdout" || data.event === "stderr") {
              setStreamingOutputs((prev) => {
                const updated = new Map(prev);
                const key = data.toolCallId || data.name;
                const existing = updated.get(key) || "";
                updated.set(key, existing + (data.data || ""));
                return updated;
              });
            }
          },
          onDone: () => resolve(),
          onError: (err) => reject(err),
        });
      });

      // No need to return mutated messages, the backend completely persists and finalizes them.
      // We will reload the conversation if needed, or simply let the SSE state updates handle the UI.
      return [];
    },
    [
      settings.provider,
      settings.model,
      settings.maxTokens,
      settings.systemPrompt,
      conversationId,
      allToolSchemas,
    ],
  );

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      if (isGenerating) {
        handleStop();
        return;
      }
      const text = inputValue.trim();
      if (!text && pendingImages.length === 0) return;

      const currentImages = [...pendingImages];
      setInputValue("");
      setPendingImages([]);
      setIsGenerating(true);
      setToolActivity([]);
      setStreamingOutputs(new Map());

      // Auto-generate title from first message
      let resolvedTitle = title;
      if (messages.length === 0) {
        const titleText = text || "Image conversation";
        resolvedTitle =
          titleText.length > 60 ? titleText.slice(0, 57) + "..." : titleText;
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
        const finalMessages = await runOrchestrationLoop(
          updatedMessages,
          resolvedTitle,
        );
        setMessages(
          finalMessages.filter(
            (m) =>
              m.role !== "tool" &&
              m.role !== "system" &&
              !(
                m.role === "assistant" &&
                !m.content?.trim() &&
                !m.toolCalls?.length
              ),
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
    [
      handleStop,
      inputValue,
      pendingImages,
      isGenerating,
      messages,
      title,
      runOrchestrationLoop,
      loadConversations,
    ],
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
        const full = await PrismService.getConversationByProject(
          conv.id,
          PROJECT_CONSOLE,
        );
        const displayMessages = prepareDisplayMessages(full.messages || []);
        setMessages(displayMessages);
        setConversationId(conv.id);
        setActiveId(conv.id);
        setTitle(full.title || "Console");
        setToolActivity([]);
      } catch (err) {
        console.error("Failed to load conversation:", err);
      }
    },
    [isGenerating],
  );

  const handleDeleteConversation = useCallback(
    async (convId) => {
      try {
        await PrismService.deleteConversationByProject(convId, PROJECT_CONSOLE);
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

  // ── Left sidebar: tab bar + content ──────────────────────────


  const leftPanel = (
    <>
      <TabBarComponent
        tabs={[
          { key: "settings", label: "Settings" },
          {
            key: "tools",
            label: "Function Calling",
            badge: allToolSchemas.length,
          },
        ]}
        activeTab={leftTab}
        onChange={setLeftTab}
      />

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
          project={PROJECT_CONSOLE}
          builtInTools={builtInTools}
          disabledBuiltIns={disabledBuiltIns}
          onToggleBuiltIn={handleToggleBuiltIn}
          onToggleAllBuiltIn={handleToggleAllBuiltIn}
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
          <EmptyStateComponent
            icon={<Terminal size={40} />}
            title="Console"
            subtitle="Ask about weather, events, commodities, trends, and more."
          >
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
          </EmptyStateComponent>
        )}

        <MessageList
          messages={messages.filter(
            (m) => m.role === "user" || m.role === "assistant",
          )}
          isGenerating={isGenerating}
          streamingOutputs={streamingOutputs}
        />

        <div ref={endRef} />
      </div>



      {/* Input area — same as ChatArea */}
      <div className={chatStyles.inputWrapper}>
        <form
          onSubmit={handleSend}
          className={`${chatStyles.inputBox} ${isDragging ? chatStyles.inputBoxDragActive : ""} ${isGenerating ? chatStyles.inputBoxGenerating : ""}`}
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
            <ChatInputButton
              variant="submit"
              isGenerating={isGenerating}
              disabled={
                isGenerating
                  ? false
                  : !inputValue.trim() && pendingImages.length === 0
              }
              label={isGenerating ? "Stop" : "Send"}
            />
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
      navSidebar={
        <NavigationSidebarComponent mode="user" isGenerating={isGenerating} />
      }
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
      rightTitle={`${conversations.length} Conversations`}
      headerTitle={title}
      headerMeta={
        messages.length > 0 ? (
          <div className={styles.headerMeta}>
            <span>
              {
                messages.filter(
                  (m) => m.role === "user" || m.role === "assistant",
                ).length
              }{" "}
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
