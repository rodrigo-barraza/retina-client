"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Check,
  Volume2,
  FileText,
  Trash2,
  Pencil,
  RotateCcw,
  X as XIcon,
  RefreshCw,
  Zap,
  Undo2,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import MarkdownContent from "./MarkdownContent";
import StreamingCursorComponent from "./StreamingCursorComponent";
import IconButtonComponent from "./IconButtonComponent";
import CopyButtonComponent from "./CopyButtonComponent";
import styles from "./MessageList.module.css";
import { DateTime } from "luxon";
import PrismService from "../services/PrismService";

/* ── Helpers ─────────────────────────────────────────────────── */

function getOrdinalSuffix(day) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatTimestamp(isoString) {
  const dt = DateTime.fromISO(isoString);
  const day = dt.day;
  const suffix = getOrdinalSuffix(day);
  return dt.toFormat(`LLLL d'${suffix},' yyyy '@' h:mm:ss a`);
}

function getMimeCategory(ref) {
  if (!ref) return "file";
  if (ref.startsWith("minio://")) {
    const ext = ref.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
      return "image";
    if (["wav", "mp3", "webm", "ogg"].includes(ext)) return "audio";
    if (["mp4", "mov", "avi"].includes(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (ext === "txt") return "text";
    return "file";
  }
  // Handle HTTP/HTTPS URLs (e.g. Discord CDN images)
  if (ref.startsWith("http://") || ref.startsWith("https://")) {
    try {
      const pathname = new URL(ref).pathname;
      const ext = pathname.split(".").pop()?.toLowerCase();
      if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext))
        return "image";
      if (["wav", "mp3", "webm", "ogg"].includes(ext)) return "audio";
      if (["mp4", "mov", "avi"].includes(ext)) return "video";
      if (ext === "pdf") return "pdf";
      if (ext === "txt") return "text";
    } catch {
      // URL parse failed, fall through
    }
    return "image"; // Default assumption for HTTP URLs in images array
  }
  const match = ref.match(/^data:([\w-]+)\//);
  if (!match) return "file";
  const type = match[1];
  if (type === "application") return "pdf";
  if (type === "text") return "text";
  return type;
}

/* ── Sub-components ──────────────────────────────────────────── */



function ThinkingBlock({ thinking, isStreaming }) {
  // User can manually toggle after streaming has finished
  const [manualOpen, setManualOpen] = useState(false);
  // User can temporarily close during streaming
  const [streamClosed, setStreamClosed] = useState(false);
  const contentRef = useRef(null);

  // Derive collapsed state:
  // - Streaming: expanded unless user explicitly closed it
  // - Not streaming: collapsed unless user explicitly opened it
  const collapsed = isStreaming ? streamClosed : !manualOpen;

  // Auto-scroll to bottom of thinking content while streaming
  useEffect(() => {
    if (isStreaming && !streamClosed && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isStreaming, streamClosed]);

  const handleToggle = () => {
    if (isStreaming) {
      setStreamClosed((v) => !v);
    } else {
      setManualOpen((v) => !v);
    }
  };

  if (!thinking) return null;

  return (
    <div className={`${styles.thinkingBlock}${isStreaming ? ` ${styles.thinkingStreaming}` : ""}`}>
      <button
        className={styles.thinkingToggle}
        onClick={handleToggle}
      >
        <Brain size={14} />
        <span>Thoughts</span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      {!collapsed && (
        <div className={styles.thinkingContent} ref={contentRef}>
          <MarkdownContent content={thinking} />
        </div>
      )}
    </div>
  );
}

function ToolCallResultBlock({ result }) {
  const [showResult, setShowResult] = useState(false);

  if (!result) return null;

  const formatted =
    typeof result === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(result);
            return "```json\n" + JSON.stringify(parsed, null, 2) + "\n```";
          } catch {
            return "```\n" + result + "\n```";
          }
        })()
      : "```json\n" + JSON.stringify(result, null, 2) + "\n```";

  return (
    <div className={styles.toolCallResultWrapper}>
      <button
        className={styles.toolCallResultToggle}
        onClick={() => setShowResult((v) => !v)}
      >
        <ChevronRight
          size={12}
          className={showResult ? styles.toolCallChevronOpen : ""}
        />
        <span>View Response</span>
      </button>
      {showResult && (
        <div className={styles.toolCallResult}>
          <MarkdownContent content={formatted} />
        </div>
      )}
    </div>
  );
}

