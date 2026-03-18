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
    Pencil,
    X,
} from "lucide-react";
import AudioRecorderComponent from "./AudioRecorderComponent";
import ImagePreviewComponent from "./ImagePreviewComponent";
import DrawingCanvas from "./DrawingCanvas";
import DocumentViewer from "./DocumentViewer";
import MessageList from "./MessageList";
import ModelGrid from "./ModelGrid";
import styles from "./ChatArea.module.css";
import { useEffect, useRef, useState } from "react";
import PrismService from "../services/PrismService";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";

// Map model input types to file accept strings
const TYPE_ACCEPT_MAP = {
    image: "image/*",
    audio: "audio/*",
    video: "video/*",
    pdf: "application/pdf",
};

const TYPE_ICON_MAP = {
    paperclip: Paperclip,
    image: ImageIcon,
    audio: Volume2,
    video: Video,
    pdf: FileText,
};

function RotatingUploadIcon({ types, size = 18 }) {
    // Always include paperclip at the start of the cycle
    const allTypes = ["paperclip", ...types];
    const [activeIndex, setActiveIndex] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    useEffect(() => {
        if (allTypes.length <= 1) return;
        const interval = setInterval(() => {
            setIsTransitioning(true);
            setTimeout(() => {
                setActiveIndex((prev) => (prev + 1) % allTypes.length);
                setIsTransitioning(false);
            }, 300);
        }, 3000);
        return () => clearInterval(interval);
    }, [allTypes.length]);

    if (allTypes.length === 1) {
        const Icon = TYPE_ICON_MAP[allTypes[0]] || Paperclip;
        return <Icon size={size} />;
    }

    const currentType = allTypes[activeIndex];
    const nextType = allTypes[(activeIndex + 1) % allTypes.length];
    const CurrentIcon = TYPE_ICON_MAP[currentType] || Paperclip;
    const NextIcon = TYPE_ICON_MAP[nextType] || Paperclip;

    return (
        <div className={styles.rotatingIconContainer}>
            <div
                className={`${styles.rotatingIconTrack} ${isTransitioning ? styles.rotatingIconSlide : ""}`}
            >
                <span className={styles.rotatingIconItem}>
                    <CurrentIcon size={size} />
                </span>
                <span className={styles.rotatingIconItem}>
                    <NextIcon size={size} />
                </span>
            </div>
        </div>
    );
}

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
}) {
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

                {messages.length === 0 && !welcomeDone && config?.availableProviders?.length === 0 && (
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

                {messages.length === 0 && !welcomeDone && config?.availableProviders?.length > 0 && (
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
                                        />
                                    </div>
                                );
                            })()}
                    </div>
                )}

                {messages.length === 0 && welcomeDone && (
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

            <div className={styles.inputWrapper}>
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
                                <button
                                    type="button"
                                    className={styles.imageUploadBtn}
                                    onClick={() => fileInputRef.current?.click()}
                                    title={imageOnly ? "Attach image" : "Attach file"}
                                >
                                    <RotatingUploadIcon types={nonTextTypes} size={18} />
                                </button>
                            </>
                        )}
                        {supportedInputTypes.includes("image") && !isTTSModel && (
                            <button
                                type="button"
                                className={styles.imageUploadBtn}
                                onClick={() => setShowDrawing(true)}
                                title="Create drawing"
                            >
                                <Pencil size={18} />
                            </button>
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
