"use client";

import { MessageSquare, Plus, Trash2 } from "lucide-react";
import styles from "./HistoryPanel.module.css";
import { DateTime } from "luxon";

export default function HistoryPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}) {
  return (
    <div className={styles.container}>
      <button className={styles.newBtn} onClick={onNew}>
        <Plus size={16} /> New Chat
      </button>

      <div className={styles.list}>
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          const dt = DateTime.fromISO(
            conv.updatedAt || conv.createdAt,
          ).toRelative();

          return (
            <div
              key={conv.id}
              className={`${styles.item} ${isActive ? styles.active : ""}`}
              onClick={() => onSelect(conv)}
            >
              <MessageSquare size={14} className={styles.icon} />
              <div className={styles.content}>
                <div className={styles.title}>
                  {conv.title || "Untitled Chat"}
                </div>
                <div className={styles.date}>{dt}</div>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
        {conversations.length === 0 && (
          <div className={styles.empty}>No recent chats</div>
        )}
      </div>
    </div>
  );
}
