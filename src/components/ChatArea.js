"use client";

import { Send, Loader2, Trash2, ChevronDown, ChevronRight, ChevronUp, Brain, Copy, Check, Paperclip, FileAudio, FileVideo, FileText, Image as ImageIcon, Type, ArrowLeft, Pencil, RotateCcw, X as XIcon, Mic, Mic2 } from "lucide-react";
import ImageAnnotator from "./ImageAnnotator";
import DocumentViewer from "./DocumentViewer";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import styles from "./ChatArea.module.css";
import { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DateTime } from "luxon";

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback
        }
    }, [text]);

    return (
        <button
            className={styles.copyBtn}
            onClick={handleCopy}
            title="Copy raw text"
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
    );
}

function EditableUserMessage({ content, index, onEdit, editing, onCancelEdit }) {
    const [editValue, setEditValue] = useState(content);
    const textareaRef = useRef(null);
    const prevEditing = useRef(false);

    useEffect(() => {
        if (editing && !prevEditing.current) {
            setTimeout(() => textareaRef.current?.focus(), 0);
        }
        prevEditing.current = editing;
    }, [editing]);

    const cancelEditing = () => {
        onCancelEdit();
        setEditValue(content);
    };


    const saveEdit = () => {
        if (editValue.trim() && editValue !== content) {
            onEdit(index, editValue);
        }
        onCancelEdit();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            cancelEditing();
        } else if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveEdit();
        }
    };

    if (editing) {
        return (
            <div className={styles.editContainer}>
                <textarea
                    ref={textareaRef}
                    className={styles.editTextarea}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={3}
                />
                <div className={styles.editActions}>
                    <button className={styles.editSaveBtn} onClick={saveEdit} title="Save">
                        <Check size={14} />
                        Save
                    </button>
                    <button className={styles.editCancelBtn} onClick={cancelEditing} title="Cancel">
                        <XIcon size={14} />
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    return <div className={styles.text}>{content}</div>;
}

function FencedCodeBlock({ language, children }) {
    const codeString = String(children).replace(/\n$/, "");
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(codeString);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Detect code execution blocks: exec-python, execresult-python, etc.
    let displayLabel = language;
    let syntaxLang = language;
    if (language.startsWith("exec-")) {
        syntaxLang = language.replace("exec-", "");
        displayLabel = `${syntaxLang.toUpperCase()} — EXECUTABLE CODE`;
    } else if (language.startsWith("execresult-")) {
        syntaxLang = language.replace("execresult-", "") || "text";
        displayLabel = `${(syntaxLang || "PYTHON").toUpperCase()} — CODE EXECUTION RESULT`;
    }

    return (
        <div className={styles.codeBlockWrapper}>
            <div className={styles.codeBlockHeader}>
                <span className={styles.codeBlockLang}>{displayLabel}</span>
                <button className={styles.codeBlockCopy} onClick={handleCopy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? "Copied" : "Copy"}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={syntaxLang}
                PreTag="div"
                customStyle={{
                    margin: 0,
                    borderRadius: "0 0 8px 8px",
                    fontSize: "13px",
                }}
            >
                {codeString}
            </SyntaxHighlighter>
        </div>
    );
}

function CodeBlock({ children, className, ...rest }) {
    const match = /language-(\w+)/.exec(className || "");

    if (!match) {
        return (
            <code className={`${styles.inlineCode} ${className || ""}`} {...rest}>
                {children}
            </code>
        );
    }

    return <FencedCodeBlock language={match[1]}>{children}</FencedCodeBlock>;
}

function MarkdownContent({ content }) {
    if (!content) return null;
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                code: CodeBlock,
            }}
        >
            {content}
        </ReactMarkdown>
    );
}

