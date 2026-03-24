"use client";

import {
    Send,
    Loader2,
    ChevronDown,
    ChevronRight,
    Paperclip,
    Volume2,
    Video,
    FileText,
    Image as ImageIcon,
    Type,
    ArrowLeft,
    Mic,
    Edit3,
    Terminal,
    AlertCircle,
    LayoutGrid,
    X,
    Parentheses,
    Clock,
    Globe,
    Code,
    Monitor,
    Search,
    Brain,
} from "lucide-react";
import AudioRecorderComponent from "./AudioRecorderComponent";
import ImagePreviewComponent from "./ImagePreviewComponent";
import DrawingCanvas from "./DrawingCanvas";
import DocumentViewer from "./DocumentViewer";
import MessageList from "./MessageList";
import ModelGrid from "./ModelGrid";
import styles from "./ChatArea.module.css";
import consoleStyles from "./ConsoleComponent.module.css";
import { ALL_CONSOLE_PROMPTS } from "../arrays.js";
import { useEffect, useRef, useState } from "react";
import PrismService from "../services/PrismService";
import ProviderLogo from "./ProviderLogos";
import ToggleSwitchComponent from "./ToggleSwitch";
import ChatInputButton from "./ChatInputButton";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";

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
        return (
            <AudioRecorderComponent
                src={dataUrl}
                compact={compact}
            />
        );
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

const OUTPUT_MODALITIES = [
    {
        key: "text",
        title: "Text",
        subtitle: "Chat, code, and reasoning",
        icon: Type,
    },
    {
        key: "image",
        title: "Image",
        subtitle: "Create and edit images",
        icon: ImageIcon,
    },
    { key: "audio", title: "Speech", subtitle: "Text to speech", icon: Mic },
    {
        key: "video",
        title: "Video",
        subtitle: "Generate videos",
        icon: Video,
        disabled: true,
    },
];

const INPUT_MODALITY_META = {
    text: { title: "Text", subtitle: "Prompts and conversations", icon: Type },
    image: {
        title: "Image",
        subtitle: "Photos and screenshots",
        icon: ImageIcon,
    },
    audio: { title: "Audio", subtitle: "Voice and sound files", icon: Volume2 },
    video: { title: "Video", subtitle: "Video clips", icon: Video },
    pdf: { title: "PDF", subtitle: "Documents and papers", icon: FileText },
};

function getAllModelsFromConfig(config) {
    if (!config) return [];
    const seen = new Map();
    const sections = ["textToText", "textToImage", "textToSpeech", "audioToText"];
    for (const section of sections) {
        const modelsMap = config[section]?.models || {};
        for (const [provider, models] of Object.entries(modelsMap)) {
            for (const model of models) {
                const key = `${provider}-${model.name}`;
                if (!seen.has(key)) {
                    seen.set(key, { ...model, provider });
                }
            }
        }
    }
    return [...seen.values()];
}

function _getOutputTypesForInput(config, inputType) {
    const allModels = getAllModelsFromConfig(config);
    const outputSet = new Set();
    for (const m of allModels) {
        if (m.inputTypes?.includes(inputType)) {
            for (const out of m.outputTypes || []) {
                outputSet.add(out);
            }
        }
    }
    return [...outputSet];
}

function getModelsForIO(config, outputType, inputType) {
    const allModels = getAllModelsFromConfig(config);
    return allModels.filter(
        (m) =>
            m.outputTypes?.includes(outputType) &&
            (inputType == null || m.inputTypes?.includes(inputType)),
    );
}

function _formatContextLength(tokens) {
    if (!tokens) return null;
    if (tokens >= 1_000_000)
        return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
    return `${Math.round(tokens / 1000)}K`;
}

const ARENA_COLUMNS = [
    { key: "text", label: "Text" },
    { key: "code", label: "Code" },
    { key: "vision", label: "Vision" },
    { key: "document", label: "Document" },
    { key: "image", label: "Image" },
    { key: "imageEdit", label: "Image Edit" },
    { key: "search", label: "Search" },
];

