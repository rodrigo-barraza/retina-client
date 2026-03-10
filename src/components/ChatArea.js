"use client";

import { Send, Loader2, ChevronDown, ChevronRight, ChevronUp, Paperclip, FileAudio, FileVideo, FileText, Image as ImageIcon, Type, ArrowLeft, Mic, Mic2, Edit3, Terminal } from "lucide-react";
import ImageAnnotator from "./ImageAnnotator";
import DocumentViewer from "./DocumentViewer";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import MessageList from "./MessageList";
import ModelGrid from "./ModelGrid";
import styles from "./ChatArea.module.css";
import { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import { PrismService } from "../services/PrismService";

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
        if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
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
            <div className={compact ? styles.pendingMediaThumb : styles.mediaCard}>
                <FileAudio size={compact ? 18 : 20} className={styles.mediaCardIcon} />
                <audio
                    controls
                    src={dataUrl}
                    className={compact ? styles.audioPlayerCompact : styles.audioPlayer}
                    preload="metadata"
                />
            </div>
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
            <div className={compact ? styles.pendingFileThumb : styles.mediaCard} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
                <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
                <span className={styles.mediaCardLabel}>PDF</span>
            </div>
        );
    }

    // text / other
    return (
        <div className={compact ? styles.pendingFileThumb : styles.mediaCard} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
            <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
            <span className={styles.mediaCardLabel}>{category.toUpperCase()}</span>
        </div>
    );
}

const OUTPUT_MODALITIES = [
    { key: "text", title: "Text", subtitle: "Chat, code, and reasoning", icon: Type },
    { key: "image", title: "Image", subtitle: "Create and edit images", icon: ImageIcon },
    { key: "audio", title: "Speech", subtitle: "Text to speech", icon: Mic },
    { key: "video", title: "Video", subtitle: "Generate videos", icon: FileVideo, disabled: true },
];

