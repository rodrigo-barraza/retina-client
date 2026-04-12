"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Check,
  FileText,
  Trash2,
  Pencil,
  RotateCcw,
  X as XIcon,
  RefreshCw,
  Zap,
  Undo2,
  AlertTriangle,
  Loader,
  Wrench,
  User,
  Bot,
  Terminal,
} from "lucide-react";
import { TOOL_ICON_MAP, TOOL_COLORS } from "./WorkflowNodeConstants";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import MarkdownContent from "./MarkdownContent";
import StreamingCursorComponent from "./StreamingCursorComponent";
import IconButtonComponent from "./IconButtonComponent";
import CopyButtonComponent from "./CopyButtonComponent";
import AudioPlayerRecorderComponent from "./AudioPlayerRecorderComponent";
import { ToolResultView } from "./ToolResultRenderers";
import styles from "./MessageList.module.css";
import { DateTime } from "luxon";
import PrismService from "../services/PrismService";
import { formatCost, getTotalInputTokens } from "../utils/utilities";



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

function ThinkingBlock({ thinking, isStreaming, children }) {
  // User can manually toggle after streaming has finished
  const [manualOpen, setManualOpen] = useState(false);
  // User can temporarily close during streaming
  const [streamClosed, setStreamClosed] = useState(false);
  const contentRef = useRef(null);

  // Derive collapsed state:
  // - Streaming: expanded unless user explicitly closed it
  // - Not streaming: collapsed unless user explicitly opened it
  const collapsed = isStreaming ? streamClosed : !manualOpen;

  // Auto-scroll to bottom of thinking content while streaming (smooth)
  useEffect(() => {
    if (isStreaming && !streamClosed && contentRef.current) {
      const el = contentRef.current;
      requestAnimationFrame(() => {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      });
    }
  }, [thinking, isStreaming, streamClosed]);

  const handleToggle = () => {
    if (isStreaming) {
      setStreamClosed((v) => !v);
    } else {
      setManualOpen((v) => !v);
    }
  };

  if (!thinking && !children) return null;

  return (
    <div
      className={`${styles.thinkingBlock}${isStreaming ? ` ${styles.thinkingStreaming}` : ""}`}
    >
      <button className={styles.thinkingToggle} onClick={handleToggle}>
        <Brain size={14} />
        <span>Thoughts</span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      {!collapsed && (
        <div className={styles.thinkingContent} ref={contentRef}>
          {thinking && <MarkdownContent content={thinking} />}
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Extract a concise, human-readable summary from tool result data.
 * Shows the first few meaningful values to give the user immediate insight.
 */
function extractResultSummary(result) {
  let parsed = null;
  if (typeof result === "string") {
    try { parsed = JSON.parse(result); } catch { return null; }
  } else if (typeof result === "object") {
    parsed = result;
  }
  if (!parsed) return null;

  // Array results: show count + first few item names/titles
  if (Array.isArray(parsed)) {
    const count = parsed.length;
    const labels = parsed.slice(0, 4).map((item) => {
      if (typeof item === "string") return item;
      return item?.name || item?.title || item?.label || item?.id || null;
    }).filter(Boolean);
    if (labels.length > 0) {
      const suffix = count > labels.length ? ` +${count - labels.length} more` : "";
      return `${count} result${count !== 1 ? "s" : ""}: ${labels.join(", ")}${suffix}`;
    }
    return `${count} result${count !== 1 ? "s" : ""}`;
  }

  // Object with count/results pattern (paginated APIs)
  if (parsed.count != null || parsed.total != null || parsed.results) {
    const count = parsed.count ?? parsed.total ?? parsed.results?.length;
    const items = parsed.results || parsed.data || parsed.items;
    if (Array.isArray(items) && items.length > 0) {
      const labels = items.slice(0, 3).map((item) =>
        item?.name || item?.title || item?.label || null
      ).filter(Boolean);
      if (labels.length > 0) {
        return `${count} result${count !== 1 ? "s" : ""}: ${labels.join(", ")}${count > 3 ? " …" : ""}`;
      }
    }
    if (count != null) return `${count} result${count !== 1 ? "s" : ""}`;
  }

  // Object with a 'name' or 'title': show it directly
  if (parsed.name || parsed.title) {
    return parsed.name || parsed.title;
  }

  // Fallback: count top-level keys
  const keys = Object.keys(parsed);
  if (keys.length > 0 && keys.length <= 6) {
    return keys.join(", ");
  }
  return `${keys.length} fields`;
}

/**
 * Resolve a tool function name (e.g. `compare_food_nutrition`) to the
 * matching icon & color from TOOL_ICON_MAP/TOOL_COLORS. Falls back to
 * `Wrench` icon and the amber accent used for Function Calling.
 */
function resolveToolVisuals(rawName) {
  // Direct match first (e.g. "Web Search")
  if (TOOL_ICON_MAP[rawName]) {
    return { Icon: TOOL_ICON_MAP[rawName], color: TOOL_COLORS[rawName] || "#f59e0b" };
  }
  // All custom function-calling tools fall under "Function Calling"
  return {
    Icon: TOOL_ICON_MAP["Function Calling"] || Wrench,
    color: TOOL_COLORS["Function Calling"] || "#f97316",
  };
}


function ToolCallsBlock({ toolCalls, streamingOutputs }) {
  const [headerCollapsed, setHeaderCollapsed] = useState(false);
  if (!toolCalls || toolCalls.length === 0) return null;

  const hasActiveCalls = toolCalls.some((tc) => tc.status === "calling");
  const doneCount = toolCalls.filter((tc) => tc.status === "done" || tc.status === "error").length;

  const formatName = (raw) => {
    if (raw === "googleSearch") return "Google Search";
    return (raw || "unknown")
      .replace(/^get_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Build header text with active tense awareness
  const headerText = (() => {
    if (toolCalls.length === 1) {
      const name = formatName(toolCalls[0].name);
      if (hasActiveCalls) return `Calling ${name}…`;
      return `Used tool: ${name}`;
    }
    if (hasActiveCalls) {
      const progress = doneCount > 0 ? ` (${doneCount}/${toolCalls.length} done)` : "";
      return `Running ${toolCalls.length} tools${progress}…`;
    }
    return `Used ${toolCalls.length} tools`;
  })();

  return (
    <div className={`${styles.toolCallsBlock}${hasActiveCalls ? ` ${styles.toolCallsStreaming}` : ""}`}>
      {/* ── Header toggle ── */}
      <button
        className={styles.toolCallsToggle}
        onClick={() => setHeaderCollapsed((c) => !c)}
      >
        <Zap size={13} />
        <span>{headerText}</span>
        {headerCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* ── Always-visible tool cards ── */}
      {!headerCollapsed && (
        <div className={styles.toolCallsContent}>
          {toolCalls.map((tc, j) => {
            const name = formatName(tc.name);
            const { Icon, color } = resolveToolVisuals(tc.name);
            const summary = tc.result ? extractResultSummary(tc.result) : null;
            const argEntries = tc.args ? Object.entries(tc.args) : [];
            const isCalling = tc.status === "calling";
            const isError = tc.status === "error";

            return (
              <div key={j} className={styles.toolCallItem}>
                {/* Status indicator */}
                <span className={`${styles.toolCallStatusIcon}${isCalling ? ` ${styles.toolCallStatusCalling}` : ""}${isError ? ` ${styles.toolCallStatusError}` : ""}`}>
                  {isCalling
                    ? <Loader size={12} className={styles.toolCallSpinner} />
                    : isError
                      ? <AlertTriangle size={12} />
                      : <Check size={12} />}
                </span>

                <span className={styles.toolCallIcon} style={{ color }}>
                  <Icon size={13} />
                </span>
                <span className={styles.toolCallName}>{name}</span>

                {/* Arg pills — inline after name */}
                {argEntries.length > 0 && argEntries.map(([k, v]) => (
                  <span key={k} className={styles.toolCallArgPill}>
                    <span className={styles.toolCallArgKey}>{k}</span>
                    <span className={styles.toolCallArgValue}>
                      {typeof v === "string" ? v : JSON.stringify(v)}
                    </span>
                  </span>
                ))}

                {/* Quick result summary */}
                {summary && (
                  <span className={styles.toolCallSummary}>
                    <Check size={10} />
                    <span>{summary}</span>
                  </span>
                )}

                {/* Tool-specific result renderer (registry pattern) */}
                <ToolResultView
                  toolCall={tc}
                  streamingOutput={streamingOutputs?.get(tc.id)}
                />
              </div>
            );
          })}
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
          !m.audio &&
          !m.error
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
        <AudioPlayerRecorderComponent src={src} compact />
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

/* ── Inline edit for messages ────────────────────────────────── */

function EditableMessage({
  content,
  index,
  role,
  onEdit,
  editing,
  onCancelEdit,
}) {
  const [editValue, setEditValue] = useState(content);
  const textareaRef = useRef(null);
  const isAssistant = role === "assistant";

  // Auto-resize textarea to fit content on open
  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 600) + "px";
    }
  }, [editing]);

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
    // Only user messages submit on plain Enter; assistant messages
    // always use Shift+Enter or the Save button (since content is long)
    else if (e.key === "Enter" && !e.shiftKey && !isAssistant) {
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
          ref={textareaRef}
          autoFocus
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            // Auto-resize as content changes
            const el = e.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 600) + "px";
          }}
          onKeyDown={handleKey}
          rows={isAssistant ? 8 : 3}
          style={{
            width: "100%",
            minHeight: isAssistant ? 120 : 60,
            maxHeight: 600,
            padding: "10px 12px",
            fontSize: isAssistant ? 13 : 14,
            lineHeight: 1.55,
            color: "var(--text-primary)",
            background: "var(--bg-secondary)",
            border: "1px solid var(--accent-color)",
            borderRadius: 8,
            resize: "vertical",
            fontFamily: isAssistant ? "var(--font-mono, monospace)" : "inherit",
            boxShadow: "0 0 0 2px var(--accent-glow)",
            tabSize: 2,
          }}
        />
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
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
          {isAssistant && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: "var(--text-muted)",
              }}
            >
              Raw markdown • Esc to cancel
            </span>
          )}
        </div>
      </div>
    );
  }

  // Non-editing: user messages show plain text, assistant uses caller's rendering
  if (!isAssistant) {
    return <div className={styles.text}>{content}</div>;
  }
  return null; // Assistant non-editing rendering is handled by the caller
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
 * @param {Map}      [props.streamingOutputs] - toolCallId → accumulated output string
 */
