"use client";

import { useCallback } from "react";
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

  allModels,
  onChangeModel,
}) {
  const safePosition = readOnly ? (onUpdateNodePosition || noop) : (onUpdateNodePosition || noop);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleClose = useCallback(() => {
    onSelectNode?.(null);
  }, [onSelectNode]);

  return (
    <div className={styles.body}>
      <WorkflowSidebar
        admin={admin}
        workflows={workflows}
        activeWorkflowId={activeWorkflowId}
        onLoadWorkflow={onLoadWorkflow}
        onDeleteWorkflow={admin ? noop : (onDeleteWorkflow || noop)}
        onDownloadWorkflow={onDownloadWorkflow}
        onCopyWorkflow={onCopyWorkflow}
        onAddAsset={admin ? undefined : onAddAsset}
        onNewWorkflow={admin ? undefined : onNewWorkflow}
        onSaveWorkflow={admin ? undefined : onSaveWorkflow}
        workflowName={workflowName}
        onWorkflowNameChange={onWorkflowNameChange}
        loading={loading}
      />
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
        onSelectNode={onSelectNode}
        readOnly={readOnly}
      />
      {selectedNode && (
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
          onClose={handleClose}
          readOnly={readOnly}
        />
      )}
    </div>
  );
}
