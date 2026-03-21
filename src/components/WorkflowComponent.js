"use client";

import { useState, useEffect, useCallback } from "react";
import WorkflowSidebar from "./WorkflowSidebar";
import WorkflowCanvas from "./WorkflowCanvas";
import WorkflowInspector from "./WorkflowInspector";
import styles from "./WorkflowComponent.module.css";

const noop = () => {};

/**
 * WorkflowComponent — unified wrapper that composes WorkflowSidebar,
 * WorkflowCanvas, and WorkflowInspector into a single three-panel layout.
 *
 * Props:
 *   readOnly    — disable all mutations (admin view)
 *   admin       — admin mode for the sidebar (no delete, shows user info)
 *
 *   -- Data --
 *   nodes, connections
 *   selectedNodeId, onSelectNode
 *   nodeStatuses, nodeResults
 *
 *   -- Canvas mutation handlers (ignored when readOnly) --
 *   onUpdateNodePosition, onDeleteNode, onAddConnection,
 *   onDeleteConnection, onUpdateNodeContent, onUpdateNodeConfig,
 *   onUpdateFileInput
 *
 *   -- Sidebar props --
 *   workflows, activeWorkflowId,
 *   onLoadWorkflow, onDeleteWorkflow,
 *   onDownloadWorkflow, onCopyWorkflow
 *   loading
 *
 *   -- Inspector props --
 *   allModels, onChangeModel
 */
export default function WorkflowComponent({
  readOnly = false,
  admin = false,

  nodes = [],
  connections = [],
  selectedNodeId,
  onSelectNode,
  nodeStatuses = {},
  nodeResults = {},

  onUpdateNodePosition,
  onDeleteNode,
  onAddConnection,
  onDeleteConnection,
  onUpdateNodeContent,
  onUpdateNodeConfig,
  onUpdateFileInput,
  onDuplicateNode,

  workflows = [],
  activeWorkflowId,
  onLoadWorkflow,
  onDeleteWorkflow,
  onDownloadWorkflow,
  onCopyWorkflow,
  onAddAsset,
  onNewWorkflow,
  onSaveWorkflow,
  workflowName,
  onWorkflowNameChange,
  loading = false,
  isLoadingWorkflow = false,
  favorites = [],
  onToggleFavorite,

  allModels,
  onChangeModel,
}) {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const safePosition = readOnly ? (onUpdateNodePosition || noop) : (onUpdateNodePosition || noop);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleClose = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarVisible((v) => {
      const next = !v;
      // On mobile, close inspector when opening sidebar
      if (next && window.innerWidth < 768) {
        onSelectNode?.(null);
      }
      return next;
    });
  }, [onSelectNode]);

  // When loading a workflow on mobile, auto-hide sidebar
  const handleLoadWorkflowWithHide = useCallback((...args) => {
    if (window.innerWidth < 768) {
      setSidebarVisible(false);
    }
    onLoadWorkflow?.(...args);
  }, [onLoadWorkflow]);

  // On mobile, close sidebar when selecting a node (opening inspector)
  const handleSelectNode = useCallback((nodeId) => {
    if (nodeId && window.innerWidth < 768) {
      setSidebarVisible(false);
    }
    onSelectNode?.(nodeId);
  }, [onSelectNode]);

  return (
    <div className={styles.body}>
      <div className={`${styles.sidebarWrapper} ${sidebarVisible ? "" : styles.sidebarHidden}`}>
        <WorkflowSidebar
          admin={admin}
          workflows={workflows}
          activeWorkflowId={activeWorkflowId}
          onLoadWorkflow={handleLoadWorkflowWithHide}
          onDeleteWorkflow={admin ? noop : (onDeleteWorkflow || noop)}
          onDownloadWorkflow={onDownloadWorkflow}
          onCopyWorkflow={onCopyWorkflow}
          onAddAsset={admin ? undefined : onAddAsset}
          onNewWorkflow={admin ? undefined : onNewWorkflow}
          onSaveWorkflow={admin ? undefined : onSaveWorkflow}
          workflowName={workflowName}
          onWorkflowNameChange={onWorkflowNameChange}
          loading={loading}
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
        />
      </div>
      {/* Mobile sidebar backdrop */}
      {isMobile && sidebarVisible && (
        <div className={styles.sidebarBackdrop} onClick={handleToggleSidebar} />
      )}
      <WorkflowCanvas
        nodes={nodes}
        connections={connections}
        onUpdateNodePosition={safePosition}
        onDeleteNode={readOnly ? noop : (onDeleteNode || noop)}
        onAddConnection={readOnly ? noop : (onAddConnection || noop)}
        onDeleteConnection={readOnly ? noop : (onDeleteConnection || noop)}
        onUpdateNodeContent={readOnly ? noop : (onUpdateNodeContent || noop)}
        onUpdateNodeConfig={readOnly ? noop : (onUpdateNodeConfig || noop)}
        onUpdateFileInput={readOnly ? noop : (onUpdateFileInput || noop)}
        onDuplicateNode={readOnly ? noop : (onDuplicateNode || noop)}
        nodeStatuses={nodeStatuses}
        nodeResults={nodeResults}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        activeWorkflowId={activeWorkflowId}
        readOnly={readOnly}
        isLoadingWorkflow={isLoadingWorkflow}
        sidebarVisible={sidebarVisible}
        onToggleSidebar={handleToggleSidebar}
      />
      {/* Inspector: bottom sheet on mobile, side panel on desktop */}
      {selectedNode && (
        <>
          {isMobile && <div className={styles.inspectorBackdrop} onClick={handleClose} />}
          <div className={styles.inspectorWrapper}>
            <WorkflowInspector
              node={selectedNode}
              connections={connections}
              nodes={nodes}
              allModels={readOnly ? [] : (allModels || [])}
              nodeResults={nodeResults}
              nodeStatuses={nodeStatuses}
              onUpdateNodeConfig={readOnly ? noop : (onUpdateNodeConfig || noop)}
              onUpdateNodeContent={readOnly ? noop : (onUpdateNodeContent || noop)}
              onUpdateFileInput={readOnly ? noop : (onUpdateFileInput || noop)}
              onChangeModel={readOnly ? noop : (onChangeModel || noop)}
              onSelectNode={handleSelectNode}
              onClose={handleClose}
              readOnly={readOnly}
            />
          </div>
        </>
      )}
    </div>
  );
}
