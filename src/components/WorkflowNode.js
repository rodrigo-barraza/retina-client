"use client";

import { X, Upload, Eye, Loader2, Check, AlertTriangle, Paperclip, Volume2, MessageSquare, Plus, Minus } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { MODALITY_ICONS } from "./WorkflowSidebar";
import {
  MODALITY_COLORS,
  ASSET_ICONS,
  ROLE_LABELS,
  HEADER_HEIGHT,
  PORT_SECTION_HEIGHT,
  CONFIG_AREA_HEIGHT,
  PORT_RADIUS,
  MODALITY_ICON_WIDTH,
  parseCompoundPort,
  getBaseModality,
  getNodeWidth,
  getAssetContentHeight,
} from "./WorkflowNodeConstants";
import styles from "./WorkflowNode.module.css";

/**
 * Renders input and output ports for a node.
 */
function NodePorts({
  node,
  inputTypes,
  outputTypes,
  configOffset = 0,
  isNodeRunning = false,
  nodeStatusGradient = "url(#prism-gradient)",
  connecting,
  hoveredPort,
  connections,
  nodeStatuses,
  onInputPortClick,
  onOutputPortClick,
  onPortHover,
  onPortLeave,
}) {
  const nodeWidth = getNodeWidth(node);
  const portStartY = HEADER_HEIGHT + configOffset + 8;
  const isConversationNode = node.nodeType === "input" && node.modality === "conversation";
  const nodeMessages = node.messages || [];

  return (
    <>
      {/* Input ports */}
      {inputTypes.map((portId, i) => {
        const compound = parseCompoundPort(portId);
        const baseMod = compound ? compound.modality : portId;
        const portY = portStartY + i * PORT_SECTION_HEIGHT + PORT_SECTION_HEIGHT / 2;
        const color = MODALITY_COLORS[baseMod] || "#888";
        const isCompatible = connecting && getBaseModality(connecting.sourceModality) === baseMod && connecting.sourceNodeId !== node.id;
        const isHovered = hoveredPort?.nodeId === node.id && hoveredPort?.type === "input" && hoveredPort?.modality === portId;
        const Icon = MODALITY_ICONS[baseMod]?.icon;
        const hasPrismSource = connections.some(
          (c) => c.targetNodeId === node.id && c.targetModality === portId && (nodeStatuses[c.sourceNodeId] === "running" || nodeStatuses[c.sourceNodeId] === "done")
        );
        const hasDoneSource = hasPrismSource && connections.some(
          (c) => c.targetNodeId === node.id && c.targetModality === portId && nodeStatuses[c.sourceNodeId] === "done"
        ) && !connections.some(
          (c) => c.targetNodeId === node.id && c.targetModality === portId && nodeStatuses[c.sourceNodeId] === "running"
        );

        let label = MODALITY_ICONS[baseMod]?.label || baseMod;
        if (compound && isConversationNode) {
          const msg = nodeMessages[compound.index];
          const roleLabel = ROLE_LABELS[msg?.role] || msg?.role || `#${compound.index}`;
          const roleCount = nodeMessages.slice(0, compound.index).filter((m) => m.role === msg?.role).length;
          const numberedRole = roleCount > 0 ? `${roleLabel} ${roleCount + 1}` : roleLabel;
          label = `${numberedRole} ${label}`;
        }

        return (
          <g key={`in-${portId}-${i}`}>
            <circle
              cx={0}
              cy={portY}
              r={isHovered && isCompatible ? PORT_RADIUS + 2 : hasPrismSource ? PORT_RADIUS + 2 : PORT_RADIUS}
              fill={hasPrismSource ? (hasDoneSource ? "url(#done-gradient)" : "url(#prism-gradient)") : isCompatible ? color : "var(--bg-tertiary)"}
              stroke={hasPrismSource ? (hasDoneSource ? "url(#done-gradient)" : "url(#prism-gradient)") : color}
              strokeWidth={2}
              className={`${styles.port} ${isCompatible ? styles.portCompatible : ""}`}
              onClick={(e) => onInputPortClick(e, node.id, portId)}
              onMouseEnter={() => onPortHover({ nodeId: node.id, type: "input", modality: portId })}
              onMouseLeave={onPortLeave}
            />
            {Icon && (
              <foreignObject x={8} y={portY - 7} width={14} height={14} style={{ pointerEvents: "none" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <Icon size={11} style={{ color }} />
                </div>
              </foreignObject>
            )}
            <text x={24} y={portY + 1} dominantBaseline="middle" className={styles.portLabel}>
              {label}
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
              r={isActive || isNodeRunning ? PORT_RADIUS + 2 : PORT_RADIUS}
              fill={isNodeRunning ? nodeStatusGradient : isActive ? color : "var(--bg-tertiary)"}
              stroke={isNodeRunning ? nodeStatusGradient : color}
              strokeWidth={2}
              className={`${styles.port} ${styles.portOutput}`}
              onClick={(e) => onOutputPortClick(e, node.id, modality, i)}
              onMouseEnter={() => onPortHover({ nodeId: node.id, type: "output", modality })}
              onMouseLeave={onPortLeave}
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
}

/**
 * Shared port props builder to avoid repeating in both node types.
 */
function usePortProps(props) {
  return {
    connecting: props.connecting,
    hoveredPort: props.hoveredPort,
    connections: props.connections,
    nodeStatuses: props.nodeStatuses,
    onInputPortClick: props.onInputPortClick,
    onOutputPortClick: props.onOutputPortClick,
    onPortHover: props.onPortHover,
    onPortLeave: props.onPortLeave,
  };
}

/**
 * Renders a model node (AI model step).
 */
function ModelNode(props) {
  const {
    node,
    status,
    results,
    isSelected,
    isExpanded,
    onMouseDown,
    onDelete,
    onUpdateConfig,
  } = props;

  const portProps = usePortProps(props);
  const inputTypes = node.inputTypes || [];
  const outputTypes = node.outputTypes || [];
  const width = getNodeWidth(node);

  const modalityIcons = (node.rawInputTypes || node.inputTypes || []).filter((t) => t !== "conversation");
  const modalityAreaWidth = modalityIcons.length * MODALITY_ICON_WIDTH;

  const portRows = Math.max(inputTypes.length, outputTypes.length, 1);
  const portsHeight = portRows * PORT_SECTION_HEIGHT + 12;
  const configHeight = isExpanded ? CONFIG_AREA_HEIGHT : 0;
  const errorHeight = results?.error ? 28 : 0;
  const nodeHeight = HEADER_HEIGHT + configHeight + portsHeight + errorHeight;

  const isRunning = status === "running";
  const isDone = status === "done";
  const isPrism = isRunning || isDone;
  const statusGradient = isRunning ? "url(#prism-gradient)" : isDone ? "url(#done-gradient)" : null;
  const statusBorderColor = statusGradient || (isSelected ? "url(#prism-gradient)" : status === "error" ? "#f43f5e" : null);
  const borderWidth = isSelected ? 2 : isPrism ? 2 : 0;

  return (
    <g
      key={node.id}
      transform={`translate(${node.position.x}, ${node.position.y})`}
      className={styles.nodeGroup}
      data-workflow-node
    >
      <rect
        width={width}
        height={nodeHeight}
        rx="3"
        ry="3"
        className={styles.nodeBody}
        style={statusBorderColor ? { stroke: statusBorderColor, strokeWidth: borderWidth } : undefined}
      />
      <rect width={width} height={HEADER_HEIGHT} rx="3" ry="3" className={styles.nodeHeader} />
      <rect x={0} y={HEADER_HEIGHT - 3} width={width} height={3} className={styles.nodeHeader} />

      <g className={styles.nodeDragArea} onMouseDown={(e) => onMouseDown(e, node.id)} style={{ cursor: "grab" }}>
        <rect x={0} y={0} width={width - 26 - modalityAreaWidth - 8} height={HEADER_HEIGHT} fill="transparent" />
        <foreignObject x={8} y={0} width={width - 34 - modalityAreaWidth - 8} height={HEADER_HEIGHT}>
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
        <foreignObject x={width - 26 - modalityAreaWidth - 22} y={8} width={18} height={18}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            {status === "running" && <Loader2 size={12} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />}
            {status === "done" && <Check size={12} style={{ color: "#10b981" }} />}
            {status === "error" && <AlertTriangle size={12} style={{ color: "#f43f5e" }} />}
          </div>
        </foreignObject>
      )}

      {/* Modality icons from model's input types (top-right) */}
      <foreignObject x={width - 26 - modalityAreaWidth} y={6} width={modalityAreaWidth} height={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
          {modalityIcons.map((modality) => {
            const mod = MODALITY_ICONS[modality];
            if (!mod) return null;
            const Icon = mod.icon;
            return <Icon key={modality} size={11} style={{ color: mod.color, opacity: 0.7 }} title={mod.label} />;
          })}
        </div>
      </foreignObject>

      <foreignObject x={width - 26} y={6} width={20} height={20}>
        <button className={styles.deleteNodeBtn} onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Remove node">
          <X size={12} />
        </button>
      </foreignObject>

      {/* Expandable config section */}
      {isExpanded && (
        <foreignObject x={4} y={HEADER_HEIGHT + 2} width={width - 8} height={CONFIG_AREA_HEIGHT - 4}>
          <div className={styles.nodeConfig}>
            <div className={styles.nodeConfigMessages}>
              <MessageSquare size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className={styles.nodeConfigMessageCount}>
                {(node.messages?.length || (node.systemPrompt ? 2 : 1))} messages
              </span>
              <span className={styles.nodeConfigMessageHint}>Edit in inspector →</span>
            </div>
            <label className={styles.nodeConfigLabel}>Static Input</label>
            <div className={styles.nodeConfigUpload}>
              {node.staticInputs?.image ? (
                <span className={styles.nodeConfigFile} title="Static image attached">
                  📎 Image attached
                  <button
                    className={styles.nodeConfigClearBtn}
                    onClick={() => onUpdateConfig?.(node.id, "staticInputs", { ...node.staticInputs, image: null })}
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
                        onUpdateConfig?.(node.id, "staticInputs", {
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
        <NodePorts
          node={node}
          inputTypes={inputTypes}
          outputTypes={outputTypes}
          isNodeRunning={isPrism}
          nodeStatusGradient={statusGradient || "url(#prism-gradient)"}
          {...portProps}
        />
      </g>

      {/* Error display */}
      {results?.error && (
        <foreignObject x={4} y={HEADER_HEIGHT + configHeight + portsHeight} width={width - 8} height={24}>
          <div className={styles.modelResultError}>{results.error}</div>
        </foreignObject>
      )}
    </g>
  );
}

/**
 * Handle file drop/upload for file input nodes.
 */
function handleFileInputChange(nodeId, file, onUpdateFileInput) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    onUpdateFileInput?.(nodeId, reader.result, file.type);
  };
  reader.readAsDataURL(file);
}

/**
 * Renders an asset node (input asset or output viewer).
 */
function AssetNode(props) {
  const {
    node,
    status,
    isExpanded,
    onMouseDown,
    onDelete,
    onUpdateContent,
    onUpdateFileInput,
    onUpdateConfig,
    onToggleExpand,
  } = props;

  const portProps = usePortProps(props);
  const isViewer = node.nodeType === "viewer";
  const width = getNodeWidth(node);
  const inputTypes = node.inputTypes || [];
  const outputTypes = node.outputTypes || [];
  const accentColor = isViewer ? "#a78bfa" : (MODALITY_COLORS[node.modality] || "#8b5cf6");
  const AssetIcon = isViewer ? Eye : node.modality
    ? (ASSET_ICONS[node.modality] || MODALITY_ICONS[node.modality]?.icon || Paperclip)
    : Paperclip;

  const isConversation = node.modality === "conversation";
  const conversationModalities = isConversation ? (node.supportedModalities || ["text"]).filter((t) => t !== "conversation") : [];
  const modalityAreaWidth = conversationModalities.length * MODALITY_ICON_WIDTH;

  const inputLabel = isViewer
    ? "Output Viewer"
    : node.modality
      ? `${MODALITY_ICONS[node.modality]?.label || node.modality} Input`
      : "File Input";

  const isRunning = status === "running";
  const isDone = status === "done";
  const isPrism = isRunning || isDone;
  const statusGradient = isRunning ? "url(#prism-gradient)" : isDone ? "url(#done-gradient)" : null;
  const contentH = getAssetContentHeight(node);
  const portRows = Math.max(inputTypes.length, outputTypes.length, 1);
  const portsHeight = portRows * PORT_SECTION_HEIGHT + 12;
  const conversationBtnHeight = isConversation && inputTypes.length > 0 ? 24 : 0;
  const nodeHeight = HEADER_HEIGHT + (isExpanded ? contentH : 0) + portsHeight + conversationBtnHeight;

  return (
    <g
      key={node.id}
      transform={`translate(${node.position.x}, ${node.position.y})`}
      className={styles.nodeGroup}
      data-workflow-node
    >
      {/* Body with accent border */}
      <rect
        width={width}
        height={nodeHeight}
        rx="3"
        ry="3"
        className={`${styles.assetNodeBody}${isPrism || isSelected ? ` ${styles.prismBorder}` : ""}`}
        style={isPrism ? { stroke: statusGradient, strokeWidth: 2, strokeOpacity: 1 } : isSelected ? { stroke: "url(#prism-gradient)", strokeWidth: 2, strokeOpacity: 1 } : { stroke: accentColor, strokeOpacity: 0.4 }}
      />

      {/* Header */}
      <rect width={width} height={HEADER_HEIGHT} rx="3" ry="3" className={styles.assetNodeHeader} style={{ fill: accentColor, fillOpacity: 0.1 }} />
      <rect x={0} y={HEADER_HEIGHT - 3} width={width} height={3} className={styles.assetNodeHeader} style={{ fill: accentColor, fillOpacity: 0.1 }} />

      {/* Drag area + icon + title */}
      <g className={styles.nodeDragArea} onMouseDown={(e) => onMouseDown(e, node.id)} style={{ cursor: "grab" }}>
        <rect x={0} y={0} width={width - 48 - (isConversation ? modalityAreaWidth : 0)} height={HEADER_HEIGHT} fill="transparent" />
        <foreignObject x={8} y={0} width={width - 56 - (isConversation ? modalityAreaWidth : 0)} height={HEADER_HEIGHT}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, height: "100%", paddingTop: 1 }}>
            <AssetIcon size={14} style={{ color: accentColor, flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: accentColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {inputLabel}
            </span>
          </div>
        </foreignObject>
      </g>

      {/* Modality icons for conversation input (show accepted modalities) */}
      {isConversation && conversationModalities.length > 0 && (
        <foreignObject x={width - 48 - modalityAreaWidth} y={6} width={modalityAreaWidth} height={20}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
            {conversationModalities.map((modality) => {
              const mod = MODALITY_ICONS[modality];
              if (!mod) return null;
              const Icon = mod.icon;
              return <Icon key={modality} size={11} style={{ color: mod.color, opacity: 0.7 }} title={mod.label} />;
            })}
          </div>
        </foreignObject>
      )}

      {/* Gear button */}
      <foreignObject x={width - 48} y={6} width={20} height={20}>
        <button
          className={`${styles.deleteNodeBtn} ${isExpanded ? styles.configBtnActive : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(node.id);
          }}
          title={isViewer ? "View outputs" : "Node info"}
        >
          {isViewer ? <Eye size={12} /> : <Eye size={12} />}
        </button>
      </foreignObject>

      {/* Delete button */}
      <foreignObject x={width - 26} y={6} width={20} height={20}>
        <button className={styles.deleteNodeBtn} onClick={(e) => { e.stopPropagation(); onDelete(node.id); }} title="Remove node">
          <X size={12} />
        </button>
      </foreignObject>

      {/* Content area — only when expanded */}
      {isExpanded && (() => {
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
                      {node.receivedOutputs.embedding && (
                        <div className={styles.viewerText} style={{ fontFamily: "monospace", fontSize: "10px" }}>
                          [{node.receivedOutputs.embedding.length} dims] [{node.receivedOutputs.embedding.slice(0, 4).map((v) => v.toFixed(4)).join(", ")}…]
                        </div>
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
                  onChange={(e) => onUpdateContent(node.id, e.target.value)}
                  placeholder="Enter text…"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : node.modality === "conversation" ? (
                null
              ) : (
                /* File input: upload / drag-drop zone or preview */
                <div
                  className={styles.assetUploadArea}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer?.files?.[0];
                    if (file) handleFileInputChange(node.id, file, onUpdateFileInput);
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
                          if (file) handleFileInputChange(node.id, file, onUpdateFileInput);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </label>
                  )}
                </div>
              )}
            </foreignObject>


          </>
        );
      })()}

      {/* Ports below content + info area */}
      <NodePorts
        node={node}
        inputTypes={inputTypes}
        outputTypes={outputTypes}
        configOffset={isExpanded ? contentH : 0}
        isNodeRunning={isPrism}
        nodeStatusGradient={statusGradient || "url(#prism-gradient)"}
        {...portProps}
      />

      {/* Add/Remove message pair buttons for conversation nodes (only when connected) */}
      {isConversation && inputTypes.length > 0 && (
        <foreignObject
          x={4}
          y={nodeHeight - conversationBtnHeight}
          width={width - 8}
          height={conversationBtnHeight}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, height: "100%", justifyContent: "center" }}>
            {(node.messages || []).length > 2 && (
              <button
                className={styles.deleteNodeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  const msgs = [...(node.messages || [])];
                  // Remove last two (assistant + user pair), keep at least system + user
                  if (msgs.length > 2) {
                    msgs.splice(msgs.length - 2, 2);
                    // Ensure it still ends with user
                    if (msgs[msgs.length - 1]?.role !== "user") {
                      msgs.push({ role: "user", content: "" });
                    }
                    onUpdateConfig?.(node.id, "messages", msgs);
                  }
                }}
                title="Remove last message pair"
                style={{ width: 18, height: 18 }}
              >
                <Minus size={10} />
              </button>
            )}
            <button
              className={styles.deleteNodeBtn}
              onClick={(e) => {
                e.stopPropagation();
                const msgs = [...(node.messages || [])];
                msgs.push({ role: "assistant", content: "" });
                msgs.push({ role: "user", content: "" });
                onUpdateConfig?.(node.id, "messages", msgs);
              }}
              title="Add assistant + user message pair"
              style={{ width: 18, height: 18 }}
            >
              <Plus size={10} />
            </button>
          </div>
        </foreignObject>
      )}
    </g>
  );
}

/**
 * WorkflowNode — dispatches to ModelNode or AssetNode based on nodeType.
 */
export default function WorkflowNode(props) {
  if (props.node.nodeType) {
    return <AssetNode {...props} />;
  }
  return <ModelNode {...props} />;
}