function _getVisibleArenaColumns(models) {
    return ARENA_COLUMNS.filter((col) =>
        models.some((m) => m.arena && m.arena[col.key] != null),
    );
}

export default function ChatArea({
    messages,
    isGenerating,
    onSend,
    onDelete,
    onEdit,
    onRerun,
    config,
    onSelectModel,
    supportedInputTypes = [],
    isTranscriptionModel = false,
    isTTSModel = false,
    systemPrompt,
    onSystemPromptClick,
    readOnly = false,
    newChatKey = 0,
    toolActivitySlot = null,
    functionCallingEnabled = false,
    conversations = [],
    favorites = [],
    onToggleFavorite,
    settings = {},
    onUpdateSettings,
}) {
    const [showToolsBubble, setShowToolsBubble] = useState(false);
    const toolsBubbleRef = useRef(null);

    // Compute selected model to know which tools it supports
    const currentProviderModels = Array.from(new Set([
        ...(config?.textToText?.models?.[settings?.provider] || []),
        ...(config?.textToImage?.models?.[settings?.provider] || []),
        ...(config?.audioToText?.models?.[settings?.provider] || []),
        ...(config?.textToSpeech?.models?.[settings?.provider] || []),
    ]));
    const selectedModelDef = currentProviderModels.find(
        (m) => m.name === settings?.model,
    );

    const TOGGLEABLE_TOOLS = new Set([
        "Thinking",
        "Web Search",
        "Google Search",
        "Web Fetch",
        "Code Execution",
        "URL Context",
        "Function Calling",
    ]);

    const TOOL_ICONS = {
        Thinking: <Brain size={14} />,
        "Web Search": <Globe size={14} />,
        "Google Search": <Globe size={14} />,
        "Web Fetch": <Globe size={14} />,
        "Function Calling": <Parentheses size={14} />,
        "Code Execution": <Code size={14} />,
        "Computer Use": <Monitor size={14} />,
        "File Search": <Search size={14} />,
        "URL Context": <Globe size={14} />,
    };

    const getToolToggle = (tool) => {
        switch (tool) {
            case "Thinking":
                return {
                    checked: settings?.thinkingEnabled || false,
                    onChange: (val) => onUpdateSettings?.({ thinkingEnabled: val }),
                    disabled: false,
                };
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
                    onChange: (val) => onUpdateSettings?.({ functionCallingEnabled: val }),
                    disabled: false,
                };
            default:
                return null;
        }
    };

    const activeTools = [];
    if (selectedModelDef) {
        const isReasoning = selectedModelDef.thinking || (settings?.model || "").includes("o1") || (settings?.model || "").includes("o3");
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
            if (toolsBubbleRef.current && !toolsBubbleRef.current.contains(e.target) && !e.target.closest('[data-tools-btn]')) {
                setShowToolsBubble(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showToolsBubble]);
    const [_modelSort, _setModelSort] = useState({ key: null, dir: "desc" });
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
    const [welcomeStep, setWelcomeStep] = useState("pickOutput"); // "pickOutput" | "pickInput" | "pickModel"
    const [welcomeDone, setWelcomeDone] = useState(false);
    const [selectedOutput, setSelectedOutput] = useState(null);
    const [selectedInput, setSelectedInput] = useState(null);
    const endRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);
    const [systemPromptExpanded, setSystemPromptExpanded] = useState(true);
    const [isDragging, setIsDragging] = useState(false);
    const [showDrawing, setShowDrawing] = useState(false);
    const [fcRandomPrompts, setFcRandomPrompts] = useState([]);
    const dragCounter = useRef(0);

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

    // Reset welcome flow when starting a new chat
    useEffect(() => {
        if (messages.length === 0) {
            setWelcomeDone(false);
            setWelcomeStep("pickOutput");
            setSelectedOutput(null);
            setSelectedInput(null);
        }
    }, [messages.length, newChatKey]);

    // Shuffle FC prompt suggestions on new chat
    useEffect(() => {
        if (functionCallingEnabled) {
            const pool = [...ALL_CONSOLE_PROMPTS];
            for (let i = pool.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [pool[i], pool[j]] = [pool[j], pool[i]];
            }
            setFcRandomPrompts(pool.slice(0, 5));
        }
    }, [functionCallingEnabled, newChatKey]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (isTranscriptionModel) {
            if (pendingImages.length === 0 || isGenerating) return;
        } else {
            if ((!input.trim() && pendingImages.length === 0) || isGenerating) return;
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
                {systemPrompt &&
                    systemPrompt !== "You are a helpful AI assistant" &&
                    systemPrompt !== "You are a helpful AI assistant." && (
                        <div className={styles.systemPromptBanner}>
                            <button
                                className={styles.systemPromptToggle}
                                onClick={() => setSystemPromptExpanded((v) => !v)}
                            >
                                {systemPromptExpanded ? (
                                    <ChevronDown size={14} />
                                ) : (
                                    <ChevronRight size={14} />
                                )}
                                <span className={styles.systemPromptLabel}>
                                    <Terminal size={13} />
                                    System Prompt
                                </span>
                                {!readOnly && onSystemPromptClick && (
                                    <span
                                        className={styles.systemPromptEditBtn}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onSystemPromptClick();
                                        }}
                                        title="Edit system prompt"
                                    >
                                        <Edit3 size={13} />
                                    </span>
                                )}
                            </button>
                            {systemPromptExpanded && (
                                <div className={styles.systemPromptBody}>{systemPrompt}</div>
                            )}
                        </div>
                    )}

                {messages.length === 0 && functionCallingEnabled && (
                    <div className={consoleStyles.emptyState}>
                        <div className={consoleStyles.emptyIcon}>
                            <Parentheses size={40} />
                        </div>
                        <h2 className={consoleStyles.emptyTitle}>Function Calling</h2>
                        <p className={consoleStyles.emptySubtitle}>
                            Ask about weather, events, commodities, trends, or anything
                            powered by the Sun ecosystem.
                        </p>
                        <div className={consoleStyles.quickPrompts}>
                            {fcRandomPrompts.map((prompt) => (
                                <button
                                    key={prompt}
                                    className={consoleStyles.quickPrompt}
                                    onClick={() => {
                                        setInput(prompt);
                                        textareaRef.current?.focus();
                                    }}
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.length === 0 && !functionCallingEnabled && !welcomeDone && config?.availableProviders?.length === 0 && (
                    <div className={styles.welcome}>
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 16,
                            padding: "48px 24px",
                            textAlign: "center",
                        }}>
                            <div style={{
                                width: 56,
                                height: 56,
                                borderRadius: "50%",
                                background: "rgba(251, 191, 36, 0.12)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}>
                                <AlertCircle size={28} style={{ color: "var(--warning, #fbbf24)" }} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: 18, color: "var(--text-primary)" }}>
                                No Providers Configured
                            </h3>
                            <p style={{
                                margin: 0,
                                fontSize: 14,
                                color: "var(--text-secondary)",
                                maxWidth: 400,
                                lineHeight: 1.6,
                            }}>
                                Please set up your API keys or LM Studio URL in the{" "}
                                <code style={{
                                    padding: "2px 6px",
                                    borderRadius: 2,
                                    background: "var(--bg-tertiary)",
                                    fontSize: 13,
                                    fontFamily: "var(--font-mono, monospace)",
                                }}>config.js</code>{" "}
                                file to get started!
                            </p>
                        </div>
                    </div>
                )}

                {messages.length === 0 && !functionCallingEnabled && !welcomeDone && config?.availableProviders?.length > 0 && (
                    <div className={styles.welcome}>
                        {welcomeStep === "pickOutput" && (
                            <>
                                <div className={styles.stepHeader}>
                                    <div>
                                        <h3>What do you wanna make?</h3>
                                        <p className={styles.sectionSubtitle}>
                                            Pick an output type to get started
                                        </p>
                                    </div>
                                </div>
                                <div className={styles.capabilityGrid}>
                                    {OUTPUT_MODALITIES.map((mod) => {
                                        const Icon = mod.icon;
                                        return (
                                            <div
                                                key={mod.key}
                                                className={`${styles.capabilityCard} ${mod.disabled ? styles.capabilityDisabled : ""}`}
                                                onClick={() => {
                                                    if (!mod.disabled) {
                                                        setSelectedOutput(mod.key);
                                                        setWelcomeStep("pickInput");
                                                    }
                                                }}
                                            >
                                                <div className={styles.capabilityIcon} style={{ color: MODALITY_COLORS[mod.key] }}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className={styles.capabilityInfo}>
                                                    <h4>{mod.title}</h4>
                                                    <p>{mod.subtitle}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Recent models from conversations */}
                                {(() => {
                                    const seen = new Set();
                                    const recent = [];
                                    for (const conv of conversations) {
                                        const m = conv.settings?.model;
                                        const p = conv.settings?.provider;
                                        if (!m || !p) continue;
                                        const key = `${p}:${m}`;
                                        if (seen.has(key)) continue;
                                        seen.add(key);
                                        recent.push({ provider: p, model: m });
                                        if (recent.length >= 4) break;
                                    }
                                    if (recent.length === 0) return null;
                                    return (
                                        <>
                                            <div className={styles.recentDivider} />
                                            <div className={styles.recentSection}>
                                                <span className={styles.recentLabel}>
                                                    <Clock size={12} />
                                                    Recently Used Models
                                                </span>
                                                <div className={styles.recentModels}>
                                                    {recent.map((r) => (
                                                        <div
                                                            key={`${r.provider}:${r.model}`}
                                                            className={styles.recentModelChip}
                                                            onClick={() => {
                                                                setSelectedOutput(null);
                                                                setSelectedInput(null);
                                                                setWelcomeStep("pickOutput");
                                                                setWelcomeDone(true);
                                                                onSelectModel(r.provider, r.model);
                                                            }}
                                                        >
                                                            <ProviderLogo provider={r.provider} size={14} />
                                                            <span>{r.model}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}

                                <div
                                    className={styles.viewAllModelsCard}
                                    onClick={() => {
                                        setSelectedOutput(null);
                                        setSelectedInput(null);
                                        setWelcomeStep("pickModel");
                                    }}
                                >
                                    <LayoutGrid size={16} />
                                    <span>View all Models</span>
                                </div>
                            </>
                        )}

                        {welcomeStep === "pickInput" &&
                            (() => {
                                const outputMod = OUTPUT_MODALITIES.find(
                                    (m) => m.key === selectedOutput,
                                );
                                return (
                                    <>
                                        <div className={styles.stepHeader}>
                                            <button
                                                className={styles.backButton}
                                                onClick={() => {
                                                    setWelcomeStep("pickOutput");
                                                    setSelectedOutput(null);
                                                }}
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <div>
                                                <h3>What do you want to send?</h3>
                                                <p className={styles.sectionSubtitle}>
                                                    Making {outputMod?.title?.toLowerCase()} — now pick your
                                                    input
                                                </p>
                                            </div>
                                        </div>
                                        <div className={styles.capabilityGrid}>
                                            {Object.entries(INPUT_MODALITY_META).map(
                                                ([key, meta]) => {
                                                    const models = getModelsForIO(
                                                        config,
                                                        selectedOutput,
                                                        key,
                                                    );
                                                    const available = models.length > 0;
                                                    const Icon = meta.icon;
                                                    return (
                                                        <div
                                                            key={key}
                                                            className={`${styles.capabilityCard} ${!available ? styles.capabilityDisabled : ""}`}
                                                            onClick={() => {
                                                                if (available) {
                                                                    setSelectedInput(key);
                                                                    setWelcomeStep("pickModel");
                                                                }
                                                            }}
                                                        >
                                                            <div className={styles.capabilityIcon} style={{ color: MODALITY_COLORS[key] }}>
                                                                <Icon size={20} />
                                                            </div>
                                                            <div className={styles.capabilityInfo}>
                                                                <h4>{meta.title}</h4>
                                                                <p>{meta.subtitle}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    </>
                                );
                            })()}

                        {welcomeStep === "pickModel" &&
                            (() => {
                                const isViewAll = !selectedOutput && !selectedInput;
                                const allModels = isViewAll
                                    ? getAllModelsFromConfig(config)
                                    : getModelsForIO(config, selectedOutput, selectedInput);
                                const outputMod = OUTPUT_MODALITIES.find(
                                    (m) => m.key === selectedOutput,
                                );
                                const inputMeta = INPUT_MODALITY_META[selectedInput];

                                const handleModelSelect = (model) => {
                                    onSelectModel(model.provider || "lm-studio", model.name);
                                    setWelcomeStep("pickOutput");
                                    setSelectedOutput(null);
                                    setSelectedInput(null);
                                    setWelcomeDone(true);
                                };

                                return (
                                    <div className={styles.modelTableView}>
                                        <div className={styles.stepHeader}>
                                            <button
                                                className={styles.backButton}
                                                onClick={() => {
                                                    if (isViewAll) {
                                                        setWelcomeStep("pickOutput");
                                                    } else {
                                                        setWelcomeStep("pickInput");
                                                        setSelectedInput(null);
                                                    }
                                                }}
                                            >
                                                <ArrowLeft size={18} />
                                            </button>
                                            <div>
                                                <h3>
                                                    {isViewAll
                                                        ? "All Models"
                                                        : `${inputMeta?.title} to ${outputMod?.title}`}
                                                </h3>
                                                <p className={styles.sectionSubtitle}>
                                                    Pick a model to get started
                                                </p>
                                            </div>
                                        </div>
                                        <ModelGrid
                                            models={allModels}
                                            onSelect={handleModelSelect}
                                            showSearch={allModels.length > 6}
                                            favorites={favorites}
                                            onToggleFavorite={onToggleFavorite}
                                        />
                                    </div>
                                );
                            })()}
                    </div>
                )}

                {messages.length === 0 && !functionCallingEnabled && welcomeDone && (
                    <div className={styles.readyPrompt}>
                        <h3>You&apos;re all set! 🎉</h3>
                        <p>Your model is ready — start typing below to begin.</p>
                    </div>
                )}

                <MessageList
                    messages={messages}
                    isGenerating={isGenerating}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    onRerun={onRerun}
                    onImageClick={(url) => setLightboxSrc(url)}
                    onDocClick={(url) => setDocViewerSrc(url)}
                />

                {isGenerating &&
                    messages.length > 0 &&
                    !messages[messages.length - 1]?.content && (
                        <div style={{
                            maxWidth: 800,
                            margin: "0 auto",
                            width: "100%",
                            paddingLeft: 48,
                            fontSize: 14,
                            color: "var(--text-muted)",
                            animation: "pulse 1.5s ease-in-out infinite",
                        }}>
                            {messages[messages.length - 1]?.status || "Generating..."}
                        </div>
                    )}
                <div ref={endRef} />
            </div>

            {toolActivitySlot}

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
                                            <span style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                                                {TOOL_ICONS[tool] || <Parentheses size={14} />}
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
                    className={`${styles.inputBox} ${isDragging ? styles.inputBoxDragActive : ""}`}
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
                                            <AudioRecorderComponent
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
                                                        if (cat === "image") return () => setLightboxSrc(dataUrl);
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
                                />
                            </>
                        )}
                        {supportedInputTypes.includes("image") && !isTTSModel && (
                            <ChatInputButton
                                onClick={() => setShowDrawing(true)}
                                label="Create drawing"
                                icon="pencil"
                            />
                        )}
                        {hasAudioInput && (
                            <AudioRecorderComponent
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
                                    isTTSModel
                                        ? "Enter text to convert to speech..."
                                        : "Type a message..."
                                }
                                rows={1}
                            />
                        )}
                        <button
                            type="submit"
                            className={isGenerating ? styles.submitGenerating : ""}
                            disabled={
                                isTranscriptionModel
                                    ? pendingImages.length === 0 || isGenerating
                                    : (!input.trim() && pendingImages.length === 0) ||
                                    isGenerating
                            }
                        >
                            {isGenerating ? (
                                <Loader2 size={18} className={styles.spin} />
                            ) : (
                                <Send size={18} />
                            )}
                        </button>
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
