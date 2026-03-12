"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, Type, Volume2, Eye, Loader2, Check, AlertTriangle, Settings, Paperclip } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { MODALITY_ICONS } from "./WorkflowSidebar";
import styles from "./WorkflowCanvas.module.css";

const MODALITY_COLORS = {
    text: "#6366f1",
    image: "#10b981",
    audio: "#f59e0b",
    video: "#f43f5e",
    pdf: "#64748b",
    embedding: "#06b6d4",
};

const ASSET_ICONS = {
    text: Type,
    audio: Volume2,
};

const NODE_WIDTH = 220;
const ASSET_NODE_WIDTH = 200;
const PORT_RADIUS = 7;
const HEADER_HEIGHT = 36;
const PORT_SECTION_HEIGHT = 24;
const ASSET_CONTENT_HEIGHT = 180;
const ASSET_CONTENT_HEIGHT_COMPACT = 40;
const RESULT_AREA_HEIGHT = 60;
const IMAGE_RESULT_AREA_HEIGHT = 120;
const CONFIG_AREA_HEIGHT = 160;
const ASSET_INFO_HEIGHT = 80;

function getPortPosition(node, portType, portIndex, configOffset = 0) {
    const width = node.nodeType ? ASSET_NODE_WIDTH : NODE_WIDTH;
    const x = portType === "input" ? 0 : width;
    const startY = HEADER_HEIGHT + configOffset + 8;
    const spacing = PORT_SECTION_HEIGHT;
    const y = startY + portIndex * spacing + spacing / 2;
    return { x: node.position.x + x, y: node.position.y + y };
}

function getAssetContentHeight(node) {
    if (node.nodeType === "viewer") {
        const outputs = node.receivedOutputs;
        if (!outputs || Object.keys(outputs).length === 0) return ASSET_CONTENT_HEIGHT_COMPACT + 20;
        let h = 8; // padding
        if (outputs.image) h += 140;
        if (outputs.text) h += 50;
        if (outputs.audio) h += 36;
        if (outputs.video) h += 140;
        return Math.max(h, ASSET_CONTENT_HEIGHT_COMPACT + 20);
    }
    if (node.modality === "image") return ASSET_CONTENT_HEIGHT;
    return ASSET_CONTENT_HEIGHT_COMPACT;
}

function getNodeHeight(node, isExpanded = false) {
    if (node.nodeType) {
        const inputCount = (node.inputTypes || []).length;
        const outputCount = (node.outputTypes || []).length;
        const portRows = Math.max(inputCount, outputCount, 1);
        const infoHeight = node.nodeType === "viewer" ? 0 : ASSET_INFO_HEIGHT;
        const contentHeight = isExpanded ? getAssetContentHeight(node) + infoHeight : 0;
        return HEADER_HEIGHT + contentHeight + portRows * PORT_SECTION_HEIGHT + 12;
    }
    const inputCount = (node.inputTypes || []).length;
    const outputCount = (node.outputTypes || []).length;
    const portRows = Math.max(inputCount, outputCount, 1);
    return HEADER_HEIGHT + portRows * PORT_SECTION_HEIGHT + 12;
}

/**
 * Generate a smooth bezier curve path between two points.
 */
function connectionPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const cp = Math.max(dx * 0.5, 60);
    return `M ${x1} ${y1} C ${x1 + cp} ${y1}, ${x2 - cp} ${y2}, ${x2} ${y2}`;
}

