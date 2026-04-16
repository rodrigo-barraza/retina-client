"use client";

import {
  Paperclip,
  FileText,
  AlertCircle,
  X,
  Parentheses,
  Zap,
  Mic,
  MicOff,
} from "lucide-react";
import AudioPlayerRecorderComponent from "./AudioPlayerRecorderComponent";
import ImagePreviewComponent from "./ImagePreviewComponent";
import DrawingCanvas from "./DrawingCanvas";
import DocumentViewer from "./DocumentViewer";
import ToolCardComponent from "./ToolCardComponent";
import MessageList from "./MessageList";
import LiveSessionService from "../services/LiveSessionService";

import SoundService from "@/services/SoundService";
import styles from "./ChatArea.module.css";
import { ALL_CONSOLE_PROMPTS } from "../arrays.js";
import { useEffect, useRef, useState } from "react";
import PrismService from "../services/PrismService";
import { shuffleArray } from "../utils/utilities";

import ToggleSwitchComponent from "./ToggleSwitch";
import ChatInputButton from "./ChatInputButton";
import {
  TOOL_COLORS,
  TOOL_ICON_MAP,
  TOGGLEABLE_TOOLS,
} from "./WorkflowNodeConstants";

// ── Tool descriptions for empty-state cards ──
const TOOL_DESCRIPTIONS = {
  Thinking: "Extended reasoning for complex problems and multi-step analysis.",
  "Web Search": "Search the web for real-time information and cite sources.",
  "Google Search": "Search the web for real-time information and cite sources.",
  "Web Fetch": "Fetch and read content from any URL on the web.",
  "Code Execution": "Run code in a sandboxed environment and return results.",
  "URL Context": "Extract and analyze content from provided URLs.",
  "Function Calling":
    "Ask about weather, events, commodities, trends, and more.",
  "Image Generation":
    "Force the model to generate an image in its response.",
};

// Map model input types to file accept strings
const TYPE_ACCEPT_MAP = {
  image: "image/*",
  audio: "audio/*",
  video: "video/*",
  pdf: "application/pdf",
};

