"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import styles from "../app/page.module.css";
import PrismService from "../services/PrismService";
import AudioPlayerService from "../services/AudioPlayerService";
import { prepareDisplayMessages } from "./MessageList";
import StorageService from "../services/StorageService";
import {
  buildToolSchemas,
} from "../utils/FunctionCallingUtilities";
import useSessionStats from "../hooks/useSessionStats";
import {
  SK_LAST_PROVIDER,
  SK_LAST_MODEL,
  SK_INFERENCE_MODE,
  SK_MODEL_MEMORY_CONVERSATIONS,
  SK_TOOL_MEMORY_CONVERSATIONS,
  SETTINGS_DEFAULTS,
} from "../constants";
import { Send, Settings, Parentheses, SlidersHorizontal, Info } from "lucide-react";
import NavigationSidebarComponent from "../components/NavigationSidebarComponent";
import SettingsPanel from "../components/SettingsPanel";
import ModelInfoPanel from "../components/ModelInfoPanel";
import ParametersPanelComponent from "../components/ParametersPanelComponent";
import CustomToolsPanel from "../components/CustomToolsPanel";
import ChatArea from "../components/ChatArea";
import HistoryPanel from "../components/HistoryPanel";
import ThreePanelLayout from "../components/ThreePanelLayout";
import TabBarComponent from "../components/TabBarComponent";
import ModelPickerPopoverComponent from "../components/ModelPickerPopoverComponent";
import ModelLoadConfigPanel from "../components/ModelLoadConfigPanel";
import { useToast } from "../components/ToastComponent";
import useToolToggles from "../hooks/useToolToggles";
import useModelMemory from "../hooks/useModelMemory";

// All tool-toggle keys that must be explicitly reset when switching conversations
// to prevent leaking state from the previous selection.
const TOOL_TOGGLE_DEFAULTS = {
  functionCallingEnabled: false,
  webSearchEnabled: false,
  thinkingEnabled: false,
  codeExecutionEnabled: false,
  urlContextEnabled: false,
};

// Detect which tool toggles were active in a conversation from its messages,
// so we can restore them even if the settings object wasn't saved.
function detectToolTogglesFromMessages(messages) {
  const toggles = {};
  for (const m of messages || []) {
    // Function calling
    if (m.role === "tool" || m.toolCalls?.length > 0) {
      toggles.functionCallingEnabled = true;
    }
    // Thinking / reasoning
    if (m.role === "assistant" && m.thinking) {
      toggles.thinkingEnabled = true;
    }
    // Web search (from inline results or tool calls)
    if (
      m.role === "assistant" &&
      typeof m.content === "string" &&
      m.content.includes("> **Sources:**")
    ) {
      toggles.webSearchEnabled = true;
    }
    if (m.toolCalls?.length > 0) {
      for (const tc of m.toolCalls) {
        const name = (tc.name || "").toLowerCase();
        if (name === "web_search" || name === "web_search_preview" || name === "google_search") {
          toggles.webSearchEnabled = true;
        }
        if (name === "code_execution") {
          toggles.codeExecutionEnabled = true;
        }
      }
    }
    // Code execution (from inline blocks)
    if (
      m.role === "assistant" &&
      typeof m.content === "string" &&
      m.content.includes("```exec-")
    ) {
      toggles.codeExecutionEnabled = true;
    }
  }
  return toggles;
}

