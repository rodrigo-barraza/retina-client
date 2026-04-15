"use client";

import { useState, useEffect, useCallback } from "react";
import { Activity, AlertCircle, Users } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import StopwatchComponent from "./StopwatchComponent";
import TokenCountBadgeComponent from "./TokenCountBadgeComponent";
import IrisService from "../services/IrisService";
import { formatCost } from "../utils/utilities";
import styles from "./SessionRequestsListComponent.module.css";

/**
 * SessionRequestsListComponent — displays all requests for an agent session
 * and its associated worker sessions as a flat chronological timeline (newest first).
 *
 * @param {string} agentSessionId - The root agent session ID to fetch requests for
 * @param {number} [refreshKey=0] - Bump to force re-fetch
 */
export default function SessionRequestsListComponent({ agentSessionId, refreshKey = 0 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRequests = useCallback(async () => {
    if (!agentSessionId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await IrisService.getSessionRequests(agentSessionId);
      setData(result);
    } catch (err) {
      // 404 = no requests yet, don't show error
      if (!err.message?.includes("404")) {
        setError(err.message);
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [agentSessionId]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests, refreshKey]);

  if (!agentSessionId || loading || error || !data?.requests?.length) {
    if (error) {
      return (
        <div className={styles.container}>
          <div className={styles.emptyState}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <Activity size={14} />
          <span>{loading ? "Loading requests…" : "No requests yet"}</span>
        </div>
      </div>
    );
  }

  // Flat list, newest first — each request tagged with isWorker
  const rootSessionId = data.rootSessionId;
  const requests = [...data.requests]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((req) => ({
      ...req,
      isWorker: req.agentSessionId !== rootSessionId,
      workerShortId: req.agentSessionId !== rootSessionId
        ? req.agentSessionId.slice(0, 8)
        : null,
    }));

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <Activity size={12} />
          <span>Requests</span>
          <span className={styles.headerCount}>{data.total}</span>
        </div>

        <div className={styles.requestList}>
          {requests.map((req, i) => {
            const isError = !req.success;
            return (
              <div
                key={req.requestId || i}
                className={`${styles.requestRow} ${isError ? styles.requestError : ""} ${req.isWorker ? styles.requestWorker : ""}`}
              >
                <div className={styles.requestMeta}>
                  {req.isWorker && (
                    <span className={styles.workerTag} title={`Worker ${req.workerShortId}`}>
                      <Users size={8} />
                    </span>
                  )}
                  <ProviderLogo provider={req.provider} size={12} />
                  <span className={styles.requestModel} title={req.model}>
                    {req.model ? req.model.replace(/^models\//, "").split("/").pop() : "—"}
                  </span>
                  {req.operation && (
                    <span className={styles.requestOperation}>{req.operation}</span>
                  )}
                </div>
                <div className={styles.requestStats}>
                  {req.inputTokens > 0 && (
                    <TokenCountBadgeComponent value={req.inputTokens} label="in" mini />
                  )}
                  {req.outputTokens > 0 && (
                    <TokenCountBadgeComponent value={req.outputTokens} label="out" mini />
                  )}
                  {req.totalTime > 0 && (
                    <StopwatchComponent seconds={req.totalTime} />
                  )}
                  {req.estimatedCost > 0 && (
                    <span className={styles.requestCost} title="Cost">
                      {formatCost(req.estimatedCost)}
                    </span>
                  )}
                  <DateTimeBadgeComponent date={req.timestamp} mini />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