function getMimeCategory(dataUrl) {
  if (!dataUrl) return "file";
  // Handle minio:// refs by extension
  if (dataUrl.startsWith("minio://")) {
    const ext = dataUrl.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
      return "image";
    if (["wav", "mp3", "webm", "ogg"].includes(ext)) return "audio";
    if (["mp4", "mov", "avi", "webm"].includes(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (ext === "txt") return "text";
    return "file";
  }
  const match = dataUrl.match(/^data:([\w-]+)\//);
  if (!match) return "file";
  const type = match[1];
  if (type === "application") return "pdf";
  if (type === "text") return "text";
  return type; // image, audio, video
}

function MediaPreview({ dataUrl: rawDataUrl, onClick, compact = false }) {
  const dataUrl = PrismService.getFileUrl(rawDataUrl);
  const category = getMimeCategory(rawDataUrl);

  if (category === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={dataUrl}
        alt="Attached"
        className={compact ? styles.pendingImg : styles.messageImage}
        onClick={onClick}
      />
    );
  }

  if (category === "audio") {
    return <AudioPlayerRecorderComponent src={dataUrl} compact={compact} />;
  }

  if (category === "video") {
    return (
      <div className={compact ? styles.pendingMediaThumb : styles.mediaCard}>
        <video
          controls
          src={dataUrl}
          className={compact ? styles.videoPreviewCompact : styles.videoPreview}
          preload="metadata"
        />
      </div>
    );
  }

  if (category === "pdf") {
    return (
      <div
        className={compact ? styles.pendingFileThumb : styles.mediaCard}
        onClick={onClick}
        style={onClick ? { cursor: "pointer" } : undefined}
      >
        <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
        <span className={styles.mediaCardLabel}>PDF</span>
      </div>
    );
  }

  // text / other
  return (
    <div
      className={compact ? styles.pendingFileThumb : styles.mediaCard}
      onClick={onClick}
      style={onClick ? { cursor: "pointer" } : undefined}
    >
      <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
      <span className={styles.mediaCardLabel}>{category.toUpperCase()}</span>
    </div>
  );
}


export default function ChatArea({
  messages,
  isGenerating,
  onSend,
  onStop,
  onDelete,
  onRestore,
  onEdit,
  onRerun,
  config,
  supportedInputTypes = [],
  isTranscriptionModel = false,
  isTTSModel = false,
  systemPrompt,
  onSystemPromptClick,
  readOnly = false,
  newChatKey = 0,
  conversationId = null,

  functionCallingEnabled = false,
  enabledToolNames = [],
  toolCount = 0,
  fcCardGlowing = false,
  onFcCardHover,
  settings = {},
  onUpdateSettings,
  onLiveUserChunk,
  onLiveAssistantChunk,
  onLiveTurnComplete,
  onLiveUserAudioReady,
  onLiveToolExecution,
  onInitializeLiveConversation,
  streamingOutputs,
}) {
  const [showToolsBubble, setShowToolsBubble] = useState(false);
  const toolsBubbleRef = useRef(null);

  // Compute selected model to know which tools it supports
  const currentProviderModels = Array.from(
    new Set([
      ...(config?.textToText?.models?.[settings?.provider] || []),
      ...(config?.textToImage?.models?.[settings?.provider] || []),
      ...(config?.audioToText?.models?.[settings?.provider] || []),
      ...(config?.textToSpeech?.models?.[settings?.provider] || []),
    ]),
  );
  const selectedModelDef = currentProviderModels.find(
    (m) => m.name === settings?.model,
  );

  const getToolToggle = (tool) => {
    switch (tool) {
      case "Thinking": {
        const isLmStudio = settings?.provider === "lm-studio";
        // LM Studio: thinking is toggleable whenever the model supports it.
        // When selectedModelDef hasn't loaded yet (async local config), fall back
        // to name-based detection matching the server-side THINKING_PATTERNS.
        const modelName = (settings?.model || "").toLowerCase();
        const nameBasedThinking = ["qwen3", "deepseek-r1", "deepseek-v3", "gpt-oss", "gemma-4"]
          .some((p) => modelName.includes(p));
        const canToggle = isLmStudio && (selectedModelDef?.thinking || nameBasedThinking);
        return {
          checked: isLmStudio
            ? (canToggle ? (settings?.thinkingEnabled !== false) : true)
            : (settings?.thinkingEnabled || false),
          onChange: (val) => onUpdateSettings?.({ thinkingEnabled: val }),
          disabled: isLmStudio && !canToggle,
        };
      }
      case "Web Search":
      case "Google Search":
      case "Web Fetch":
        return {
          checked: settings?.webSearchEnabled || false,
          onChange: (val) => onUpdateSettings?.({ webSearchEnabled: val }),
          disabled: settings?.codeExecutionEnabled,
        };
      case "Code Execution":
        return {
          checked: settings?.codeExecutionEnabled || false,
          onChange: (val) => {
            const updates = { codeExecutionEnabled: val };
            if (val) {
              updates.webSearchEnabled = false;
              updates.urlContextEnabled = false;
            }
            onUpdateSettings?.(updates);
          },
          disabled: false,
        };
      case "URL Context":
        return {
          checked: settings?.urlContextEnabled || false,
          onChange: (val) => onUpdateSettings?.({ urlContextEnabled: val }),
          disabled: settings?.codeExecutionEnabled,
        };
      case "Function Calling":
        return {
          checked: settings?.functionCallingEnabled || false,
          onChange: (val) =>
            onUpdateSettings?.({ functionCallingEnabled: val }),
          disabled: false,
        };
      case "Image Generation":
        return {
          checked: settings?.forceImageGeneration || false,
          onChange: (val) =>
            onUpdateSettings?.({ forceImageGeneration: val }),
          disabled: false,
        };
      default:
        return null;
    }
  };

  const activeTools = [];
  if (selectedModelDef) {
    const isReasoning =
      selectedModelDef.thinking ||
      (settings?.model || "").includes("o1") ||
      (settings?.model || "").includes("o3");
    if (isReasoning && !selectedModelDef.responsesAPI) {
      activeTools.push("Thinking");
    }
    if (selectedModelDef.tools) {
      for (const t of selectedModelDef.tools) {
        if (TOGGLEABLE_TOOLS.has(t) && !activeTools.includes(t)) {
          activeTools.push(t);
        }
      }
    }
  }

  useEffect(() => {
    if (!showToolsBubble) return;
    const handleClickOutside = (e) => {
      if (
        toolsBubbleRef.current &&
        !toolsBubbleRef.current.contains(e.target) &&
        !e.target.closest("[data-tools-btn]")
      ) {
        setShowToolsBubble(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showToolsBubble]);
  const nonTextTypes = supportedInputTypes.filter((t) => t !== "text");
  const hasFileInput = !isTTSModel && nonTextTypes.length > 0;
  const imageOnly = nonTextTypes.length === 1 && nonTextTypes[0] === "image";
  const acceptStr = nonTextTypes
    .map((t) => TYPE_ACCEPT_MAP[t])
    .filter(Boolean)
    .join(",");
  const hasAudioInput = !isTTSModel && supportedInputTypes.includes("audio");
  const [input, setInput] = useState("");
  const [pendingImages, setPendingImages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [docViewerSrc, setDocViewerSrc] = useState(null);

  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [showDrawing, setShowDrawing] = useState(false);
  const [fcRandomPrompts, setFcRandomPrompts] = useState([]);
  const dragCounter = useRef(0);

  // ── Live API mic state ────────────────────────────────────
  const isLiveModel = selectedModelDef?.liveAPI === true;
  const liveSessionRef = useRef(null);
  const [liveMicActive, setLiveMicActive] = useState(false);
  const [_liveConnected, setLiveConnected] = useState(false);
  // Accumulate transcriptions between turn boundaries
  const liveUserTranscriptRef = useRef("");
  const liveAssistantTranscriptRef = useRef("");
  // Stale = live model with messages but no active session (view-only)
  const liveSessionStale = isLiveModel && messages.length > 0 && !liveMicActive && !_liveConnected;

  // All input buttons disabled when viewing a past / ended conversation
  const inputDisabled = readOnly || liveSessionStale;

  // Clean up live session when model changes or unmounts
  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.disconnect();
        liveSessionRef.current = null;
      }
    };
  }, [settings?.model]);

  // Tear down live session when switching conversations
  const prevConvIdRef = useRef(conversationId);
  useEffect(() => {
    const prevId = prevConvIdRef.current;
    prevConvIdRef.current = conversationId;

    // Only tear down when changing away from an existing conversation (e.g., not from a new, unsaved chat)
    if (prevId && prevId !== conversationId && liveSessionRef.current) {
      liveSessionRef.current.disconnect();
      liveSessionRef.current = null;
      liveUserTranscriptRef.current = "";
      liveAssistantTranscriptRef.current = "";
    }
  }, [conversationId]);

  // ── Shared live session setup ─────────────────────────────
  // Builds the config and connects to Prism's /ws/live if not
  // already connected. Returns a Promise that resolves with
  // the session once setupComplete fires.  `responseModalities`
  // is overridable so text-only sends use ["TEXT"] while mic
  // sends use ["AUDIO"].
  const ensureLiveSession = (responseModalities = ["AUDIO"]) => {
    if (!liveSessionRef.current) {
      liveSessionRef.current = new LiveSessionService();
    }
    const session = liveSessionRef.current;

    if (session.connected) return Promise.resolve(session);

    return new Promise((resolve, reject) => {
      let connectConversationId = conversationId;
      if (!connectConversationId) {
        connectConversationId = crypto.randomUUID();
        onInitializeLiveConversation?.(connectConversationId);
      }

      // Build config from current settings
      const liveConfig = {
        responseModalities,
        conversationId: connectConversationId,
      };
      if (systemPrompt) {
        liveConfig.systemInstruction = systemPrompt;
      }
      if (settings?.temperature !== undefined) {
        liveConfig.temperature = settings.temperature;
      }
      if (settings?.liveVoice) {
        liveConfig.voiceName = settings.liveVoice;
      }
      const thinkingLevel = settings?.liveThinkingLevel || "none";
      if (thinkingLevel !== "none") {
        liveConfig.thinkingConfig = {
          includeThoughts: true,
          thinkingLevel,
        };
      }

      const activeToolNames = activeTools.filter((t) => getToolToggle(t)?.checked);
      if (activeToolNames.includes("Function Calling") && enabledToolNames.length > 0) {
        liveConfig.enabledTools = [...new Set([...activeToolNames, ...enabledToolNames])];
      } else {
        liveConfig.enabledTools = activeToolNames;
      }

      liveUserTranscriptRef.current = "";
      liveAssistantTranscriptRef.current = "";

      session.connect({
        model: settings?.model || "gemini-3.1-flash-live-preview",
        config: liveConfig,
        callbacks: {
          onSetupComplete: () => {
            setLiveConnected(true);
            resolve(session);
          },
          onText: (text) => {
            // Text-modality response chunks (used when responseModalities=["TEXT"])
            liveAssistantTranscriptRef.current += text;
            onLiveAssistantChunk?.(liveAssistantTranscriptRef.current);
          },
          onOutputTranscription: (text) => {
            liveAssistantTranscriptRef.current += text;
            onLiveAssistantChunk?.(liveAssistantTranscriptRef.current);
          },
          onInputTranscription: (text) => {
            liveUserTranscriptRef.current += text;
            onLiveUserChunk?.(liveUserTranscriptRef.current);
          },
          onThinking: (content) => {
            console.log("[LiveAPI] Thinking:", content);
          },
          onUserAudioReady: (userAudioRef) => {
            onLiveUserAudioReady?.(userAudioRef);
          },
          onToolExecution: (data) => {
            onLiveToolExecution?.(data);
          },
          onInterrupted: (turnData) => {
            if (liveAssistantTranscriptRef.current.trim()) {
              onLiveTurnComplete?.(turnData);
              liveAssistantTranscriptRef.current = "";
            }
          },
          onTurnComplete: (turnData) => {
            onLiveTurnComplete?.(turnData);
            liveUserTranscriptRef.current = "";
            liveAssistantTranscriptRef.current = "";
          },
          onError: (msg) => {
            console.error("[LiveAPI] Error:", msg);
            setLiveMicActive(false);
            reject(new Error(msg));
          },
          onClose: () => {
            if (
              liveUserTranscriptRef.current.trim() ||
              liveAssistantTranscriptRef.current.trim()
            ) {
              onLiveTurnComplete?.();
            }
            liveUserTranscriptRef.current = "";
            liveAssistantTranscriptRef.current = "";
            setLiveConnected(false);
            setLiveMicActive(false);
          },
        },
      });
    });
  };

  const handleLiveMicToggle = async () => {
    if (liveMicActive) {
      if (liveSessionRef.current) {
        liveSessionRef.current.stopMicrophone();
      }
      setLiveMicActive(false);
      return;
    }

    try {
      const session = await ensureLiveSession(["AUDIO"]);
      await session.startMicrophone();
      setLiveMicActive(true);
    } catch (err) {
      console.error("[LiveMic] Failed to start mic:", err);
    }
  };

  // Check if a file matches the accepted types
  const isFileAccepted = (file) => {
    if (!acceptStr) return false;
    const accepts = acceptStr.split(",").map((a) => a.trim());
    return accepts.some((accept) => {
      if (accept.endsWith("/*")) {
        const category = accept.replace("/*", "");
        return file.type.startsWith(category + "/");
      }
      return file.type === accept;
    });
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (hasFileInput && e.dataTransfer?.items?.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;
    if (!hasFileInput) return;
    const files = Array.from(e.dataTransfer?.files || []);
    const accepted = files.filter(isFileAccepted);
    for (const file of accepted) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaste = (e) => {
    if (!hasFileInput) return;
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile())
      .filter(Boolean)
      .filter(isFileAccepted);
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [input]);

  // Shuffle FC prompt suggestions on new chat
  useEffect(() => {
    if (functionCallingEnabled) {
      const pool = shuffleArray(ALL_CONSOLE_PROMPTS);
      setFcRandomPrompts(pool.slice(0, 5));
    }
  }, [functionCallingEnabled, newChatKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isGenerating) {
      onStop?.();
      return;
    }
    if (isTranscriptionModel) {
      if (pendingImages.length === 0) return;
    } else {
      if (!input.trim() && pendingImages.length === 0) return;
    }

    // ── Live model text input — route through WebSocket ────────
    if (isLiveModel && input.trim()) {
      const text = input.trim();
      setInput("");
      setPendingImages([]);

      // Add user message immediately (typed text won't trigger
      // inputTranscription from the API, so we inject it directly)
      onLiveUserChunk?.(text, { isTyped: true });

      try {
        // Use TEXT modality for typed input so the response is text,
        // unless the session is already connected (mic session = AUDIO)
        const session = liveSessionRef.current?.connected
          ? liveSessionRef.current
          : await ensureLiveSession(["AUDIO"]);
        session.sendText(text);
      } catch (err) {
        console.error("[LiveText] Failed to send text:", err);
      }
      return;
    }

    onSend(input, pendingImages);
    setInput("");
    setPendingImages([]);
  };

  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  const removeImage = (index) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messagesList}>

        {messages.length === 0 && activeTools.length > 0 && (
          <div className={styles.toolCardsStack}>
            <div className={styles.toolCardsHeader}>
              <Zap size={14} />
              <span>Tools</span>
              <span className={styles.toolCardsCount}>
                {activeTools.filter((t) => getToolToggle(t)?.checked).length}
              </span>
            </div>
            {activeTools.map((tool) => {
              const ToolIcon = TOOL_ICON_MAP[tool];
              const toggle = getToolToggle(tool);
              const isEnabled = toggle?.checked || false;
              const isLocked = (toggle?.disabled && toggle?.checked) || false;
              return (
                <ToolCardComponent
                  key={tool}
                  icon={ToolIcon ? <ToolIcon size={20} /> : null}
                  title={tool}
                  subtitle={TOOL_DESCRIPTIONS[tool] || ""}
                  color={TOOL_COLORS[tool]}
                  count={tool === "Function Calling" ? toolCount : undefined}
                  enabled={isEnabled}
                  locked={isLocked}
                  onClick={
                    toggle ? () => toggle.onChange(!isEnabled) : undefined
                  }
                  glowing={tool === "Function Calling" && fcCardGlowing}
                  onHover={
                    tool === "Function Calling"
                      ? (h) => onFcCardHover?.(h)
                      : undefined
                  }
                  {...(tool === "Image Generation" ? { enabledLabel: "Forced", disabledLabel: "Default" } : {})}
                />
              );
            })}
          </div>
        )}

        {messages.length === 0 &&
          activeTools.length === 0 &&
          config?.availableProviders?.length === 0 && (
            <div className={styles.welcome}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  padding: "48px 24px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(251, 191, 36, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <AlertCircle
                    size={28}
                    style={{ color: "var(--warning, #fbbf24)" }}
                  />
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 18,
                    color: "var(--text-primary)",
                  }}
                >
                  No Providers Configured
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "var(--text-secondary)",
                    maxWidth: 400,
                    lineHeight: 1.6,
                  }}
                >
                  Please set up your API keys or LM Studio URL in the{" "}
                  <code
                    style={{
                      padding: "2px 6px",
                      borderRadius: 2,
                      background: "var(--bg-tertiary)",
                      fontSize: 13,
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    config.js
                  </code>{" "}
                  file to get started!
                </p>
              </div>
            </div>
          )}

        {messages.length === 0 &&
          activeTools.length === 0 &&
          config?.availableProviders?.length > 0 && (
            <div className={styles.readyPrompt}>
              <h3>You&apos;re all set! 🎉</h3>
              <p>Your model is ready — start typing below to begin.</p>
            </div>
          )}

        <MessageList
          messages={messages}
          isGenerating={isGenerating}
          onDelete={onDelete}
          onRestore={onRestore}
          onEdit={onEdit}
          onRerun={onRerun}
          onImageClick={(url) => setLightboxSrc(url)}
          onDocClick={(url) => setDocViewerSrc(url)}
          streamingOutputs={streamingOutputs}
          systemPrompt={systemPrompt}
          onSystemPromptEdit={onSystemPromptClick}
          readOnly={readOnly}
        />

        {isGenerating &&
          messages.length > 0 &&
          !messages[messages.length - 1]?.content && (
            <div
              style={{
                maxWidth: 800,
                margin: "0 auto",
                width: "100%",
                paddingLeft: 48,
                fontSize: 14,
                color: "var(--text-muted)",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            >
              {messages[messages.length - 1]?.status || "Generating..."}
            </div>
          )}
        <div ref={endRef} />
      </div>



      {messages.length === 0 &&
        functionCallingEnabled &&
        fcRandomPrompts.length > 0 && (
          <div className={styles.toolCardsPrompts}>
            {fcRandomPrompts.map((prompt) => (
              <button
                key={prompt}
                className={styles.quickPrompt}
                onClick={() => {
                  setInput(prompt);
                  textareaRef.current?.focus();
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

      {isLiveModel &&
        messages.length > 0 &&
        (_liveConnected || liveMicActive ? (
          <div className={styles.liveStreamBanner}>
            <span className={styles.liveStreamDot} />
            Stream is live
          </div>
        ) : (
          <div
            className={`${styles.liveStreamBanner} ${styles.liveStreamStale}`}
          >
            <span className={styles.liveStreamDotStale} />
            Session ended
          </div>
        ))}

      {/* ── Status indicator bar (always visible thin bar above input) ── */}
      {(() => {
        const lastMsg = messages[messages.length - 1];
        const status = isGenerating ? (lastMsg?.status || "Generating...") : null;
        const phase = isGenerating ? lastMsg?.statusPhase : null;
        const phaseIcon = isGenerating
          ? ({ starting: "⚡", loading: "📦", processing: "⚙️", generating: "✨" }[phase] || "✨")
          : "✓";
        const label = status || "Ready";
        return (
          <div className={`${styles.statusBar}${isGenerating ? ` ${styles.statusBarActive}` : ""}`}>
            <span className={styles.statusBarIcon}>{phaseIcon}</span>
            <span className={styles.statusBarMessage}>{label}</span>
            {isGenerating && <span className={styles.statusBarPulse} />}
          </div>
        );
      })()}

      <div className={styles.inputWrapper}>
        {showToolsBubble && activeTools.length > 0 && (
          <div className={styles.toolsBubble} ref={toolsBubbleRef}>
            <div className={styles.toolsBubbleHeader}>
              <span>Tools</span>
            </div>
            <div className={styles.toolsBubbleList}>
              {activeTools.map((tool) => {
                const toggle = getToolToggle(tool);
                if (!toggle) return null;
                return (
                  <div
                    key={tool}
                    className={styles.toolsBubbleItem}
                    onClick={() => {
                      if (!toggle.disabled) {
                        toggle.onChange(!toggle.checked);
                      }
                    }}
                    style={{ cursor: toggle.disabled ? "default" : "pointer" }}
                  >
                    <div className={styles.toolsBubbleItemInfo}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          opacity: 0.7,
                        }}
                      >
                        {(() => {
                          const ToolIcon = TOOL_ICON_MAP[tool];
                          return ToolIcon ? (
                            <ToolIcon
                              size={14}
                              style={{ color: TOOL_COLORS[tool] }}
                            />
                          ) : (
                            <Parentheses
                              size={14}
                              style={{ color: TOOL_COLORS[tool] }}
                            />
                          );
                        })()}
                      </span>
                      <span className={styles.toolsBubbleItemName}>{tool}</span>
                    </div>
                    <div style={{ pointerEvents: "none" }}>
                      <ToggleSwitchComponent
                        checked={toggle.checked}
                        onChange={() => {}}
                        size="small"
                        disabled={toggle.disabled}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className={`${styles.inputBox} ${isDragging ? styles.inputBoxDragActive : ""} ${isGenerating ? styles.inputBoxGenerating : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget || e.target.tagName === 'TEXTAREA') SoundService.playClick({ event: e }); }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {isDragging && (
            <div className={styles.dragOverlay}>
              <Paperclip size={20} />
              <span>Drop files here</span>
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className={styles.pendingImages}>
              {pendingImages.map((dataUrl, i) => {
                const cat = getMimeCategory(dataUrl);
                const resolvedUrl = PrismService.getFileUrl(dataUrl);
                const isAudio = cat === "audio";
                return (
                  <div key={i} className={styles.pendingAttachmentWrap}>
                    {isAudio ? (
                      <AudioPlayerRecorderComponent
                        src={resolvedUrl}
                        compact
                        onRemove={() => removeImage(i)}
                      />
                    ) : (
                      <>
                        <MediaPreview
                          dataUrl={dataUrl}
                          compact
                          onClick={(() => {
                            if (cat === "image")
                              return () => setLightboxSrc(dataUrl);
                            if (cat === "pdf" || cat === "text")
                              return () => setDocViewerSrc(dataUrl);
                            return undefined;
                          })()}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className={styles.removeAttachment}
                        >
                          <X size={14} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className={styles.inputRow}>
            {activeTools.length > 0 && (
              <ChatInputButton
                onClick={() => setShowToolsBubble((v) => !v)}
                label="Tools"
                isActive={showToolsBubble}
                icon="wrench"
                disabled={inputDisabled}
                data-tools-btn
              />
            )}
            {hasFileInput && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptStr}
                  multiple
                  hidden
                  onChange={handleImageSelect}
                />
                <ChatInputButton
                  onClick={() => fileInputRef.current?.click()}
                  label={imageOnly ? "Attach image" : "Attach file"}
                  icon="upload"
                  uploadTypes={nonTextTypes}
                  disabled={inputDisabled}
                />
              </>
            )}
            {supportedInputTypes.includes("image") && !isTTSModel && (
              <ChatInputButton
                onClick={() => setShowDrawing(true)}
                label="Create drawing"
                icon="pencil"
                disabled={inputDisabled}
              />
            )}
            {hasAudioInput && !isLiveModel && (
              <AudioPlayerRecorderComponent
                onRecordingComplete={(dataUrl) =>
                  setPendingImages((prev) => [...prev, dataUrl])
                }
              />
            )}
            {!isTranscriptionModel && (
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  inputDisabled
                    ? "This conversation has ended. Start a new one."
                    : isTTSModel
                      ? "Enter text to convert to speech..."
                      : "Type a message..."
                }
                rows={1}
                disabled={inputDisabled}
              />
            )}
            {isLiveModel && (
              <ChatInputButton
                onClick={handleLiveMicToggle}
                label={liveMicActive ? "Stop Live Mic" : "Start Live Mic"}
                isActive={liveMicActive}
                disabled={inputDisabled}
                icon={
                  liveMicActive ? (
                    <MicOff size={18} className={styles.liveMicActive} />
                  ) : (
                    <Mic size={18} />
                  )
                }
                className={
                  liveMicActive ? styles.liveMicBtn : styles.liveMicReady
                }
              />
            )}
            <ChatInputButton
              variant="submit"
              isGenerating={isGenerating}
              disabled={
                inputDisabled
                  ? true
                  : isGenerating
                    ? false
                    : isTranscriptionModel
                      ? pendingImages.length === 0
                      : !input.trim() && pendingImages.length === 0
              }
              label={isGenerating ? "Stop" : "Send"}
            />
          </div>
        </form>
        <div className={styles.hint}>
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

      {docViewerSrc && (
        <DocumentViewer
          dataUrl={docViewerSrc}
          onClose={() => setDocViewerSrc(null)}
        />
      )}

      {showDrawing && (
        <DrawingCanvas
          onClose={() => setShowDrawing(false)}
          onSave={(dataUrl) => {
            setPendingImages((prev) => [...prev, dataUrl]);
            setShowDrawing(false);
          }}
        />
      )}
    </div>
  );
}
