"use client";

import { Zap, Trash2 } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import IconButtonComponent from "./IconButtonComponent";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import { formatLatency } from "../utils/utilities";
import styles from "./WorkerNotificationComponent.module.css";

/**
 * WorkerNotificationComponent — renders a task-notification card
 * for worker agent results in the message list. The `result` body
 * is rendered through `MarkdownContent` to support full markdown
 * formatting (code blocks, lists, links, etc.).
 */
export default function WorkerNotificationComponent({
  taskNotif,
  timestamp,
  readOnly,
  onDelete,
}) {
  const statusIcon =
    taskNotif.status === "completed"
      ? "✓"
      : taskNotif.status === "failed"
        ? "✗"
        : "■";

  const statusColor =
    taskNotif.status === "completed"
      ? "var(--color-success, #22c55e)"
      : taskNotif.status === "failed"
        ? "var(--color-danger, #ef4444)"
        : "var(--text-muted)";

  const durationSec = taskNotif.durationMs
    ? formatLatency(Number(taskNotif.durationMs) / 1000)
    : null;

  return (
    <div className={styles.root}>
      <div className={styles.avatar} style={{ color: statusColor }}>
        <Zap size={16} />
      </div>
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.roleLabel} style={{ color: statusColor }}>
            <span className={styles.statusIcon}>{statusIcon}</span>
            Worker
            {timestamp && <DateTimeBadgeComponent date={timestamp} mini />}
          </div>
          {!readOnly && onDelete && (
            <div className={styles.actions}>
              <IconButtonComponent
                icon={<Trash2 size={14} />}
                onClick={onDelete}
                tooltip="Delete notification"
                variant="destructive"
                className={styles.actionBtn}
              />
            </div>
          )}
        </div>

        {/* Summary line with duration + tool count badges */}
        <div className={styles.summary}>
          {taskNotif.summary}
          {durationSec && (
            <span className={styles.meta}>({durationSec})</span>
          )}
          {taskNotif.toolUses && (
            <span className={styles.meta}>{taskNotif.toolUses} tools</span>
          )}
        </div>

        {/* Result body — rendered as full markdown */}
        {taskNotif.result && (
          <MarkdownContent
            content={taskNotif.result}
            className={styles.resultBody}
          />
        )}
      </div>
    </div>
  );
}
