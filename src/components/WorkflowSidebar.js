"use client";

import { useMemo } from "react";
import {
  Plus,
  Save,
  Package,
  Bot,
  MessageSquare,
  Type,
  Paperclip,
  Eye,
  Workflow,
} from "lucide-react";
import HistoryList from "./HistoryList";
import styles from "./WorkflowSidebar.module.css";

export default function WorkflowSidebar({
  admin = false,
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
  favorites = [],
  onToggleFavorite,
}) {
  // Normalize workflows into HistoryList items
  const items = useMemo(() => {
    return workflows.map((wf) => {
      const id = wf._id || wf.id;
      const name = wf.name || (wf.userContent
        ? wf.userContent.substring(0, 80) + (wf.userContent.length > 80 ? "…" : "")
        : "Untitled Workflow");

      return {
        id,
        title: name,
        updatedAt: wf.updatedAt,
        createdAt: wf.createdAt,
        totalCost: wf.totalCost || 0,
        modalities: wf.modalities || {},
        providers: wf.providers || [],
        username: wf.userName,
        searchText: wf.userName || "",
      };
    });
  }, [workflows]);

  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <span className={styles.sidebarCount}>
          {workflows.length} workflows
        </span>
        {!admin && (
          <div className={styles.sidebarHeaderActions}>
            <button
              className={styles.headerBtn}
              onClick={onNewWorkflow}
              title="New Workflow"
            >
              <Plus size={14} />
            </button>
            <button
              className={styles.headerBtn}
              onClick={onSaveWorkflow}
              title="Save Workflow"
            >
              <Save size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Workflow name input — user mode only */}
      {!admin && (
        <div className={styles.nameInputWrapper}>
          <input
            type="text"
            className={styles.nameInput}
            placeholder="Untitled Workflow"
            value={workflowName || ""}
            onChange={(e) => onWorkflowNameChange?.(e.target.value)}
          />
        </div>
      )}

      {/* Asset buttons — user mode only */}
      {!admin && onAddAsset && (
        <div className={styles.assetSection}>
          <div className={styles.assetSectionLabel}>
            <Package size={11} />
            Assets
          </div>
          <div className={styles.assetButtons}>
            <button
              className={styles.assetBtn}
              onClick={() => onAddAsset("model")}
              title="Add AI Model"
            >
              <Bot size={12} style={{ color: "#3b82f6" }} />
              <span>AI Model</span>
            </button>
            <button
              className={styles.assetBtn}
              onClick={() => onAddAsset("conversation", "input")}
              title="Add Chat History"
            >
              <MessageSquare size={12} style={{ color: "#8b5cf6" }} />
              <span>Chat History</span>
            </button>
            <button
              className={styles.assetBtn}
              onClick={() => onAddAsset("text", "input")}
              title="Add Text"
            >
              <Type size={12} style={{ color: "#6366f1" }} />
              <span>Text</span>
            </button>
            <button
              className={styles.assetBtn}
              onClick={() => onAddAsset("file", "input")}
              title="Add Media"
            >
              <Paperclip size={12} style={{ color: "#8b5cf6" }} />
              <span>Media</span>
            </button>
            <button
              className={styles.assetBtn}
              onClick={() => onAddAsset("text", "viewer")}
              title="Add Output"
            >
              <Eye size={12} style={{ color: "#a78bfa" }} />
              <span>Output</span>
            </button>
          </div>
        </div>
      )}

      {/* Workflow list — uses shared HistoryList */}
      <HistoryList
        items={items}
        activeId={activeWorkflowId}
        onSelect={(item) => onLoadWorkflow?.(item.id)}
        onDelete={!admin ? onDeleteWorkflow : undefined}
        onDownload={onDownloadWorkflow}
        onCopy={onCopyWorkflow}
        icon={Workflow}
        readOnly={false}
        emptyLabel={loading ? "Loading…" : "No workflows yet"}
        searchPlaceholder="Search workflows…"
        admin={admin}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