export default function HomePage({ initialConversationId = null }) {
  const router = useRouter();
  const [config, setConfig] = useState(null);
  const [inferenceMode, _setInferenceMode] = useState(() =>
    StorageService.get(SK_INFERENCE_MODE, "async"),
  );
  const [conversations, setConversations] = useState([]);

  const [activeId, setActiveId] = useState(initialConversationId || null);
  const [title, setTitle] = useState("New Conversation");
  const [messages, setMessages] = useState([]);
  // Ref to synchronously track live conversation ID (avoids stale closure in setMessages updater)
  const liveConvIdRef = useRef(null);
  // Whether the live conversation document has been created in MongoDB (via appendMessages)
  const liveConvCreatedRef = useRef(false);
  // Chain live persistence ops to prevent race conditions (e.g. PATCH before POST completes)
  const livePersistChainRef = useRef(Promise.resolve());

  const [settings, setSettings] = useState({
    ...SETTINGS_DEFAULTS,
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [newChatKey, setNewChatKey] = useState(0);

  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false);
  const skipSystemPromptSave = useRef(false);
  const [workflows, setWorkflows] = useState([]);
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [convFavoriteKeys, setConvFavoriteKeys] = useState([]);
  const [originalMessageCount, setOriginalMessageCount] = useState(0);
  const [originalTotalCost, setOriginalTotalCost] = useState(0);

  // ── LM Studio Model Load Config ────────────────────────────
  const [lmConfigModel, setLmConfigModel] = useState(null);
  const [lmConfigLoading, setLmConfigLoading] = useState(false);
  const [lmLoadProgress, setLmLoadProgress] = useState(null); // null = idle, 0–1 = loading
  const lmLoadAbortRef = useRef(null);
  const [toastElement, showToast] = useToast(4000);

  // ── Reusable LM Studio model load trigger ──────────────────
  const startLmLoad = useCallback(
    (modelKey, options = {}) => {
      setLmConfigLoading(true);
      setLmConfigModel(null);
      setLmLoadProgress(0);

      // Select the model immediately so the user can start chatting
      const modelDef = (config?.textToText?.models?.["lm-studio"] || []).find(
        (m) => m.name === modelKey,
      );
      const temp = modelDef?.defaultTemperature ?? 1.0;
      setSettings((s) => ({
        ...s,
        provider: "lm-studio",
        model: modelKey,
        temperature: temp,
      }));

      // Stream the load with real-time progress
      if (lmLoadAbortRef.current) lmLoadAbortRef.current();
      lmLoadAbortRef.current = PrismService.loadLmStudioModelStream(
        modelKey,
        options,
        {
          onProgress: (progress) => setLmLoadProgress(progress),
          onComplete: () => {
            setLmLoadProgress(null);
            setLmConfigLoading(false);
            lmLoadAbortRef.current = null;
            showToast(`Loaded ${modelKey}`, "success");
          },
          onError: (err) => {
            setLmLoadProgress(null);
            setLmConfigLoading(false);
            lmLoadAbortRef.current = null;
            showToast(`Failed to load: ${err.message}`, "error");
          },
        },
      );
    },
    [config, showToast],
  );

  // ── Function Calling state ──────────────────────────────────
  const [leftTab, setLeftTab] = useState("settings");

  // Bidirectional glow link: FC ToolCard <-> Tools tab
  const [hoveredLink, setHoveredLink] = useState(null);

  // Determine if the selected model supports Function Calling
  const selectedModelSupportsFc = useMemo(() => {
    const providerModels =
      config?.textToText?.models?.[settings.provider] || [];
    const modelDef = providerModels.find((m) => m.name === settings.model);
    return modelDef?.tools?.includes("Function Calling") ?? false;
  }, [config, settings.provider, settings.model]);

  // Reset to Settings tab when the model doesn't support FC
  useEffect(() => {
    if (!selectedModelSupportsFc && leftTab === "tools") {
      setLeftTab("settings");
    }
  }, [selectedModelSupportsFc, leftTab]);
  const [customTools, setCustomTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn } =
    useToolToggles(builtInTools, SK_TOOL_MEMORY_CONVERSATIONS);
  const [_toolActivity, setToolActivity] = useState([]);
  const [streamingOutputs, setStreamingOutputs] = useState(new Map());

  // Reusable callback for tool_output SSE events
  const handleToolOutput = useCallback((data) => {
    if (data.event === "stdout" || data.event === "stderr") {
      setStreamingOutputs((prev) => {
        const updated = new Map(prev);
        const key = data.toolCallId || data.name;
        const existing = updated.get(key) || "";
        updated.set(key, existing + (data.data || ""));
        return updated;
      });
    }
  }, []);

  const abortRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Lazily initialise and return the audio player for Live API playback
  const getAudioPlayer = useCallback(() => {
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new AudioPlayerService();
      audioPlayerRef.current.init();
    }
    return audioPlayerRef.current;
  }, []);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsGenerating(false);
    setIsGeneratingImage(false);
    // Stop audio playback on generation stop
    if (audioPlayerRef.current) {
      audioPlayerRef.current.stop();
      audioPlayerRef.current = null;
    }
  }, []);

  // Helper to update URL bar without triggering Next.js navigation.
  // Uses History.prototype.replaceState to bypass Next.js's patching of window.history.
  const updateUrl = (id) => {
    const targetPath = id ? `/conversations/${id}` : "/";
    if (window.location.pathname !== targetPath) {
      History.prototype.replaceState.call(window.history, {}, "", targetPath);
    }
  };

  const {
    uniqueModels, uniqueProviders, totalCost, totalTokens, requestCount,
    usedTools, modalities,
  } = useSessionStats(messages);

  // Auto-save system prompt on edit (debounced)
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    // Skip for live conversations that haven't been persisted yet
    if (liveConvIdRef.current === activeId && !liveConvCreatedRef.current) return;
    if (skipSystemPromptSave.current) {
      skipSystemPromptSave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const { systemPrompt, ...modelSettings } = settings;
      PrismService.patchConversation(activeId, {
        systemPrompt,
        settings: modelSettings,
      }).catch((err) => console.error("Failed to save system prompt:", err));
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, activeId, messages.length]);

  // Fetch workflows that include this conversation
  useEffect(() => {
    if (!activeId) {
      setWorkflows([]);
      return;
    }
    // Skip for live conversations that haven't been persisted yet
    if (liveConvIdRef.current === activeId && !liveConvCreatedRef.current) return;
    PrismService.getConversationWorkflows(activeId)
      .then(setWorkflows)
      .catch(() => setWorkflows([]));
  }, [activeId]);

  // ── Model memory (persist last-used model per page) ──────────
  const { saveModel, restoreModel } = useModelMemory(SK_MODEL_MEMORY_CONVERSATIONS);

  useEffect(() => {
    PrismService.getConfigWithLocalModels({
      onConfig: (cfg) => {
        setConfig(cfg);

        // Try to restore page-scoped model memory first, then fall back to legacy keys
        restoreModel(cfg, setSettings, {
          fallback: (config) => {
            const savedProvider = StorageService.get(SK_LAST_PROVIDER);
            const savedModel = StorageService.get(SK_LAST_MODEL);
            const savedValid =
              savedProvider &&
              config.providerList?.includes(savedProvider) &&
              ((config.textToText?.models?.[savedProvider] || []).some(
                (m) => m.name === savedModel,
              ) ||
                (config.textToImage?.models?.[savedProvider] || []).some(
                  (m) => m.name === savedModel,
                ));

            const prov = savedValid ? savedProvider : config.providerList?.[0] || "";
            const mod = savedValid
              ? savedModel
              : config.textToText?.defaults?.[prov] ||
                config.textToText?.models?.[prov]?.[0]?.name ||
                "";

            const modelDef =
              (config.textToText?.models?.[prov] || []).find((m) => m.name === mod) ||
              (config.textToImage?.models?.[prov] || []).find((m) => m.name === mod);
            const temp = modelDef?.defaultTemperature ?? 1.0;
            setSettings((s) => ({
              ...s,
              provider: prov,
              model: mod,
              temperature: temp,
            }));
          },
        });
      },
      onLocalMerge: (merged) => {
        setConfig(merged);
        restoreModel(merged, setSettings);
      },
    }).catch(console.error);

    // Load history
    loadConversations();

    // Load favorite models
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});

    // Load favorite conversations
    PrismService.getFavorites("conversation")
      .then((favs) => setConvFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Function Calling infrastructure ────────────────────────

  const FC_SYSTEM_PROMPT = config?.fcSystemPrompt?.replace("{{CURRENT_DATE_TIME}}", new Date().toLocaleString()) || "";

  const allToolSchemas = useMemo(
    () => buildToolSchemas(builtInTools, disabledBuiltIns, customTools),
    [customTools, disabledBuiltIns, builtInTools],
  );



  const loadCustomTools = useCallback(async () => {
    try {
      const tools = await PrismService.getCustomTools();
      setCustomTools(tools);
    } catch (err) {
      console.error("Failed to load custom tools:", err);
    }
  }, []);

  // Load custom tools on mount
  useEffect(() => {
    loadCustomTools();
  }, [loadCustomTools]);

  // Fetch built-in tools on mount
  useEffect(() => {
    PrismService.getBuiltInToolSchemas()
      .then(setBuiltInTools)
      .catch(console.error);
  }, []);



  const handleToggleCustomTool = useCallback(
    async (tool) => {
      try {
        // Optimistic update for better UX
        setCustomTools((prev) =>
          prev.map((t) =>
            (t.id || t._id) === (tool.id || tool._id)
              ? { ...t, enabled: !t.enabled }
              : t,
          ),
        );
        await PrismService.updateCustomTool(tool.id || tool._id, {
          enabled: !tool.enabled,
        });
        loadCustomTools();
      } catch (err) {
        console.error("Failed to toggle custom tool:", err);
        loadCustomTools(); // Revert on failure
      }
    },
    [loadCustomTools],
  );

  // ── Shared conversation restore logic ────────────────────────
  // Used by URL-load and history-click to avoid duplicating the
  // message preparation, settings detection, and toggle restoration.
  const restoreConversation = useCallback((full) => {
    setActiveId(full.id);
    setTitle(full.title);
    const displayMessages = prepareDisplayMessages(full.messages);
    setMessages(displayMessages);
    setOriginalMessageCount(displayMessages.length);
    setOriginalTotalCost(
      full.totalCost ||
        displayMessages.reduce((s, m) => s + (m.estimatedCost || 0), 0),
    );
    skipSystemPromptSave.current = true;

    // Restore settings — use saved settings, or fall back to
    // provider/model from the last assistant message (for older conversations).
    let restoredSettings = full.settings || {};
    if (!restoredSettings.provider && full.messages?.length) {
      const lastAssistant = [...(full.messages || [])]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastAssistant) {
        restoredSettings = {
          ...restoredSettings,
          provider: lastAssistant.provider || "",
          model: lastAssistant.model || "",
        };
      }
    }

    const detectedToggles = detectToolTogglesFromMessages(full.messages);
    setSettings((s) => ({
      ...s,
      ...TOOL_TOGGLE_DEFAULTS,
      ...restoredSettings,
      ...detectedToggles,
      systemPrompt: full.systemPrompt ?? "",
    }));
  }, []);

  // Load conversation from URL path on mount
  const urlLoadedRef = useRef(false);
  useEffect(() => {
    if (initialConversationId && !urlLoadedRef.current) {
      urlLoadedRef.current = true;
      PrismService.getConversation(initialConversationId)
        .then((full) => restoreConversation(full))
        .catch(() => {
          setActiveId(null);
          updateUrl(null);
        });
    }
  }, [initialConversationId, restoreConversation]);

  const loadConversations = async () => {
    try {
      const hist = await PrismService.getConversations();
      setConversations(hist);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewChat = () => {
    setActiveId(null);
    liveConvIdRef.current = null;
    liveConvCreatedRef.current = false;
    livePersistChainRef.current = Promise.resolve();
    updateUrl(null);
    setTitle("New Conversation");
    setMessages([]);
    setOriginalMessageCount(0);
    setOriginalTotalCost(0);
    setToolActivity([]);
    setStreamingOutputs(new Map());
    skipSystemPromptSave.current = true;
    setSettings((s) => ({
      ...s,
      systemPrompt: "",
    }));
  };

  // Explicit "New Conversation" button action — also resets the welcome flow
  const handleNewChatClick = () => {
    handleNewChat();
    setNewChatKey((k) => k + 1);
  };

  // Persist provider/model to localStorage (legacy keys + page-scoped memory)
  useEffect(() => {
    if (settings.provider)
      StorageService.set(SK_LAST_PROVIDER, settings.provider);
    if (settings.model) StorageService.set(SK_LAST_MODEL, settings.model);
    if (settings.provider && settings.model) {
      saveModel(settings.provider, settings.model);
    }
  }, [settings.provider, settings.model, saveModel]);

  // Persist inference mode to localStorage
  useEffect(() => {
    StorageService.set(SK_INFERENCE_MODE, inferenceMode);
  }, [inferenceMode]);

  const handleSelectConversation = async (conv) => {
    if (conv.id === activeId) return;
    try {
      const full = await PrismService.getConversation(conv.id);
      liveConvIdRef.current = full.id;
      liveConvCreatedRef.current = true; // Doc exists in DB
      livePersistChainRef.current = Promise.resolve();
      updateUrl(full.id);
      restoreConversation(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteConversation = async (id) => {
    try {
      await PrismService.deleteConversation(id);
      if (activeId === id) handleNewChat();
      loadConversations();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteMessage = async (index) => {
    if (isGenerating) return;
    // Soft-delete: mark the message as deleted rather than removing it
    const updatedMessages = [...messages];
    updatedMessages[index] = { ...updatedMessages[index], deleted: true };
    setMessages(updatedMessages);

    if (activeId) {
      try {
        await PrismService.patchConversation(activeId, {
          messages: updatedMessages,
        });
        loadConversations();
      } catch (err) {
        console.error("Failed to save after soft-delete:", err);
      }
    }
  };

  const handleRestoreMessage = async (index) => {
    if (isGenerating) return;
    const updatedMessages = [...messages];
    const { deleted: _, ...restored } = updatedMessages[index];
    updatedMessages[index] = restored;
    setMessages(updatedMessages);

    if (activeId) {
      try {
        await PrismService.patchConversation(activeId, {
          messages: updatedMessages,
        });
        loadConversations();
      } catch (err) {
        console.error("Failed to save after restore:", err);
      }
    }
  };

  const handleEditMessage = async (index, newContent) => {
    if (isGenerating) return;
    const updatedMessages = [...messages];
    updatedMessages[index] = { ...updatedMessages[index], content: newContent };
    setMessages(updatedMessages);

    if (activeId) {
      try {
        await PrismService.patchConversation(activeId, {
          messages: updatedMessages,
        });
      } catch (err) {
        console.error("Failed to save after edit:", err);
      }
    }
  };

  const handleRerunTurn = async (userMsgIndex) => {
    if (isGenerating) return;
    if (isTranscriptionModel) return; // Transcription models don't support rerun

    const userMsg = messages[userMsgIndex];
    if (!userMsg || userMsg.role !== "user") return;

    // --- TTS rerun branch ---
    if (isTTSModel) {
      // Soft-delete ALL messages after this user message
      const newMessages = [
        ...messages.slice(0, userMsgIndex + 1),
        ...messages.slice(userMsgIndex + 1).map((m) =>
          m.deleted ? m : { ...m, deleted: true }
        ),
      ];

      setMessages(newMessages);
      setIsGenerating(true);

      try {
        const currentId = activeId;
        const currentTitle = title;

        const defaultVoice =
          config?.textToSpeech?.defaultVoices?.[settings.provider] || undefined;
        const requestStart = performance.now();

        const result = await PrismService.generateSpeech({
          provider: settings.provider,
          text: userMsg.content,
          voice: settings.voice || defaultVoice,
          model: settings.model,
        });

        const totalTime = (performance.now() - requestStart) / 1000;

        const ttsModels =
          config?.textToSpeech?.models?.[settings.provider] || [];
        const ttsModelDef = ttsModels.find((m) => m.name === settings.model);
        const charCount = userMsg.content.length;
        let estimatedCost = null;
        if (ttsModelDef?.pricing?.perCharacter) {
          estimatedCost = charCount * ttsModelDef.pricing.perCharacter;
        } else if (ttsModelDef?.pricing?.inputPerMillion) {
          const estimatedTokens = Math.ceil(charCount / 4);
          estimatedCost =
            (estimatedTokens / 1_000_000) * ttsModelDef.pricing.inputPerMillion;
        }

        const rerunVoice = settings.voice || defaultVoice || "";

        const assistantMsg = {
          role: "assistant",
          content: "",
          audio: result.audioDataUrl,
          timestamp: new Date().toISOString(),
          provider: settings.provider,
          model: settings.model,
          voice: rerunVoice,
          totalTime,
          usage: { characters: charCount },
          estimatedCost,
        };

        // Append new response at the end
        const finalMessages = [...newMessages, assistantMsg];
        setMessages(finalMessages);

        try {
          const { systemPrompt, ...modelSettings } = settings;
          await PrismService.patchConversation(currentId, {
            title: currentTitle,
            messages: finalMessages,
            systemPrompt,
            settings: modelSettings,
          });
          loadConversations();
        } catch (saveErr) {
          console.error("Save failed:", saveErr);
        }
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, error: error.message };
          } else {
            updated.push({ role: "assistant", content: "", error: error.message });
          }
          return updated;
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // userMsg already declared above

    // Collect all messages up to and including this user message
    const historyUpToUser = messages.slice(0, userMsgIndex + 1);

    // Soft-delete ALL messages after this user message so they stay visible
    // as collapsed "Deleted" rows, and the new response appends at the end.
    const newMessages = [
      ...historyUpToUser,
      ...messages.slice(userMsgIndex + 1).map((m) =>
        m.deleted ? m : { ...m, deleted: true }
      ),
    ];

    // New response always appends at the end
    const rerunInsertIndex = newMessages.length;

    setMessages(newMessages);
    setIsGenerating(true);
    setToolActivity([]);
    setStreamingOutputs(new Map());

    // ── Function Calling rerun branch ────────────────────────────
    if (settings.functionCallingEnabled) {
      try {
        const currentId = activeId;
        const _currentTitle = title;
        const systemPromptText = settings.systemPrompt || FC_SYSTEM_PROMPT;
        const currentMessages = [...historyUpToUser];

        // Insert placeholder so the blinking cursor shows immediately.
        // newMessages keeps the old assistant as soft-deleted; new reply goes after it.
        setMessages([
          ...newMessages,
          {
            role: "assistant",
            content: "",
            timestamp: new Date().toISOString(),
            provider: settings.provider,
            model: settings.model,
          },
        ]);

        await new Promise((resolve, reject) => {
          const payload = {
            provider: settings.provider,
            model: settings.model,
            messages: [
              { role: "system", content: systemPromptText },
              ...currentMessages
                .filter((m) => !m.deleted)
                .map((m) => ({
                  role: m.role,
                  content: m.content,
                  ...(m.images ? { images: m.images } : {}),
                  ...(m.video ? { video: m.video } : {}),
                  ...(m.audio ? { audio: m.audio } : {}),
                  ...(m.pdf ? { pdf: m.pdf } : {}),
                })),
            ],
            functionCallingEnabled: true,
            enabledTools: allToolSchemas.map(t => t.name),
            maxTokens: settings.maxTokens,
            temperature: settings.temperature,
            // Pass thinking toggle so the server respects it for local models
            thinkingEnabled: settings.thinkingEnabled ?? false,
            conversationId: currentId,
            conversationMeta: {
              title: _currentTitle,
              systemPrompt: systemPromptText,
            },
          };

          let streamedText = "";
          let streamedThinking = "";

          abortRef.current = PrismService.streamText(payload, {
            onChunk: (chunk) => {
              streamedText += chunk;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (
                  lastMsg?.role === "assistant" &&
                  !lastMsg.toolCalls?.length
                ) {
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
                }
                return updated;
              });
            },
            onToolExecution: (data) => {
              const tc = data.tool;
              // Reset streamed text for the new iteration so the next
              // assistant message doesn't repeat previous segments
              if (data.status === "calling") {
                streamedText = "";
                streamedThinking = "";
              }
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
                      return { ...activity, status: data.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) };
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
            // MCP native tool events from LM Studio
            // Server injects position markers into the thinking stream;
            // here we just track tool activity state for UI rendering.
            onToolCall: (tc) => {
              setToolActivity((prev) => {
                let updated;
                if (tc.status === "calling") {
                  // Deduplicate: Prism may re-emit tool calls
                  const alreadyTracked = prev.some((a) =>
                    (tc.id && a.id === tc.id) ||
                    (!tc.id && a.name === tc.name),
                  );
                  if (alreadyTracked) return prev;

                  updated = [
                    ...prev,
                    {
                      id: tc.id || `tc-${Date.now()}-${Math.random()}`,
                      name: tc.name,
                      args: tc.args || {},
                      status: "calling",
                      timestamp: Date.now(),
                    },
                  ];
                } else {
                  updated = prev.map((a) =>
                    (tc.id && a.id === tc.id) ||
                    (!tc.id && a.name === tc.name && a.status === "calling")
                      ? { ...a, status: tc.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) }
                      : a,
                  );
                }
                setMessages((msgPrev) => {
                  const arr = [...msgPrev];
                  const last = arr[arr.length - 1];
                  if (last?.role === "assistant") {
                    arr[arr.length - 1] = {
                      ...last,
                      toolCalls: updated,
                    };
                  }
                  return arr;
                });
                return updated;
              });
            },
            onToolOutput: handleToolOutput,
            onDone: (data) => {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    usage: data.usage,
                    totalTime: data.totalTime,
                    tokensPerSec: data.tokensPerSec,
                    estimatedCost: data.estimatedCost,
                    status: undefined,
                    statusPhase: undefined,
                  };
                }
                return updated;
              });
              resolve();
            },
            onError: (err) => reject(err),
          });
        });

        // Persist the full messages array (including soft-deleted old assistant)
        // so the deleted state survives a page refresh.
        if (currentId) {
          try {
            setMessages((prev) => {
              const { systemPrompt: sp, ...modelSettings } = settings;
              PrismService.patchConversation(currentId, {
                title: _currentTitle,
                messages: prev,
                systemPrompt: sp,
                settings: modelSettings,
              }).catch((e) => console.error("Failed to save FC rerun:", e));
              return prev;
            });
          } catch (saveErr) {
            console.error("Failed to save FC rerun:", saveErr);
          }
        }
        loadConversations();
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, error: error.message };
          } else {
            updated.push({ role: "assistant", content: "", error: error.message });
          }
          return updated;
        });
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
      return;
    }

    // ── Normal text rerun branch ─────────────────────────────────
    try {
      const currentId = activeId;
      const currentTitle = title;

      const systemMsg = settings.systemPrompt
        ? [{ role: "system", content: settings.systemPrompt }]
        : [];
      const payloadMessages = [...systemMsg, ...historyUpToUser]
        .filter((m) => !m.deleted)
        .map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.images ? { images: m.images } : {}),
          ...(m.video ? { video: m.video } : {}),
          ...(m.audio ? { audio: m.audio } : {}),
          ...(m.pdf ? { pdf: m.pdf } : {}),
        }));
      const stopArray = settings.stopSequences
        ? settings.stopSequences
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const currentModels =
        config?.textToText?.models?.[settings.provider] || [];
      const selectedModelDef = currentModels.find(
        (m) => m.name === settings.model,
      );

      const payload = {
        provider: settings.provider,
        model: settings.model,
        messages: payloadMessages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        topK: settings.topK,
        frequencyPenalty: settings.frequencyPenalty,
        presencePenalty: settings.presencePenalty,
        stopSequences: stopArray?.length ? stopArray : undefined,
        ...(settings.seed !== undefined && settings.seed !== "" && { seed: settings.seed }),
        ...(settings.minP !== undefined && settings.minP > 0 && { minP: settings.minP }),
        ...(settings.repeatPenalty !== undefined && settings.repeatPenalty !== 1 && { repeatPenalty: settings.repeatPenalty }),
        ...(selectedModelDef?.responsesAPI
          ? {
              reasoningEffort: settings.reasoningEffort || "high",
              ...(settings.reasoningSummary
                ? { reasoningSummary: settings.reasoningSummary }
                : {}),
            }
          : {}),
        ...(!selectedModelDef?.responsesAPI &&
        (selectedModelDef?.thinking || settings.provider === "lm-studio")
          ? {
              // LM Studio: thinking defaults to ON; only send false when explicitly toggled off
              thinkingEnabled: settings.provider === "lm-studio"
                ? (settings.thinkingEnabled !== false)
                : (settings.thinkingEnabled || false),
              ...((settings.thinkingEnabled !== false || settings.provider === "lm-studio") ? {
                reasoningEffort: settings.reasoningEffort,
                thinkingLevel: settings.thinkingLevel,
                thinkingBudget: settings.thinkingBudget || undefined,
              } : {}),
            }
          : {}),
        ...(settings.webSearchEnabled ? { webSearch: true } : {}),
        ...(settings.webSearchEnabled && selectedModelDef?.webFetch
          ? { webFetch: true }
          : {}),
        ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
        ...(settings.urlContextEnabled ? { urlContext: true } : {}),
        ...(settings.forceImageGeneration ? { forceImageGeneration: true } : {}),
        ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
        // No conversationId — Retina handles persistence via patchConversation
        // for reruns (Prism's auto-append would be immediately overwritten).
      };

      await new Promise((resolve, reject) => {
        let streamedText = "";
        let streamedThinking = "";
        let streamedImages = [];
        const codeBlocks = [];
        const insertIndex = rerunInsertIndex;

        const placeholderMsg = {
          role: "assistant",
          content: "",
          thinking: "",
          timestamp: new Date().toISOString(),
          provider: settings.provider,
          model: settings.model,
        };

        // Insert placeholder at the correct position
        setMessages((prev) => {
          const updated = [...prev];
          updated.splice(insertIndex, 0, placeholderMsg);
          return updated;
        });

        abortRef.current = PrismService.streamText(payload, {
          onStatus: (statusData) => {
            const message = typeof statusData === "string" ? statusData : statusData?.message || "";
            // Sync lmLoadProgress with chat auto-load status
            const loadMatch = message.match(/Loading model[….]\s*(\d+)%/);
            if (loadMatch) {
              const pct = parseInt(loadMatch[1], 10) / 100;
              setLmLoadProgress(pct < 1 ? pct : null);
            } else if (!message.toLowerCase().includes("unload")) {
              // Non-loading status (e.g. generation started) — clear progress
              setLmLoadProgress((prev) => (prev != null ? null : prev));
            }

            const phase = statusData?.phase || undefined;
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                status: message,
                statusPhase: phase,
              };
              return updated;
            });
          },
          onChunk: (content) => {
            // Safety net: clear stale lmLoadProgress if model auto-loaded via chat
            setLmLoadProgress((prev) => (prev != null ? null : prev));

            streamedText += content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                content: streamedText,
              };
              return updated;
            });
          },
          onThinking: (content) => {
            streamedThinking += content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                thinking: streamedThinking,
              };
              return updated;
            });
          },
          onImage: (data, mimeType, minioRef) => {
            setIsGeneratingImage(true);
            const imageUrl = minioRef
              ? PrismService.getFileUrl(minioRef)
              : `data:${mimeType};base64,${data}`;
            streamedImages = [...streamedImages, minioRef || imageUrl];
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                images: streamedImages,
              };
              return updated;
            });
          },
          onExecutableCode: (code, language) => {
            const lang = language || "python";
            streamedText += `\n\n\`\`\`exec-${lang}\n${code}\n\`\`\`\n\n`;
            codeBlocks.push({ type: "code", code, language: lang });
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                content: streamedText,
              };
              return updated;
            });
          },
          onCodeExecutionResult: (output, outcome) => {
            streamedText += `\n\n\`\`\`execresult-python\n${output}\n\`\`\`\n\n`;
            codeBlocks.push({ type: "result", output, outcome });
            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = {
                ...updated[insertIndex],
                content: streamedText,
              };
              return updated;
            });
          },
          onWebSearchResult: (results) => {
            if (results && results.length > 0) {
              const citations = results
                .map((r) => `[${r.title}](${r.url})`)
                .join(" · ");
              streamedText += `\n\n> **Sources:** ${citations}\n\n`;
              setMessages((prev) => {
                const updated = [...prev];
                updated[insertIndex] = {
                  ...updated[insertIndex],
                  content: streamedText,
                };
                return updated;
              });
            }
          },
          onDone: async (data) => {
            const finalMsg = {
              role: "assistant",
              content: streamedText,
              thinking: streamedThinking || undefined,
              ...(streamedImages.length > 0 ? { images: streamedImages } : {}),
              timestamp: placeholderMsg.timestamp,
              provider: settings.provider,
              model: settings.model,
              usage: data.usage,
              totalTime: data.totalTime,
              tokensPerSec: data.tokensPerSec,
              estimatedCost: data.estimatedCost,
            };

            setMessages((prev) => {
              const updated = [...prev];
              updated[insertIndex] = finalMsg;
              return updated;
            });

            // Persist the updated messages to the database
            if (currentId) {
              try {
                const finalMessages = [...newMessages];
                finalMessages.splice(insertIndex, 0, finalMsg);
                const { systemPrompt: sp, ...modelSettings } = settings;
                await PrismService.patchConversation(currentId, {
                  title: currentTitle,
                  messages: finalMessages,
                  systemPrompt: sp,
                  settings: modelSettings,
                });
              } catch (saveErr) {
                console.error("Failed to save rerun:", saveErr);
              }
            }

            loadConversations();
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        });
      });
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, error: error.message };
        } else {
          updated.push({ role: "assistant", content: "", error: error.message });
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setIsGeneratingImage(false);
    }
  };

  // Check if current model is an audio-to-text (transcription) model
  // Only true if the model is in audioToText but NOT in textToText or textToImage
  // (some models like Gemini 3 Flash share the same name across sections)
  const isTranscriptionModel = (() => {
    const atModels = config?.audioToText?.models?.[settings.provider] || [];
    if (!atModels.some((m) => m.name === settings.model)) return false;
    const ttModels = config?.textToText?.models?.[settings.provider] || [];
    const tiModels = config?.textToImage?.models?.[settings.provider] || [];
    return (
      !ttModels.some((m) => m.name === settings.model) &&
      !tiModels.some((m) => m.name === settings.model)
    );
  })();

  // Check if current model is a text-to-speech (TTS) model
  // Only true if the model is in textToSpeech but NOT in textToText or textToImage
  const isTTSModel = (() => {
    const ttsModels = config?.textToSpeech?.models?.[settings.provider] || [];
    if (!ttsModels.some((m) => m.name === settings.model)) return false;
    const ttModels = config?.textToText?.models?.[settings.provider] || [];
    const tiModels = config?.textToImage?.models?.[settings.provider] || [];
    return (
      !ttModels.some((m) => m.name === settings.model) &&
      !tiModels.some((m) => m.name === settings.model)
    );
  })();

  const handleSend = async (content, images = []) => {
    // --- TTS branch ---
    if (isTTSModel) {
      if (!content.trim()) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "Error: Please enter text to convert to speech.",
          },
        ]);
        return;
      }

      setIsGenerating(true);

      try {
        let currentId = activeId;
        let currentTitle = title;

        if (!currentId) {
          currentTitle = content.slice(0, 40) || "Speech Generation";
          setTitle(currentTitle);
          currentId = crypto.randomUUID();
          setActiveId(currentId);
          updateUrl(currentId);
        }

        const userMsg = {
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMsg]);

        const { systemPrompt } = settings;

        const defaultVoice =
          config?.textToSpeech?.defaultVoices?.[settings.provider] || undefined;
        const requestStart = performance.now();

        const result = await PrismService.generateSpeech({
          provider: settings.provider,
          text: content,
          voice: settings.voice || defaultVoice,
          model: settings.model,
          // Server-side conversation accumulation
          conversationId: currentId,
          conversationMeta: { title: currentTitle, systemPrompt },
        });

        const totalTime = (performance.now() - requestStart) / 1000;

        // Estimate cost from character count and model pricing
        const ttsModels =
          config?.textToSpeech?.models?.[settings.provider] || [];
        const ttsModelDef = ttsModels.find((m) => m.name === settings.model);
        const charCount = content.length;
        let estimatedCost = null;
        if (ttsModelDef?.pricing?.perCharacter) {
          estimatedCost = charCount * ttsModelDef.pricing.perCharacter;
        } else if (ttsModelDef?.pricing?.inputPerMillion) {
          const estimatedTokens = Math.ceil(charCount / 4);
          estimatedCost =
            (estimatedTokens / 1_000_000) * ttsModelDef.pricing.inputPerMillion;
        }

        const usedVoice = settings.voice || defaultVoice || "";

        const assistantMsg = {
          role: "assistant",
          content: "",
          audio: result.audioDataUrl,
          timestamp: new Date().toISOString(),
          provider: settings.provider,
          model: settings.model,
          voice: usedVoice,
          totalTime,
          usage: { characters: charCount },
          estimatedCost,
        };

        setMessages((prev) => [...prev, assistantMsg]);
        loadConversations();
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, error: error.message };
          } else {
            updated.push({ role: "assistant", content: "", error: error.message });
          }
          return updated;
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // --- Audio transcription branch ---
    if (isTranscriptionModel) {
      const audioFiles = images.filter((dataUrl) => {
        const match = dataUrl.match(/^data:([^;]+);/);
        return match && match[1].startsWith("audio/");
      });

      if (audioFiles.length === 0) {
        setMessages((prev) => [
          ...prev,
          {
            role: "system",
            content: "Error: Please attach an audio file to transcribe.",
          },
        ]);
        return;
      }

      setIsGenerating(true);

      try {
        let currentId = activeId;
        let currentTitle = title;

        if (!currentId) {
          currentTitle = "Audio Transcription";
          setTitle(currentTitle);
          currentId = crypto.randomUUID();
          setActiveId(currentId);
          updateUrl(currentId);
        }

        const { systemPrompt } = settings;
        const conversationMeta = { title: currentTitle, systemPrompt };

        for (const audioDataUrl of audioFiles) {
          const userMsg = {
            role: "user",
            content: content || "Transcribe this audio",
            timestamp: new Date().toISOString(),
            images: [audioDataUrl],
          };

          setMessages((prev) => [...prev, userMsg]);

          const result = await PrismService.transcribeAudio({
            provider: settings.provider,
            audio: audioDataUrl,
            model: settings.model,
            ...(content ? { prompt: content } : {}),
            // Server-side conversation accumulation
            conversationId: currentId,
            conversationMeta,
          });

          const assistantMsg = {
            role: "assistant",
            content: result.text,
            timestamp: new Date().toISOString(),
            provider: settings.provider,
            model: settings.model,
            usage: result.usage || null,
            totalTime: result.totalTime || null,
            estimatedCost: result.estimatedCost || null,
          };

          setMessages((prev) => [...prev, assistantMsg]);
        }

        loadConversations();
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, error: error.message };
          } else {
            updated.push({ role: "assistant", content: "", error: error.message });
          }
          return updated;
        });
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // --- Normal text generation branch ---
    // Categorize attachments by MIME type so the server places them
    // in the correct media fields (images, video, audio, pdf).
    const mediaFields = {};
    if (images.length > 0) {
      const imageArr = [];
      const videoArr = [];
      const audioArr = [];
      const pdfArr = [];
      for (const dataUrl of images) {
        const mimeMatch = dataUrl.match(/^data:([^;]+);/);
        const mime = mimeMatch?.[1] || "";
        if (mime.startsWith("video/")) videoArr.push(dataUrl);
        else if (mime.startsWith("audio/")) audioArr.push(dataUrl);
        else if (mime === "application/pdf") pdfArr.push(dataUrl);
        else imageArr.push(dataUrl); // default to image
      }
      if (imageArr.length > 0) mediaFields.images = imageArr;
      if (videoArr.length > 0) mediaFields.video = videoArr;
      if (audioArr.length > 0) mediaFields.audio = audioArr;
      if (pdfArr.length > 0) mediaFields.pdf = pdfArr;
    }
    const userMsg = {
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      ...mediaFields,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setIsGenerating(true);
    setToolActivity([]);
    setStreamingOutputs(new Map());

    // ── Function Calling branch ──────────────────────────────
    if (settings.functionCallingEnabled) {
      try {
        let currentId = activeId;
        let currentTitle = title;

        if (!currentId) {
          currentTitle =
            content.substring(0, 30) + (content.length > 30 ? "..." : "");
          setTitle(currentTitle);
          currentId = crypto.randomUUID();
          setActiveId(currentId);
          updateUrl(currentId);
        }

        const systemPromptText = settings.systemPrompt || FC_SYSTEM_PROMPT;
        const currentMessages = [...newMessages];

        // Insert placeholder so the blinking cursor shows immediately
        setMessages((prev) => {
          const cleaned = prev.filter(
            (m) =>
              !(
                m.role === "assistant" &&
                !m.content?.trim() &&
                !m.toolCalls?.length
              ),
          );
          return [
            ...cleaned,
            {
              role: "assistant",
              content: "",
              timestamp: new Date().toISOString(),
              provider: settings.provider,
              model: settings.model,
            },
          ];
        });

        await new Promise((resolve, reject) => {
          const payload = {
            provider: settings.provider,
            model: settings.model,
            messages: [
              { role: "system", content: systemPromptText },
              ...currentMessages
                .filter((m) => !m.deleted)
                .map((m) => ({
                  role: m.role,
                  content: m.content,
                  ...(m.images ? { images: m.images } : {}),
                  ...(m.video ? { video: m.video } : {}),
                  ...(m.audio ? { audio: m.audio } : {}),
                  ...(m.pdf ? { pdf: m.pdf } : {}),
                })),
            ],
            functionCallingEnabled: true,
            enabledTools: allToolSchemas.map(t => t.name),
            maxTokens: settings.maxTokens,
            temperature: settings.temperature,
            // Pass thinking toggle so the server respects it for local models
            thinkingEnabled: settings.thinkingEnabled ?? false,
            conversationId: currentId,
            conversationMeta: {
              title: currentTitle,
              systemPrompt: systemPromptText,
            },
          };

          let streamedText = "";
          let streamedThinking = "";

          abortRef.current = PrismService.streamText(payload, {
            onChunk: (chunk) => {
              streamedText += chunk;
              setMessages((prev) => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (
                  lastMsg?.role === "assistant" &&
                  !lastMsg.toolCalls?.length
                ) {
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
                }
                return updated;
              });
            },
            onToolExecution: (data) => {
              const tc = data.tool;
              // Reset streamed text for the new iteration so the next
              // assistant message doesn't repeat previous segments
              if (data.status === "calling") {
                streamedText = "";
                streamedThinking = "";
              }
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
                      return { ...activity, status: data.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) };
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
            // MCP native tool events from LM Studio
            // Server injects position markers into the thinking stream;
            // here we just track tool activity state for UI rendering.
            onToolCall: (tc) => {
              setToolActivity((prev) => {
                let updated;
                if (tc.status === "calling") {
                  // Deduplicate: Prism may re-emit tool calls
                  const alreadyTracked = prev.some((a) =>
                    (tc.id && a.id === tc.id) ||
                    (!tc.id && a.name === tc.name),
                  );
                  if (alreadyTracked) return prev;

                  updated = [
                    ...prev,
                    {
                      id: tc.id || `tc-${Date.now()}-${Math.random()}`,
                      name: tc.name,
                      args: tc.args || {},
                      status: "calling",
                      timestamp: Date.now(),
                    },
                  ];
                } else {
                  updated = prev.map((a) =>
                    (tc.id && a.id === tc.id) ||
                    (!tc.id && a.name === tc.name && a.status === "calling")
                      ? { ...a, status: tc.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) }
                      : a,
                  );
                }
                setMessages((msgPrev) => {
                  const arr = [...msgPrev];
                  const last = arr[arr.length - 1];
                  if (last?.role === "assistant") {
                    arr[arr.length - 1] = {
                      ...last,
                      toolCalls: updated,
                    };
                  }
                  return arr;
                });
                return updated;
              });
            },
            onToolOutput: handleToolOutput,
            onDone: (data) => {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    usage: data.usage,
                    totalTime: data.totalTime,
                    tokensPerSec: data.tokensPerSec,
                    estimatedCost: data.estimatedCost,
                    status: undefined,
                    statusPhase: undefined,
                  };
                }
                return updated;
              });
              setToolActivity([]);
              resolve();
            },
            onError: (err) => reject(err),
          });
        });

        loadConversations();
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, error: error.message };
          } else {
            updated.push({ role: "assistant", content: "", error: error.message });
          }
          return updated;
        });
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
      }
      return;
    }

    try {
      let currentId = activeId;
      let currentTitle = title;

      if (!currentId) {
        currentTitle =
          content.substring(0, 30) + (content.length > 30 ? "..." : "");
        setTitle(currentTitle);
        currentId = crypto.randomUUID();
        setActiveId(currentId);
        updateUrl(currentId);
      }

      const { systemPrompt } = settings;

      const systemMsg = settings.systemPrompt
        ? [{ role: "system", content: settings.systemPrompt }]
        : [];
      const payloadMessages = [...systemMsg, ...newMessages]
        .filter((m) => !m.deleted)
        .map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.images ? { images: m.images } : {}),
          ...(m.video ? { video: m.video } : {}),
          ...(m.audio ? { audio: m.audio } : {}),
          ...(m.pdf ? { pdf: m.pdf } : {}),
        }));
      const stopArray = settings.stopSequences
        ? settings.stopSequences
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

      const currentModels =
        config?.textToText?.models?.[settings.provider] || [];
      const selectedModelDef = currentModels.find(
        (m) => m.name === settings.model,
      );

      const payload = {
        provider: settings.provider,
        model: settings.model,
        messages: payloadMessages,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        topP: settings.topP,
        topK: settings.topK,
        frequencyPenalty: settings.frequencyPenalty,
        presencePenalty: settings.presencePenalty,
        stopSequences: stopArray?.length ? stopArray : undefined,
        ...(settings.seed !== undefined && settings.seed !== "" && { seed: settings.seed }),
        ...(settings.minP !== undefined && settings.minP > 0 && { minP: settings.minP }),
        ...(settings.repeatPenalty !== undefined && settings.repeatPenalty !== 1 && { repeatPenalty: settings.repeatPenalty }),
        ...(selectedModelDef?.responsesAPI
          ? {
              reasoningEffort: settings.reasoningEffort || "high",
              ...(settings.reasoningSummary
                ? { reasoningSummary: settings.reasoningSummary }
                : {}),
            }
          : {}),
        ...(!selectedModelDef?.responsesAPI &&
        (selectedModelDef?.thinking || settings.provider === "lm-studio")
          ? {
              // LM Studio: thinking defaults to ON; only send false when explicitly toggled off
              thinkingEnabled: settings.provider === "lm-studio"
                ? (settings.thinkingEnabled !== false)
                : (settings.thinkingEnabled || false),
              ...((settings.thinkingEnabled !== false || settings.provider === "lm-studio") ? {
                reasoningEffort: settings.reasoningEffort,
                thinkingLevel: settings.thinkingLevel,
                thinkingBudget: settings.thinkingBudget || undefined,
              } : {}),
            }
          : {}),
        ...(settings.webSearchEnabled ? { webSearch: true } : {}),
        ...(settings.webSearchEnabled && selectedModelDef?.webFetch
          ? { webFetch: true }
          : {}),
        ...(settings.codeExecutionEnabled ? { codeExecution: true } : {}),
        ...(settings.urlContextEnabled ? { urlContext: true } : {}),
        ...(settings.forceImageGeneration ? { forceImageGeneration: true } : {}),
        ...(settings.verbosity ? { verbosity: settings.verbosity } : {}),
        // Server-side conversation accumulation
        conversationId: currentId,
        conversationMeta: { title: currentTitle, systemPrompt },
      };

      // Use WebSocket streaming for real-time text generation
      await new Promise((resolve, reject) => {
        let streamedText = "";
        let streamedThinking = "";
        let streamedImages = [];
        const codeBlocks = [];

        // Reset audio player for new generation
        if (audioPlayerRef.current) {
          audioPlayerRef.current.stop();
          audioPlayerRef.current = null;
        }

        // Add placeholder AI message
        const placeholderMsg = {
          role: "assistant",
          content: "",
          thinking: "",
          timestamp: new Date().toISOString(),
          provider: settings.provider,
          model: settings.model,
        };
        const msgsWithPlaceholder = [...newMessages, placeholderMsg];
        setMessages(msgsWithPlaceholder);

        abortRef.current = PrismService.streamText(payload, {
          onStatus: (statusData) => {
            const message = typeof statusData === "string" ? statusData : statusData?.message || "";
            // Sync lmLoadProgress with chat auto-load status
            const loadMatch = message.match(/Loading model[\u2026.]\s*(\d+)%/);
            if (loadMatch) {
              const pct = parseInt(loadMatch[1], 10) / 100;
              setLmLoadProgress(pct < 1 ? pct : null);
            } else if (!message.toLowerCase().includes("unload")) {
              // Non-loading status — clear progress
              setLmLoadProgress((prev) => (prev != null ? null : prev));
            }

            const phase = statusData?.phase || undefined;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                status: message,
                statusPhase: phase,
              };
              return updated;
            });
          },
          onChunk: (content) => {
            // Safety net: if we receive a chunk while lmLoadProgress is
            // stuck (model loaded via chat auto-load), clear it now.
            setLmLoadProgress((prev) => (prev != null ? null : prev));

            streamedText += content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: streamedText,
              };
              return updated;
            });
          },
          onThinking: (content) => {
            streamedThinking += content;
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                thinking: streamedThinking,
              };
              return updated;
            });
          },
          onAudio: (data, mimeType) => {
            // Live playback via Web Audio API
            const player = getAudioPlayer();
            player.enqueue(data, mimeType);
          },
          onImage: (data, mimeType, minioRef) => {
            setIsGeneratingImage(true);
            const imageUrl = minioRef
              ? PrismService.getFileUrl(minioRef)
              : `data:${mimeType};base64,${data}`;
            streamedImages = [...streamedImages, minioRef || imageUrl];
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                images: streamedImages,
              };
              return updated;
            });
          },
          onExecutableCode: (code, language) => {
            const lang = language || "python";
            streamedText += `\n\n\`\`\`exec-${lang}\n${code}\n\`\`\`\n\n`;
            codeBlocks.push({ type: "code", code, language: lang });
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: streamedText,
              };
              return updated;
            });
          },
          onCodeExecutionResult: (output, outcome) => {
            streamedText += `\n\n\`\`\`execresult-python\n${output}\n\`\`\`\n\n`;
            codeBlocks.push({ type: "result", output, outcome });
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: streamedText,
              };
              return updated;
            });
          },
          onWebSearchResult: (results) => {
            if (results && results.length > 0) {
              const citations = results
                .map((r) => `[${r.title}](${r.url})`)
                .join(" · ");
              streamedText += `\n\n> **Sources:** ${citations}\n\n`;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: streamedText,
                };
                return updated;
              });
            }
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
                    return { ...activity, status: data.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) };
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
          onToolOutput: handleToolOutput,
          onDone: async (data) => {
            setMessages((prev) => {
              const prevAssistant = prev[prev.length - 1];
              const safeToolCalls = prevAssistant?.toolCalls?.length > 0 ? prevAssistant.toolCalls : undefined;
              
              const finalMsg = {
                role: "assistant",
                content: streamedText,
                thinking: streamedThinking || undefined,
                ...(streamedImages.length > 0 ? { images: streamedImages } : {}),
                ...(data.audioRef ? { audio: data.audioRef } : {}),
                ...(safeToolCalls ? { toolCalls: safeToolCalls } : {}),
                timestamp: placeholderMsg.timestamp,
                provider: settings.provider,
                model: settings.model,
                usage: data.usage,
                totalTime: data.totalTime,
                tokensPerSec: data.tokensPerSec,
                estimatedCost: data.estimatedCost,
              };
              
              const updatedMessages = [...newMessages, finalMsg];
              return updatedMessages;
            });

            // Clear tool activity for next turn
            setToolActivity([]);
            loadConversations();
            resolve();
          },
          onError: (err) => {
            reject(err);
          },
        });
      });
    } catch (error) {
      console.error(error);
      setMessages((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant") {
          updated[updated.length - 1] = { ...last, error: error.message };
        } else {
          updated.push({ role: "assistant", content: "", error: error.message });
        }
        return updated;
      });
    } finally {
      setIsGenerating(false);
      setIsGeneratingImage(false);
    }
  };

  return (
    <main className={styles.appContainer}>
      <ThreePanelLayout
        leftTitle={null}
        leftPanel={
          <>
            <TabBarComponent
              tabs={[
                {
                  key: "settings",
                  icon: <Settings size={14} />,
                  tooltip: "Settings",
                },
                {
                  key: "tools",
                  icon: <Parentheses size={14} />,
                  badge: selectedModelSupportsFc
                    ? allToolSchemas.length
                    : undefined,
                  badgeDisabled: !settings.functionCallingEnabled,
                  disabled: !selectedModelSupportsFc,
                  tooltip: "Tools",
                },
                {
                  key: "params",
                  icon: <SlidersHorizontal size={14} />,
                  tooltip: "Parameters",
                },
                {
                  key: "info",
                  icon: <Info size={14} />,
                  tooltip: "Info",
                },
              ]}
              activeTab={leftTab}
              onChange={setLeftTab}
              glowingTabs={hoveredLink === "fc-card" ? ["tools"] : []}
              onTabHover={(key) =>
                setHoveredLink(key === "tools" ? "tools-tab" : null)
              }
            />
            {leftTab === "settings" && (
              <SettingsPanel
                config={config}
                settings={settings}
                onChange={(updates) =>
                  setSettings((s) => ({ ...s, ...updates }))
                }
                hasAssistantImages={messages.some(
                  (m) => m.role === "assistant" && m.images?.length > 0,
                )}
                inferenceMode={inferenceMode}
                onSystemPromptClick={() => setShowSystemPromptModal(true)}
                showSystemPromptModal={showSystemPromptModal}
                onCloseSystemPromptModal={() => setShowSystemPromptModal(false)}
                workflows={workflows}
                sessionStats={
                  messages.length > 0
                    ? {
                        messageCount: messages.length,
                        deletedCount: originalMessageCount - messages.length,
                        requestCount,
                        uniqueModels,
                        uniqueProviders,
                        totalTokens,
                        totalCost,
                        originalTotalCost,
                        usedTools,
                        modalities,
                      }
                    : null
                }
              />
            )}
            {leftTab === "tools" && selectedModelSupportsFc && (
              <CustomToolsPanel
                tools={customTools}
                onToolsChange={loadCustomTools}
                builtInTools={builtInTools}
                disabledBuiltIns={disabledBuiltIns}
                onToggleBuiltIn={handleToggleBuiltIn}
                onToggleAllBuiltIn={handleToggleAllBuiltIn}
              />
            )}
            {leftTab === "params" && (
              <ParametersPanelComponent
                settings={settings}
                onChange={(updates) =>
                  setSettings((s) => ({ ...s, ...updates }))
                }
                config={config}
              />
            )}
            {leftTab === "info" && (
              <ModelInfoPanel
                config={config}
                settings={settings}
                onChange={(updates) =>
                  setSettings((s) => ({ ...s, ...updates }))
                }
              />
            )}
          </>
        }
        rightPanel={
          <HistoryPanel
            sessions={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onNew={handleNewChatClick}
            onDelete={handleDeleteConversation}
            favorites={convFavoriteKeys}
            onToggleFavorite={async (convId) => {
              if (convFavoriteKeys.includes(convId)) {
                setConvFavoriteKeys((prev) => prev.filter((k) => k !== convId));
                PrismService.removeFavorite("conversation", convId).catch(
                  () => {},
                );
              } else {
                setConvFavoriteKeys((prev) => [...prev, convId]);
                const conv = conversations.find((c) => c.id === convId);
                PrismService.addFavorite("conversation", convId, {
                  title: conv?.title || "Untitled",
                }).catch(() => {});
              }
            }}
            countLabel="conversations"
          />
        }
        headerTitle={title}
        navSidebar={
          <NavigationSidebarComponent
            mode="user"
            isGenerating={isGenerating}
            isGeneratingImage={isGeneratingImage}
          />
        }
        headerCenter={
          <ModelPickerPopoverComponent
            config={config}
            settings={settings}
            onSelectModel={(provider, modelName) => {
              const modelDef =
                (config?.textToText?.models?.[provider] || []).find(
                  (m) => m.name === modelName,
                ) ||
                (config?.textToImage?.models?.[provider] || []).find(
                  (m) => m.name === modelName,
                );
              const temp = modelDef?.defaultTemperature ?? 1.0;
              setSettings((s) => ({
                ...s,
                provider,
                model: modelName,
                temperature: temp,
              }));
              saveModel(provider, modelName);
            }}
            onLmStudioSelect={(rawModel) => {
              setLmConfigModel(rawModel);
            }}
            loadingProgress={lmLoadProgress}
            favorites={favoriteKeys}
            onToggleFavorite={async (key) => {
              if (favoriteKeys.includes(key)) {
                setFavoriteKeys((prev) => prev.filter((k) => k !== key));
                PrismService.removeFavorite("model", key).catch(() => {});
              } else {
                setFavoriteKeys((prev) => [...prev, key]);
                const [provider, ...rest] = key.split(":");
                PrismService.addFavorite("model", key, {
                  provider,
                  name: rest.join(":"),
                }).catch(() => {});
              }
            }}
          />
        }
        headerMeta={null}
        headerControls={
          <div className={styles.headerControls}>
            {messages.length > 0 && (
              <button
                className={styles.modeToggle}
                title="Send this conversation to a workflow"
                onClick={() => {
                  const convMessages = [];
                  if (settings.systemPrompt) {
                    convMessages.push({
                      role: "system",
                      content: settings.systemPrompt,
                    });
                  }
                  messages.forEach((m) => {
                    convMessages.push({
                      role: m.role,
                      content: m.content || "",
                      ...(m.images?.length > 0 ? { images: m.images } : {}),
                      ...(m.video?.length > 0 ? { video: m.video } : {}),
                      ...(m.audio?.length > 0 ? { audio: m.audio } : {}),
                      ...(m.pdf?.length > 0 ? { pdf: m.pdf } : {}),
                    });
                  });
                  sessionStorage.setItem(
                    "workflow_import_conversation",
                    JSON.stringify({
                      messages: convMessages,
                      provider: settings.provider,
                      model: settings.model,
                      title: title,
                    }),
                  );
                  router.push("/workflows?import=conversation");
                }}
              >
                <Send size={13} />
                To Workflow
              </button>
            )}
          </div>
        }
      >
        <ChatArea
          messages={messages}
          isGenerating={isGenerating}
          onStop={handleStop}
          newChatKey={newChatKey}
          conversationId={activeId}
          onSend={handleSend}
          onDelete={handleDeleteMessage}
          onRestore={handleRestoreMessage}
          onEdit={handleEditMessage}
          onRerun={handleRerunTurn}
          config={config}
          isTranscriptionModel={isTranscriptionModel}
          isTTSModel={isTTSModel}
          customTools={customTools}
          disabledBuiltIns={disabledBuiltIns}
          onToggleBuiltIn={handleToggleBuiltIn}
          onToggleCustomTool={handleToggleCustomTool}
          settings={settings}
          onUpdateSettings={(updates) =>
            setSettings((s) => ({ ...s, ...updates }))
          }
          supportedInputTypes={
            isTranscriptionModel
              ? ["audio"]
              : isTTSModel
                ? ["text"]
                : (() => {
                    const sections = [
                      "textToText",
                      "textToImage",
                      "textToSpeech",
                      "audioToText",
                    ];
                    for (const section of sections) {
                      const found = (
                        config?.[section]?.models?.[settings.provider] || []
                      ).find((m) => m.name === settings.model);
                      if (found?.inputTypes) return found.inputTypes;
                    }
                    return [];
                  })()
          }
          systemPrompt={settings.systemPrompt}
          onSystemPromptClick={() => setShowSystemPromptModal(true)}
          functionCallingEnabled={!!settings.functionCallingEnabled}
          enabledToolNames={allToolSchemas.map((t) => t.name)}
          toolCount={allToolSchemas.length}
          fcCardGlowing={hoveredLink === "tools-tab"}
          onFcCardHover={(hovering) =>
            setHoveredLink(hovering ? "fc-card" : null)
          }
          streamingOutputs={streamingOutputs}

          onLiveUserChunk={(fullText, { isTyped } = {}) => {
            setMessages((prev) => {
              const lastIdx = prev.length - 1;
              const lastMsg = prev[lastIdx];
              // Update existing streaming user message
              if (lastMsg?.role === "user" && lastMsg._liveStreaming) {
                const updated = [...prev];
                updated[lastIdx] = { ...lastMsg, content: fullText };
                return updated;
              }
              // Create new streaming user message
              return [
                ...prev,
                {
                  role: "user",
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  _liveStreaming: true,
                  ...(!isTyped && { _liveTranscription: true }),
                },
              ];
            });
          }}
          onLiveAssistantChunk={(fullText) => {
            setMessages((prev) => {
              const lastIdx = prev.length - 1;
              const lastMsg = prev[lastIdx];
              // Update existing streaming assistant message
              if (lastMsg?.role === "assistant" && lastMsg._liveStreaming) {
                const updated = [...prev];
                updated[lastIdx] = { ...lastMsg, content: fullText };
                return updated;
              }
              // Create new streaming assistant message
              return [
                ...prev,
                {
                  role: "assistant",
                  content: fullText,
                  timestamp: new Date().toISOString(),
                  provider: settings.provider,
                  model: settings.model,
                  _liveStreaming: true,
                },
              ];
            });
          }}
          onLiveTurnComplete={(turnData) => {
            // Finalize messages: remove _liveStreaming flag, attach audio + usage
            // IMPORTANT: The updater must be a pure function (no side effects).
            // React StrictMode double-invokes updaters to detect impurity.
            let capturedFinalized = null;
            setMessages((prev) => {
              const finalized = prev.map((m) => {
                if (!m._liveStreaming) return m;
                const { _liveStreaming: _, _liveTranscription, ...rest } = m;
                // Preserve speech-transcription flag (stripped of underscore prefix)
                if (_liveTranscription) rest.liveTranscription = true;
                // Attach audioRef and usage to the assistant message
                if (rest.role === "assistant" && turnData) {
                  if (turnData.audioRef) rest.audio = turnData.audioRef;
                  if (turnData.usage) {
                    rest.usage = turnData.usage;
                    // Prefer server-computed cost (uses audioInputPerMillion + audioOutputPerMillion)
                    if (turnData.estimatedCost != null) {
                      rest.estimatedCost = turnData.estimatedCost;
                    } else {
                      // Fallback: compute locally with audio-aware rates
                      const pricing = (() => {
                        const models =
                          config?.textToText?.models?.[settings.provider] || [];
                        const md = models.find(
                          (x) => x.name === settings.model,
                        );
                        return md?.pricing;
                      })();
                      if (pricing && turnData.usage) {
                        const inputRate =
                          pricing.audioInputPerMillion ||
                          pricing.inputPerMillion ||
                          0;
                        const outputRate =
                          pricing.audioOutputPerMillion ||
                          pricing.outputPerMillion ||
                          0;
                        const inCost =
                          (turnData.usage.inputTokens / 1_000_000) * inputRate;
                        const outCost =
                          (turnData.usage.outputTokens / 1_000_000) *
                          outputRate;
                        rest.estimatedCost = parseFloat(
                          (inCost + outCost).toFixed(8),
                        );
                      }
                    }
                  }
                }
                return rest;
              });

              capturedFinalized = finalized;
              return finalized;
            });

            // ── Persist to DB (outside updater — runs exactly once) ──
            if (!capturedFinalized) return;

            let currentId = liveConvIdRef.current || activeId;
            const { systemPrompt, ...modelSettings } = settings;

            if (!currentId) {
              // ID not yet assigned — generate one and assign it now
              currentId = crypto.randomUUID();
              liveConvIdRef.current = currentId;
              setActiveId(currentId);
              updateUrl(currentId);
            }

            if (!liveConvCreatedRef.current) {
              // First persist — create the conversation via appendMessages (auto-creates doc)
              const firstUserMsg = capturedFinalized.find((m) => m.role === "user");
              const liveTitle =
                firstUserMsg?.content?.slice(0, 40) || "Live Conversation";
              setTitle(liveTitle);

              livePersistChainRef.current = livePersistChainRef.current
                .then(() =>
                  PrismService.appendMessages(currentId, capturedFinalized, null, {
                    title: liveTitle,
                    systemPrompt,
                    settings: modelSettings,
                  }).then(() => {
                    liveConvCreatedRef.current = true;
                    loadConversations();
                  }),
                )
                .catch((err) =>
                  console.error("[Live] Failed to create conversation:", err),
                );
            } else {
              // Subsequent turns — doc exists, safe to PATCH
              livePersistChainRef.current = livePersistChainRef.current
                .then(() =>
                  PrismService.patchConversation(currentId, {
                    messages: capturedFinalized,
                    systemPrompt,
                    settings: modelSettings,
                  }).then(() => loadConversations()),
                )
                .catch((err) =>
                  console.error("[Live] Failed to persist:", err),
                );
            }
          }}
          onLiveUserAudioReady={(userAudioRef) => {
            // Eagerly attach the user's uploaded audio to their message
            // The server sends this as soon as the model starts its turn,
            // so the audio card appears immediately, not after the model finishes.
            setMessages((prev) => {
              const updated = [...prev];
              // Find the most recent user message (streaming or finalized)
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === "user") {
                  updated[i] = { ...updated[i], audio: userAudioRef };
                  break;
                }
              }
              return updated;
            });
          }}
          onInitializeLiveConversation={(newId) => {
            liveConvIdRef.current = newId;
            setActiveId(newId);
            updateUrl(newId);
          }}
          onLiveToolExecution={(data) => {
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
                // Try attaching to the most recent assistant message (if it is the live streaming one)
                const last = arr[arr.length - 1];
                if (last?.role === "assistant" || last?._liveStreaming) {
                  arr[arr.length - 1] = { ...last, toolCalls: updated };
                }
                return arr;
              });
              return updated;
            });
          }}
        />
      </ThreePanelLayout>

      {/* LM Studio Model Load Config Modal */}
      {lmConfigModel && (
        <ModelLoadConfigPanel
          model={lmConfigModel}
          service={PrismService}
          loading={lmConfigLoading}
          onClose={() => setLmConfigModel(null)}
          onLoad={(modelKey, options) => startLmLoad(modelKey, options)}
        />
      )}


      {toastElement}
    </main>
  );
}
