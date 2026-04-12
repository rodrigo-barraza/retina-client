"use client";

import { useMemo } from "react";
import { MessageSquare, Plus } from "lucide-react";
import HistoryList from "./HistoryList";
import ButtonComponent from "./ButtonComponent";
import styles from "./HistoryPanel.module.css";

// Re-export from canonical location so existing imports don't break
export { getModalities } from "../utils/utilities";


export default function HistoryPanel({
  sessions,
  activeId,
  onSelect,
  onNew,
  onDelete,
  readOnly = false,
  showProject = false,
  showUsername = false,
  newIds,
  favorites = [],
  onToggleFavorite,
  initialProviders,
  initialSearch = "",
  disableNew,
  // Customisable labels — defaults match conversation-session context
  newLabel = "New Conversation",
  emptyText = "No recent chats",
  searchText = "Search conversations...",
  itemIcon,
}) {
  // Normalize sessions into HistoryList items
  const items = useMemo(() => {
    return sessions.map((conv) => {
      const totalCost =
        conv.totalCost ||
        (conv.messages || []).reduce(
          (sum, m) => sum + (m.estimatedCost || 0),
          0,
        );

      const tags = [];
      if (showProject && conv.project) {
        tags.push({
          label: conv.project,
          style: {
            background: "var(--accent-subtle)",
            color: "var(--accent-color)",
          },
        });
      }
      if (conv.synthetic) {
        tags.push({
          label: "SYNTHETIC",
          style: {
            background: "rgba(168, 85, 247, 0.12)",
            color: "rgb(168, 85, 247)",
          },
        });
      }

      // Extract unique model names used in this conversation
      const msgs = conv.messages || [];
      const modelNamesSet = new Set();

      // Look at messages from newest to oldest to order recent models first
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant" && msgs[i].model) {
          modelNamesSet.add(msgs[i].model);
        }
      }

      // If no models found in messages, fall back to conv.model
      if (modelNamesSet.size === 0 && conv.model) {
        modelNamesSet.add(conv.model);
      }

      const modelNames = Array.from(modelNamesSet);

      return {
        id: conv.id,
        title: conv.title || "Untitled Chat",
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
        totalCost,
        modalities: conv.modalities || getModalities(conv.messages),
        providers: conv.providers || [],
        tags,
        username: conv.username,
        modelNames,
        searchText: [
          conv.project || "",
          conv.username || "",
          ...(conv.messages || []).map((m) => m.content || ""),
        ].join(" "),
      };
    });
  }, [sessions, showProject]);

  return (
    <div className={styles.container}>
      {!readOnly && onNew && (
        <ButtonComponent
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={onNew}
          disabled={disableNew !== undefined ? disableNew : !activeId}
          className={styles.newBtn}
          data-panel-close
        >
          {newLabel}
        </ButtonComponent>
      )}
      <HistoryList
        items={items}
        activeId={activeId}
        onSelect={(item) => {
          const conv = sessions.find((c) => c.id === item.id);
          if (conv) onSelect(conv);
        }}
        onDelete={!readOnly && onDelete ? onDelete : undefined}
        icon={itemIcon || MessageSquare}
        readOnly={readOnly}
        emptyLabel={emptyText}
        searchPlaceholder={searchText}
        admin={showUsername}
        newIds={newIds}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        initialProviders={initialProviders}
        initialSearch={initialSearch}
      />
    </div>
  );
}