function ThinkingBlock({ thinking }) {
    const [collapsed, setCollapsed] = useState(true);

    if (!thinking) return null;

    return (
        <div className={styles.thinkingBlock}>
            <button
                className={styles.thinkingToggle}
                onClick={() => setCollapsed((c) => !c)}
            >
                <Brain size={14} />
                <span>Thoughts</span>
                {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
            {!collapsed && (
                <div className={styles.thinkingContent}>
                    <MarkdownContent content={thinking} />
                </div>
            )}
        </div>
    );
}

// Map model input types to file accept strings
const TYPE_ACCEPT_MAP = {
    image: "image/*",
    audio: "audio/*",
    video: "video/*",
    pdf: "application/pdf",
};

function getMimeCategory(dataUrl) {
    const match = dataUrl.match(/^data:([\w-]+)\//);
    if (!match) return "file";
    const type = match[1];
    if (type === "application") return "pdf";
    if (type === "text") return "text";
    return type; // image, audio, video
}

function MediaPreview({ dataUrl, onClick, compact = false }) {
    const category = getMimeCategory(dataUrl);

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
    const sections = ["textToText", "textToImage"];
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
    { key: "textToImage", label: "T2I" },
    { key: "imageEdit", label: "Img Edit" },
    { key: "search", label: "Search" },
];

function getVisibleArenaColumns(models) {
    return ARENA_COLUMNS.filter((col) =>
        models.some((m) => m.arena && m.arena[col.key] != null)
    );
}

export default function ChatArea({ messages, isGenerating, onSend, onDelete, onEdit, onRerun, config, onSelectModel, supportedInputTypes = [], isTranscriptionModel = false }) {
    const [modelSort, setModelSort] = useState({ key: null, dir: "desc" });
    const nonTextTypes = supportedInputTypes.filter((t) => t !== "text");
    const hasFileInput = nonTextTypes.length > 0;
    const imageOnly = nonTextTypes.length === 1 && nonTextTypes[0] === "image";
    const acceptStr = nonTextTypes.map((t) => TYPE_ACCEPT_MAP[t]).filter(Boolean).join(",");
    const hasAudioInput = supportedInputTypes.includes("audio");
    const [input, setInput] = useState("");
    const [pendingImages, setPendingImages] = useState([]);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [docViewerSrc, setDocViewerSrc] = useState(null);
    const [welcomeStep, setWelcomeStep] = useState("pickOutput"); // "pickOutput" | "pickInput" | "pickModel"
    const [welcomeDone, setWelcomeDone] = useState(false);
    const [selectedOutput, setSelectedOutput] = useState(null);
    const [selectedInput, setSelectedInput] = useState(null);
    const endRef = useRef(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const fileInputRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

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
                            const models = getModelsForIO(config, selectedOutput, selectedInput);
                            const outputMod = OUTPUT_MODALITIES.find((m) => m.key === selectedOutput);
                            const inputMeta = INPUT_MODALITY_META[selectedInput];
                            const arenaCols = getVisibleArenaColumns(models);
                            const hasInputPrice = models.some((m) => m.pricing?.inputPerMillion != null);
                            const hasOutputPrice = models.some((m) => m.pricing?.outputPerMillion != null);
                            const hasContext = models.some((m) => m.contextLength != null);

                            const sortKey = modelSort.key;
                            const sortDir = modelSort.dir;
                            const sorted = [...models].sort((a, b) => {
                                let va, vb;
                                if (sortKey === "context") {
                                    va = a.contextLength ?? 0; vb = b.contextLength ?? 0;
                                } else if (sortKey === "input") {
                                    va = a.pricing?.inputPerMillion ?? Infinity; vb = b.pricing?.inputPerMillion ?? Infinity;
                                } else if (sortKey === "output") {
                                    va = a.pricing?.outputPerMillion ?? Infinity; vb = b.pricing?.outputPerMillion ?? Infinity;
                                } else if (sortKey) {
                                    va = a.arena?.[sortKey] ?? 0; vb = b.arena?.[sortKey] ?? 0;
                                } else {
                                    return 0;
                                }
                                return sortDir === "asc" ? va - vb : vb - va;
                            });

                            const handleSort = (key) => {
                                setModelSort((prev) => {
                                    if (prev.key === key) return { key, dir: prev.dir === "desc" ? "asc" : "desc" };
                                    return { key, dir: "desc" };
                                });
                            };

                            const SortIcon = ({ colKey }) => {
                                if (modelSort.key !== colKey) return null;
                                return modelSort.dir === "desc"
                                    ? <ChevronDown size={12} className={styles.sortIcon} />
                                    : <ChevronUp size={12} className={styles.sortIcon} />;
                            };

                            return (
                                <div className={styles.modelTableView}>
                                    <div className={styles.modelTableHeader}>
                                        <button className={styles.backButton} onClick={() => { setWelcomeStep("pickInput"); setSelectedInput(null); setModelSort({ key: null, dir: "desc" }); }}>
                                            <ArrowLeft size={18} />
                                        </button>
                                        <div>
                                            <h3>{inputMeta?.title} → {outputMod?.title}</h3>
                                            <p className={styles.modelListSubtitle}>Pick a model to get started</p>
                                        </div>
                                    </div>
                                    <div className={styles.modelTableScroll}>
                                        <table className={styles.modelTable}>
                                            <thead>
                                                <tr>
                                                    <th className={styles.modelTh}>Model</th>
                                                    {hasContext && <th className={`${styles.modelTh} ${styles.modelThSortable}`} onClick={() => handleSort("context")}>Context <SortIcon colKey="context" /></th>}
                                                    {hasInputPrice && <th className={`${styles.modelTh} ${styles.modelThSortable}`} onClick={() => handleSort("input")}>Input <SortIcon colKey="input" /></th>}
                                                    {hasOutputPrice && <th className={`${styles.modelTh} ${styles.modelThSortable}`} onClick={() => handleSort("output")}>Output <SortIcon colKey="output" /></th>}
                                                    {arenaCols.map((col) => (
                                                        <th key={col.key} className={`${styles.modelTh} ${styles.modelThSortable} ${styles.modelThArena}`} onClick={() => handleSort(col.key)}>
                                                            {col.label} <SortIcon colKey={col.key} />
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {sorted.map((model) => (
                                                    <tr
                                                        key={`${model.provider}-${model.name}`}
                                                        className={styles.modelTr}
                                                        onClick={() => {
                                                            onSelectModel(model.provider, model.name);
                                                            setWelcomeStep("pickOutput");
                                                            setSelectedOutput(null);
                                                            setSelectedInput(null);
                                                            setWelcomeDone(true);
                                                            setModelSort({ key: null, dir: "desc" });
                                                        }}
                                                    >
                                                        <td className={styles.modelTdName}>
                                                            <ProviderLogo provider={model.provider} size={18} />
                                                            <div className={styles.modelTdNameText}>
                                                                <span className={styles.modelName}>{model.label || model.name}</span>
                                                                <span className={styles.modelProvider}>{PROVIDER_LABELS[model.provider] || model.provider}</span>
                                                            </div>
                                                        </td>
                                                        {hasContext && <td className={styles.modelTd}>{model.contextLength ? formatContextLength(model.contextLength) : "—"}</td>}
                                                        {hasInputPrice && <td className={styles.modelTd}>{model.pricing?.inputPerMillion != null ? `$${model.pricing.inputPerMillion}` : "—"}</td>}
                                                        {hasOutputPrice && <td className={styles.modelTd}>{model.pricing?.outputPerMillion != null ? `$${model.pricing.outputPerMillion}` : "—"}</td>}
                                                        {arenaCols.map((col) => (
                                                            <td key={col.key} className={`${styles.modelTd} ${model.arena?.[col.key] != null ? styles.modelTdArena : styles.modelTdEmpty}`}>
                                                                {model.arena?.[col.key] ?? "—"}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                                {sorted.length === 0 && (
                                                    <tr><td colSpan={99} className={styles.empty}>No models available for this combination</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
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

                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`${styles.message} ${msg.role === "user" ? styles.userNode : styles.aiNode}`}
                    >
                        <div className={styles.avatar}>
                            {msg.role === "user" ? "U" : "AI"}
                        </div>
                        <div className={styles.content}>
                            <div className={styles.messageHeader}>
                                <div className={styles.roleLabel}>
                                    {msg.role === "user" ? "You" : "Model"}
                                    {msg.timestamp && (
                                        <span className={styles.timestamp}>
                                            {DateTime.fromISO(msg.timestamp).toLocaleString(DateTime.DATETIME_SHORT)}
                                        </span>
                                    )}
                                </div>
                                <div className={styles.messageActions}>
                                    {msg.role === "user" && (
                                        <>
                                            <button
                                                className={styles.copyBtn}
                                                onClick={() => {
                                                    setEditingIndex(editingIndex === i ? null : i);
                                                }}
                                                disabled={isGenerating}
                                                title="Edit message"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                            <button
                                                className={styles.copyBtn}
                                                onClick={() => onRerun(i)}
                                                disabled={isGenerating}
                                                title="Rerun this turn"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                        </>
                                    )}
                                    {msg.content && <CopyButton text={msg.content} />}
                                    <button
                                        className={styles.deleteMsgBtn}
                                        onClick={() => onDelete(i)}
                                        title="Delete message"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                            {msg.thinking && (
                                <ThinkingBlock thinking={msg.thinking} />
                            )}
                            {msg.images && msg.images.length > 0 && (
                                <div className={styles.imagePreviewRow}>
                                    {msg.images.map((dataUrl, j) => {
                                        const cat = getMimeCategory(dataUrl);
                                        let clickHandler;
                                        if (cat === "image") clickHandler = () => setLightboxSrc(dataUrl);
                                        else if (cat === "pdf" || cat === "text") clickHandler = () => setDocViewerSrc(dataUrl);
                                        return (
                                            <MediaPreview
                                                key={j}
                                                dataUrl={dataUrl}
                                                onClick={clickHandler}
                                            />
                                        );
                                    })}
                                </div>
                            )}
                            {msg.role === "user" ? (
                                <EditableUserMessage
                                    content={msg.content}
                                    index={i}
                                    onEdit={onEdit}
                                    editing={editingIndex === i}
                                    onCancelEdit={() => setEditingIndex(null)}
                                />
                            ) : (
                                <div className={styles.text}>
                                    <MarkdownContent content={msg.content} />
                                </div>
                            )}
                            {msg.usage && (
                                <div className={styles.meta}>
                                    <span className={styles.metaProvider}>
                                        <ProviderLogo provider={msg.provider} size={13} />
                                        {PROVIDER_LABELS[msg.provider] || msg.provider}
                                    </span>
                                    {" • "}{msg.model}
                                    {` • ${(msg.usage.inputTokens || 0) + (msg.usage.outputTokens || 0)} tokens`}
                                    {msg.content ? ` • ${msg.content.trim().split(/\s+/).filter(Boolean).length} words` : ""}
                                    {msg.totalTime != null ? ` • ${msg.totalTime.toFixed(1)}s` : ""}
                                    {msg.tokensPerSec ? ` • ${msg.tokensPerSec} tok/s` : ""}
                                    {msg.estimatedCost
                                        ? ` • $${msg.estimatedCost.toFixed(5)}`
                                        : ""}
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {isGenerating && messages.length > 0 && !messages[messages.length - 1]?.content && (
                    <div className={`${styles.message} ${styles.aiNode}`}>
                        <div className={styles.avatar}>
                            <Loader2 size={16} className={styles.spin} />
                        </div>
                        <div className={styles.content}>Generating...</div>
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
                                placeholder="Type a message..."
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
