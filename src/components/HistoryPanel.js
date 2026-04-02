"use client";

import { useMemo } from "react";
import { MessageSquare, Plus } from "lucide-react";
import HistoryList from "./HistoryList";
import ButtonComponent from "./ButtonComponent";
import styles from "./HistoryPanel.module.css";

export function getModalities(messages) {
  const modalities = {
    textIn: false,
    textOut: false,
    imageIn: false,
    imageOut: false,
    audioIn: false,
    audioOut: false,
    videoIn: false,
    docIn: false,
    webSearch: false,
    codeExecution: false,
    functionCalling: false,
    thinking: false,
  };

  const WEB_SEARCH_NAMES = new Set(["web_search", "web_search_preview"]);
  const CODE_EXEC_NAMES = new Set(["code_execution"]);

  for (const m of messages || []) {
    const isUser = m.role === "user";
    const isAssistant = m.role === "assistant";
    if (m.content && (isUser || isAssistant)) {
      if (isUser && !m.liveTranscription) modalities.textIn = true;
      if (isAssistant) modalities.textOut = true;
    }
    // Tool calls are structured text output
    if (isAssistant && m.toolCalls?.length > 0) {
      modalities.textOut = true;
    }
    if (m.audio) {
      if (isUser) modalities.audioIn = true;
      if (isAssistant) modalities.audioOut = true;
    }
    if (m.images?.length > 0) {
      for (const ref of m.images) {
        if (typeof ref !== "string") continue;
        const isDoc =
          ref.startsWith("data:application/") ||
          ref.startsWith("data:text/") ||
          ref.endsWith(".pdf") ||
          ref.endsWith(".txt");
        const isVideo =
          ref.startsWith("data:video/") ||
          [".mp4", ".mov", ".avi", ".webm"].some((ext) => ref.endsWith(ext));
        if (isDoc) {
          modalities.docIn = true;
        } else if (isVideo) {
          if (isUser) modalities.videoIn = true;
        } else {
          // Actual image ref
          if (isUser) modalities.imageIn = true;
          if (isAssistant) modalities.imageOut = true;
        }
      }
    }
    // Standalone image field (not from images array)
    if (m.image && !m.images?.length) {
      if (isUser) modalities.imageIn = true;
      if (isAssistant) modalities.imageOut = true;
    }
    if (m.documents?.length > 0) {
      modalities.docIn = true;
    }

    // Classify tool calls by type
    if (m.toolCalls?.length > 0) {
      for (const tc of m.toolCalls) {
        const name = (tc.name || "").toLowerCase();
        if (WEB_SEARCH_NAMES.has(name)) {
          modalities.webSearch = true;
        } else if (CODE_EXEC_NAMES.has(name)) {
          modalities.codeExecution = true;
        } else {
          modalities.functionCalling = true;
        }
      }
    }

    // Detect inline web search results (from streaming)
    if (
      isAssistant &&
      typeof m.content === "string" &&
      m.content.includes("> **Sources:**")
    ) {
      modalities.webSearch = true;
    }

    // Detect inline code execution blocks (from streaming)
    if (
      isAssistant &&
      typeof m.content === "string" &&
      m.content.includes("```exec-")
    ) {
      modalities.codeExecution = true;
    }

    // Tool result messages → function calling
    if (m.role === "tool") {
      modalities.functionCalling = true;
    }

    // Detect thinking / reasoning
    if (isAssistant && m.thinking) {
      modalities.thinking = true;
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
  newIds,
  favorites = [],
  onToggleFavorite,
  initialProviders,
  initialSearch = "",
}) {
  // Normalize conversations into HistoryList items
  const items = useMemo(() => {
    return conversations.map((conv) => {
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

      // Extract the most recent model name from assistant messages
      const msgs = conv.messages || [];
      let modelName = conv.model || null;
      if (!modelName) {
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant" && msgs[i].model) {
            modelName = msgs[i].model;
            break;
          }
        }
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
        modelName,
        searchText: (conv.messages || []).map((m) => m.content || "").join(" "),
      };
    });
  }, [conversations, showProject]);

  return (
    <div className={styles.container}>
      {!readOnly && (
        <ButtonComponent
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={onNew}
          disabled={!activeId}
          className={styles.newBtn}
          data-panel-close
        >
          New Conversation
        </ButtonComponent>
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
        newIds={newIds}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        initialProviders={initialProviders}
        initialSearch={initialSearch}
      />
    </div>
  );
}
