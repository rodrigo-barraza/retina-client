"use client";

import { Send, Loader2, Trash2, ChevronDown, ChevronRight, Brain, Copy, Check, Paperclip, FileAudio, FileVideo, FileText, Image as ImageIcon, Type, ArrowLeft, Pencil, RotateCcw, X as XIcon } from "lucide-react";
import ImageAnnotator from "./ImageAnnotator";
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
            <div className={compact ? styles.pendingFileThumb : styles.mediaCard}>
                <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
                <span className={styles.mediaCardLabel}>PDF</span>
            </div>
        );
    }

    // text / other
    return (
        <div className={compact ? styles.pendingFileThumb : styles.mediaCard}>
            <FileText size={compact ? 24 : 22} className={styles.mediaCardIcon} />
            <span className={styles.mediaCardLabel}>{category.toUpperCase()}</span>
        </div>
    );
}

const CAPABILITY_MAP = {
    text: {
        title: "Text Generation",
        subtitle: "Chat, code, and reasoning",
        configKey: "textToText",
    },
    image: {
        title: "Image Generation",
        subtitle: "Create and edit images",
        configKey: "textToImage",
    },
};

function getModelsForCapability(config, capabilityKey) {
    const cap = CAPABILITY_MAP[capabilityKey];
    if (!cap || !config) return [];
    const modelsMap = config[cap.configKey]?.models || {};
    const results = [];
    for (const [provider, models] of Object.entries(modelsMap)) {
        for (const model of models) {
            results.push({ ...model, provider });
        }
    }
    return results;
}

export default function ChatArea({ messages, isGenerating, onSend, onDelete, onEdit, onRerun, config, onSelectModel, supportedInputTypes = [] }) {
    const nonTextTypes = supportedInputTypes.filter((t) => t !== "text");
    const hasFileInput = nonTextTypes.length > 0;
    const imageOnly = nonTextTypes.length === 1 && nonTextTypes[0] === "image";
    const acceptStr = nonTextTypes.map((t) => TYPE_ACCEPT_MAP[t]).filter(Boolean).join(",");
    const [input, setInput] = useState("");
    const [pendingImages, setPendingImages] = useState([]);
    const [lightboxSrc, setLightboxSrc] = useState(null);
    const [selectedCapability, setSelectedCapability] = useState(null);
    const endRef = useRef(null);
    const [editingIndex, setEditingIndex] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isGenerating]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if ((!input.trim() && pendingImages.length === 0) || isGenerating) return;
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
                {messages.length === 0 && (
                    <div className={styles.welcome}>
                        {!selectedCapability ? (
                            <>
                                <h3>Let&apos;s get this show started</h3>
                                <div className={styles.capabilityGrid}>
                                    <div className={styles.capabilityCard} onClick={() => setSelectedCapability("text")}>
                                        <div className={styles.capabilityIcon}>
                                            <Type size={20} />
                                        </div>
                                        <div className={styles.capabilityInfo}>
                                            <h4>Text Generation</h4>
                                            <p>Chat, code, and reasoning</p>
                                        </div>
                                    </div>
                                    <div className={styles.capabilityCard} onClick={() => setSelectedCapability("image")}>
                                        <div className={styles.capabilityIcon}>
                                            <ImageIcon size={20} />
                                        </div>
                                        <div className={styles.capabilityInfo}>
                                            <h4>Image Generation</h4>
                                            <p>Create and edit images</p>
                                        </div>
                                    </div>
                                    <div className={`${styles.capabilityCard} ${styles.capabilityDisabled}`}>
                                        <div className={styles.capabilityIcon}>
                                            <FileAudio size={20} />
                                        </div>
                                        <div className={styles.capabilityInfo}>
                                            <h4>Speech Generation</h4>
                                            <p>Change text into speech</p>
                                        </div>
                                    </div>
                                    <div className={`${styles.capabilityCard} ${styles.capabilityDisabled}`}>
                                        <div className={styles.capabilityIcon}>
                                            <FileVideo size={20} />
                                        </div>
                                        <div className={styles.capabilityInfo}>
                                            <h4>Video Generation</h4>
                                            <p>Generate videos</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className={styles.modelListView}>
                                <button className={styles.backButton} onClick={() => setSelectedCapability(null)}>
                                    <ArrowLeft size={18} />
                                </button>
                                <h3>{CAPABILITY_MAP[selectedCapability]?.title}</h3>
                                <p className={styles.modelListSubtitle}>{CAPABILITY_MAP[selectedCapability]?.subtitle}</p>
                                <div className={styles.modelList}>
                                    {getModelsForCapability(config, selectedCapability).map((model) => (
                                        <div
                                            key={`${model.provider}-${model.name}`}
                                            className={styles.modelRow}
                                            onClick={() => {
                                                onSelectModel(model.provider, model.name);
                                                setSelectedCapability(null);
                                            }}
                                        >
                                            <div className={styles.modelRowIcon}>
                                                <ProviderLogo provider={model.provider} size={20} />
                                            </div>
                                            <div className={styles.modelRowInfo}>
                                                <span className={styles.modelRowName}>{model.label || model.name}</span>
                                                <span className={styles.modelRowProvider}>{PROVIDER_LABELS[model.provider] || model.provider}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                                    {msg.images.map((dataUrl, j) => (
                                        <MediaPreview
                                            key={j}
                                            dataUrl={dataUrl}
                                            onClick={getMimeCategory(dataUrl) === "image" ? () => setLightboxSrc(dataUrl) : undefined}
                                        />
                                    ))}
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
                {pendingImages.length > 0 && (
                    <div className={styles.pendingImages}>
                        {pendingImages.map((dataUrl, i) => (
                            <div key={i} className={styles.pendingAttachmentWrap}>
                                <MediaPreview dataUrl={dataUrl} compact onClick={getMimeCategory(dataUrl) === "image" ? () => setLightboxSrc(dataUrl) : undefined} />
                                <button onClick={() => removeImage(i)} className={styles.removeImage}>×</button>
                            </div>
                        ))}
                    </div>
                )}
                <form onSubmit={handleSubmit} className={styles.inputBox}>
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
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a message..."
                        rows={1}
                    />
                    <button type="submit" disabled={(!input.trim() && pendingImages.length === 0) || isGenerating}>
                        {isGenerating ? (
                            <Loader2 size={18} className={styles.spin} />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
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
        </div>
    );
}
