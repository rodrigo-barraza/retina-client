"use client";

import { useState, useMemo } from "react";
import {
  Search,
  X,
  Trash2,
  FolderOpen,
  User,
  Clock,
  Zap,
  Hash,
  Download,
  Copy,
  Type,
  Paperclip,
  MessageSquare,
  Eye,
  Package,
  Bot,
  Plus,
  Save,
} from "lucide-react";
import styles from "./WorkflowSidebar.module.css";

function formatDuration(ms) {
  if (!ms) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

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
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;
    const q = searchQuery.trim().toLowerCase();
    return workflows.filter((wf) => {
      const name = wf.name || wf.userContent || "";
      const user = wf.userName || "";
      return name.toLowerCase().includes(q) || user.toLowerCase().includes(q);
    });
  }, [workflows, searchQuery]);

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

      {/* Search */}
      <div className={styles.searchWrapper}>
        <Search size={13} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search workflows…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className={styles.searchClear}
            onClick={() => setSearchQuery("")}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Workflow list */}
      <div className={styles.workflowScroll}>
        {loading && workflows.length === 0 ? (
          <div className={styles.emptyState}>Loading…</div>
        ) : filteredWorkflows.length === 0 ? (
          <div className={styles.emptyState}>
            <FolderOpen size={24} />
            <span>{searchQuery ? "No matches" : "No workflows yet"}</span>
          </div>
        ) : (
          filteredWorkflows.map((wf) => {
            const id = wf._id || wf.id;
            const isActive = activeWorkflowId === id;
            const name = wf.name || (wf.userContent
              ? wf.userContent.substring(0, 80) + (wf.userContent.length > 80 ? "…" : "")
              : "Untitled Workflow");

            return (
              <div
                key={id}
                role="button"
                tabIndex={0}
                className={`${styles.workflowItem} ${isActive ? styles.workflowItemActive : ""}`}
                onClick={() => onLoadWorkflow?.(id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onLoadWorkflow?.(id); }}
              >
                <div className={styles.workflowItemTop}>
                  {admin && wf.userName && (
                    <span className={styles.workflowItemUser}>
                      <User size={11} />
                      {wf.userName}
                    </span>
                  )}
                  {wf.createdAt && (
                    <span className={styles.workflowItemTime}>
                      {formatTime(wf.createdAt)}
                    </span>
                  )}
                </div>
                <div className={styles.workflowItemName}>
                  {name}
                </div>
                <div className={styles.workflowItemBottom}>
                  <div className={styles.workflowItemMeta}>
                    {(wf.stepCount != null || wf.nodeCount != null) && (
                      <span className={styles.metaTag}>
                        <Zap size={10} />
                        {wf.stepCount ?? wf.nodeCount ?? wf.nodes?.length ?? 0} {wf.stepCount != null ? "steps" : "nodes"}
                      </span>
                    )}
                    {wf.totalDuration != null && (
                      <span className={styles.metaTag}>
                        <Clock size={10} />
                        {formatDuration(wf.totalDuration)}
                      </span>
                    )}
                    {(wf.edgeCount ?? wf.connectionCount) != null && (
                      <span className={styles.metaTag}>
                        {wf.edgeCount ?? wf.connectionCount ?? wf.edges?.length ?? wf.connections?.length ?? 0} edges
                      </span>
                    )}
                    {wf.channelName && wf.channelName !== "DM" && (
                      <span className={styles.metaTag}>
                        <Hash size={10} />
                        {wf.channelName}
                      </span>
                    )}
                  </div>
                  <div className={styles.workflowItemActions}>
                    <button
                      className={styles.itemActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadWorkflow?.(id);
                      }}
                      title="Download workflow"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      className={styles.itemActionBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyWorkflow?.(id);
                      }}
                      title="Copy workflow"
                    >
                      <Copy size={12} />
                    </button>
                    {!admin && (
                      <button
                        className={`${styles.itemActionBtn} ${styles.itemDeleteBtn}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWorkflow?.(id);
                        }}
                        title="Delete workflow"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
