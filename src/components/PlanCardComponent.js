"use client";

import { useState, useMemo } from "react";
import { ClipboardList, Check, X, ChevronDown, ChevronUp } from "lucide-react";
import MarkdownContent from "./MarkdownContent.js";
import styles from "./PlanCardComponent.module.css";

/**
 * Plan approval card — shows the structured plan output with
 * approve/reject actions and step progress tracking.
 */
export default function PlanCardComponent({
  planText,
  steps = [],
  completedSteps = [],
  onApprove,
  onReject,
  status = "pending", // "pending" | "approved" | "rejected" | "executing"
}) {
  const [expanded, setExpanded] = useState(true);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "approved": return "Approved";
      case "rejected": return "Rejected";
      case "executing": return `Executing (${completedSteps.length}/${steps.length})`;
      default: return "Awaiting Approval";
    }
  }, [status, completedSteps.length, steps.length]);

  const statusColor = useMemo(() => {
    switch (status) {
      case "approved":
      case "executing":
        return "var(--color-success)";
      case "rejected":
        return "var(--color-error)";
      default:
        return "var(--color-warning)";
    }
  }, [status]);

  return (
    <div className={`${styles.card} ${styles[status] || ""}`}>
      <button
        className={styles.header}
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        <div className={styles.headerLeft}>
          <ClipboardList size={16} style={{ color: statusColor }} />
          <span className={styles.title}>Implementation Plan</span>
          <span
            className={styles.statusBadge}
            style={{
              color: statusColor,
              borderColor: `color-mix(in srgb, ${statusColor} 30%, transparent)`,
            }}
          >
            {statusLabel}
          </span>
        </div>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <>
          {status === "pending" && (
            <div className={styles.actions}>
              <button className={styles.approveBtn} onClick={onApprove}>
                <Check size={14} />
                Execute Plan
              </button>
              <button className={styles.rejectBtn} onClick={onReject}>
                <X size={14} />
                Cancel
              </button>
            </div>
          )}

          <div className={styles.planContent}>
            <MarkdownContent content={planText} />
          </div>

          {steps.length > 0 && status === "executing" && (
            <div className={styles.stepsProgress}>
              {steps.map((step, i) => {
                const isDone = completedSteps.includes(i);
                return (
                  <div
                    key={i}
                    className={`${styles.step} ${isDone ? styles.stepDone : ""}`}
                  >
                    <span className={styles.stepCheck}>
                      {isDone ? <Check size={12} /> : <span className={styles.stepDot} />}
                    </span>
                    <span className={styles.stepText}>{step}</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