const INPUT_MODALITY_META = {
    text: { title: "Text", subtitle: "Prompts and conversations", icon: Type },
    image: { title: "Image", subtitle: "Photos and screenshots", icon: ImageIcon },
    audio: { title: "Audio", subtitle: "Voice and sound files", icon: FileAudio },
    video: { title: "Video", subtitle: "Video clips", icon: FileVideo },
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




function getOutputTypesForInput(config, inputType) {
    const allModels = getAllModelsFromConfig(config);
    const outputSet = new Set();
    for (const m of allModels) {
        if (m.inputTypes?.includes(inputType)) {
            for (const out of (m.outputTypes || [])) {
                outputSet.add(out);
            }
        }
    }
    return [...outputSet];
}

function getModelsForIO(config, outputType, inputType) {
    const allModels = getAllModelsFromConfig(config);
    return allModels.filter(
        (m) => m.outputTypes?.includes(outputType) && (inputType == null || m.inputTypes?.includes(inputType)),
    );
}

function formatContextLength(tokens) {
    if (!tokens) return null;
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
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

function getVisibleArenaColumns(models) {
    return ARENA_COLUMNS.filter((col) =>
        models.some((m) => m.arena && m.arena[col.key] != null)
    );
}

export default function ChatArea({ messages, isGenerating, onSend, onDelete, onEdit, onRerun, config, onSelectModel, supportedInputTypes = [], isTranscriptionModel = false, isTTSModel = false, systemPrompt, onSystemPromptClick, readOnly = false }) {
    const [modelSort, setModelSort] = useState({ key: null, dir: "desc" });
    const nonTextTypes = supportedInputTypes.filter((t) => t !== "text");
    const hasFileInput = !isTTSModel && nonTextTypes.length > 0;
    const imageOnly = nonTextTypes.length === 1 && nonTextTypes[0] === "image";
    const acceptStr = nonTextTypes.map((t) => TYPE_ACCEPT_MAP[t]).filter(Boolean).join(",");
    const hasAudioInput = !isTTSModel && supportedInputTypes.includes("audio");
    const [input, setInput] = useState("");
    const [pendingImages, setPendingImages] = useState([]);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [docViewerSrc, setDocViewerSrc] = useState(null);
    const [welcomeStep, setWelcomeStep] = useState("pickOutput"); // "pickOutput" | "pickInput" | "pickModel"
    const [welcomeDone, setWelcomeDone] = useState(false);
    const [selectedOutput, setSelectedOutput] = useState(null);
    const [selectedInput, setSelectedInput] = useState(null);
    const [providerFilter, setProviderFilter] = useState(null);
    const endRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const [systemPromptExpanded, setSystemPromptExpanded] = useState(true);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isGenerating]);

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

    const toggleRecording = async () => {
        if (isRecording) {
            mediaRecorderRef.current?.stop();
            setIsRecording(false);
            return;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.onstop = () => {
                const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setPendingImages((prev) => [...prev, ev.target.result]);
                };
                reader.readAsDataURL(blob);
                stream.getTracks().forEach((t) => t.stop());
            };
            mediaRecorderRef.current = recorder;
            recorder.start();
            setIsRecording(true);
        } catch {
            // Microphone permission denied or unavailable
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.messagesList}>
                {systemPrompt && systemPrompt !== "You are a helpful AI assistant" && systemPrompt !== "You are a helpful AI assistant." && (
                    <div className={styles.systemPromptBanner}>
                        <button
                            className={styles.systemPromptToggle}
                            onClick={() => setSystemPromptExpanded((v) => !v)}
                        >
                            {systemPromptExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            <span className={styles.systemPromptLabel}>
                                <Terminal size={13} />
                                System Prompt
                            </span>
                            {!readOnly && onSystemPromptClick && (
                                <span
                                    className={styles.systemPromptEditBtn}
                                    onClick={(e) => { e.stopPropagation(); onSystemPromptClick(); }}
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

                {messages.length === 0 && !welcomeDone && (
                    <div className={styles.welcome}>
                        {welcomeStep === "pickOutput" && (
                            <>
                                <h3>What do you wanna make?</h3>
                                <p className={styles.sectionSubtitle}>Pick an output type to get started</p>
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
                                                <div className={styles.capabilityIcon}>
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
                            </>
                        )}

                        {welcomeStep === "pickInput" && (() => {
                            const outputMod = OUTPUT_MODALITIES.find((m) => m.key === selectedOutput);
                            return (
                                <div className={styles.modelListView}>
                                    <button className={styles.backButton} onClick={() => { setWelcomeStep("pickOutput"); setSelectedOutput(null); }}>
                                        <ArrowLeft size={18} />
                                    </button>
                                    <h3>How do you wanna send it?</h3>
                                    <p className={styles.modelListSubtitle}>Making {outputMod?.title?.toLowerCase()} — now pick your input</p>
                                    <div className={styles.capabilityGrid}>
                                        {Object.entries(INPUT_MODALITY_META).map(([key, meta]) => {
                                            const models = getModelsForIO(config, selectedOutput, key);
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
                                                    <div className={styles.capabilityIcon}>
                                                        <Icon size={20} />
                                                    </div>
                                                    <div className={styles.capabilityInfo}>
                                                        <h4>{meta.title}</h4>
                                                        <p>{meta.subtitle}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()}

                        {welcomeStep === "pickModel" && (() => {
                            const allModels = getModelsForIO(config, selectedOutput, selectedInput);
                            const uniqueProviders = [...new Set(allModels.map((m) => m.provider))];
                            const models = providerFilter ? allModels.filter((m) => m.provider === providerFilter) : allModels;
                            const outputMod = OUTPUT_MODALITIES.find((m) => m.key === selectedOutput);
                            const inputMeta = INPUT_MODALITY_META[selectedInput];

                            const handleModelSelect = (model) => {
                                onSelectModel(model.provider || "lm-studio", model.name);
                                setWelcomeStep("pickOutput");
                                setSelectedOutput(null);
                                setSelectedInput(null);
                                setWelcomeDone(true);
                                setProviderFilter(null);
                            };

                            return (
                                <div className={styles.modelTableView}>
                                    <div className={styles.modelTableHeader}>
                                        <button className={styles.backButton} onClick={() => { setWelcomeStep("pickInput"); setSelectedInput(null); setProviderFilter(null); }}>
                                            <ArrowLeft size={18} />
                                        </button>
                                        <div>
                                            <h3>{inputMeta?.title} to {outputMod?.title}</h3>
                                            <p className={styles.modelListSubtitle}>Pick a model to get started</p>
                                        </div>
                                        {uniqueProviders.length > 1 && (
                                            <div className={styles.providerFilters}>
                                                <button
                                                    className={`${styles.providerFilterPill} ${!providerFilter ? styles.providerFilterActive : ""}`}
                                                    onClick={() => setProviderFilter(null)}
                                                >
                                                    All
                                                </button>
                                                {uniqueProviders.map((p) => (
                                                    <button
                                                        key={p}
                                                        className={`${styles.providerFilterPill} ${providerFilter === p ? styles.providerFilterActive : ""}`}
                                                        onClick={() => setProviderFilter(providerFilter === p ? null : p)}
                                                        title={PROVIDER_LABELS[p] || p}
                                                    >
                                                        <ProviderLogo provider={p} size={16} />
                                                        <span>{PROVIDER_LABELS[p] || p}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <ModelGrid
                                        models={models}
                                        onSelect={handleModelSelect}
                                        showSearch={models.length > 6}
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

                {isGenerating && messages.length > 0 && !messages[messages.length - 1]?.content && (
                    <div className={`${styles.message} ${styles.aiNode}`}>
                        <div className={styles.avatar}>
                            <Loader2 size={16} className={styles.spin} />
                        </div>
                        <div className={styles.content}>{messages[messages.length - 1]?.status || "Generating..."}</div>
                    </div>
                )}
                <div ref={endRef} />
            </div>

            <div className={styles.inputWrapper}>
                <form onSubmit={handleSubmit} className={styles.inputBox}>
                    {pendingImages.length > 0 && (
                        <div className={styles.pendingImages}>
                            {pendingImages.map((dataUrl, i) => (
                                <div key={i} className={styles.pendingAttachmentWrap}>
                                    <MediaPreview dataUrl={dataUrl} compact onClick={(() => { const c = getMimeCategory(dataUrl); if (c === "image") return () => setLightboxSrc(dataUrl); if (c === "pdf" || c === "text") return () => setDocViewerSrc(dataUrl); return undefined; })()} />
                                    <button type="button" onClick={() => removeImage(i)} className={styles.removeImage}>×</button>
                                </div>
                            ))}
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
                                    {imageOnly ? <ImageIcon size={18} /> : <Paperclip size={18} />}
                                </button>
                            </>
                        )}
                        {hasAudioInput && (
                            <button
                                type="button"
                                className={`${styles.imageUploadBtn} ${isRecording ? styles.recordingActive : ""}`}
                                onClick={toggleRecording}
                                title={isRecording ? "Stop recording" : "Record voice"}
                            >
                                <Mic2 size={18} />
                            </button>
                        )}
                        {!isTranscriptionModel && (
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isTTSModel ? "Enter text to convert to speech..." : "Type a message..."}
                                rows={1}
                            />
                        )}
                        <button type="submit" disabled={isTranscriptionModel ? (pendingImages.length === 0 || isGenerating) : ((!input.trim() && pendingImages.length === 0) || isGenerating)}>
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
                <ImageAnnotator
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
        </div>
    );
}