function ToolCallsBlock({ toolCalls }) {
  const [collapsed, setCollapsed] = useState(true);
  if (!toolCalls || toolCalls.length === 0) return null;

  const names = toolCalls.map((tc) =>
    (tc.name || "unknown")
      .replace(/^get_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  );

  return (
    <div className={styles.toolCallsBlock}>
      <button
        className={styles.toolCallsToggle}
        onClick={() => setCollapsed((c) => !c)}
      >
        <Zap size={13} />
        <span>
          {toolCalls.length === 1
            ? `Used tool: ${names[0]}`
            : `Used ${toolCalls.length} tools`}
        </span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      {!collapsed && (
        <div className={styles.toolCallsContent}>
          {toolCalls.map((tc, j) => (
            <div key={j} className={styles.toolCallItem}>
              <div className={styles.toolCallHeader}>
                <span className={styles.toolCallName}>{names[j]}</span>
                {tc.args && Object.keys(tc.args).length > 0 && (
                  <span className={styles.toolCallArgs}>
                    (
                    {Object.entries(tc.args)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                    )
                  </span>
                )}
              </div>
              <ToolCallResultBlock result={tc.result} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Prepare messages for display — filters out tool/system messages
 * and merges tool results into the preceding assistant's toolCalls.
 * Soft-deleted messages are always included (with their `deleted` flag)
 * so they render in-place as ghostly apparitions.
 * Use this in both /conversations and /admin/conversations for consistency.
 */
export function prepareDisplayMessages(rawMessages) {
  if (!rawMessages || rawMessages.length === 0) return [];

  // First pass: collect tool results keyed by tool_call_id
  // Support both snake_case (API) and camelCase (normalized) property names
  const toolResults = {};
  for (const m of rawMessages) {
    if (m.role === "tool") {
      const id = m.tool_call_id || m.toolCallId;
      if (id) toolResults[id] = m.content;
    }
  }

  // Second pass: filter and enrich
  return rawMessages
    .filter(
      (m) =>
        m.role !== "tool" &&
        m.role !== "system" &&
        !(
          m.role === "assistant" &&
          !m.content?.trim() &&
          !m.toolCalls?.length &&
          !m.images?.length &&
          !m.audio
        ),
    )
    .map((m) => {
      // Merge tool results into toolCalls
      if (m.toolCalls?.length > 0 && Object.keys(toolResults).length > 0) {
        const enrichedCalls = m.toolCalls.map((tc) => ({
          ...tc,
          result:
            tc.result ||
            toolResults[tc.id] ||
            toolResults[tc.tool_call_id] ||
            null,
        }));
        return { ...m, toolCalls: enrichedCalls };
      }
      return m;
    });
}

function MediaPreview({ dataUrl: rawUrl, onClick }) {
  const src = PrismService.getFileUrl(rawUrl);
  const cat = getMimeCategory(rawUrl);

  if (cat === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={src}
        alt="Attached"
        className={styles.messageImage}
        onClick={onClick}
      />
    );
  }
  if (cat === "audio") {
    return (
      <div className={styles.audioCard}>
        <div className={styles.audioCardHeader}>
          <Volume2 size={16} className={styles.audioCardIcon} />
          <span className={styles.audioCardLabel}>Audio</span>
          <a
            href={src}
            download
            className={styles.audioCardDownload}
            title="Download audio"
          >
            ↓
          </a>
        </div>
        <audio
          controls
          src={src}
          preload="metadata"
          className={styles.audioCardPlayer}
        />
      </div>
    );
  }
  if (cat === "video") {
    return (
      <div className={styles.videoCard}>
        <video
          controls
          src={src}
          preload="metadata"
          className={styles.videoPreview}
        />
      </div>
    );
  }
  if (cat === "pdf") {
    return (
      <div className={styles.pdfViewer}>
        <div className={styles.pdfHeader}>
          <FileText size={14} className={styles.pdfHeaderIcon} />
          <span className={styles.pdfHeaderLabel}>PDF Document</span>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.pdfOpenLink}
          >
            Open ↗
          </a>
        </div>
        <iframe src={src} className={styles.pdfFrame} title="PDF preview" />
      </div>
    );
  }
  if (cat === "text") {
    return (
      <div
        className={styles.mediaCard}
        onClick={onClick}
        style={onClick ? { cursor: "pointer" } : undefined}
      >
        <FileText size={22} className={styles.mediaCardIcon} />
        <span className={styles.mediaCardLabel}>{cat.toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className={styles.mediaCard}>
      <FileText size={22} className={styles.mediaCardIcon} />
      <span className={styles.mediaCardLabel}>{cat.toUpperCase()}</span>
    </div>
  );
}

/* ── Inline edit for user messages ───────────────────────────── */

function EditableUserMessage({
  content,
  index,
  onEdit,
  editing,
  onCancelEdit,
}) {
  const [editValue, setEditValue] = useState(content);

  const cancel = () => {
    onCancelEdit();
    setEditValue(content);
  };
  const save = () => {
    if (editValue.trim() && editValue !== content) onEdit(index, editValue);
    onCancelEdit();
  };
  const handleKey = (e) => {
    if (e.key === "Escape") cancel();
    else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    }
  };

  if (editing) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: "100%",
        }}
      >
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          style={{
            width: "100%",
            minHeight: 60,
            maxHeight: 300,
            padding: "10px 12px",
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--text-primary)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--accent-color)",
            borderRadius: 8,
            resize: "vertical",
            fontFamily: "inherit",
            boxShadow: "0 0 0 2px var(--accent-glow)",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={save}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              background: "var(--accent-color)",
              color: "#fff",
            }}
          >
            <Check size={14} /> Save
          </button>
          <button
            onClick={cancel}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 14px",
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              cursor: "pointer",
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-color)",
            }}
          >
            <XIcon size={14} /> Cancel
          </button>
        </div>
      </div>
    );
  }

  return <div className={styles.text}>{content}</div>;
}