export default function WorkflowCanvas({
    nodes,
    connections,
    onUpdateNodePosition,
    onDeleteNode,
    onAddConnection,
    onDeleteConnection,
    onUpdateNodeContent,
    onUpdateNodeConfig,
    onUpdateFileInput,
    nodeStatuses = {},
    nodeResults = {},
    selectedNodeId,
    onSelectNode,
}) {
    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [connecting, setConnecting] = useState(null);
    const [connectingMouse, setConnectingMouse] = useState(null);
    const [expandedInputs, setExpandedInputs] = useState(new Set());
    const [expandedOutputs, setExpandedOutputs] = useState(new Set());
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const [hoveredPort, setHoveredPort] = useState(null);

    const MIN_ZOOM = 0.2;
    const MAX_ZOOM = 3;

    // Convert screen coordinates to SVG coordinates
    const screenToSvg = useCallback(
        (clientX, clientY) => {
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return { x: clientX, y: clientY };
            return {
                x: (clientX - rect.left - pan.x) / zoom,
                y: (clientY - rect.top - pan.y) / zoom,
            };
        },
        [pan, zoom],
    );

    // Node dragging
    const handleNodeMouseDown = useCallback(
        (e, nodeId) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            onSelectNode?.(nodeId);
            const node = nodes.find((n) => n.id === nodeId);
            if (!node) return;
            const svgPos = screenToSvg(e.clientX, e.clientY);
            setDragging({
                nodeId,
                offsetX: svgPos.x - node.position.x,
                offsetY: svgPos.y - node.position.y,
            });
        },
        [nodes, screenToSvg, onSelectNode],
    );

    // Panning — starts when clicking on empty canvas background
    const handleCanvasMouseDown = useCallback(
        (e) => {
            if (e.button !== 0) return;
            // Allow pan from: container div, SVG element, grid background,
            // or any SVG child that isn't inside a node/connection group
            const el = e.target;
            const isContainerOrSvg = el === containerRef.current || el === svgRef.current;
            const isGridBg = el.classList?.contains?.(styles.gridBackground);
            const isInsideInteractive = el.closest?.(`.${styles.nodeGroup}, .${styles.connectionGroup}`);
            if (isContainerOrSvg || isGridBg || (!isInsideInteractive && containerRef.current?.contains(el))) {
                onSelectNode?.(null);
                setIsPanning(true);
                panStart.current = {
                    x: e.clientX,
                    y: e.clientY,
                    panX: pan.x,
                    panY: pan.y,
                };
            }
        },
        [pan, onSelectNode],
    );

    const handleMouseMove = useCallback(
        (e) => {
            if (dragging) {
                const svgPos = screenToSvg(e.clientX, e.clientY);
                onUpdateNodePosition(dragging.nodeId, {
                    x: svgPos.x - dragging.offsetX,
                    y: svgPos.y - dragging.offsetY,
                });
            }
            if (connecting) {
                const svgPos = screenToSvg(e.clientX, e.clientY);
                setConnectingMouse(svgPos);
            }
            if (isPanning) {
                setPan({
                    x: panStart.current.panX + (e.clientX - panStart.current.x),
                    y: panStart.current.panY + (e.clientY - panStart.current.y),
                });
            }
        },
        [dragging, connecting, isPanning, screenToSvg, onUpdateNodePosition],
    );

    const handleMouseUp = useCallback(() => {
        if (dragging) setDragging(null);
        if (isPanning) setIsPanning(false);
        if (connecting && !hoveredPort) {
            setConnecting(null);
            setConnectingMouse(null);
        }
    }, [dragging, isPanning, connecting, hoveredPort]);

    // Zoom — scroll wheel zooms toward cursor
    const handleWheel = useCallback(
        (e) => {
            e.preventDefault();
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;

            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));
            const ratio = newZoom / zoom;

            // Adjust pan so the point under the cursor stays in place
            setPan((prev) => ({
                x: mouseX - ratio * (mouseX - prev.x),
                y: mouseY - ratio * (mouseY - prev.y),
            }));
            setZoom(newZoom);
        },
        [zoom],
    );

    useEffect(() => {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        const container = containerRef.current;
        container?.addEventListener("wheel", handleWheel, { passive: false });
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            container?.removeEventListener("wheel", handleWheel);
        };
    }, [handleMouseMove, handleMouseUp, handleWheel]);

    // Output port click — start connection
    const handleOutputPortClick = useCallback(
        (e, nodeId, modality, index) => {
            e.stopPropagation();
            if (connecting) {
                setConnecting(null);
                setConnectingMouse(null);
                return;
            }
            setConnecting({ sourceNodeId: nodeId, sourceModality: modality, sourceIndex: index });
            const svgPos = screenToSvg(e.clientX, e.clientY);
            setConnectingMouse(svgPos);
        },
        [connecting, screenToSvg],
    );

    // Input port click — complete connection
    const handleInputPortClick = useCallback(
        (e, nodeId, modality) => {
            e.stopPropagation();
            if (!connecting) return;
            if (connecting.sourceModality !== modality) return;
            if (connecting.sourceNodeId === nodeId) return;

            const existingConn = connections.find(
                (c) => c.targetNodeId === nodeId && c.targetModality === modality,
            );
            if (existingConn) return;

            onAddConnection({
                sourceNodeId: connecting.sourceNodeId,
                sourceModality: connecting.sourceModality,
                targetNodeId: nodeId,
                targetModality: modality,
            });

            setConnecting(null);
            setConnectingMouse(null);
        },
        [connecting, connections, onAddConnection],
    );

    // Render input/output ports
    const renderPorts = (node, inputTypes, outputTypes, configOffset = 0) => {
        const nodeWidth = node.nodeType ? ASSET_NODE_WIDTH : NODE_WIDTH;
        const portStartY = HEADER_HEIGHT + configOffset + 8;

        return (
            <>
                {/* Input ports */}
                {inputTypes.map((modality, i) => {
                    const portY = portStartY + i * PORT_SECTION_HEIGHT + PORT_SECTION_HEIGHT / 2;
                    const color = MODALITY_COLORS[modality] || "#888";
                    const isCompatible = connecting && connecting.sourceModality === modality && connecting.sourceNodeId !== node.id;
                    const isHovered = hoveredPort?.nodeId === node.id && hoveredPort?.type === "input" && hoveredPort?.modality === modality;
                    const Icon = MODALITY_ICONS[modality]?.icon;

                    return (
                        <g key={`in-${modality}-${i}`}>
                            <circle
                                cx={0}
                                cy={portY}
                                r={isHovered && isCompatible ? PORT_RADIUS + 2 : PORT_RADIUS}
                                fill={isCompatible ? color : "var(--bg-tertiary)"}
                                stroke={color}
                                strokeWidth={2}
                                className={`${styles.port} ${isCompatible ? styles.portCompatible : ""}`}
                                onClick={(e) => handleInputPortClick(e, node.id, modality)}
                                onMouseEnter={() => setHoveredPort({ nodeId: node.id, type: "input", modality })}
                                onMouseLeave={() => setHoveredPort(null)}
                            />
                            {Icon && (
                                <foreignObject x={8} y={portY - 7} width={14} height={14} style={{ pointerEvents: "none" }}>
                                    <div style={{ display: "flex", alignItems: "center" }}>
                                        <Icon size={11} style={{ color }} />
                                    </div>
                                </foreignObject>
                            )}
                            <text x={24} y={portY + 1} dominantBaseline="middle" className={styles.portLabel}>
                                {MODALITY_ICONS[modality]?.label || modality}
                            </text>
                        </g>
                    );
                })}

                {/* Output ports */}
                {outputTypes.map((modality, i) => {
                    const portY = portStartY + i * PORT_SECTION_HEIGHT + PORT_SECTION_HEIGHT / 2;
                    const color = MODALITY_COLORS[modality] || "#888";
                    const Icon = MODALITY_ICONS[modality]?.icon;
                    const isActive = connecting?.sourceNodeId === node.id && connecting?.sourceModality === modality;

                    return (
                        <g key={`out-${modality}-${i}`}>
                            <circle
                                cx={nodeWidth}
                                cy={portY}
                                r={isActive ? PORT_RADIUS + 2 : PORT_RADIUS}
                                fill={isActive ? color : "var(--bg-tertiary)"}
                                stroke={color}
                                strokeWidth={2}
                                className={`${styles.port} ${styles.portOutput}`}
                                onClick={(e) => handleOutputPortClick(e, node.id, modality, i)}
                                onMouseEnter={() => setHoveredPort({ nodeId: node.id, type: "output", modality })}
                                onMouseLeave={() => setHoveredPort(null)}
                            />
                            {Icon && (
                                <foreignObject x={nodeWidth - 22} y={portY - 7} width={14} height={14} style={{ pointerEvents: "none" }}>
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                                        <Icon size={11} style={{ color }} />
                                    </div>
                                </foreignObject>
                            )}
                            <text x={nodeWidth - 24} y={portY + 1} dominantBaseline="middle" textAnchor="end" className={styles.portLabel}>
                                {MODALITY_ICONS[modality]?.label || modality}
                            </text>
                        </g>
                    );
                })}
            </>
        );
    };

    // Render a model node
    const renderModelNode = (node) => {
        const inputTypes = node.inputTypes || [];
        const outputTypes = node.outputTypes || [];
        const status = nodeStatuses[node.id];
        const results = nodeResults[node.id];
        const hasResults = results && Object.keys(results).length > 0 && !results.error;
        const isSelected = selectedNodeId === node.id;

        // Toggle states
        const inputsExpanded = expandedInputs.has(node.id);
        const outputsExpanded = expandedOutputs.has(node.id);

        // Calculate height: header + optional config + ports + optional result area
        const portRows = Math.max(inputTypes.length, outputTypes.length, 1);
        const portsHeight = portRows * PORT_SECTION_HEIGHT + 12;
        const configHeight = inputsExpanded ? CONFIG_AREA_HEIGHT : 0;
        const actualResultHeight = results?.image ? IMAGE_RESULT_AREA_HEIGHT : RESULT_AREA_HEIGHT;
        const resultHeight = (hasResults && outputsExpanded) ? actualResultHeight + 8 : 0;
        const errorHeight = results?.error ? 28 : 0;
        const nodeHeight = HEADER_HEIGHT + configHeight + portsHeight + resultHeight + errorHeight;

        // Border color: selection or status
        const statusBorderColor = isSelected ? "var(--accent-color, #7c6ef6)" : status === "running" ? "#f59e0b" : status === "error" ? "#f43f5e" : status === "done" ? "#10b981" : null;
        const borderWidth = isSelected ? 2 : status ? 2 : 0;

        return (
            <g
                key={node.id}
                transform={`translate(${node.position.x}, ${node.position.y})`}
                className={styles.nodeGroup}
            >
                <rect
                    width={NODE_WIDTH}
                    height={nodeHeight}
                    rx="3"
                    ry="3"
                    className={styles.nodeBody}
                    style={statusBorderColor ? { stroke: statusBorderColor, strokeWidth: borderWidth } : undefined}
                />
                <rect width={NODE_WIDTH} height={HEADER_HEIGHT} rx="3" ry="3" className={styles.nodeHeader} />
                <rect x={0} y={HEADER_HEIGHT - 3} width={NODE_WIDTH} height={3} className={styles.nodeHeader} />

                <g className={styles.nodeDragArea} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} style={{ cursor: "grab" }}>
                    <rect x={0} y={0} width={NODE_WIDTH - 70} height={HEADER_HEIGHT} fill="transparent" />
                    <foreignObject x={8} y={0} width={NODE_WIDTH - 78} height={HEADER_HEIGHT}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%", paddingTop: 1 }}>
                            <ProviderLogo provider={node.provider} size={16} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {node.displayName || node.modelName}
                            </span>
                        </div>
                    </foreignObject>
                </g>

                {/* Status indicator in header */}
                {status && (
                    <foreignObject x={NODE_WIDTH - 70} y={8} width={18} height={18}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {status === "running" && <Loader2 size={12} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />}
                            {status === "done" && <Check size={12} style={{ color: "#10b981" }} />}
                            {status === "error" && <AlertTriangle size={12} style={{ color: "#f43f5e" }} />}
                        </div>
                    </foreignObject>
                )}

                {/* Inputs toggle (Settings icon) */}
                <foreignObject x={NODE_WIDTH - 70} y={6} width={20} height={20}>
                    <button
                        className={`${styles.deleteNodeBtn} ${inputsExpanded ? styles.configBtnActive : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpandedInputs((prev) => {
                                const next = new Set(prev);
                                if (next.has(node.id)) next.delete(node.id);
                                else next.add(node.id);
                                return next;
                            });
                        }}
                        title="Toggle inputs"
                    >
                        <Settings size={12} />
                    </button>
                </foreignObject>

                {/* Outputs toggle (Eye icon) */}
                <foreignObject x={NODE_WIDTH - 48} y={6} width={20} height={20}>
                    <button
                        className={`${styles.deleteNodeBtn} ${outputsExpanded ? styles.configBtnActive : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpandedOutputs((prev) => {
                                const next = new Set(prev);
                                if (next.has(node.id)) next.delete(node.id);
                                else next.add(node.id);
                                return next;
                            });
                        }}
                        title="Toggle outputs"
                    >
                        <Eye size={12} />
                    </button>
                </foreignObject>

                <foreignObject x={NODE_WIDTH - 26} y={6} width={20} height={20}>
                    <button className={styles.deleteNodeBtn} onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }} title="Remove node">
                        <X size={12} />
                    </button>
                </foreignObject>

                {/* Expandable config section */}
                {inputsExpanded && (
                    <foreignObject x={4} y={HEADER_HEIGHT + 2} width={NODE_WIDTH - 8} height={CONFIG_AREA_HEIGHT - 4}>
                        <div className={styles.nodeConfig}>
                            {node.supportsSystemPrompt !== false && (
                                <>
                                    <label className={styles.nodeConfigLabel}>System Prompt</label>
                                    <textarea
                                        className={styles.nodeConfigTextarea}
                                        value={node.systemPrompt || ""}
                                        onChange={(e) => onUpdateNodeConfig?.(node.id, "systemPrompt", e.target.value)}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        placeholder="Instructions for this model..."
                                        rows={2}
                                    />
                                </>
                            )}
                            <label className={styles.nodeConfigLabel}>User Prompt</label>
                            <textarea
                                className={styles.nodeConfigTextarea}
                                value={node.userPrompt || ""}
                                onChange={(e) => onUpdateNodeConfig?.(node.id, "userPrompt", e.target.value)}
                                onMouseDown={(e) => e.stopPropagation()}
                                placeholder="What to do with piped input..."
                                rows={2}
                            />
                            <label className={styles.nodeConfigLabel}>Static Input</label>
                            <div className={styles.nodeConfigUpload}>
                                {node.staticInputs?.image ? (
                                    <span className={styles.nodeConfigFile} title="Static image attached">
                                        📎 Image attached
                                        <button
                                            className={styles.nodeConfigClearBtn}
                                            onClick={() => onUpdateNodeConfig?.(node.id, "staticInputs", { ...node.staticInputs, image: null })}
                                        >×</button>
                                    </span>
                                ) : (
                                    <label className={styles.nodeConfigUploadLabel}>
                                        <Upload size={10} />
                                        <span>Attach image/file</span>
                                        <input
                                            type="file"
                                            accept="image/*,audio/*"
                                            className={styles.assetFileInput}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                    const modality = file.type.startsWith("image") ? "image" : "audio";
                                                    onUpdateNodeConfig?.(node.id, "staticInputs", {
                                                        ...node.staticInputs,
                                                        [modality]: reader.result,
                                                    });
                                                };
                                                reader.readAsDataURL(file);
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>
                    </foreignObject>
                )}

                {/* Ports — offset by config height when expanded */}
                <g transform={`translate(0, ${configHeight})`}>
                    {renderPorts(node, inputTypes, outputTypes)}
                </g>

                {/* Result display area — only when outputs toggled on */}
                {hasResults && outputsExpanded && (
                    <foreignObject x={4} y={HEADER_HEIGHT + configHeight + portsHeight} width={NODE_WIDTH - 8} height={actualResultHeight}>
                        <div className={styles.modelResultArea}>
                            {results.image ? (
                                <img /* eslint-disable-line @next/next/no-img-element */
                                    src={results.image}
                                    alt="Generated output"
                                    className={styles.modelResultImage}
                                />
                            ) : results.audio ? (
                                <div className={styles.modelResultAudio}>
                                    <Volume2 size={14} />
                                    <span>Audio generated</span>
                                </div>
                            ) : results.text ? (
                                <div className={styles.modelResultText}>{results.text}</div>
                            ) : null}
                        </div>
                    </foreignObject>
                )}

                {/* Error display */}
                {results?.error && (
                    <foreignObject x={4} y={HEADER_HEIGHT + configHeight + portsHeight + resultHeight} width={NODE_WIDTH - 8} height={24}>
                        <div className={styles.modelResultError}>{results.error}</div>
                    </foreignObject>
                )}
            </g>
        );
    };

    // Handle file drop/upload for file input nodes
    const handleFileInputChange = (nodeId, file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            onUpdateFileInput?.(nodeId, reader.result, file.type);
        };
        reader.readAsDataURL(file);
    };

    // Render an asset node (input asset or output viewer)
    const renderAssetNode = (node) => {
        const isViewer = node.nodeType === "viewer";
        const isExpanded = isViewer
            ? !expandedInputs.has(node.id) // viewers expanded by default, toggle collapses
            : expandedInputs.has(node.id);
        const nodeHeight = getNodeHeight(node, isExpanded);
        const width = ASSET_NODE_WIDTH;
        const inputTypes = node.inputTypes || [];
        const outputTypes = node.outputTypes || [];
        const accentColor = isViewer ? "#a78bfa" : (MODALITY_COLORS[node.modality] || "#8b5cf6");
        const AssetIcon = isViewer ? Eye : node.modality
            ? (ASSET_ICONS[node.modality] || MODALITY_ICONS[node.modality]?.icon || Paperclip)
            : Paperclip;

        // Label for input nodes
        const inputLabel = isViewer
            ? "Output Viewer"
            : node.modality
                ? `${MODALITY_ICONS[node.modality]?.label || node.modality} Input`
                : "File Input";

        return (
            <g
                key={node.id}
                transform={`translate(${node.position.x}, ${node.position.y})`}
                className={styles.nodeGroup}
            >
                {/* Body with accent border */}
                <rect
                    width={width}
                    height={nodeHeight}
                    rx="3"
                    ry="3"
                    className={styles.assetNodeBody}
                    style={{ stroke: accentColor, strokeOpacity: 0.4 }}
                />

                {/* Header */}
                <rect width={width} height={HEADER_HEIGHT} rx="3" ry="3" className={styles.assetNodeHeader} style={{ fill: accentColor, fillOpacity: 0.1 }} />
                <rect x={0} y={HEADER_HEIGHT - 3} width={width} height={3} className={styles.assetNodeHeader} style={{ fill: accentColor, fillOpacity: 0.1 }} />

                {/* Drag area + icon + title */}
                <g className={styles.nodeDragArea} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} style={{ cursor: "grab" }}>
                    <rect x={0} y={0} width={width - 48} height={HEADER_HEIGHT} fill="transparent" />
                    <foreignObject x={8} y={0} width={width - 56} height={HEADER_HEIGHT}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%", paddingTop: 1 }}>
                            <AssetIcon size={14} style={{ color: accentColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: accentColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {inputLabel}
                            </span>
                        </div>
                    </foreignObject>
                </g>

                {/* Gear button */}
                <foreignObject x={width - 48} y={6} width={20} height={20}>
                    <button
                        className={`${styles.deleteNodeBtn} ${isExpanded ? styles.configBtnActive : ""}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpandedInputs((prev) => {
                                const next = new Set(prev);
                                if (next.has(node.id)) next.delete(node.id);
                                else next.add(node.id);
                                return next;
                            });
                        }}
                        title={isViewer ? "View outputs" : "Node info"}
                    >
                        {isViewer ? <Eye size={12} /> : <Settings size={12} />}
                    </button>
                </foreignObject>

                {/* Delete button */}
                <foreignObject x={width - 26} y={6} width={20} height={20}>
                    <button className={styles.deleteNodeBtn} onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }} title="Remove node">
                        <X size={12} />
                    </button>
                </foreignObject>

                {/* Content area — only when expanded */}
                {isExpanded && (() => {
                    const contentH = getAssetContentHeight(node);
                    return (
                        <>
                            <foreignObject x={4} y={HEADER_HEIGHT + 4} width={width - 8} height={contentH - 8}>
                                {isViewer ? (
                                    <div className={styles.viewerContent}>
                                        {node.receivedOutputs && Object.keys(node.receivedOutputs).length > 0 ? (
                                            <>
                                                {node.receivedOutputs.image && (
                                                    <img
                                                        src={node.receivedOutputs.image}
                                                        alt="Received image"
                                                        className={styles.viewerImage}
                                                    />
                                                )}
                                                {node.receivedOutputs.text && (
                                                    <div className={styles.viewerText}>{node.receivedOutputs.text}</div>
                                                )}
                                                {node.receivedOutputs.audio && (
                                                    <audio
                                                        controls
                                                        src={node.receivedOutputs.audio}
                                                        style={{ width: "100%", height: 28 }}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                                {node.receivedOutputs.video && (
                                                    <video
                                                        controls
                                                        src={node.receivedOutputs.video}
                                                        className={styles.viewerImage}
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <div className={styles.viewerEmpty}>
                                                <Eye size={16} style={{ opacity: 0.3 }} />
                                                <span>Waiting for input…</span>
                                            </div>
                                        )}
                                    </div>
                                ) : node.modality === "text" && node.content !== undefined && node.modality !== null ? (
                                    <textarea
                                        className={styles.assetTextarea}
                                        value={node.content || ""}
                                        onChange={(e) => onUpdateNodeContent(node.id, e.target.value)}
                                        placeholder="Enter text…"
                                        onMouseDown={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    /* File input: upload / drag-drop zone or preview */
                                    <div
                                        className={styles.assetUploadArea}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                        onDrop={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const file = e.dataTransfer?.files?.[0];
                                            if (file) handleFileInputChange(node.id, file);
                                        }}
                                    >
                                        {node.content ? (
                                            <div className={styles.fileInputPreview}>
                                                {node.modality === "image" ? (
                                                    <img
                                                        src={node.content}
                                                        alt="Uploaded asset"
                                                        className={styles.assetPreviewImg}
                                                    />
                                                ) : node.modality === "audio" ? (
                                                    <div className={styles.assetFileLabel}>
                                                        <Volume2 size={14} />
                                                        Audio loaded
                                                    </div>
                                                ) : (
                                                    <div className={styles.assetFileLabel}>
                                                        <Paperclip size={14} />
                                                        File loaded
                                                    </div>
                                                )}
                                                <button
                                                    className={styles.fileInputClearBtn}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onUpdateFileInput?.(node.id, null, null);
                                                    }}
                                                    title="Remove file"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        ) : (
                                            <label className={styles.assetUploadLabel}>
                                                <Paperclip size={14} />
                                                <span>Drop or upload file</span>
                                                <input
                                                    type="file"
                                                    accept="image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv"
                                                    className={styles.assetFileInput}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleFileInputChange(node.id, file);
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                />
                                            </label>
                                        )}
                                    </div>
                                )}
                            </foreignObject>

                            {/* Expandable info section — skip for viewers */}
                            {!isViewer && (
                                <foreignObject x={4} y={HEADER_HEIGHT + contentH + 2} width={width - 8} height={ASSET_INFO_HEIGHT - 4}>
                                    <div className={styles.nodeConfig}>
                                        <label className={styles.nodeConfigLabel}>Node ID</label>
                                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", wordBreak: "break-all" }}>
                                            {node.id}
                                        </div>
                                        <label className={styles.nodeConfigLabel}>Modality</label>
                                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                                            {node.modality || "None (upload a file)"}
                                        </div>
                                    </div>
                                </foreignObject>
                            )}
                        </>
                    );
                })()}

                {/* Ports below content + info area */}
                {renderPorts(node, inputTypes, outputTypes, isExpanded ? getAssetContentHeight(node) + (isViewer ? 0 : ASSET_INFO_HEIGHT) : 0)}
            </g>
        );
    };

    // Render a single node (dispatch to model or asset)
    const renderNode = (node) => {
        if (node.nodeType) {
            return renderAssetNode(node);
        }
        return renderModelNode(node);
    };

    // Render connections
    const renderConnection = (conn) => {
        const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
        const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
        if (!sourceNode || !targetNode) return null;

        const sourceIndex = (sourceNode.outputTypes || []).indexOf(conn.sourceModality);
        const targetIndex = (targetNode.inputTypes || []).indexOf(conn.targetModality);
        if (sourceIndex === -1 || targetIndex === -1) return null;

        const isSourceAssetExpanded = sourceNode.nodeType
            ? (sourceNode.nodeType === "viewer" ? !expandedInputs.has(sourceNode.id) : expandedInputs.has(sourceNode.id))
            : false;
        const isTargetAssetExpanded = targetNode.nodeType
            ? (targetNode.nodeType === "viewer" ? !expandedInputs.has(targetNode.id) : expandedInputs.has(targetNode.id))
            : false;

        const sourceOffset = !sourceNode.nodeType && expandedInputs.has(sourceNode.id)
            ? CONFIG_AREA_HEIGHT
            : isSourceAssetExpanded
                ? getAssetContentHeight(sourceNode) + (sourceNode.nodeType === "viewer" ? 0 : ASSET_INFO_HEIGHT)
                : 0;
        const targetOffset = !targetNode.nodeType && expandedInputs.has(targetNode.id)
            ? CONFIG_AREA_HEIGHT
            : isTargetAssetExpanded
                ? getAssetContentHeight(targetNode) + (targetNode.nodeType === "viewer" ? 0 : ASSET_INFO_HEIGHT)
                : 0;

        const sourcePos = getPortPosition(sourceNode, "output", sourceIndex, sourceOffset);
        const targetPos = getPortPosition(targetNode, "input", targetIndex, targetOffset);
        const color = MODALITY_COLORS[conn.sourceModality] || "#888";

        return (
            <g key={conn.id} className={styles.connectionGroup}>
                <path
                    d={connectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                    stroke="transparent"
                    strokeWidth={12}
                    fill="none"
                    className={styles.connectionHitArea}
                    onClick={() => onDeleteConnection(conn.id)}
                />
                <path
                    d={connectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
                    stroke={color}
                    strokeWidth={2}
                    fill="none"
                    strokeOpacity={0.7}
                    className={styles.connectionLine}
                />
                <foreignObject
                    x={(sourcePos.x + targetPos.x) / 2 - 8}
                    y={(sourcePos.y + targetPos.y) / 2 - 8}
                    width={16}
                    height={16}
                    className={styles.connectionDeleteWrapper}
                >
                    <button
                        className={styles.connectionDeleteBtn}
                        onClick={(e) => { e.stopPropagation(); onDeleteConnection(conn.id); }}
                        title="Delete connection"
                    >
                        <X size={10} />
                    </button>
                </foreignObject>
            </g>
        );
    };

    // Render the "in-progress" connection line
    const renderConnectingLine = () => {
        if (!connecting || !connectingMouse) return null;
        const sourceNode = nodes.find((n) => n.id === connecting.sourceNodeId);
        if (!sourceNode) return null;

        const sourceIndex = (sourceNode.outputTypes || []).indexOf(connecting.sourceModality);
        if (sourceIndex === -1) return null;

        const isSourceAssetExpanded = sourceNode.nodeType
            ? (sourceNode.nodeType === "viewer" ? !expandedInputs.has(sourceNode.id) : expandedInputs.has(sourceNode.id))
            : false;
        const srcOffset = !sourceNode.nodeType && expandedInputs.has(sourceNode.id)
            ? CONFIG_AREA_HEIGHT
            : isSourceAssetExpanded
                ? getAssetContentHeight(sourceNode) + (sourceNode.nodeType === "viewer" ? 0 : ASSET_INFO_HEIGHT)
                : 0;
        const sourcePos = getPortPosition(sourceNode, "output", sourceIndex, srcOffset);
        const color = MODALITY_COLORS[connecting.sourceModality] || "#888";

        return (
            <path
                d={connectionPath(sourcePos.x, sourcePos.y, connectingMouse.x, connectingMouse.y)}
                stroke={color}
                strokeWidth={2}
                strokeDasharray="6 3"
                fill="none"
                strokeOpacity={0.5}
                className={styles.connectingLine}
            />
        );
    };

    return (
        <div
            ref={containerRef}
            className={`${styles.canvas}${isPanning ? ` ${styles.panning}` : ""}`}
            onMouseDown={handleCanvasMouseDown}
        >
            <div
                className={styles.gridBackground}
                style={{
                    backgroundPosition: `${pan.x}px ${pan.y}px`,
                    backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
                }}
            />

            {nodes.length === 0 && (
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>⟡</div>
                    <div className={styles.emptyTitle}>Start Building Your Workflow</div>
                    <div className={styles.emptySubtitle}>
                        Add models and assets from the sidebar to begin chaining them together
                    </div>
                </div>
            )}

            <svg
                ref={svgRef}
                className={styles.svg}
                style={{ overflow: "visible" }}
            >
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {connections.map(renderConnection)}
                    {renderConnectingLine()}
                    {nodes.map(renderNode)}
                </g>
            </svg>

            {nodes.length > 0 && (
                <div className={styles.instructions}>
                    Click an <strong>output port</strong> then an <strong>input port</strong> of the same type to connect
                </div>
            )}
        </div>
    );
}
