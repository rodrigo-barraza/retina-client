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
 *   admin       — admin mode for the sidebar (workflow history list vs builder)
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
 *   -- Sidebar props (user mode) --
 *   models, workflows, activeWorkflowId,
 *   onAddNode, onAddAsset, onLoadWorkflow, onDeleteWorkflow,
 *   onNewWorkflow, onSaveWorkflow, workflowName, onWorkflowNameChange
 *
 *   -- Sidebar props (admin mode) --
 *   adminWorkflows, adminSelectedId, onAdminSelectWorkflow, adminLoading
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

  models,
  workflows,
  activeWorkflowId,
  onAddNode,
  onAddAsset,
  onLoadWorkflow,
  onDeleteWorkflow,
  onNewWorkflow,
  onSaveWorkflow,
  workflowName,
  onWorkflowNameChange,

  adminWorkflows,
  adminSelectedId,
  onAdminSelectWorkflow,
  adminLoading,

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
        models={admin ? [] : (models || [])}
        workflows={admin ? [] : (workflows || [])}
        activeWorkflowId={admin ? undefined : activeWorkflowId}
        onAddNode={admin ? noop : (onAddNode || noop)}
        onAddAsset={admin ? noop : (onAddAsset || noop)}
        onLoadWorkflow={admin ? noop : (onLoadWorkflow || noop)}
        onDeleteWorkflow={admin ? noop : (onDeleteWorkflow || noop)}
        onNewWorkflow={admin ? noop : (onNewWorkflow || noop)}
        onSaveWorkflow={admin ? noop : (onSaveWorkflow || noop)}
        workflowName={admin ? "" : (workflowName || "")}
        onWorkflowNameChange={admin ? noop : (onWorkflowNameChange || noop)}
        adminWorkflows={adminWorkflows}
        adminSelectedId={adminSelectedId}
        onAdminSelectWorkflow={onAdminSelectWorkflow}
        adminLoading={adminLoading}
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
        nodeStatuses={nodeStatuses}
        nodeResults={nodeResults}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
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