export default function MessageList({
  messages = [],
  readOnly = false,
  isGenerating = false,
  streamingOutputs,
  headerContent,
  systemPrompt,
  onSystemPromptEdit,

  onDelete,
  onRestore,
  onEdit,
  onRerun,
  onImageClick,
  onDocClick,
}) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [expandedDeletedSet, setExpandedDeletedSet] = useState(new Set());
  const hasSystemPrompt = !!(systemPrompt && systemPrompt.trim());

  // ── Sticky last user message (pinned header) ─────────────
  const [isUserMsgScrolledPast, setIsUserMsgScrolledPast] = useState(false);
  const lastUserMsgRef = useRef(null);
  const lastUserMsgIndexRef = useRef(-1);

  // Find the last user message
  const lastUserMsgIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user" && !messages[i].deleted) return i;
    }
    return -1;
  }, [messages]);

  // IntersectionObserver for scroll-past detection
  useEffect(() => {
    lastUserMsgIndexRef.current = lastUserMsgIndex;
    const node = lastUserMsgRef.current;
    if (!node || lastUserMsgIndex < 0) {
      return;
    }

    // Find the scroll container — walk up to the nearest overflow-y ancestor
    let scrollParent = node.parentElement;
    while (scrollParent) {
      const overflow = getComputedStyle(scrollParent).overflowY;
      if (overflow === "auto" || overflow === "scroll") break;
      scrollParent = scrollParent.parentElement;
    }
    if (!scrollParent) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show sticky when user message is NOT intersecting
        // AND the element is above the viewport (scrolled past)
        const scrolledPast = !entry.isIntersecting &&
          entry.boundingClientRect.bottom < entry.rootBounds.top + 20;
        setIsUserMsgScrolledPast(scrolledPast);
      },
      {
        root: scrollParent,
        threshold: 0,
        rootMargin: "0px",
      },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      setIsUserMsgScrolledPast(false);
    };
  }, [lastUserMsgIndex]);

  // Derive sticky message data from the boolean flag
  const stickyUserMsg = useMemo(() => {
    if (!isUserMsgScrolledPast || lastUserMsgIndex < 0) return null;
    const msg = messages[lastUserMsgIndex];
    if (!msg) return null;
    return {
      content: msg.content,
      images: msg.images,
      index: lastUserMsgIndex,
    };
  }, [isUserMsgScrolledPast, lastUserMsgIndex, messages]);

  const handleStickyClick = useCallback(() => {
    lastUserMsgRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const toggleDeletedExpanded = (index) => {
    setExpandedDeletedSet((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const swapBefore = useMemo(() => {
    const arr = new Array(messages.length).fill(false);
    let lastModel = null;
    let prospectiveSwapIndex = null;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === "user") {
        if (prospectiveSwapIndex === null) {
          prospectiveSwapIndex = i; // The start of the user's turn
        }
      } else if (msg.role === "assistant" && msg.model) {
        if (lastModel && lastModel !== msg.model) {
          // Model changed! Show swap before the user's turn that led to this,
          // or before this assistant message if no user message preceded it.
          const swapIdx = prospectiveSwapIndex !== null ? prospectiveSwapIndex : i;
          arr[swapIdx] = true;
        }
        lastModel = msg.model;
        prospectiveSwapIndex = null;
      }
    }
    return arr;
  }, [messages]);

  // ── Coalesce consecutive deleted messages into groups ──────
  // Each group is keyed by the index of the first deleted message
  // in the run (the "leader"). Non-leader deleted messages are
  // skipped during rendering.
  const deletedGroups = useMemo(() => {
    const map = new Map(); // index → { isLeader, groupIndices }
    let i = 0;
    while (i < messages.length) {
      if (messages[i].deleted) {
        const start = i;
        const indices = [];
        while (i < messages.length && messages[i].deleted) {
          indices.push(i);
          i++;
        }
        // First in run is the leader
        map.set(start, { isLeader: true, groupIndices: indices });
        for (let k = 1; k < indices.length; k++) {
          map.set(indices[k], { isLeader: false });
        }
      } else {
        i++;
      }
    }
    return map;
  }, [messages]);

  // ── Coalesce consecutive assistant messages into groups ────
  // Each group shares a single avatar + header. Only the first
  // message in a run of assistant messages shows the avatar.
  // "isContinuation" means this assistant msg continues the
  // previous assistant msg's visual container.
  // "isLastInGroup" means metadata (tokens, cost) should render.
  const coalesceMeta = useMemo(() => {
    const meta = new Array(messages.length).fill(null);
    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "assistant") continue;
      // Deleted messages always break the coalesce chain —
      // they render as their own standalone block.
      if (messages[i].deleted) {
        meta[i] = { isContinuation: false, isLastInGroup: true };
        continue;
      }
      const prevIsAssistant =
        i > 0 && messages[i - 1].role === "assistant" && !messages[i - 1].deleted;
      const nextIsAssistant =
        i < messages.length - 1 && messages[i + 1].role === "assistant" && !messages[i + 1].deleted;
      meta[i] = {
        isContinuation: prevIsAssistant && !swapBefore[i],
        isLastInGroup: !nextIsAssistant || (i < messages.length - 1 && swapBefore[i + 1]),
      };
    }
    return meta;
  }, [messages, swapBefore]);

  return (
    <div className={styles.messagesList}>
      {/* ── Sticky pinned user message ── */}
      {stickyUserMsg && (
        <div className={styles.stickyUserMsg} onClick={handleStickyClick}>
          <div className={styles.stickyUserMsgInner}>
            <div className={styles.stickyUserMsgAvatar}>
              <User size={12} />
            </div>
            <div className={styles.stickyUserMsgContent}>
              {stickyUserMsg.images && stickyUserMsg.images.length > 0 && (
                <span className={styles.stickyUserMsgBadge}>
                  {stickyUserMsg.images.length} attachment{stickyUserMsg.images.length > 1 ? "s" : ""}
                </span>
              )}
              <span className={styles.stickyUserMsgText}>
                {stickyUserMsg.content
                  ? stickyUserMsg.content.length > 200
                    ? stickyUserMsg.content.slice(0, 200) + "…"
                    : stickyUserMsg.content
                  : "(no text)"}
              </span>
            </div>
            <ChevronDown size={14} className={styles.stickyUserMsgChevron} />
          </div>
        </div>
      )}
      {hasSystemPrompt && (
        <div className={`${styles.message} ${styles.systemNode}`}>
          <div className={styles.avatar}>
            <Terminal size={16} />
          </div>
          <div className={styles.content}>
            <div className={styles.messageHeader}>
              <div className={styles.roleLabel}>System Prompt</div>
              {!readOnly && onSystemPromptEdit && (
                <div className={styles.messageActions}>
                  <IconButtonComponent
                    icon={<Pencil size={14} />}
                    onClick={onSystemPromptEdit}
                    tooltip="Edit system prompt"
                    className={styles.actionBtn}
                  />
                </div>
              )}
            </div>
            <MarkdownContent content={systemPrompt} />
          </div>
        </div>
      )}
      {headerContent}
      {messages.map((msg, i) => {
        const roleClass =
          msg.role === "user"
            ? styles.userNode
            : msg.role === "system"
              ? styles.systemNode
              : styles.aiNode;
        const isStreaming =
          (isGenerating &&
            msg.role === "assistant" &&
            i === messages.length - 1) ||
          (msg.role === "assistant" && msg._liveStreaming === true);
        const coalesce = coalesceMeta[i];

        const showModelChange = swapBefore[i];
        const isFadedSwap = showModelChange && i > 0 && messages[i - 1].deleted && messages[i].deleted;
        const swapDividerClass = `${styles.modelChangeDivider} ${isFadedSwap ? styles.modelChangeDividerFaded : ""}`.trim();

        // If message is a non-leader deleted message, skip rendering the whole 
        // top-level block so we don't leak the model swap outside the group
        const deletedGroupInfo = msg.deleted ? deletedGroups.get(i) : null;
        if (msg.deleted && !deletedGroupInfo?.isLeader) {
          return null;
        }

        return (
          <React.Fragment key={i}>
            {showModelChange && (
              <div className={swapDividerClass}>
                <span className={styles.modelChangeLine} />
                <span className={styles.modelChangeLabel}>
                  <RefreshCw size={11} />
                  Model Swap
                </span>
                <span className={styles.modelChangeLine} />
              </div>
            )}
            {/* ── Deleted message group: coalesced into a single row ── */}
            {msg.deleted && (() => {
              const groupInfo = deletedGroups.get(i);
              // Non-leader deleted messages are rendered inside the leader block
              if (!groupInfo?.isLeader) return null;
              const groupIndices = groupInfo.groupIndices;
              const groupCount = groupIndices.length;
              const isExpanded = expandedDeletedSet.has(i);

              if (!isExpanded) {
                // ── Collapsed: single summary row ──
                return (
                  <div className={styles.deletedRow}>
                    <button
                      className={styles.deletedToggle}
                      onClick={() => toggleDeletedExpanded(i)}
                    >
                      <ChevronRight size={13} />
                      <span className={styles.deletedBadge}>
                        Deleted{groupCount > 1 ? ` (${groupCount})` : ""}
                      </span>
                      {groupCount === 1 && (
                        <>
                          <span className={styles.deletedRoleBadge}>
                            {msg.role === "user" ? "User" : "Model"}
                          </span>
                          {msg.model && (
                            <span className={styles.deletedModelLabel}>{msg.model}</span>
                          )}
                          {msg.timestamp && (
                            <span className={styles.deletedTimestamp}>
                              {formatTimestamp(msg.timestamp)}
                            </span>
                          )}
                          {msg.content && (
                            <span className={styles.deletedPreview}>
                              {msg.content.length > 80
                                ? msg.content.slice(0, 80) + "…"
                                : msg.content}
                            </span>
                          )}
                        </>
                      )}
                      {groupCount > 1 && (
                        <span className={styles.deletedTimestamp}>
                          {formatTimestamp(messages[groupIndices[0]].timestamp)}
                          {" — "}
                          {formatTimestamp(messages[groupIndices[groupCount - 1]].timestamp)}
                        </span>
                      )}
                    </button>
                    {groupCount === 1 && !readOnly && onRestore && (
                      <div className={styles.deletedActions}>
                        <IconButtonComponent
                          icon={<Undo2 size={14} />}
                          onClick={() => onRestore?.(i)}
                          tooltip="Restore message"
                          className={styles.actionBtn}
                        />
                      </div>
                    )}
                  </div>
                );
              }

              // ── Expanded: show all messages in the group ──
              return (
                <div className={styles.deletedExpanded}>
                  <div className={styles.deletedRow}>
                    <button
                      className={styles.deletedToggle}
                      onClick={() => toggleDeletedExpanded(i)}
                    >
                      <ChevronDown size={13} />
                      <span className={styles.deletedBadge}>
                        Deleted{groupCount > 1 ? ` (${groupCount})` : ""}
                      </span>
                    </button>
                  </div>
                  {groupIndices.map((gi) => {
                    const gMsg = messages[gi];
                    const gRoleClass =
                      gMsg.role === "user"
                        ? styles.userNode
                        : gMsg.role === "system"
                          ? styles.systemNode
                          : styles.aiNode;

                    const gShowModelChange = swapBefore[gi];
                    const gIsFadedSwap = gShowModelChange && gi > 0 && messages[gi - 1].deleted && messages[gi].deleted;
                    const gSwapDividerClass = `${styles.modelChangeDivider} ${gIsFadedSwap ? styles.modelChangeDividerFaded : ""}`.trim();
                    const shouldRenderInnerSwap = gShowModelChange && gi !== groupIndices[0];

                    return (
                      <React.Fragment key={gi}>
                        {shouldRenderInnerSwap && (
                          <div className={gSwapDividerClass}>
                            <span className={styles.modelChangeLine} />
                            <span className={styles.modelChangeLabel}>
                              <RefreshCw size={11} />
                              Model Swap
                            </span>
                            <span className={styles.modelChangeLine} />
                          </div>
                        )}
                        <div className={styles.deletedGroupItem}>
                          <div className={styles.deletedGroupItemHeader}>
                            <span className={styles.deletedRoleBadge}>
                              {gMsg.role === "user" ? "User" : "Model"}
                            </span>
                          {gMsg.model && (
                            <span className={styles.deletedModelLabel}>{gMsg.model}</span>
                          )}
                          {gMsg.timestamp && (
                            <span className={styles.deletedTimestamp}>
                              {formatTimestamp(gMsg.timestamp)}
                            </span>
                          )}
                          <div className={styles.deletedActions} style={{ opacity: 1 }}>
                            {!readOnly && onRestore && (
                              <IconButtonComponent
                                icon={<Undo2 size={14} />}
                                onClick={() => onRestore?.(gi)}
                                tooltip="Restore message"
                                className={styles.actionBtn}
                              />
                            )}
                            {gMsg.content && (
                              <CopyButtonComponent
                                text={gMsg.content}
                                tooltip="Copy raw text"
                                className={styles.actionBtn}
                              />
                            )}
                          </div>
                        </div>
                        <div className={styles.deletedMessageBody}>
                          <div className={`${styles.message} ${gRoleClass}`}>
                            <div className={`${styles.avatar} ${styles.deletedAvatar}`}>
                              {gMsg.role === "user" ? <User size={16} /> : gMsg.role === "system" ? "S" : <Bot size={16} />}
                            </div>
                            <div className={styles.content}>
                              {gMsg.thinking && (
                                <ThinkingBlock thinking={gMsg.thinking} isStreaming={false} />
                              )}
                              {gMsg.toolCalls && gMsg.toolCalls.length > 0 && (
                                <ToolCallsBlock toolCalls={gMsg.toolCalls} />
                              )}
                              {gMsg.images && gMsg.images.length > 0 && (
                                <div className={styles.imagePreviewRow}>
                                  {gMsg.images.map((rawUrl, j) => (
                                    <MediaPreview key={j} dataUrl={rawUrl} />
                                  ))}
                                </div>
                              )}
                              {gMsg.content ? (
                                <MarkdownContent content={gMsg.content} />
                              ) : null}
                              {gMsg.role === "assistant" && (gMsg.usage || gMsg.provider) && (
                                <div className={styles.meta}>
                                  <div className={styles.metaRow}>
                                    {gMsg.provider && (
                                      <span className={styles.metaProvider}>
                                        <ProviderLogo provider={gMsg.provider} size={13} />
                                        {PROVIDER_LABELS[gMsg.provider] || gMsg.provider}
                                      </span>
                                    )}
                                    {gMsg.model && <>{" • "}{gMsg.model}</>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })()}
            {/* ── Normal (non-deleted) message ── */}
            {!msg.deleted && (
            <div
              ref={i === lastUserMsgIndex && msg.role === "user" ? lastUserMsgRef : undefined}
              className={`${styles.message} ${roleClass}${coalesce?.isContinuation ? ` ${styles.continuationMessage}` : ""}`}
            >
              {/* Avatar: hidden for continuation messages */}
              {!coalesce?.isContinuation && (
                <div
                  className={`${styles.avatar}${msg.role === "assistant" && isGenerating && i === messages.length - 1 ? ` ${styles.prismAvatar}` : ""}`}
                >
                  {msg.role === "user" ? <User size={16} /> : msg.role === "system" ? "S" : <Bot size={16} />}
                </div>
              )}
              <div className={styles.content}>
                {/* Header: hidden for continuation messages */}
                {!coalesce?.isContinuation && (
                <div className={styles.messageHeader}>
                  <div className={styles.roleLabel}>
                    {msg.role === "user"
                      ? "User"
                      : msg.role === "system"
                        ? "System"
                        : "Model"}
                    {msg.timestamp && (
                      <span className={styles.timestamp}>
                        {formatTimestamp(msg.timestamp)}
                      </span>
                    )}
                  </div>
                  {!readOnly && (
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
                      {msg.role === "assistant" && msg.content && (
                        <IconButtonComponent
                          icon={<Pencil size={14} />}
                          onClick={() =>
                            setEditingIndex(editingIndex === i ? null : i)
                          }
                          disabled={isGenerating}
                          tooltip="Edit response"
                          className={styles.actionBtn}
                        />
                      )}
                      {msg.content && (
                        <CopyButtonComponent
                          text={msg.content}
                          tooltip="Copy raw text"
                          className={styles.actionBtn}
                        />
                      )}
                      <IconButtonComponent
                        icon={<Trash2 size={14} />}
                        onClick={() => onDelete?.(i)}
                        tooltip="Delete message"
                        variant="danger"
                        className={styles.actionBtn}
                      />
                    </div>
                  )}
                  {readOnly && msg.content && (
                    <div className={styles.messageActions}>
                      <CopyButtonComponent
                        text={msg.content}
                        tooltip="Copy raw text"
                        className={styles.actionBtn}
                      />
                    </div>
                  )}
                </div>
                )}

                {/* ── Interleaved content: thinking + tool calls + text ── */}
                {msg.contentSegments && msg.contentSegments.length > 0 ? (
                  (() => {
                    const segs = msg.contentSegments;
                    const hasThinking = segs.some((s) => s.type === "thinking");

                    // Find the boundary between "reasoning" and "answer":
                    // Everything up to and including the last thinking/tools segment is reasoning.
                    // Text segments after that are the final answer.
                    let answerStartIdx = segs.length;
                    for (let k = segs.length - 1; k >= 0; k--) {
                      if (segs[k].type !== "text") {
                        answerStartIdx = k + 1;
                        break;
                      }
                    }

                    const reasoningSegs = segs.slice(0, answerStartIdx);

                    // Find the last text segment index in answerSegs for streaming cursor
                    const lastTextSegIdx = (() => {
                      for (let k = segs.length - 1; k >= 0; k--) {
                        if (segs[k].type === "text") return k;
                      }
                      return -1;
                    })();

                    // Helper: render a segment by type
                    const renderSeg = (seg, si, opts = {}) => {
                      if (seg.type === "thinking") {
                        const fragment = msg.thinkingFragments?.[seg.fragmentIndex]?.trim();
                        if (!fragment) return null;
                        return <MarkdownContent key={`seg-k-${si}`} content={fragment} />;
                      }
                      if (seg.type === "tools" && msg.toolCalls?.length > 0) {
                        const toolIdSet = new Set(seg.toolIds || []);
                        const segmentTools = msg.toolCalls.filter((tc) => toolIdSet.has(tc.id));
                        if (segmentTools.length === 0) return null;
                        return <ToolCallsBlock key={`seg-t-${si}`} toolCalls={segmentTools} streamingOutputs={streamingOutputs} />;
                      }
                      if (seg.type === "text") {
                        const fragmentText = msg.textFragments?.[seg.fragmentIndex]?.trim();
                        const isLastTextSeg = si === lastTextSegIdx;
                        const showCursor = !opts.insideThinking && !opts.suppressCursor;
                        if (fragmentText) {
                          return (
                            <MarkdownContent
                              key={`seg-x-${si}`}
                              content={fragmentText}
                              className={isStreaming && isLastTextSeg && showCursor ? styles.streamingText : ""}
                            >
                              {isLastTextSeg && showCursor && <StreamingCursorComponent active={isStreaming} />}
                            </MarkdownContent>
                          );
                        }
                        if (isStreaming && isLastTextSeg && showCursor) {
                          return <span key={`seg-x-${si}`} className={styles.streamingCursor} />;
                        }
                        return null;
                      }
                      return null;
                    };

                    // Edit mode: show reasoning then editable text
                    if (msg.role === "assistant" && !readOnly && editingIndex === i) {
                      return (
                        <>
                          {hasThinking && reasoningSegs.length > 0 && (
                            <ThinkingBlock isStreaming={false}>
                              {reasoningSegs.map((seg, si) => renderSeg(seg, si, { insideThinking: true }))}
                            </ThinkingBlock>
                          )}
                          {!hasThinking && reasoningSegs.map((seg, si) => renderSeg(seg, si))}
                          <EditableMessage
                            key="seg-edit"
                            content={msg.content}
                            index={i}
                            role="assistant"
                            onEdit={onEdit}
                            editing={true}
                            onCancelEdit={() => setEditingIndex(null)}
                          />
                        </>
                      );
                    }

                    // ── Normal rendering ──
                    // If thinking is present: all reasoning segments (thinking + tools +
                    // intermediate text) are rendered inside a single ThinkingBlock.
                    // Only text segments after the last thinking/tools boundary render
                    // outside as the final answer.
                    if (hasThinking) {
                      // All reasoning segments (thinking + tools + intermediate text)
                      // go into a single ThinkingBlock. Only the final text after the
                      // last thinking/tools segment renders outside as the answer.
                      const thinkingIsStreaming = isStreaming && answerStartIdx >= segs.length;

                      return (
                        <>
                          {reasoningSegs.length > 0 && (
                            <ThinkingBlock isStreaming={thinkingIsStreaming}>
                              {reasoningSegs.map((seg, si) =>
                                renderSeg(seg, si, { insideThinking: true })
                              )}
                            </ThinkingBlock>
                          )}
                          {/* Final answer text segments (after the last thinking/tools segment) */}
                          {segs.slice(answerStartIdx).map((seg, si) => {
                            const origIdx = answerStartIdx + si;
                            const isLastTextSeg = origIdx === lastTextSegIdx;
                            return (
                              <React.Fragment key={`ans-${si}`}>
                                {renderSeg(seg, origIdx, { suppressCursor: !isLastTextSeg })}
                              </React.Fragment>
                            );
                          })}
                          {/* Streaming cursor when answer hasn't started yet */}
                          {isStreaming && answerStartIdx >= segs.length && (
                            <span className={styles.streamingCursor} />
                          )}
                        </>
                      );
                    }

                    // No thinking — render all segments inline (tools interleaved with text)
                    return segs.map((seg, si) => renderSeg(seg, si));
                  })()
                ) : (
                  <>
                    {/* Thinking block (legacy / saved conversations — no segments) */}
                    {msg.thinking && (
                      <ThinkingBlock
                        thinking={msg.thinking}
                        isStreaming={isStreaming && !!msg.thinking && !msg.content}
                      />
                    )}

                    {/* Tool calls (legacy / saved conversations — no segments) */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <ToolCallsBlock toolCalls={msg.toolCalls} streamingOutputs={streamingOutputs} />
                    )}

                    {/* Text content */}
                    {msg.role === "user" && !readOnly ? (
                      <EditableMessage
                        content={msg.content}
                        index={i}
                        role="user"
                        onEdit={onEdit}
                        editing={editingIndex === i}
                        onCancelEdit={() => setEditingIndex(null)}
                      />
                    ) : msg.role === "assistant" && !readOnly && editingIndex === i ? (
                      <EditableMessage
                        content={msg.content}
                        index={i}
                        role="assistant"
                        onEdit={onEdit}
                        editing={true}
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
                  </>
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

                {/* Streaming audio (live session in progress) */}
                {msg.role === "assistant" &&
                  msg._liveStreaming &&
                  !msg.audio && (
                    <div className={styles.audioCard}>
                      <AudioPlayerRecorderComponent streaming compact />
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

                {/* Error block */}
                {msg.error && (
                  <div className={styles.errorBlock}>
                    <AlertTriangle size={14} className={styles.errorIcon} />
                    <span>{msg.error}</span>
                  </div>
                )}

                {/* User metadata */}
                {msg.role === "user" && msg.content && (
                  <div className={styles.meta}>
                    {`${msg.content.trim().split(/\s+/).filter(Boolean).length} words`}
                  </div>
                )}

                {/* Assistant metadata — only on the last message in a coalesced group */}
                {msg.role === "assistant" &&
                  (coalesce?.isLastInGroup !== false) &&
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
                          ? (() => {
                              const cacheRead =
                                msg.usage.cacheReadInputTokens || 0;
                              const cacheWrite =
                                msg.usage.cacheCreationInputTokens || 0;
                              const cached = cacheRead + cacheWrite;
                              const totalIn = getTotalInputTokens(msg.usage);
                              let inLabel;
                              if (cached) {
                                const parts = [];
                                if (msg.usage.inputTokens)
                                  parts.push(
                                    `${msg.usage.inputTokens.toLocaleString()} new`,
                                  );
                                if (cacheRead)
                                  parts.push(
                                    `${cacheRead.toLocaleString()} read`,
                                  );
                                if (cacheWrite)
                                  parts.push(
                                    `${cacheWrite.toLocaleString()} write`,
                                  );
                                inLabel = `${totalIn.toLocaleString()} in (${parts.join(" · ")})`;
                              } else {
                                inLabel = `${msg.usage.inputTokens.toLocaleString()} in`;
                              }
                              return `${msg.voice ? " • " : ""}${inLabel} · ${msg.usage.outputTokens.toLocaleString()} out tokens`;
                            })()
                          : msg.usage?.outputTokens != null
                            ? `${msg.voice ? " • " : ""}${msg.usage.outputTokens.toLocaleString()} tokens`
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
                            ? ` • ${formatCost(msg.estimatedCost)}`
                            : ""}
                      </div>
                    </div>
                  )}
              </div>
            </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
