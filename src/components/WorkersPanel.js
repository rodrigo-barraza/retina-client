"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Users, RefreshCw, Wrench, Clock, GitBranch, FileCode,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import CostBadgeComponent from "./CostBadgeComponent.js";
import ModelBadgeComponent from "./ModelBadgeComponent.js";
import ModalityIconComponent from "./ModalityIconComponent";
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
 * Extract a short agent number from an agentId like "agent-1" → "1"
 */
function getAgentNumber(agentId) {
  const match = agentId?.match(/agent-(\w+)/);
  return match ? match[1].toUpperCase() : agentId;
}

/**
 * WorkersPanel — displays coordinator workers spawned during this agent session.
 *
 * Polls the coordinator /workers endpoint filtered by the current agentSessionId.
 * Workers represent parallel sub-agents spawned via the `spawn_agent` tool
 * during agentic coding sessions.
 *
 * @param {object} props
 * @param {string} [props.agentSessionId] - Current agent session ID to filter workers by
 * @param {number} [props.refreshKey] - External trigger to refresh worker list
 */
export default function WorkersPanel({ agentSessionId, refreshKey, onCountChange, workerToolActivity = {} }) {
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
      const result = await PrismService.getCoordinatorWorkers(agentSessionId);
      const list = result.workers || [];
      setWorkers(list);
      onCountChange?.(list.length);
      hasData.current = true;
    } catch (err) {
      console.error("Failed to load workers:", err);
      if (!hasData.current) setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [agentSessionId, onCountChange]);

  // Reset on session change
  useEffect(() => {
    hasData.current = false;
    setWorkers([]);
  }, [agentSessionId]);

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
        const isComplete = worker.status === "complete";

        // Workers are text-in → text-out agents
        const workerModalities = { textIn: true, textOut: true };

        return (
          <div
            key={worker.agentId}
            className={`${styles.workerCard} ${cardClass ? styles[cardClass] : ""}`}
          >
            {/* ── Title row (HistoryItem-style) ─────────────── */}
            <div className={styles.titleRow}>
              <span className={styles.agentBadge}>
                Agent {getAgentNumber(worker.agentId)}
              </span>
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

            {/* ── Meta row (time, cost — HistoryItem-style) ── */}
            <div className={styles.meta}>
              {worker.durationMs > 0 && (
                <span className={`${styles.metaItem} ${isLive ? styles.durationLive : ""}`}>
                  <Clock size={10} />
                  {formatDuration(worker.durationMs)}
                </span>
              )}
              <CostBadgeComponent cost={worker.totalCost} mini showIcon={false} />
              {/* Live tool count from SSE (or fallback to API count) */}
              {(() => {
                const liveActivity = workerToolActivity[worker.agentId];
                const toolCount = Math.max(liveActivity?.toolCount || 0, worker.toolCallCount || 0);
                return toolCount > 0 ? (
                  <span className={styles.metaItem}>
                    <Wrench size={10} />
                    {toolCount} tool{toolCount !== 1 ? "s" : ""}
                  </span>
                ) : null;
              })()}
              {worker.branchName && (
                <span className={styles.metaItem}>
                  <GitBranch size={10} />
                  {worker.branchName}
                </span>
              )}
            </div>

            {/* ── Model badge ────────────────────────────────── */}
            {worker.resolvedModel && (
              <ModelBadgeComponent
                models={[worker.resolvedModel.replace(/-\d{8}$/, "")]}
                provider={worker.provider}
                mini
                className={styles.modelBadge}
              />
            )}

            {/* ── Modality icons ─────────────────────────────── */}
            {isComplete && (
              <ModalityIconComponent modalities={workerModalities} size={10} />
            )}

            {/* ── Live tool activity (SSE-driven) ────────────── */}
            {isLive && workerToolActivity[worker.agentId]?.currentTool && (
              <div className={styles.liveActivity}>
                <span className={styles.liveDot} />
                <Wrench size={9} />
                <span className={styles.liveToolName}>
                  {workerToolActivity[worker.agentId].currentTool.replace(/_/g, " ")}
                </span>
                {workerToolActivity[worker.agentId].iteration > 0 && (
                  <span className={styles.liveIteration}>
                    iter {workerToolActivity[worker.agentId].iteration}
                  </span>
                )}
              </div>
            )}

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