/* ── Main export ─────────────────────────────────────────────── */

/**
 * Shared message list component.
 *
 * @param {object} props
 * @param {Array}  props.messages          - array of message objects
 * @param {boolean} [props.readOnly=false] - hide edit/delete/rerun actions
 * @param {boolean} [props.isGenerating]   - show generating indicator
 * @param {Function} [props.onDelete]      - (index) => void
 * @param {Function} [props.onEdit]        - (index, newContent) => void
 * @param {Function} [props.onRerun]       - (index) => void
 * @param {Function} [props.onImageClick]  - (resolvedUrl) => void
 * @param {Function} [props.onDocClick]    - (resolvedUrl) => void
 */
export default function MessageList({
  messages = [],
  readOnly = false,
  isGenerating = false,

  onDelete,
  onRestore,
  onEdit,
  onRerun,
  onImageClick,
  onDocClick,
}) {
  const [editingIndex, setEditingIndex] = useState(null);

  return (
    <div className={styles.messagesList}>
      {messages.map((msg, i) => {

        const roleClass =
          msg.role === "user"
            ? styles.userNode
            : msg.role === "system"
              ? styles.systemNode
              : styles.aiNode;
        const isStreaming =
          (isGenerating && msg.role === "assistant" && i === messages.length - 1)
          || (msg.role === "assistant" && msg._liveStreaming === true);

        // Detect model swap: show divider above user message when the next
        // assistant's model differs from the previous assistant's model
        let showModelChange = false;
        if (msg.role === "user") {
          let prevAssistantModel = null;
          let nextAssistantModel = null;
          for (let j = i - 1; j >= 0; j--) {
            if (messages[j].role === "assistant" && messages[j].model) {
              prevAssistantModel = messages[j].model;
              break;
            }
          }
          for (let j = i + 1; j < messages.length; j++) {
            if (messages[j].role === "assistant" && messages[j].model) {
              nextAssistantModel = messages[j].model;
              break;
            }
          }
          if (
            prevAssistantModel &&
            nextAssistantModel &&
            prevAssistantModel !== nextAssistantModel
          ) {
            showModelChange = true;
          }
        }

        return (
          <React.Fragment key={i}>
            {showModelChange && (
              <div className={styles.modelChangeDivider}>
                <span className={styles.modelChangeLine} />
                <span className={styles.modelChangeLabel}>
                  <RefreshCw size={11} />
                  Model Swap
                </span>
                <span className={styles.modelChangeLine} />
              </div>
            )}
            <div className={`${styles.message} ${roleClass}${msg.deleted ? ` ${styles.deletedMessage}` : ""}`}>
              <div
                className={`${styles.avatar}${msg.role === "assistant" && isGenerating && i === messages.length - 1 ? ` ${styles.prismAvatar}` : ""}${msg.deleted ? ` ${styles.deletedAvatar}` : ""}`}
              >
                {msg.role === "user" ? "U" : msg.role === "system" ? "S" : "AI"}
              </div>
              <div className={styles.content}>
                {/* Header: role + timestamp + actions */}
                <div className={styles.messageHeader}>
                  <div className={styles.roleLabel}>
                    {msg.role === "user"
                      ? "You"
                      : msg.role === "system"
                        ? "System"
                        : "Model"}
                    {msg.timestamp && (
                      <span className={styles.timestamp}>
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  {!readOnly && !msg.deleted && (
                    <div className={styles.messageActions}>
                      {msg.role === "user" && (
                        <>
                          <IconButtonComponent
                            icon={<Pencil size={14} />}
                            onClick={() =>
                              setEditingIndex(editingIndex === i ? null : i)
                            }
                            disabled={isGenerating}
                            tooltip="Edit message"
                            className={styles.actionBtn}
                          />
                          <IconButtonComponent
                            icon={<RotateCcw size={14} />}
                            onClick={() => onRerun?.(i)}
                            disabled={isGenerating}
                            tooltip="Rerun this turn"
                            className={styles.actionBtn}
                          />
                        </>
                      )}
                      {msg.content && <CopyButtonComponent text={msg.content} tooltip="Copy raw text" className={styles.actionBtn} />}
                      <IconButtonComponent
                        icon={<Trash2 size={14} />}
                        onClick={() => onDelete?.(i)}
                        tooltip="Delete message"
                        variant="danger"
                        className={styles.actionBtn}
                      />
                    </div>
                  )}
                  {!readOnly && msg.deleted && (
                    <div className={styles.messageActions}>
                      <span className={styles.deletedBadge}>Deleted</span>
                      <IconButtonComponent
                        icon={<Undo2 size={14} />}
                        onClick={() => onRestore?.(i)}
                        tooltip="Restore message"
                        className={styles.actionBtn}
                      />
                    </div>
                  )}
                  {readOnly && msg.content && (
                    <div className={styles.messageActions}>
                      <CopyButtonComponent text={msg.content} tooltip="Copy raw text" className={styles.actionBtn} />
                    </div>
                  )}
                </div>

                {/* Thinking block */}
                {msg.thinking && (
                  <ThinkingBlock
                    thinking={msg.thinking}
                    isStreaming={isStreaming && !!msg.thinking && !msg.content}
                  />
                )}

                {/* Tool calls indicator */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <ToolCallsBlock toolCalls={msg.toolCalls} />
                )}

                {/* Images / media */}
                {msg.images && msg.images.length > 0 && (
                  <div className={styles.imagePreviewRow}>
                    {msg.images.map((rawUrl, j) => {
                      const resolvedUrl = PrismService.getFileUrl(rawUrl);
                      const cat = getMimeCategory(rawUrl);
                      let clickHandler;
                      if (cat === "image")
                        clickHandler = () => onImageClick?.(resolvedUrl);
                      else if (cat === "pdf" || cat === "text")
                        clickHandler = () => onDocClick?.(resolvedUrl);
                      return (
                        <MediaPreview
                          key={j}
                          dataUrl={rawUrl}
                          onClick={clickHandler}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Audio */}
                {msg.audio && (
                  <div className={styles.imagePreviewRow}>
                    {(Array.isArray(msg.audio) ? msg.audio : [msg.audio]).map(
                      (rawUrl, j) => (
                        <MediaPreview key={`aud-${j}`} dataUrl={rawUrl} />
                      ),
                    )}
                  </div>
                )}

                {/* Video */}
                {msg.video &&
                  (Array.isArray(msg.video) ? msg.video : [msg.video]).length >
                    0 && (
                    <div className={styles.imagePreviewRow}>
                      {(Array.isArray(msg.video) ? msg.video : [msg.video]).map(
                        (rawUrl, j) => (
                          <MediaPreview key={`vid-${j}`} dataUrl={rawUrl} />
                        ),
                      )}
                    </div>
                  )}

                {/* PDF */}
                {msg.pdf &&
                  (Array.isArray(msg.pdf) ? msg.pdf : [msg.pdf]).length > 0 && (
                    <div className={styles.imagePreviewRow}>
                      {(Array.isArray(msg.pdf) ? msg.pdf : [msg.pdf]).map(
                        (rawUrl, j) => {
                          const resolvedUrl = PrismService.getFileUrl(rawUrl);
                          return (
                            <MediaPreview
                              key={`pdf-${j}`}
                              dataUrl={rawUrl}
                              onClick={() => onDocClick?.(resolvedUrl)}
                            />
                          );
                        },
                      )}
                    </div>
                  )}

                {/* Text content */}
                {msg.role === "user" && !readOnly ? (
                  <EditableUserMessage
                    content={msg.content}
                    index={i}
                    onEdit={onEdit}
                    editing={editingIndex === i}
                    onCancelEdit={() => setEditingIndex(null)}
                  />
                ) : msg.content ? (
                  <MarkdownContent
                      content={msg.content}
                      className={isStreaming ? styles.streamingText : ""}
                    >
                      <StreamingCursorComponent active={isStreaming} />
                    </MarkdownContent>
                ) : isStreaming ? (
                  <span className={styles.streamingCursor} />
                ) : null}

                {/* User metadata */}
                {msg.role === "user" && msg.content && (
                  <div className={styles.meta}>
                    {`${msg.content.trim().split(/\s+/).filter(Boolean).length} words`}
                  </div>
                )}

                {/* Assistant metadata */}
                {msg.role === "assistant" &&
                  (msg.usage || msg.audio || msg.provider) && (
                    <div className={styles.meta}>
                      <div className={styles.metaRow}>
                        {msg.provider && (
                          <span className={styles.metaProvider}>
                            <ProviderLogo provider={msg.provider} size={13} />
                            {PROVIDER_LABELS[msg.provider] || msg.provider}
                          </span>
                        )}
                        {msg.model && (
                          <>
                            {" • "}
                            {msg.model}
                          </>
                        )}
                      </div>
                      <div className={styles.metaRow}>
                        {msg.voice ? `🔊 ${msg.voice}` : ""}
                        {msg.usage?.inputTokens != null &&
                        msg.usage?.outputTokens != null
                          ? `${msg.voice ? " • " : ""}${msg.usage.inputTokens} in · ${msg.usage.outputTokens} out tokens`
                          : msg.usage?.outputTokens != null
                            ? `${msg.voice ? " • " : ""}${msg.usage.outputTokens} tokens`
                            : ""}
                        {msg.content
                          ? ` • ${msg.content.trim().split(/\s+/).filter(Boolean).length} words`
                          : ""}
                        {msg.totalTime != null
                          ? ` • ${msg.totalTime.toFixed(1)}s`
                          : ""}
                        {msg.tokensPerSec ? ` • ${msg.tokensPerSec} tok/s` : ""}
                        {msg.provider === "lm-studio" || msg.provider === "vllm"
                          ? " • $0"
                          : msg.estimatedCost
                            ? ` • $${msg.estimatedCost.toFixed(5)}`
                            : ""}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
