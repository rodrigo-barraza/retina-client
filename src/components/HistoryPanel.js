"use client";

import { useMemo } from "react";
import { MessageSquare, Plus } from "lucide-react";
import HistoryList from "./HistoryList";
import styles from "./HistoryPanel.module.css";

function getModalities(messages) {
  const modalities = {
    textIn: false,
    textOut: false,
    imageIn: false,
    imageOut: false,
    audioIn: false,
    audioOut: false,
    docIn: false,
  };
  for (const m of messages || []) {
    const isUser = m.role === "user";
    const isAssistant = m.role === "assistant";
    if (m.content && (isUser || isAssistant)) {
      if (isUser) modalities.textIn = true;
      if (isAssistant) modalities.textOut = true;
    }
    if (m.images?.length > 0 || m.image) {
      if (isUser) modalities.imageIn = true;
      if (isAssistant) modalities.imageOut = true;
    }
    if (m.audio) {
      if (isUser) modalities.audioIn = true;
      if (isAssistant) modalities.audioOut = true;
    }
    if (
      m.documents?.length > 0 ||
      m.images?.some(
        (ref) =>
          typeof ref === "string" &&
          (ref.endsWith(".pdf") || ref.endsWith(".txt")),
      )
    ) {
      modalities.docIn = true;
    }
  }
  return modalities;
}

export default function HistoryPanel({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  readOnly = false,
  showProject = false,
  showUsername = false,
}) {
  // Normalize conversations into HistoryList items
  const items = useMemo(() => {
    return conversations.map((conv) => {
      const totalCost =
        conv.totalCost ||
        (conv.messages || []).reduce((sum, m) => sum + (m.estimatedCost || 0), 0);

      const tags = [];
      if (showProject && conv.project) {
        tags.push({ label: conv.project, style: { background: "var(--accent-subtle)", color: "var(--accent-color)" } });
      }

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
        searchText: (conv.messages || []).map((m) => m.content || "").join(" "),
      };
    });
  }, [conversations, showProject]);

  return (
    <div className={styles.container}>
      {!readOnly && (
        <button className={styles.newBtn} onClick={onNew} data-panel-close>
          <Plus size={16} /> New Conversation
        </button>
      )}
      <HistoryList
        items={items}
        activeId={activeId}
        onSelect={(item) => {
          const conv = conversations.find((c) => c.id === item.id);
          if (conv) onSelect(conv);
        }}
        onDelete={!readOnly && onDelete ? onDelete : undefined}
        icon={MessageSquare}
        readOnly={readOnly}
        emptyLabel="No recent chats"
        searchPlaceholder="Search conversations..."
        admin={showUsername}
      />
    </div>
  );
}
