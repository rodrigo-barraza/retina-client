"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Eye, Type, Volume2, X, Maximize2, Search, ChevronDown, ChevronRight, Paperclip, Code, BookOpen, Wrench } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { MODALITY_ICONS } from "./WorkflowNodeConstants";
import MarkdownContent from "./MarkdownContent";
import TextContentComponent from "./TextContentComponent";
import MessageList from "./MessageList";
import AudioRecorderComponent from "./AudioRecorderComponent";
import AssetInputOptions from "./AssetInputOptions";
import ToggleSwitchComponent from "./ToggleSwitch";
import PrismService from "../services/PrismService";

import styles from "./WorkflowInspector.module.css";

const STORAGE_KEY = "workflow-inspector-width";
const MIN_WIDTH = 320;
const MAX_WIDTH = 800;
const DEFAULT_WIDTH = 320;

function getStoredWidth() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v) {
            const n = parseInt(v, 10);
            if (!isNaN(n) && n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
        }
    } catch { /* ignore */ }
    return DEFAULT_WIDTH;
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
    onSelectNode,
    onClose,
    readOnly = false,
}) {
    // Model change state (hooks must be called before any early return)
    const [modelSearch, setModelSearch] = useState("");
    const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
    const [conversationView, setConversationView] = useState("json");
    const [toolBuiltInOpen, setToolBuiltInOpen] = useState(true);
    const [toolCustomOpen, setToolCustomOpen] = useState(true);


    // ── Resize logic ──
    const [inspectorWidth, setInspectorWidth] = useState(getStoredWidth);
    const isDragging = useRef(false);

    const handleResizeStart = useCallback((e) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";

        const onMove = (ev) => {
            if (!isDragging.current) return;
            const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
            setInspectorWidth(newWidth);
        };

        const onUp = () => {
            isDragging.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        };

        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, []);

    // Persist width to localStorage whenever it changes
    useEffect(() => {
        try { localStorage.setItem(STORAGE_KEY, String(inspectorWidth)); } catch { /* ignore */ }
    }, [inspectorWidth]);





    const isModel = node ? !node.nodeType : false;
    const isTools = node ? node.nodeType === "tools" : false;



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
            // Check input compatibility: conversation-type models accept "conversation" edges
            // Tools connections are always compatible with FC-capable models
            if (requiredInputs.length > 0) {
                const inputsOk = requiredInputs.every((mod) =>
                    mod === "tools" || mInputs.includes(mod) || (mod === "conversation" && m.modelType === "conversation"),
                );
                if (!inputsOk) return false;
            }
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
        if (n.nodeType === "input") {
            const labels = { text: "Text", image: "Image", audio: "Audio", video: "Video", pdf: "PDF", conversation: "Chat History" };
            return n.customName || labels[n.modality] || "Media";
        }
        if (n.nodeType === "viewer") return n.customName || "Output";
        if (n.nodeType === "tools") return n.customName || "Tools";
        return n.displayName || n.modelName || id;
    };

    const NODE_TYPE_LABELS = {
        text: "Text Node",
        image: "Image Node",
        audio: "Audio Node",
        video: "Video Node",
        pdf: "PDF Node",
        conversation: "Chat History Node",
    };

    const nodeSubtitle = isModel
        ? node.provider
        : isTools
            ? "Function Calling"
            : isInput
                ? (NODE_TYPE_LABELS[node.modality] || "Media Node")
                : "Output Node";

    return (
        <div className={styles.inspector} style={{ width: inspectorWidth, minWidth: MIN_WIDTH }}>
            <div className={styles.resizeHandle} onMouseDown={handleResizeStart} />
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
                    {isTools && (
                        <div className={styles.typeIcon} style={{ color: "#f97316" }}>
                            <Wrench size={16} />
                        </div>
                    )}
                    <div className={styles.headerInfo}>
                        <span className={styles.headerTitle}>
                            {isModel ? (node.displayName || node.modelName) : isTools ? (node.customName || "Tools") : isInput ? (node.customName || { text: "Text", image: "Image", audio: "Audio", video: "Video", pdf: "PDF", conversation: "Chat History" }[node.modality] || "Media") : (node.customName || "Output")}
                        </span>
                        <span className={styles.headerSubtitle}>
                            {nodeSubtitle}
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
                                                            {(m.rawInputTypes || m.inputTypes || []).map((t) => {
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

                {/* Input Ports */}
                {incoming.length > 0 && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Input Ports</label>
                        <div className={styles.connectionList}>
                            {incoming.map((c) => (
                                <div
                                    key={c.id}
                                    className={`${styles.connectionItem} ${styles.connectionItemClickable}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelectNode?.(c.sourceNodeId)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectNode?.(c.sourceNodeId); }}
                                >
                                    <span className={styles.connectionDot} style={{ background: MODALITY_ICONS[c.targetModality]?.color || "#888" }} />
                                    <span className={styles.connectionFrom}>{getNodeLabel(c.sourceNodeId)}</span>
                                    <span className={styles.connectionArrow}>→</span>
                                    <span className={styles.connectionModality}>{c.targetModality}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Output Ports */}
                {outgoing.length > 0 && (
                    <section className={styles.section}>
                        <label className={styles.sectionLabel}>Output Ports</label>
                        <div className={styles.connectionList}>
                            {outgoing.map((c) => (
                                <div
                                    key={c.id}
                                    className={`${styles.connectionItem} ${styles.connectionItemClickable}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => onSelectNode?.(c.targetNodeId)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectNode?.(c.targetNodeId); }}
                                >
                                    <span className={styles.connectionModality}>{c.sourceModality}</span>
                                    <span className={styles.connectionArrow}>→</span>
                                    <span className={styles.connectionTo}>{getNodeLabel(c.targetNodeId)}</span>
                                    <span className={styles.connectionDot} style={{ background: MODALITY_ICONS[c.sourceModality]?.color || "#888" }} />
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Content — text input assets */}
                {isInput && node.modality === "text" && (
                    <section className={`${styles.section} ${styles.scrollableSection}`}>
                        <TextContentComponent
                            label="Text Content"
                            value={node.content || ""}
                            onChange={readOnly ? undefined : (val) => onUpdateNodeContent?.(node.id, val)}
                            readOnly={readOnly}
                            placeholder="Enter text..."
                        />
                    </section>
                )}

                {/* Content — file input assets (image, audio, or empty) */}
                {isInput && node.modality !== "text" && node.modality !== "conversation" && (
                    <section className={`${styles.section} ${styles.scrollableSection}`}>
                        <label className={styles.sectionLabel}>Media Content</label>
                        {node.content ? (
                            <div className={styles.previewContainer}>
                                {node.modality === "image" ? (
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={PrismService.getFileUrl(node.content)}
                                        alt="Input asset"
                                        className={styles.previewImage}
                                    />
                                ) : node.modality === "audio" ? (
                                    <AudioRecorderComponent src={PrismService.getFileUrl(node.content)} compact />
                                ) : node.modality === "video" ? (
                                    <video
                                        controls
                                        src={PrismService.getFileUrl(node.content)}
                                        className={styles.previewVideo}
                                    />
                                ) : node.modality === "pdf" ? (
                                    <div className={styles.previewPdfWrap}>
                                        <iframe
                                            src={PrismService.getFileUrl(node.content)}
                                            className={styles.previewPdf}
                                            title="PDF preview"
                                        />
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
                            <AssetInputOptions
                                onFile={(dataUrl, mimeType) => onUpdateFileInput?.(node.id, dataUrl, mimeType)}
                            />
                        )}
                    </section>
                )}

                {/* Conversation messages — conversation input nodes */}
                {isInput && node.modality === "conversation" && (node.messages || []).length > 0 && (() => {
                    // Build resolved messages by merging static template with connected input content
                    const resolved = JSON.parse(JSON.stringify(node.messages || []));
                    for (const conn of incoming) {
                        const dotIdx = conn.targetModality.indexOf(".");
                        if (dotIdx === -1) continue;
                        const msgIdx = parseInt(conn.targetModality.substring(0, dotIdx));
                        const modality = conn.targetModality.substring(dotIdx + 1);
                        if (msgIdx < 0 || msgIdx >= resolved.length) continue;
                        const sourceNode = (nodes || []).find((n) => n.id === conn.sourceNodeId);
                        if (!sourceNode?.content) continue;
                        const msg = resolved[msgIdx];
                        if (modality === "text") {
                            msg.content = msg.content ? `${msg.content}\n\n${sourceNode.content}` : sourceNode.content;
                        } else if (modality === "image") {
                            msg.images = [...(msg.images || []), "[image attached]"];
                        } else if (modality === "audio") {
                            msg.audio = [...(msg.audio || []), "[audio attached]"];
                        } else if (modality === "video") {
                            msg.video = [...(msg.video || []), "[video attached]"];
                        } else if (modality === "pdf") {
                            msg.pdf = [...(msg.pdf || []), "[pdf attached]"];
                        }
                    }
                    const resolveRef = (ref) => {
                        if (typeof ref === "string" && ref.startsWith("minio://")) return PrismService.getFileUrl(ref);
                        if (typeof ref === "string" && ref.startsWith("data:")) {
                            const mime = ref.match(/^data:([^;]+)/)?.[1] || "unknown";
                            return `[${mime} attached]`;
                        }
                        return ref;
                    };
                    const messagesJson = JSON.stringify(
                        resolved.map(({ role, content, images, audio, video, pdf }) => ({
                            role,
                            content: content || "",
                            ...(images?.length > 0 ? { images: images.map(resolveRef) } : {}),
                            ...(audio?.length > 0 ? { audio: audio.map(resolveRef) } : {}),
                            ...(video?.length > 0 ? { video: video.map(resolveRef) } : {}),
                            ...(pdf?.length > 0 ? { pdf: pdf.map(resolveRef) } : {}),
                        })),
                        null,
                        2,
                    );
                    return (
                        <section className={`${styles.section} ${styles.scrollableSection}`}>
                            <div className={styles.sectionHeaderRow}>
                                <label className={styles.sectionLabel}>
                                    {conversationView === "json" ? "Conversation JSON" : "Conversation Preview"}
                                </label>
                                <div className={styles.contentTabs}>
                                    <button
                                        className={`${styles.contentTab} ${conversationView === "json" ? styles.contentTabActive : ""}`}
                                        onClick={() => setConversationView("json")}
                                    >
                                        <Code size={10} />
                                        JSON
                                    </button>
                                    <button
                                        className={`${styles.contentTab} ${conversationView === "preview" ? styles.contentTabActive : ""}`}
                                        onClick={() => setConversationView("preview")}
                                    >
                                        <BookOpen size={10} />
                                        Preview
                                    </button>
                                </div>
                            </div>
                            {conversationView === "preview" ? (
                                <div className={styles.conversationPreview}>
                                    <MessageList messages={resolved} readOnly />
                                </div>
                            ) : (
                                <MarkdownContent content={`\`\`\`json\n${messagesJson}\n\`\`\``} />
                            )}
                        </section>
                    );
                })()}

                {/* Tool node — built-in + custom tool toggles */}
                {isTools && (() => {
                    const builtIn = node.builtInTools || [];
                    const custom = node.customTools || [];
                    const disabled = new Set(node.disabledTools || []);
                    const enabledCount = builtIn.filter((t) => !disabled.has(t.name)).length
                        + custom.filter((t) => !disabled.has(t.name || t._id)).length;
                    const totalCount = builtIn.length + custom.length;

                    const toggleTool = (toolName) => {
                        const next = new Set(disabled);
                        if (next.has(toolName)) next.delete(toolName);
                        else next.add(toolName);
                        onUpdateNodeConfig?.(node.id, "disabledTools", [...next]);
                    };

                    const renderTool = (t, key) => {
                        const name = t.name || key;
                        const isDisabled = disabled.has(name);
                        const paramCount = t.parameters?.properties
                            ? Object.keys(t.parameters.properties).length
                            : (t.parameters?.length || 0);
                        const displayName = name.replace(/^get_/, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                        return (
                            <div key={name} className={styles.toolRow}>
                                <div className={styles.toolRowLeft}>
                                    <span className={`${styles.toolRowName} ${isDisabled ? styles.toolRowNameDisabled : ""}`}>
                                        {displayName}
                                    </span>
                                    {paramCount > 0 && (
                                        <span className={styles.toolRowParams}>{paramCount} params</span>
                                    )}
                                </div>
                                <ToggleSwitchComponent
                                    checked={!isDisabled}
                                    onChange={() => toggleTool(name)}
                                    size="small"
                                />
                            </div>
                        );
                    };

                    return (
                        <>
                            <section className={styles.section}>
                                <div className={styles.toolSummary}>
                                    <span className={styles.toolSummaryCount}>{enabledCount}</span>
                                    <span className={styles.toolSummaryLabel}>of {totalCount} tools enabled</span>
                                </div>
                            </section>

                            {builtIn.length > 0 && (
                                <section className={styles.section}>
                                    <button
                                        className={styles.toolSectionToggle}
                                        onClick={() => setToolBuiltInOpen((v) => !v)}
                                    >
                                        {toolBuiltInOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        <span>Built-in ({builtIn.filter((t) => !disabled.has(t.name)).length}/{builtIn.length})</span>
                                    </button>
                                    {toolBuiltInOpen && (
                                        <div className={styles.toolList}>
                                            {builtIn.map((t) => renderTool(t, t.name))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {custom.length > 0 && (
                                <section className={styles.section}>
                                    <button
                                        className={styles.toolSectionToggle}
                                        onClick={() => setToolCustomOpen((v) => !v)}
                                    >
                                        {toolCustomOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                        <span>Custom ({custom.filter((t) => !disabled.has(t.name || t._id)).length}/{custom.length})</span>
                                    </button>
                                    {toolCustomOpen && (
                                        <div className={styles.toolList}>
                                            {custom.map((t) => renderTool(t, t.name || t._id))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </>
                    );
                })()}

                {/* Generated Results — model nodes only */}
                {results && !results.error && !isViewer && !isInput && (
                    <section className={`${styles.section} ${styles.scrollableSection}`}>
                        <label className={styles.sectionLabel}>Generated Output</label>

                        {results.image && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Image</span>
                                <div className={styles.resultImageContainer}>
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={PrismService.getFileUrl(results.image)}
                                        alt="Generated image"
                                        className={styles.resultImage}
                                    />
                                    <a
                                        href={PrismService.getFileUrl(results.image)}
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
                                <TextContentComponent
                                    label="Text"
                                    value={results.text}
                                    readOnly
                                />
                            </div>
                        )}

                        {results.audio && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Audio</span>
                                <audio controls src={PrismService.getFileUrl(results.audio)} className={styles.resultAudio} />
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
                    <section className={`${styles.section} ${styles.scrollableSection}`}>

                        {node.receivedOutputs.image && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Image Content</span>
                                <div className={styles.resultImageContainer}>
                                    <img /* eslint-disable-line @next/next/no-img-element */
                                        src={PrismService.getFileUrl(node.receivedOutputs.image)}
                                        alt="Received image"
                                        className={styles.resultImage}
                                    />
                                    <a
                                        href={PrismService.getFileUrl(node.receivedOutputs.image)}
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
                                <TextContentComponent
                                    label="Text Content"
                                    value={node.receivedOutputs.text}
                                    readOnly
                                />
                            </div>
                        )}

                        {node.receivedOutputs.audio && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Audio Content</span>
                                <audio controls src={PrismService.getFileUrl(node.receivedOutputs.audio)} className={styles.resultAudio} />
                            </div>
                        )}

                        {node.receivedOutputs.embedding && (
                            <div className={styles.resultBlock}>
                                <span className={styles.resultType}>Embedding Content [{node.receivedOutputs.embedding.length} dims]</span>
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

            </div>


        </div>
    );
}
