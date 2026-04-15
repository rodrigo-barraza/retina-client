"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, RefreshCw, User, MessageSquare, FolderKanban, ExternalLink, Trash2, Sparkles, History, GitMerge, Settings } from "lucide-react";
import Link from "next/link";
import PrismService from "../services/PrismService.js";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import { formatTimeAgo } from "../utils/utilities";
import styles from "./MemoriesPanel.module.css";



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

const TRIGGER_LABELS = {
  manual: "Manual",
  scheduled: "Auto-Dream",
  session_threshold: "Session",
};

/**
 * MemoriesPanel — view and manage agent memories.
 *
 * Displays memories extracted from past coding sessions, organized by type
 * (user, feedback, project, reference). These are extracted automatically
 * by the SessionSummarizer and stored via AgentMemoryService.
 *
 * @param {object} props
 * @param {string} props.project - Project identifier
 * @param {number} props.refreshKey - External refresh trigger
 * @param {object} [props.consolidationEvent] - Real-time consolidation event from WebSocket
 */
export default function MemoriesPanel({ project, refreshKey, consolidationEvent, onCountChange, memoryConfigured = true }) {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [newMemoryIds, setNewMemoryIds] = useState(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const [toast, setToast] = useState(null);
  const knownIdsRef = useRef(new Set());

  // History state
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

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

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await PrismService.getConsolidationHistory(project, 5);
      setHistory(result.history || []);
    } catch (err) {
      console.error("Failed to load consolidation history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [project]);

  // Propagate count changes to parent via effect (avoids setState-during-render)
  useEffect(() => {
    onCountChange?.(total);
  }, [total, onCountChange]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories, refreshKey]);

  // Load history when expanded
  useEffect(() => {
    if (historyOpen) loadHistory();
  }, [historyOpen, loadHistory]);

  // React to real-time consolidation events from WebSocket
  useEffect(() => {
    if (!consolidationEvent) return;
    if (consolidationEvent.project && consolidationEvent.project !== project) return;

    const { summary, actionsApplied } = consolidationEvent;
    if (actionsApplied > 0) {
      setToast({ type: "success", text: `✨ ${summary || "Memories consolidated"}` });
      loadMemories();
      if (historyOpen) loadHistory();
    } else {
      setToast({ type: "info", text: summary || "No changes needed" });
    }
    setTimeout(() => setToast(null), 5000);
  }, [consolidationEvent]); // eslint-disable-line react-hooks/exhaustive-deps

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
        const msg = result.reason === "daily_limit_reached"
          ? "Daily consolidation limit reached"
          : result.reason === "insufficient memories"
            ? "Not enough memories to consolidate"
            : "No consolidation needed";
        setToast({ type: "info", text: msg });
      } else if (result.actionsApplied > 0) {
        setToast({ type: "success", text: result.summary || `Consolidated ${result.merged || 0} memories` });
        // Refresh after consolidation
        loadMemories();
        if (historyOpen) loadHistory();
      } else {
        setToast({ type: "info", text: result.summary || "No changes needed" });
      }
    } catch (err) {
      setToast({ type: "error", text: `Consolidation failed: ${err.message}` });
    } finally {
      setConsolidating(false);
      setTimeout(() => setToast(null), 5000);
    }
  }, [project, loadMemories, loadHistory, historyOpen]);

  // ── Not configured ──────────────────────────────────────────
  if (!memoryConfigured) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <div className={`${styles.emptyIcon} ${styles.emptyIconDisabled}`}>
            <Brain size={24} />
          </div>
          <div className={styles.emptyTitle}>Memories Not Available</div>
          <div className={styles.emptySubtitle}>
            Memory models need to be configured before memories can be
            extracted and stored. Set the extraction, consolidation, and
            embedding models in Settings.
          </div>
          <Link href="/settings" className={styles.settingsLink}>
            <Settings size={13} />
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

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
          className={`${styles.refreshBtn} ${historyOpen ? styles.historyBtnActive : ""}`}
          onClick={() => setHistoryOpen((prev) => !prev)}
          title="Consolidation history"
        >
          <History size={11} />
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

      {/* ── Consolidation History ─────────────────────────────── */}
      {historyOpen && (
        <div className={styles.historySection}>
          <div className={styles.historySectionHeader}>
            <span className={styles.historySectionTitle}>Consolidation History</span>
            {historyLoading && <RefreshCw size={10} className={styles.refreshSpin} />}
          </div>
          {history.length === 0 && !historyLoading && (
            <div className={styles.historyEmpty}>No consolidation runs yet</div>
          )}
          {history.map((run, i) => (
            <div key={i} className={styles.historyEntry}>
              <div className={styles.historyEntryHeader}>
                <span className={`${styles.historyTrigger} ${styles[`trigger${run.trigger?.charAt(0).toUpperCase()}${run.trigger?.slice(1)}`] || ""}`}>
                  {TRIGGER_LABELS[run.trigger] || run.trigger || "unknown"}
                </span>
                <span className={styles.historyTime}>{formatTimeAgo(run.runAt)}</span>
              </div>
              <div className={styles.historySummary}>{run.summary}</div>
              <div className={styles.historyStats}>
                <span><GitMerge size={9} /> {run.actionsApplied} action{run.actionsApplied !== 1 ? "s" : ""}</span>
                <span>{run.memoriesBefore} → {run.memoriesAfter} memories</span>
                {run.durationMs && <span>{(run.durationMs / 1000).toFixed(1)}s</span>}
              </div>
            </div>
          ))}
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
                  {memory.title || (memory.content ? memory.content.substring(0, 60) : "Untitled")}
                </div>
                <div className={styles.memoryMeta}>
                  <span className={`${styles.memoryTypeBadge} ${styles[badgeClass]}`}>
                    {type}
                  </span>
                  {memory.createdAt && (
                    <DateTimeBadgeComponent date={memory.createdAt} mini />
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

            {memory.content && (
              <div className={styles.memoryContent}>
                {memory.content}
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
