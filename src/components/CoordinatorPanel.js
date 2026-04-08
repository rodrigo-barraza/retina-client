"use client";

import { useState, useCallback } from "react";
import { GitBranch, RefreshCw, Play, Check, X, AlertTriangle, Loader } from "lucide-react";
import PrismService from "../services/PrismService.js";
import styles from "./CoordinatorPanel.module.css";

const STATUS_CLASSES = {
  pending: "statusPending",
  ready: "statusPending",
  running: "statusRunning",
  complete: "statusComplete",
  error: "statusError",
};

const COMPLEXITY_CLASSES = {
  low: "complexityLow",
  medium: "complexityMedium",
  high: "complexityHigh",
};

/**
 * CoordinatorPanel — Multi-Agent Orchestration UI
 *
 * Provides a workflow for decomposing complex refactoring tasks into
 * parallel sub-tasks, executing them in isolated git worktrees, reviewing
 * unified diffs, and merging results.
 *
 * Lifecycle: Input → Plan → Execute → Review → Merge
 *
 * @param {object} props
 * @param {string} props.project - Project identifier
 */
export default function CoordinatorPanel({ project: _project }) {
  // ── State ─────────────────────────────────────────────────
  const [phase, setPhase] = useState("input"); // input | planning | plan | executing | review | merged
  const [task, setTask] = useState("");
  const [filesInput, setFilesInput] = useState("");
  const [plan, setPlan] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }, []);

  // ── Plan ──────────────────────────────────────────────────
  const handlePlan = useCallback(async () => {
    if (!task.trim()) return;

    const files = filesInput
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    if (files.length === 0) {
      showToast("error", "Add at least one file path");
      return;
    }

    setPhase("planning");
    setLoading(true);

    try {
      const result = await PrismService._request("/coordinator/plan", {
        body: { task, files },
      });

      if (result.error) {
        showToast("error", result.error);
        setPhase("input");
        return;
      }

      setPlan(result);
      setPhase("plan");
    } catch (err) {
      showToast("error", `Planning failed: ${err.message}`);
      setPhase("input");
    } finally {
      setLoading(false);
    }
  }, [task, filesInput, showToast]);

  // ── Execute ───────────────────────────────────────────────
  const handleExecute = useCallback(async () => {
    if (!plan) return;

    setPhase("executing");
    setLoading(true);

    try {
      const result = await PrismService._request("/coordinator/execute", {
        body: { plan },
      });

      if (result.error) {
        showToast("error", result.error);
        setPhase("plan");
        return;
      }

      setWorkers(result.workers || []);
      setPhase("review");
    } catch (err) {
      showToast("error", `Execution failed: ${err.message}`);
      setPhase("plan");
    } finally {
      setLoading(false);
    }
  }, [plan, showToast]);

  // ── Merge ─────────────────────────────────────────────────
  const handleMerge = useCallback(async () => {
    if (!plan?.taskId) return;

    setLoading(true);
    try {
      const result = await PrismService._request(`/coordinator/approve-merge/${plan.taskId}`, {
        method: "POST",
      });

      if (result.error) {
        showToast("error", result.error);
        return;
      }

      setPhase("merged");
      showToast("success", "All branches merged successfully!");
    } catch (err) {
      showToast("error", `Merge failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [plan, showToast]);

  // ── Abort ─────────────────────────────────────────────────
  const handleAbort = useCallback(async () => {
    if (!plan?.taskId) return;

    try {
      await PrismService._request(`/coordinator/abort/${plan.taskId}`, {
        method: "POST",
      });
      showToast("success", "Task aborted, worktrees cleaned up");
    } catch {
      // best-effort
    }

    setPlan(null);
    setWorkers([]);
    setPhase("input");
  }, [plan, showToast]);

  // ── Reset ─────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setPlan(null);
    setWorkers([]);
    setTask("");
    setFilesInput("");
    setPhase("input");
  }, []);

  // ═══ Render ════════════════════════════════════════════════

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Coordinator Mode
        </span>
        {phase !== "input" && (
          <button className={styles.actionBtn} onClick={handleReset}>
            <X size={11} /> Reset
          </button>
        )}
      </div>

      {toast && (
        <div className={`${styles.toast} ${styles[`toast${toast.type.charAt(0).toUpperCase() + toast.type.slice(1)}`]}`}>
          {toast.text}
        </div>
      )}

      {/* ── Input Phase ────────────────────────────────────── */}
      {phase === "input" && (
        <div className={styles.inputSection}>
          <textarea
            className={styles.taskTextarea}
            placeholder="Describe the refactoring task…&#10;e.g. 'Refactor all services to use the new structured logger'"
            value={task}
            onChange={(e) => setTask(e.target.value)}
          />
          <textarea
            className={styles.filesInput}
            placeholder="Target file paths (one per line)&#10;e.g. /home/rodrigo/development/sun/prism/src/services/FileService.js"
            value={filesInput}
            onChange={(e) => setFilesInput(e.target.value)}
            rows={4}
          />
          <button
            className={styles.planBtn}
            onClick={handlePlan}
            disabled={!task.trim() || !filesInput.trim()}
          >
            <GitBranch size={13} /> Decompose Task
          </button>
        </div>
      )}

      {/* ── Planning Phase ─────────────────────────────────── */}
      {phase === "planning" && (
        <div className={styles.loading}>
          <Loader size={14} className={styles.spin} />
          Decomposing task into sub-tasks…
        </div>
      )}

      {/* ── Plan Review Phase ──────────────────────────────── */}
      {phase === "plan" && plan && (
        <div className={styles.planSection}>
          <div className={styles.planSummary}>
            {plan.summary}
          </div>

          {plan.subTasks?.map((st) => (
            <div key={st.id} className={styles.subTaskCard}>
              <div className={styles.subTaskHeader}>
                <span className={styles.subTaskId}>{st.id}</span>
                <span className={`${styles.subTaskComplexity} ${styles[COMPLEXITY_CLASSES[st.complexity] || "complexityMedium"]}`}>
                  {st.complexity || "medium"}
                </span>
              </div>
              <div className={styles.subTaskFiles}>
                {st.files?.map((f, i) => (
                  <span key={i} className={styles.subTaskFile}>
                    {f.split("/").pop()}
                  </span>
                ))}
              </div>
              <div className={styles.subTaskInstruction}>
                {st.instruction}
              </div>
            </div>
          ))}

          <div className={styles.planActions}>
            <button className={styles.approveBtn} onClick={handleExecute} disabled={loading}>
              <Play size={12} /> Execute ({plan.subTasks?.length} workers)
            </button>
            <button className={styles.rejectBtn} onClick={handleReset}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Executing Phase ────────────────────────────────── */}
      {phase === "executing" && (
        <div className={styles.loading}>
          <Loader size={14} className={styles.spin} />
          Spawning workers in git worktrees…
        </div>
      )}

      {/* ── Review Phase ───────────────────────────────────── */}
      {phase === "review" && (
        <>
          {workers.map((w) => (
            <div key={w.id} className={styles.workerCard}>
              <div className={styles.workerHeader}>
                <span className={styles.workerName}>{w.id}</span>
                <span className={`${styles.workerStatus} ${styles[STATUS_CLASSES[w.status] || "statusPending"]}`}>
                  {w.status}
                </span>
              </div>
              {w.error && (
                <div className={styles.workerError}>
                  <AlertTriangle size={10} /> {w.error}
                </div>
              )}
              {w.diff?.hasChanges && (
                <div className={styles.diffSection}>
                  <div className={styles.diffHeader}>
                    <span className={styles.diffTitle}>Changes</span>
                    <div className={styles.diffStats}>
                      <span className={styles.diffAdditions}>+{w.diff.additions}</span>
                      <span className={styles.diffDeletions}>-{w.diff.deletions}</span>
                    </div>
                  </div>
                  <pre className={styles.diffContent}>
                    {w.diff.diff}
                  </pre>
                </div>
              )}
            </div>
          ))}

          <div className={styles.planActions}>
            <button className={styles.approveBtn} onClick={handleMerge} disabled={loading}>
              <Check size={12} /> Approve & Merge
            </button>
            <button className={styles.rejectBtn} onClick={handleAbort}>
              Reject & Cleanup
            </button>
          </div>
        </>
      )}

      {/* ── Merged Phase ───────────────────────────────────── */}
      {phase === "merged" && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Check size={24} />
          </div>
          <div className={styles.emptyTitle}>Merge Complete</div>
          <div className={styles.emptySubtitle}>
            All worker branches have been merged. You can run another task or close this panel.
          </div>
          <button className={styles.planBtn} onClick={handleReset}>
            <RefreshCw size={12} /> New Task
          </button>
        </div>
      )}

      {/* ── Empty (initial) ────────────────────────────────── */}
      {phase === "input" && !task && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <GitBranch size={24} />
          </div>
          <div className={styles.emptyTitle}>Multi-Agent Coordinator</div>
          <div className={styles.emptySubtitle}>
            Decompose complex tasks into parallel sub-tasks. Each worker
            operates in an isolated git worktree, and results are merged
            via unified diffs.
          </div>
        </div>
      )}
    </div>
  );
}
