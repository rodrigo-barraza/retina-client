"use client";

import { useState, useMemo } from "react";
import { Eye, Type, Volume2, X, Maximize2, Search, ChevronDown, Paperclip, Plus, Trash2, MessageSquare, ImagePlus, Pencil } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { MODALITY_ICONS } from "./WorkflowSidebar";
import { PrismService } from "../services/PrismService";
import DrawingCanvas from "./DrawingCanvas";
import styles from "./WorkflowInspector.module.css";

/**
 * Role cycle order for clicking the role badge.
 */
const ROLE_CYCLE = ["system", "user", "assistant"];
const ROLE_COLORS = {
  system: "#f59e0b",
  user: "#6366f1",
  assistant: "#10b981",
};

/**
 * Convert legacy systemPrompt/userPrompt to a messages array.
 * Returns the existing messages array if already present.
 */
function getNodeMessages(node) {
  if (node.messages && node.messages.length > 0) return node.messages;
  const msgs = [];
  if (node.systemPrompt) msgs.push({ role: "system", content: node.systemPrompt });
  msgs.push({ role: "user", content: node.userPrompt || node.input || "" });
  return msgs;
}

/**
 * Right-side inspector panel that shows details about the selected workflow node.
 */
export default function WorkflowInspector({
    node,
    connections,
    nodes,
    allModels = [],
    nodeResults,
    nodeStatuses,
    onUpdateNodeConfig,
    onUpdateNodeContent,
    onUpdateFileInput,
    onChangeModel,
    onClose,
    readOnly = false,
}) {
    // Model change state (hooks must be called before any early return)
    const [modelSearch, setModelSearch] = useState("");
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);

    // Drawing canvas state: { msgIdx, imgIdx? (edit), src? (edit) } | null
    const [drawingState, setDrawingState] = useState(null);

    // Whether the current model supports image inputs
    const modelAcceptsImage = node ? (node.inputTypes || []).includes("image") : false;

    const isModel = node ? !node.nodeType : false;

    // Find incoming / outgoing connections
    const incoming = useMemo(
        () => (connections || []).filter((c) => node && c.targetNodeId === node.id),
        [connections, node],
    );
    const outgoing = useMemo(
        () => (connections || []).filter((c) => node && c.sourceNodeId === node.id),
        [connections, node],
    );

    // Compute compatible models based on connections
    const compatibleModels = useMemo(() => {
        if (!isModel) return [];
        const requiredInputs = incoming.map((c) => c.targetModality);
        const requiredOutputs = outgoing.map((c) => c.sourceModality);

        return allModels.filter((m) => {
            const mInputs = m.inputTypes || [];
            const mOutputs = m.outputTypes || [];
            if (requiredInputs.length > 0 && !requiredInputs.every((mod) => mInputs.includes(mod))) return false;
            if (requiredOutputs.length > 0 && !requiredOutputs.every((mod) => mOutputs.includes(mod))) return false;
            return true;
        });
    }, [isModel, incoming, outgoing, allModels]);

    // Filtered by search
    const filteredModels = useMemo(() => {
        if (!modelSearch.trim()) return compatibleModels;
        const q = modelSearch.trim().toLowerCase();
        return compatibleModels.filter((m) => {
            const name = m.display_name || m.label || m.name || "";
            const provider = m.provider || "";
            return name.toLowerCase().includes(q) || provider.toLowerCase().includes(q);
        });
    }, [compatibleModels, modelSearch]);

    if (!node) return null;

    const status = nodeStatuses?.[node.id];
    const results = nodeResults?.[node.id];
    const isInput = node.nodeType === "input";
    const isViewer = node.nodeType === "viewer";

    const getNodeLabel = (id) => {
        const n = (nodes || []).find((nd) => nd.id === id);
        if (!n) return id;
        if (n.nodeType === "input") return `${n.modality} Input`;
        if (n.nodeType === "viewer") return "Output Viewer";
        return n.displayName || n.modelName || id;
    };

    return (
        <div className={styles.inspector}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {isModel && (
                        <div className={styles.providerIcon}>
                            <ProviderLogo provider={node.provider} size={18} />
                        </div>
                    )}
                    {isInput && (
                        <div className={styles.typeIcon} style={{ color: MODALITY_ICONS[node.modality]?.color }}>
                            {node.modality === "text" ? <Type size={16} /> : node.modality === "audio" ? <Volume2 size={16} /> : (MODALITY_ICONS[node.modality]?.icon ? (() => { const Icon = MODALITY_ICONS[node.modality].icon; return <Icon size={16} />; })() : <Type size={16} />)}
                        </div>
                    )}
                    {isViewer && (
                        <div className={styles.typeIcon} style={{ color: "#a78bfa" }}>
                            <Eye size={16} />
                        </div>
                    )}
                    <div className={styles.headerInfo}>
                        <span className={styles.headerTitle}>
                            {isModel ? (node.displayName || node.modelName) : isInput ? (node.modality ? `${node.modality.charAt(0).toUpperCase() + node.modality.slice(1)} Input` : "File Input") : "Output Viewer"}
                        </span>
                        <span className={styles.headerSubtitle}>
                            {isModel ? node.provider : isInput ? "Asset Node" : "Viewer Node"}
                            {status && (
                                <span className={`${styles.statusBadge} ${styles[`status_${status}`]}`}>
                                    {status}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                <button className={styles.closeBtn} onClick={onClose}>
                    <X size={14} />
                </button>
            </div>

            {/* Scrollable body */}
            <div className={styles.body}>
                {/* Model selector — model nodes only, hidden in readOnly */}
                {isModel && !readOnly && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Model</label>
                        <div className={styles.modelSelector}>
                            <button
                                className={`${styles.modelSelectorTrigger} ${modelDropdownOpen ? styles.modelSelectorTriggerOpen : ""}`}
                                onClick={() => setModelDropdownOpen((prev) => !prev)}
                            >
                                <span className={styles.modelSelectorContent}>
                                    <ProviderLogo provider={node.provider} size={14} />
                                    <span className={styles.modelSelectorLabel}>
                                        {node.displayName || node.modelName}
                                    </span>
                                </span>
                                <ChevronDown
                                    size={12}
                                    className={`${styles.modelSelectorChevron} ${modelDropdownOpen ? styles.modelSelectorChevronOpen : ""}`}
                                />
                            </button>

                            {modelDropdownOpen && (
                                <div className={styles.modelDropdown}>
                                    <div className={styles.modelDropdownSearch}>
                                        <Search size={11} className={styles.modelDropdownSearchIcon} />
                                        <input
                                            type="text"
                                            className={styles.modelDropdownSearchInput}
                                            placeholder="Search models…"
                                            value={modelSearch}
                                            onChange={(e) => setModelSearch(e.target.value)}
                                            autoFocus
                                        />
                                        {modelSearch && (
                                            <button
                                                className={styles.modelDropdownSearchClear}
                                                onClick={() => setModelSearch("")}
                                            >
                                                <X size={10} />
                                            </button>
                                        )}
                                    </div>
                                    <div className={styles.modelDropdownList}>
                                        {filteredModels.length === 0 ? (
                                            <div className={styles.modelDropdownEmpty}>
                                                No compatible models found
                                            </div>
                                        ) : (
                                            filteredModels.map((m) => {
                                                const key = `${m.provider}:${m.name}`;
                                                const isCurrent = m.name === node.modelName && m.provider === node.provider;
                                                return (
                                                    <button
                                                        key={key}
                                                        className={`${styles.modelDropdownItem} ${isCurrent ? styles.modelDropdownItemActive : ""}`}
                                                        onClick={() => {
                                                            onChangeModel?.(node.id, m);
                                                            setModelDropdownOpen(false);
                                                            setModelSearch("");
                                                        }}
                                                    >
                                                        <ProviderLogo provider={m.provider} size={13} />
                                                        <span className={styles.modelDropdownItemName}>
                                                            {m.display_name || m.label || m.name}
                                                        </span>
                                                        <span className={styles.modelDropdownItemModalities}>
                                                            {(m.inputTypes || []).map((t) => {
                                                                const mod = MODALITY_ICONS[t];
                                                                if (!mod) return null;
                                                                const Icon = mod.icon;
                                                                return <Icon key={`in-${t}`} size={9} style={{ color: mod.color }} />;
                                                            })}
                                                            <span className={styles.modelDropdownItemArrow}>→</span>
                                                            {(m.outputTypes || []).map((t) => {
                                                                const mod = MODALITY_ICONS[t];
                                                                if (!mod) return null;
                                                                const Icon = mod.icon;
                                                                return <Icon key={`out-${t}`} size={9} style={{ color: mod.color }} />;
                                                            })}
                                                        </span>
                                                    </button>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>
                )}

                {/* Model info — readOnly mode */}
                {isModel && readOnly && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Model</label>
                        <div className={styles.modelSelectorTrigger} style={{ cursor: "default" }}>
                            <span className={styles.modelSelectorContent}>
                                <ProviderLogo provider={node.provider} size={14} />
                                <span className={styles.modelSelectorLabel}>
                                    {node.displayName || node.modelName}
                                </span>
                            </span>
                        </div>
                    </section>
                )}

                {/* Conversation Messages — model nodes */}
                {isModel && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>
                            <MessageSquare size={10} style={{ marginRight: 4 }} />
                            Messages ({getNodeMessages(node).length})
                        </label>
                        <div className={styles.messageList}>
                            {getNodeMessages(node).map((msg, idx) => (
                                <div key={idx} className={styles.messageRow}>
                                    <div className={styles.messageHeader}>
                                        <button
                                            className={styles.roleBadge}
                                            style={{ background: `${ROLE_COLORS[msg.role]}20`, color: ROLE_COLORS[msg.role], borderColor: `${ROLE_COLORS[msg.role]}40`, ...(readOnly ? { cursor: "default" } : {}) }}
                                            onClick={readOnly ? undefined : () => {
                                                const msgs = [...getNodeMessages(node)];
                                                const nextRole = ROLE_CYCLE[(ROLE_CYCLE.indexOf(msg.role) + 1) % ROLE_CYCLE.length];
                                                msgs[idx] = { ...msgs[idx], role: nextRole };
                                                onUpdateNodeConfig?.(node.id, "messages", msgs);
                                            }}
                                            title={readOnly ? msg.role : "Click to change role"}
                                        >
                                            {msg.role}
                                        </button>
                                        {!readOnly && getNodeMessages(node).length > 1 && (
                                            <button
                                                className={styles.messageDeleteBtn}
                                                onClick={() => {
                                                    const msgs = getNodeMessages(node).filter((_, i) => i !== idx);
                                                    onUpdateNodeConfig?.(node.id, "messages", msgs);
                                                }}
                                                title="Remove message"
                                            >
                                                <Trash2 size={10} />
                                            </button>
                                        )}
                                    </div>
                                    <textarea
                                        className={styles.messageTextarea}
                                        value={msg.content || ""}
                                        onChange={readOnly ? undefined : (e) => {
                                            const msgs = [...getNodeMessages(node)];
                                            msgs[idx] = { ...msgs[idx], content: e.target.value };
                                            onUpdateNodeConfig?.(node.id, "messages", msgs);
                                        }}
                                        readOnly={readOnly}
                                        placeholder={msg.role === "system" ? "System instructions..." : msg.role === "user" ? "User message..." : "Assistant response..."}
                                        rows={2}
                                    />
                                    {msg.images?.length > 0 && (
                                        <div className={styles.messageImages}>
                                            {msg.images.map((img, imgIdx) => {
                                                const imgSrc = typeof img === "string" && img.startsWith("data:") ? img : PrismService.getFileUrl(img);
                                                return (
                                                    <div key={imgIdx} className={styles.messageImageWrapper}>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={imgSrc}
                                                            alt={`Attachment ${imgIdx + 1}`}
                                                            className={styles.messageImageThumb}
                                                            onClick={readOnly ? undefined : () => setDrawingState({ msgIdx: idx, imgIdx, src: imgSrc })}
                                                            title={readOnly ? "Attachment" : "Click to edit drawing"}
                                                        />
                                                        {!readOnly && (
                                                            <button
                                                                className={styles.messageImageRemove}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const msgs = [...getNodeMessages(node)];
                                                                    const updatedImages = [...(msgs[idx].images || [])];
                                                                    updatedImages.splice(imgIdx, 1);
                                                                    msgs[idx] = { ...msgs[idx], images: updatedImages };
                                                                    onUpdateNodeConfig?.(node.id, "messages", msgs);
                                                                }}
                                                                title="Remove image"
                                                            >
                                                                <X size={8} />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Upload button: user always, assistant when model accepts image, never system */}
                                    {!readOnly && (msg.role === "user" || (msg.role === "assistant" && modelAcceptsImage)) && (
                                        <div className={styles.messageActions}>
                                            <label className={styles.messageUploadBtn} title="Upload image">
                                                <ImagePlus size={12} />
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className={styles.fileInput}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (!file) return;
                                                        const reader = new FileReader();
                                                        reader.onload = () => {
                                                            const msgs = [...getNodeMessages(node)];
                                                            const existing = msgs[idx].images || [];
                                                            msgs[idx] = { ...msgs[idx], images: [...existing, reader.result] };
                                                            onUpdateNodeConfig?.(node.id, "messages", msgs);
                                                        };
                                                        reader.readAsDataURL(file);
                                                        e.target.value = "";
                                                    }}
                                                />
                                            </label>
                                            <button
                                                className={styles.messageDrawBtn}
                                                onClick={() => setDrawingState({ msgIdx: idx })}
                                                title="Create drawing"
                                            >
                                                <Pencil size={12} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        {!readOnly && (
                            <>
                                <button
                                    className={styles.addMessageBtn}
                                    onClick={() => {
                                        const msgs = [...getNodeMessages(node)];
                                        const lastRole = msgs[msgs.length - 1]?.role;
                                        const nextRole = lastRole === "user" ? "assistant" : "user";
                                        msgs.push({ role: nextRole, content: "" });
                                        onUpdateNodeConfig?.(node.id, "messages", msgs);
                                    }}
                                >
                                    <Plus size={11} />
                                    Add Message
                                </button>
                                <span className={styles.fieldHint}>Piped input is appended to the last user message</span>
                            </>
                        )}
                    </section>
                )}

                {/* Content — text input assets */}
                {isInput && node.modality === "text" && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Content</label>
                        <textarea
                            className={styles.textarea}
                            value={node.content || ""}
                            onChange={readOnly ? undefined : (e) => onUpdateNodeContent?.(node.id, e.target.value)}
                            readOnly={readOnly}
                            placeholder="Enter text..."
                            rows={4}
                        />
                    </section>
                )}

                {/* Content — file input assets (image, audio, or empty) */}
                {isInput && node.modality !== "text" && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Content</label>
                        {node.content ? (
                            <div className={styles.previewContainer}>
                                {node.modality === "image" ? (
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={node.content}
                                        alt="Input asset"
                                        className={styles.previewImage}
                                    />
                                ) : node.modality === "audio" ? (
                                    <div className={styles.audioIndicator}>
                                        <Volume2 size={16} />
                                        <span>Audio file attached</span>
                                    </div>
                                ) : (
                                    <div className={styles.audioIndicator}>
                                        <Paperclip size={16} />
                                        <span>File attached</span>
                                    </div>
                                )}
                                <button
                                    className={styles.clearBtn}
                                    onClick={() => onUpdateFileInput?.(node.id, null, null)}
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <label
                                className={styles.uploadArea}
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const file = e.dataTransfer?.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = () => onUpdateFileInput?.(node.id, reader.result, file.type);
                                    reader.readAsDataURL(file);
                                }}
                            >
                                <Paperclip size={16} />
                                <span>Drop or upload file</span>
                                <input
                                    type="file"
                                    accept="image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv"
                                    className={styles.fileInput}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        const reader = new FileReader();
                                        reader.onload = () => onUpdateFileInput?.(node.id, reader.result, file.type);
                                        reader.readAsDataURL(file);
                                    }}
                                />
                            </label>
                        )}
                    </section>
                )}



                {/* Connections */}
                {(incoming.length > 0 || outgoing.length > 0) && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Connections</label>
                        <div className={styles.connectionList}>
                            {incoming.map((c) => (
                                <div key={c.id} className={styles.connectionItem}>
                                    <span className={styles.connectionDot} style={{ background: MODALITY_ICONS[c.targetModality]?.color || "#888" }} />
                                    <span className={styles.connectionFrom}>{getNodeLabel(c.sourceNodeId)}</span>
                                    <span className={styles.connectionArrow}>→</span>
                                    <span className={styles.connectionModality}>{c.targetModality}</span>
                                </div>
                            ))}
                            {outgoing.map((c) => (
                                <div key={c.id} className={styles.connectionItem}>
                                    <span className={styles.connectionModality}>{c.sourceModality}</span>
                                    <span className={styles.connectionArrow}>→</span>
                                    <span className={styles.connectionTo}>{getNodeLabel(c.targetNodeId)}</span>
                                    <span className={styles.connectionDot} style={{ background: MODALITY_ICONS[c.sourceModality]?.color || "#888" }} />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Generated Results — model nodes only */}
                {results && !results.error && !isViewer && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Generated Output</label>

                        {results.image && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Image</span>
                                <div className={styles.resultImageContainer}>
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={results.image}
                                        alt="Generated image"
                                        className={styles.resultImage}
                                    />
                                    <a
                                        href={results.image}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.expandBtn}
                                        title="Open full size"
                                    >
                                        <Maximize2 size={12} />
                                    </a>
                                </div>
                            </div>
                        )}

                        {results.text && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Text</span>
                                <div className={styles.resultText}>{results.text}</div>
                            </div>
                        )}

                        {results.audio && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Audio</span>
                                <audio controls src={results.audio} className={styles.resultAudio} />
                            </div>
                        )}

                        {results.embedding && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Embedding [{results.embedding.length} dims]</span>
                                <div className={styles.resultText} style={{ fontSize: "11px", fontFamily: "monospace", maxHeight: "120px", overflow: "auto" }}>
                                    [{results.embedding.slice(0, 8).map((v) => v.toFixed(6)).join(", ")}{results.embedding.length > 8 ? ", …" : ""}]
                                </div>
                                <button
                                    className={styles.clearBtn}
                                    style={{ marginTop: "4px" }}
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(results.embedding))}
                                >
                                    Copy All
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* Viewer received content — show all types */}
                {isViewer && node.receivedOutputs && Object.keys(node.receivedOutputs).length > 0 && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Received Content</label>

                        {node.receivedOutputs.image && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Image</span>
                                <div className={styles.resultImageContainer}>
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={node.receivedOutputs.image}
                                        alt="Received image"
                                        className={styles.resultImage}
                                    />
                                    <a
                                        href={node.receivedOutputs.image}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={styles.expandBtn}
                                        title="Open full size"
                                    >
                                        <Maximize2 size={12} />
                                    </a>
                                </div>
                            </div>
                        )}

                        {node.receivedOutputs.text && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Text</span>
                                <div className={styles.resultText}>{node.receivedOutputs.text}</div>
                            </div>
                        )}

                        {node.receivedOutputs.audio && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Audio</span>
                                <audio controls src={node.receivedOutputs.audio} className={styles.resultAudio} />
                            </div>
                        )}

                        {node.receivedOutputs.embedding && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Embedding [{node.receivedOutputs.embedding.length} dims]</span>
                                <div className={styles.resultText} style={{ fontSize: "11px", fontFamily: "monospace", maxHeight: "120px", overflow: "auto" }}>
                                    [{node.receivedOutputs.embedding.slice(0, 8).map((v) => v.toFixed(6)).join(", ")}{node.receivedOutputs.embedding.length > 8 ? ", …" : ""}]
                                </div>
                                <button
                                    className={styles.clearBtn}
                                    style={{ marginTop: "4px" }}
                                    onClick={() => navigator.clipboard.writeText(JSON.stringify(node.receivedOutputs.embedding))}
                                >
                                    Copy All
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {/* Error */}
                {results?.error && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Error</label>
                        <div className={styles.errorBlock}>{results.error}</div>
                    </section>
                )}

                {/* Node ID (debug) */}
                <section className={styles.section}>
                    <label className={styles.sectionLabel}>Node ID</label>
                    <code className={styles.nodeId}>{node.id}</code>
                </section>
            </div>

            {/* Drawing Canvas Modal */}
            {!readOnly && drawingState && (
                <DrawingCanvas
                    src={drawingState.src || null}
                    onClose={() => setDrawingState(null)}
                    onSave={(dataUrl) => {
                        const msgs = [...getNodeMessages(node)];
                        const { msgIdx, imgIdx } = drawingState;
                        if (imgIdx != null) {
                            // Edit mode: replace existing image
                            const updatedImages = [...(msgs[msgIdx].images || [])];
                            updatedImages[imgIdx] = dataUrl;
                            msgs[msgIdx] = { ...msgs[msgIdx], images: updatedImages };
                        } else {
                            // Create mode: append new drawing
                            const existing = msgs[msgIdx].images || [];
                            msgs[msgIdx] = { ...msgs[msgIdx], images: [...existing, dataUrl] };
                        }
                        onUpdateNodeConfig?.(node.id, "messages", msgs);
                        setDrawingState(null);
                    }}
                />
            )}
        </div>
    );
}
