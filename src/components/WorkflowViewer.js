"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import WorkflowCanvas from "./WorkflowCanvas";

/**
 * WorkflowViewer — a reusable, self-contained wrapper around WorkflowCanvas.
 *
 * Manages its own local state for nodes/connections so they can be dragged,
 * selected, etc. Accepts initial data via props and renders a fully interactive
 * canvas.
 *
 * Exposes `onNodeSelect(node|null)` callback so parent can react to selection.
 */
export default function WorkflowViewer({
  initialNodes = [],
  initialConnections = [],
  readOnly = false,
  nodeStatuses = {},
  nodeResults = {},
  onNodeSelect,
  className,
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const [connections, setConnections] = useState(initialConnections);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const prevKeyRef = useRef(null);

  // Re-sync internal state when initial data changes
  useEffect(() => {
    const key = JSON.stringify(initialNodes.map((n) => n.id));
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      setNodes(initialNodes);
      setConnections(initialConnections);
      setSelectedNodeId(null);
    }
  }, [initialNodes, initialConnections]);

  // Notify parent when selection changes
  const handleSelectNode = useCallback((nodeId) => {
    setSelectedNodeId(nodeId);
    if (onNodeSelect) {
      const node = nodeId ? initialNodes.find((n) => n.id === nodeId) || null : null;
      onNodeSelect(node);
    }
  }, [onNodeSelect, initialNodes]);

  const handleUpdateNodePosition = useCallback((nodeId, position) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    );
  }, []);

  const handleDeleteNode = useCallback((nodeId) => {
    if (readOnly) return;
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setConnections((prev) =>
      prev.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      ),
    );
  }, [readOnly]);

  const handleAddConnection = useCallback((conn) => {
    if (readOnly) return;
    setConnections((prev) => [
      ...prev,
      { ...conn, id: `conn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
    ]);
  }, [readOnly]);

  const handleDeleteConnection = useCallback((connId) => {
    if (readOnly) return;
    setConnections((prev) => prev.filter((c) => c.id !== connId));
  }, [readOnly]);

  const noop = useCallback(() => {}, []);

  return (
    <div className={className} style={{ width: "100%", height: "100%", position: "relative", display: "flex", flexDirection: "column" }}>
      <WorkflowCanvas
        nodes={nodes}
        connections={connections}
        onUpdateNodePosition={handleUpdateNodePosition}
        onDeleteNode={readOnly ? noop : handleDeleteNode}
        onAddConnection={readOnly ? noop : handleAddConnection}
        onDeleteConnection={readOnly ? noop : handleDeleteConnection}
        onUpdateNodeContent={noop}
        onUpdateNodeConfig={noop}
        onUpdateFileInput={noop}
        nodeStatuses={nodeStatuses}
        nodeResults={nodeResults}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
      />
    </div>
  );
}
