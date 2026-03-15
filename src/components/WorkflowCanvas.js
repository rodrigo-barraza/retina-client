"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X } from "lucide-react";
import WorkflowNode from "./WorkflowNode";
import {
  MODALITY_COLORS,
  CONFIG_AREA_HEIGHT,
  getBaseModality,
  getAssetContentHeight,
  getPortPosition,
  connectionPath,
} from "./WorkflowNodeConstants";
import styles from "./WorkflowCanvas.module.css";

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
  onDuplicateNode,
  nodeStatuses = {},
  nodeResults = {},
  selectedNodeId,
  onSelectNode,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const clipboardRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [connecting, setConnecting] = useState(null);
  const [connectingMouse, setConnectingMouse] = useState(null);
  const [expandedInputs, setExpandedInputs] = useState(new Set());
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
      const el = e.target;
      const isContainerOrSvg = el === containerRef.current || el === svgRef.current;
      const isGridBg = el.classList?.contains?.(styles.gridBackground);
      const isInsideInteractive = el.closest?.("[data-workflow-node], [data-workflow-connection]");
      if (isContainerOrSvg || isGridBg || (!isInsideInteractive && containerRef.current?.contains(el))) {
        setIsPanning(true);
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          panX: pan.x,
          panY: pan.y,
        };
      }
    },
    [pan],
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

  // Keyboard copy-paste
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip when typing in inputs or textareas
      const tag = e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        if (!selectedNodeId) return;
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (!node) return;
        clipboardRef.current = JSON.parse(JSON.stringify(node));
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        if (!clipboardRef.current) return;
        e.preventDefault();
        onDuplicateNode?.(clipboardRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, nodes, onDuplicateNode]);

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

      if (getBaseModality(connecting.sourceModality) !== getBaseModality(modality)) return;
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

  // Toggle expanded state for a node
  const handleToggleExpand = useCallback((nodeId) => {
    setExpandedInputs((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  // Compute expanded state for a specific node
  const isNodeExpanded = useCallback((node) => {
    if (node.nodeType === "viewer") {
      return !expandedInputs.has(node.id); // viewers expanded by default
    }
    return expandedInputs.has(node.id);
  }, [expandedInputs]);

  // Compute the vertical offset for a node's ports (used by connection routing)
  const getExpandedOffset = useCallback((node) => {
    const expanded = isNodeExpanded(node);
    if (!node.nodeType && expandedInputs.has(node.id)) {
      return CONFIG_AREA_HEIGHT;
    }
    if (expanded && node.nodeType) {
      return getAssetContentHeight(node);
    }
    return 0;
  }, [expandedInputs, isNodeExpanded]);

  // Render connections
  const renderConnection = (conn) => {
    const sourceNode = nodes.find((n) => n.id === conn.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === conn.targetNodeId);
    if (!sourceNode || !targetNode) return null;

    const sourceIndex = (sourceNode.outputTypes || []).indexOf(conn.sourceModality);
    const targetIndex = (targetNode.inputTypes || []).indexOf(conn.targetModality);
    if (sourceIndex === -1 || targetIndex === -1) return null;

    const sourceOffset = getExpandedOffset(sourceNode);
    const targetOffset = getExpandedOffset(targetNode);

    const sourcePos = getPortPosition(sourceNode, "output", sourceIndex, sourceOffset);
    const targetPos = getPortPosition(targetNode, "input", targetIndex, targetOffset);
    const color = MODALITY_COLORS[conn.sourceModality] || "#888";

    const sourceStatus = nodeStatuses[conn.sourceNodeId];
    const isRunning = sourceStatus === "running";
    const isDone = sourceStatus === "done";
    const isActive = isRunning || isDone;

    return (
      <g key={conn.id} className={styles.connectionGroup} data-workflow-connection>
        <path
          d={connectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
          stroke="transparent"
          strokeWidth={12}
          fill="none"
          className={styles.connectionHitArea}
          onClick={() => onSelectNode(conn.sourceNodeId)}
        />
        <path
          d={connectionPath(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y)}
          stroke={isRunning ? "url(#prism-gradient)" : isDone ? "url(#done-gradient)" : color}
          strokeWidth={isActive ? 3 : 2}
          fill="none"
          strokeOpacity={isActive ? 1 : 0.7}
          className={`${styles.connectionLine}${isActive ? ` ${styles.prismLine}` : ""}`}
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

    const srcOffset = getExpandedOffset(sourceNode);
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
        <defs>
          <linearGradient id="prism-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="300">
            <stop offset="0%" stopColor="#ff0000" />
            <stop offset="16%" stopColor="#ff8800" />
            <stop offset="33%" stopColor="#ffff00" />
            <stop offset="50%" stopColor="#00ff88" />
            <stop offset="66%" stopColor="#0088ff" />
            <stop offset="83%" stopColor="#8800ff" />
            <stop offset="100%" stopColor="#ff0088" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 150 150"
              to="360 150 150"
              dur="2s"
              repeatCount="indefinite"
            />
          </linearGradient>
          <linearGradient id="done-gradient" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="300" y2="300">
            <stop offset="0%" stopColor="#f0b429" />
            <stop offset="50%" stopColor="#d4a017" />
            <stop offset="100%" stopColor="#10b981" />
            <animateTransform
              attributeName="gradientTransform"
              type="rotate"
              from="0 150 150"
              to="360 150 150"
              dur="4s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {connections.map(renderConnection)}
          {renderConnectingLine()}
          {nodes.map((node) => (
            <WorkflowNode
              key={node.id}
              node={node}
              status={nodeStatuses[node.id]}
              results={nodeResults[node.id]}
              isSelected={selectedNodeId === node.id}
              isExpanded={isNodeExpanded(node)}
              connecting={connecting}
              hoveredPort={hoveredPort}
              connections={connections}
              nodeStatuses={nodeStatuses}
              onMouseDown={handleNodeMouseDown}
              onInputPortClick={handleInputPortClick}
              onOutputPortClick={handleOutputPortClick}
              onPortHover={setHoveredPort}
              onPortLeave={() => setHoveredPort(null)}
              onDelete={onDeleteNode}
              onUpdateContent={onUpdateNodeContent}
              onUpdateConfig={onUpdateNodeConfig}
              onUpdateFileInput={onUpdateFileInput}
              onToggleExpand={handleToggleExpand}
            />
          ))}
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
