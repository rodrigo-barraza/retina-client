"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ListChecks, RefreshCw, Trash2, Plus, Loader2,
  CircleDot, Play, CheckCircle2, ChevronDown, ChevronRight,
  X,
} from "lucide-react";
import ToolsApiService from "../services/ToolsApiService.js";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import styles from "./TasksPanel.module.css";


const STATUS_CONFIG = {
  pending: { icon: CircleDot, label: "Pending", colorClass: "statusPending" },
  in_progress: { icon: Play, label: "In Progress", colorClass: "statusInProgress" },
  completed: { icon: CheckCircle2, label: "Done", colorClass: "statusCompleted" },
};

const STATUS_CYCLE = ["pending", "in_progress", "completed"];

/**
 * TasksPanel — view and manage persistent agentic tasks.
 *
 * Displayed in the agent sidebar alongside Memories. Tasks are created
 * by the agent (via task_create tool) and persist across conversations.
 * Users can also create tasks manually from this panel.
 *
 * @param {object} props
 * @param {string} props.project - Project identifier
 * @param {number} [props.refreshKey] - External refresh trigger
 */
export default function TasksPanel({ project, refreshKey, agentSessionId, onCountChange }) {
  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(null);
  const hasData = useRef(false);

  // New task form
  const [showNewForm, setShowNewForm] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  // ── Load ────────────────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    // Only show full spinner on first load (no data yet)
    if (!hasData.current) setLoading(true);
    setError(null);
    try {
      const result = await ToolsApiService.getAllAgenticTasks({
        status: statusFilter || undefined,
        agentSessionId: agentSessionId || undefined,
      });
      setTasks(result.tasks || []);
      setSummary(result.summary || null);
      onCountChange?.(result.summary?.total || (result.tasks || []).length);
      hasData.current = true;
    } catch (err) {
      console.error("Failed to load tasks:", err);
      if (!hasData.current) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, agentSessionId, onCountChange]);

  // Reset on session change (new conversation = clean slate)
  useEffect(() => {
    hasData.current = false;
    setTasks([]);
    setSummary(null);
  }, [agentSessionId]);

  // Single effect — fires on mount, refreshKey changes, and statusFilter/session changes
  useEffect(() => {
    loadTasks();
  }, [loadTasks, refreshKey]);

  // ── Create ─────────────────────────────────────────────────

  const handleCreate = useCallback(async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;
    setCreating(true);
    try {
      await ToolsApiService.createAgenticTask(project, {
        subject: newSubject.trim(),
        description: newDescription.trim(),
      });
      setNewSubject("");
      setNewDescription("");
      setShowNewForm(false);
      loadTasks();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      setCreating(false);
    }
  }, [project, newSubject, newDescription, loadTasks]);

  // ── Status cycle ───────────────────────────────────────────

  const handleCycleStatus = useCallback(async (task) => {
    const idx = STATUS_CYCLE.indexOf(task.status);
    const nextStatus = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    try {
      await ToolsApiService.updateAgenticTask(task.project, task.taskId, {
        status: nextStatus,
      });
      // Optimistic
      setTasks((prev) =>
        prev.map((t) =>
          t.project === task.project && t.taskId === task.taskId
            ? { ...t, status: nextStatus }
            : t,
        ),
      );
      // Refresh summary
      loadTasks(true);
    } catch (err) {
      console.error("Failed to update task:", err);
    }
  }, [loadTasks]);

  // ── Delete ─────────────────────────────────────────────────

  const handleDelete = useCallback(async (task) => {
    try {
      await ToolsApiService.deleteAgenticTask(task.project, task.taskId);
      setTasks((prev) =>
        prev.filter((t) => !(t.project === task.project && t.taskId === task.taskId)),
      );
      setConfirmingDeleteId(null);
      loadTasks(true);
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  }, [loadTasks]);

  // ── Loading ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <RefreshCw size={14} className={styles.spin} />
          Loading tasks…
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Failed to load tasks: {error}
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className={styles.container}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Tasks {summary ? `(${summary.total})` : ""}
        </span>
        <button
          className={styles.headerBtn}
          onClick={() => setShowNewForm((v) => !v)}
          title="Create task"
        >
          {showNewForm ? <X size={11} /> : <Plus size={11} />}
        </button>
        <button
          className={styles.headerBtn}
          onClick={loadTasks}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? styles.spin : ""} />
        </button>
      </div>

      {/* ── Summary badges ──────────────────────────────────── */}
      {summary && summary.total > 0 && (
        <div className={styles.summaryRow}>
          {STATUS_CYCLE.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const count = summary[s] || 0;
            if (count === 0 && statusFilter !== s) return null;
            const isActive = statusFilter === s;
            return (
              <button
                key={s}
                className={`${styles.summaryBadge} ${styles[cfg.colorClass]} ${isActive ? styles.summaryBadgeActive : ""}`}
                onClick={() => setStatusFilter(isActive ? null : s)}
                title={`${isActive ? "Clear" : "Filter"}: ${cfg.label}`}
              >
                <cfg.icon size={9} />
                {count}
              </button>
            );
          })}
        </div>
      )}

      {/* ── New Task Form ──────────────────────────────────── */}
      {showNewForm && (
        <form className={styles.newTaskForm} onSubmit={handleCreate}>
          <input
            className={styles.newTaskInput}
            placeholder="Task subject…"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            autoFocus
          />
          <textarea
            className={styles.newTaskTextarea}
            placeholder="Description…"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            rows={2}
          />
          <div className={styles.newTaskActions}>
            <button
              type="submit"
              className={styles.newTaskSubmit}
              disabled={creating || !newSubject.trim() || !newDescription.trim()}
            >
              {creating ? <RefreshCw size={10} className={styles.spin} /> : <Plus size={10} />}
              Create
            </button>
            <button
              type="button"
              className={styles.newTaskCancel}
              onClick={() => {
                setShowNewForm(false);
                setNewSubject("");
                setNewDescription("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Empty ─────────────────────────────────────────── */}
      {tasks.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <ListChecks size={24} />
          </div>
          <div className={styles.emptyTitle}>No tasks yet</div>
          <div className={styles.emptySubtitle}>
            {statusFilter
              ? `No ${STATUS_CONFIG[statusFilter]?.label.toLowerCase()} tasks. Try clearing the filter.`
              : "Tasks are created by the agent during coding sessions, or you can create them manually."}
          </div>
        </div>
      )}

      {/* ── Task list ─────────────────────────────────────── */}
      {tasks.map((task) => {
        const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
        const StatusIcon = cfg.icon;
        const isExpanded = expandedId === task.taskId;
        const isConfirming = confirmingDeleteId === task.taskId;

        return (
          <div key={`${task.project}-${task.taskId}`} className={`${styles.taskCard} ${styles[cfg.colorClass + "Card"]}`}>
            <div className={styles.taskCardHeader}>
              {/* Status cycle button */}
              <button
                className={`${styles.statusBtn} ${styles[cfg.colorClass]}`}
                onClick={() => handleCycleStatus(task)}
                title={`Status: ${cfg.label} — click to cycle`}
              >
                <StatusIcon size={14} />
              </button>

              {/* Content */}
              <div
                className={styles.taskInfo}
                onClick={() => setExpandedId(isExpanded ? null : task.taskId)}
              >
                <div className={`${styles.taskSubject} ${task.status === "completed" ? styles.taskDone : ""}`}>
                  <span className={styles.taskIdBadge}>#{task.taskId}</span>
                  {task.subject}
                </div>
                <div className={styles.taskMeta}>
                  <span className={`${styles.taskStatusBadge} ${styles[cfg.colorClass]}`}>
                    {cfg.label}
                  </span>
                  {task.status === "in_progress" && task.activeForm && (
                    <span className={styles.activeFormBadge}>
                      <Loader2 size={9} className={styles.activeFormSpin} />
                      {task.activeForm}
                    </span>
                  )}
                  {task.project && (
                    <span className={styles.taskProjectBadge}>{task.project}</span>
                  )}
                  {task.createdAt && (
                    <DateTimeBadgeComponent date={task.createdAt} mini />
                  )}
                </div>
              </div>

              {/* Expand/collapse */}
              <button
                className={styles.expandBtn}
                onClick={() => setExpandedId(isExpanded ? null : task.taskId)}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>

              {/* Delete */}
              <button
                className={styles.deleteBtn}
                onClick={() => setConfirmingDeleteId(isConfirming ? null : task.taskId)}
                title="Delete task"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className={styles.taskDetail}>
                <div className={styles.taskDescription}>
                  {task.description}
                </div>
                {task.metadata && Object.keys(task.metadata).length > 0 && (
                  <div className={styles.taskMetadata}>
                    {Object.entries(task.metadata).map(([k, v]) => (
                      <span key={k} className={styles.metaTag}>
                        <span className={styles.metaKey}>{k}</span>
                        <span className={styles.metaValue}>{String(v)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {task.conversationId && (
                  <div className={styles.taskConversation}>
                    Conv: {task.conversationId.slice(0, 8)}…
                  </div>
                )}
              </div>
            )}

            {/* Delete confirm */}
            {isConfirming && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>Delete task #{task.taskId}?</span>
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnYes}`}
                  onClick={() => handleDelete(task)}
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
