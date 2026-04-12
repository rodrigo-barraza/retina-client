"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, RefreshCw, Wrench, Clock, GitBranch, Cpu, FileCode,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import styles from "./WorkersPanel.module.css";


const STATUS_LABEL = {
  running: "Running",
  complete: "Complete",
  failed: "Failed",
  stopped: "Stopped",
  pending: "Pending",
};

const STATUS_CLASS = {
  running: "statusRunning",
  complete: "statusComplete",
  failed: "statusFailed",
  stopped: "statusStopped",
  pending: "statusPending",
};

const CARD_CLASS = {
  running: "workerCardRunning",
  complete: "workerCardComplete",
  failed: "workerCardFailed",
  stopped: "workerCardStopped",
};

/**
 * Format milliseconds as a human-readable duration.
 * E.g. 125400 → "2m 5s"
 */
function formatDuration(ms) {
  if (!ms || ms < 1000) return ms ? `${ms}ms` : "—";
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  const s = secs % 60;
  if (mins > 0) return `${mins}m ${s}s`;
  return `${s}s`;
}

/**
 * WorkersPanel — displays coordinator workers spawned during this agent session.
 *
 * Polls the coordinator /workers endpoint filtered by the current sessionId.
 * Workers represent parallel sub-agents spawned via the `spawn_agent` tool
 * during agentic coding sessions.
 *
 * @param {object} props
 * @param {string} [props.sessionId] - Current agent session ID to filter workers by
 * @param {number} [props.refreshKey] - External trigger to refresh worker list
 */
export default function WorkersPanel({ sessionId, refreshKey }) {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const hasData = useRef(false);
  const pollRef = useRef(null);

  // ── Load ──────────────────────────────────────────────────

  const loadWorkers = useCallback(async () => {
    if (!hasData.current) setLoading(true);
    setError(null);
    try {
      const result = await PrismService.getCoordinatorWorkers(sessionId);
      setWorkers(result.workers || []);
      hasData.current = true;
    } catch (err) {
      console.error("Failed to load workers:", err);
      if (!hasData.current) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Reset on session change
  useEffect(() => {
    hasData.current = false;
    setWorkers([]);
  }, [sessionId]);

  // Initial load + external refresh
  useEffect(() => {
    loadWorkers();
  }, [loadWorkers, refreshKey]);

  // Auto-poll while any worker is running (every 3s)
  useEffect(() => {
    const hasRunning = workers.some((w) => w.status === "running");

    if (hasRunning) {
      pollRef.current = setInterval(loadWorkers, 3000);
    } else {
      clearInterval(pollRef.current);
    }

    return () => clearInterval(pollRef.current);
  }, [workers, loadWorkers]);

  // ── Loading ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <RefreshCw size={14} className={styles.spin} />
          Loading workers…
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Failed to load workers: {error}
        </div>
      </div>
    );
  }

  // ═══ Render ═══════════════════════════════════════════════

  return (
    <div className={styles.container}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Workers {workers.length > 0 ? `(${workers.length})` : ""}
        </span>
        <button
          className={styles.headerBtn}
          onClick={loadWorkers}
          disabled={loading}
          title="Refresh"
        >
          <RefreshCw size={11} className={loading ? styles.spin : ""} />
        </button>
      </div>

      {/* ── Empty ─────────────────────────────────────────── */}
      {workers.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Users size={24} />
          </div>
          <div className={styles.emptyTitle}>No workers</div>
          <div className={styles.emptySubtitle}>
            Workers are spawned by the coordinator when it
            decomposes tasks into parallel sub-agents. Use the
            <strong> spawn_agent</strong> tool to create workers.
          </div>
        </div>
      )}

      {/* ── Worker list ─────────────────────────────────────── */}
      {workers.map((worker) => {
        const statusLabel = STATUS_LABEL[worker.status] || worker.status;
        const statusClass = STATUS_CLASS[worker.status] || "statusPending";
        const cardClass = CARD_CLASS[worker.status] || "";
        const isLive = worker.status === "running";

        return (
          <div
            key={worker.agentId}
            className={`${styles.workerCard} ${cardClass ? styles[cardClass] : ""}`}
          >
            {/* Header: ID + status */}
            <div className={styles.workerHeader}>
              <span className={styles.workerIdBadge}>{worker.agentId}</span>
              <span className={`${styles.workerStatus} ${styles[statusClass]}`}>
                {statusLabel}
              </span>
            </div>

            {/* Description */}
            {worker.description && (
              <div className={styles.workerDescription}>
                {worker.description}
              </div>
            )}

            {/* Meta badges */}
            <div className={styles.workerMeta}>
              {worker.toolCallCount > 0 && (
                <span className={styles.metaBadge}>
                  <Wrench size={9} />
                  {worker.toolCallCount} tool{worker.toolCallCount !== 1 ? "s" : ""}
                </span>
              )}
              {worker.durationMs > 0 && (
                <span className={`${styles.metaBadge} ${isLive ? styles.durationLive : ""}`}>
                  <Clock size={9} />
                  {formatDuration(worker.durationMs)}
                </span>
              )}
              {worker.branchName && (
                <span className={styles.metaBadge}>
                  <GitBranch size={9} />
                  {worker.branchName}
                </span>
              )}
              {worker.resolvedModel && (
                <span className={styles.metaBadge}>
                  <Cpu size={9} />
                  {worker.resolvedModel.replace(/-\d{8}$/, "")}
                </span>
              )}
            </div>

            {/* Files */}
            {worker.files?.length > 0 && (
              <div className={styles.workerFiles}>
                {worker.files.map((f, i) => (
                  <span key={i} className={styles.workerFile} title={f}>
                    <FileCode size={9} style={{ display: "inline", verticalAlign: "middle", marginRight: 2 }} />
                    {f.split("/").pop()}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
