"use client";

import { useState, useEffect, useCallback } from "react";
import { Brain, RefreshCw, User, MessageSquare, FolderKanban, ExternalLink } from "lucide-react";
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
 * MemoriesPanel — read-only view of agent memories.
 *
 * Displays memories extracted from past coding sessions, organized by type
 * (user, feedback, project, reference). These are extracted automatically
 * by the SessionSummarizer and stored via AgentMemoryService.
 */
export default function MemoriesPanel({ project }) {
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await PrismService.getAgentMemories(project);
      setMemories(result.memories || []);
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
  }, [loadMemories]);

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
          onClick={loadMemories}
          disabled={loading}
          title="Refresh memories"
        >
          <RefreshCw size={11} className={loading ? styles.refreshSpin : ""} />
        </button>
      </div>

      {memories.map((memory) => {
        const memoryId = memory.id || memory._id;
        const type = memory.type || "project";
        const IconComponent = TYPE_ICONS[type] || FolderKanban;
        const iconClass = TYPE_ICON_CLASSES[type] || "memoryIconProject";
        const badgeClass = TYPE_BADGE_CLASSES[type] || "badgeProject";

        return (
          <div key={memoryId} className={styles.memoryCard}>
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
            </div>

            {(memory.content || memory.fact) && (
              <div className={styles.memoryContent}>
                {memory.content || memory.fact}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
