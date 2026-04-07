"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, RefreshCw, User, MessageSquare, FolderKanban, ExternalLink, Trash2, Sparkles } from "lucide-react";
import PrismService from "../services/PrismService.js";
import styles from "./MemoriesPanel.module.css";

/**
 * Human-readable relative timestamp from an ISO date string.
 */
function timeAgo(dateStr) {
  if (!dateStr) return "";
  const ms = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * Type → icon mapping for memory categories.
 */
const TYPE_ICONS = {
  user: User,
  feedback: MessageSquare,
  project: FolderKanban,
  reference: ExternalLink,
};

const TYPE_ICON_CLASSES = {
  user: "memoryIconUser",
  feedback: "memoryIconFeedback",
  project: "memoryIconProject",
  reference: "memoryIconReference",
};

const TYPE_BADGE_CLASSES = {
  user: "badgeUser",
  feedback: "badgeFeedback",
  project: "badgeProject",
  reference: "badgeReference",
};

/**
 * MemoriesPanel — view and manage agent memories.
 *
 * Displays memories extracted from past coding sessions, organized by type
 * (user, feedback, project, reference). These are extracted automatically
 * by the SessionSummarizer and stored via AgentMemoryService.
 */
export default function MemoriesPanel({ project, refreshKey }) {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [newMemoryIds, setNewMemoryIds] = useState(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const [toast, setToast] = useState(null);
  const knownIdsRef = useRef(new Set());

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await PrismService.getAgentMemories(project);
      const fetched = result.memories || [];

      // Detect newly arrived memories
      const freshIds = new Set();
      for (const m of fetched) {
        const id = m.id || m._id;
        if (knownIdsRef.current.size > 0 && !knownIdsRef.current.has(id)) {
          freshIds.add(id);
        }
        knownIdsRef.current.add(id);
      }

      if (freshIds.size > 0) {
        setNewMemoryIds(freshIds);
        // Auto-clear highlight after 6s
        setTimeout(() => setNewMemoryIds(new Set()), 6000);
      }

      setMemories(fetched);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to load memories:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [project]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories, refreshKey]);

  const handleDelete = useCallback(async (memoryId) => {
    try {
      await PrismService.deleteAgentMemory(memoryId);
      // Optimistic removal from local state
      setMemories((prev) => prev.filter((m) => (m.id || m._id) !== memoryId));
      setTotal((prev) => Math.max(0, prev - 1));
      setConfirmingDeleteId(null);
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  }, []);

  const handleConsolidate = useCallback(async () => {
    setConsolidating(true);
    setToast(null);
    try {
      const result = await PrismService.consolidateMemories(project);
      if (result.skipped) {
        setToast({ type: "info", text: result.reason === "insufficient memories" ? "Not enough memories to consolidate" : "No consolidation needed" });
      } else if (result.actionsApplied > 0) {
        setToast({ type: "success", text: result.summary || `Consolidated ${result.merged || 0} memories` });
        // Refresh after consolidation
        loadMemories();
      } else {
        setToast({ type: "info", text: result.summary || "No changes needed" });
      }
    } catch (err) {
      setToast({ type: "error", text: `Consolidation failed: ${err.message}` });
    } finally {
      setConsolidating(false);
      setTimeout(() => setToast(null), 5000);
    }
  }, [project, loadMemories]);

  // ── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <RefreshCw size={14} className={styles.refreshSpin} />
          Loading memories…
        </div>
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Failed to load memories: {error}
        </div>
      </div>
    );
  }

  // ── Empty ───────────────────────────────────────────────────
  if (memories.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Brain size={24} />
          </div>
          <div className={styles.emptyTitle}>No memories yet</div>
          <div className={styles.emptySubtitle}>
            Memories are automatically extracted from your conversations.
            They capture user preferences, feedback, project context, and
            external references.
          </div>
        </div>
      </div>
    );
  }

  // ── List ────────────────────────────────────────────────────
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Memories ({total})
        </span>
        <button
          className={styles.refreshBtn}
          onClick={handleConsolidate}
          disabled={consolidating || total < 2}
          title="Consolidate memories — merge duplicates and clean stale entries"
        >
          <Sparkles size={11} className={consolidating ? styles.refreshSpin : ""} />
        </button>
        <button
          className={styles.refreshBtn}
          onClick={loadMemories}
          disabled={loading}
          title="Refresh memories"
        >
          <RefreshCw size={11} className={loading ? styles.refreshSpin : ""} />
        </button>
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          {toast.text}
        </div>
      )}

      {memories.map((memory) => {
        const memoryId = memory.id || memory._id;
        const type = memory.type || "project";
        const IconComponent = TYPE_ICONS[type] || FolderKanban;
        const iconClass = TYPE_ICON_CLASSES[type] || "memoryIconProject";
        const badgeClass = TYPE_BADGE_CLASSES[type] || "badgeProject";
        const isConfirming = confirmingDeleteId === memoryId;
        const isNew = newMemoryIds.has(memoryId);

        return (
          <div
            key={memoryId}
            className={`${styles.memoryCard} ${isNew ? styles.memoryCardNew : ""}`}
          >
            <div className={styles.memoryCardHeader}>
              <div className={`${styles.memoryIcon} ${styles[iconClass]}`}>
                <IconComponent size={14} />
              </div>
              <div className={styles.memoryInfo}>
                <div className={styles.memoryTitle}>
                  {memory.title || memory.fact || "Untitled"}
                </div>
                <div className={styles.memoryMeta}>
                  <span className={`${styles.memoryTypeBadge} ${styles[badgeClass]}`}>
                    {type}
                  </span>
                  {memory.createdAt && (
                    <span className={styles.memoryAge}>
                      {timeAgo(memory.createdAt)}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => setConfirmingDeleteId(isConfirming ? null : memoryId)}
                title="Delete memory"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {(memory.content || memory.fact) && (
              <div className={styles.memoryContent}>
                {memory.content || memory.fact}
              </div>
            )}

            {isConfirming && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>Delete this memory?</span>
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnYes}`}
                  onClick={() => handleDelete(memoryId)}
                >
                  Delete
                </button>
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnNo}`}
                  onClick={() => setConfirmingDeleteId(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
