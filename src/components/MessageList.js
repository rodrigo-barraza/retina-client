"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Copy,
  Check,
  FileAudio,
  FileVideo,
  FileText,
  Trash2,
  Pencil,
  RotateCcw,
  X as XIcon,
  RefreshCw,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import styles from "./MessageList.module.css";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { DateTime } from "luxon";
import { PrismService } from "../services/PrismService";

/* ── Helpers ─────────────────────────────────────────────────── */

function getMimeCategory(ref) {
  if (!ref) return "file";
  if (ref.startsWith("minio://")) {
    const ext = ref.split(".").pop()?.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
    if (["wav", "mp3", "webm", "ogg"].includes(ext)) return "audio";
    if (["mp4", "mov", "avi"].includes(ext)) return "video";
    if (ext === "pdf") return "pdf";
    if (ext === "txt") return "text";
    return "file";
  }
  const match = ref.match(/^data:([\w-]+)\//);
  if (!match) return "file";
  const type = match[1];
  if (type === "application") return "pdf";
  if (type === "text") return "text";
  return type;
}

/* ── Sub-components ──────────────────────────────────────────── */

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }, [text]);

  return (
    <button className={styles.actionBtn} onClick={handleCopy} title="Copy raw text">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

function FencedCodeBlock({ language, children }) {
  const codeString = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let displayLabel = language;
  let syntaxLang = language;
  if (language.startsWith("exec-")) {
    syntaxLang = language.replace("exec-", "");
    displayLabel = `${syntaxLang.toUpperCase()} — EXECUTABLE CODE`;
  } else if (language.startsWith("execresult-")) {
    syntaxLang = language.replace("execresult-", "") || "text";
    displayLabel = `${(syntaxLang || "PYTHON").toUpperCase()} — CODE EXECUTION RESULT`;
  }

  return (
    <div className={styles.codeBlockWrapper}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeBlockLang}>{displayLabel}</span>
        <button className={styles.codeBlockCopy} onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={syntaxLang}
        PreTag="div"
        customStyle={{ margin: 0, borderRadius: "0 0 8px 8px", fontSize: "13px" }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

function CodeBlock({ children, className, ...rest }) {
  const match = /language-(\w+)/.exec(className || "");
  if (!match) {
    return (
      <code className={`${styles.inlineCode} ${className || ""}`} {...rest}>
        {children}
      </code>
    );
  }
  return <FencedCodeBlock language={match[1]}>{children}</FencedCodeBlock>;
}

function MarkdownContent({ content }) {
  if (!content) return null;
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
      {content}
    </ReactMarkdown>
  );
}

function ThinkingBlock({ thinking }) {
  const [collapsed, setCollapsed] = useState(true);
  if (!thinking) return null;

  return (
    <div className={styles.thinkingBlock}>
      <button className={styles.thinkingToggle} onClick={() => setCollapsed((c) => !c)}>
        <Brain size={14} />
        <span>Thoughts</span>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
      </button>
      {!collapsed && (
        <div className={styles.thinkingContent}>
          <MarkdownContent content={thinking} />
        </div>
      )}
    </div>
  );
}

function MediaPreview({ dataUrl: rawUrl, onClick }) {
  const src = PrismService.getFileUrl(rawUrl);
  const cat = getMimeCategory(rawUrl);

  if (cat === "image") {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={src} alt="Attached" className={styles.messageImage} onClick={onClick} />
    );
  }
  if (cat === "audio") {
    return (
      <div className={styles.mediaCard}>
        <FileAudio size={20} className={styles.mediaCardIcon} />
        <audio controls src={src} preload="metadata" />
      </div>
    );
  }
  if (cat === "video") {
    return (
      <div className={styles.mediaCard}>
        <video controls src={src} preload="metadata" className={styles.videoPreview} />
      </div>
    );
  }
  if (cat === "pdf" || cat === "text") {
    return (
      <div className={styles.mediaCard} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
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

function EditableUserMessage({ content, index, onEdit, editing, onCancelEdit }) {
  const [editValue, setEditValue] = useState(content);

  const cancel = () => { onCancelEdit(); setEditValue(content); };
  const save = () => {
    if (editValue.trim() && editValue !== content) onEdit(index, editValue);
    onCancelEdit();
  };
  const handleKey = (e) => {
    if (e.key === "Escape") cancel();
    else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); }
  };

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <textarea
          autoFocus
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKey}
          rows={3}
          style={{
            width: "100%", minHeight: 60, maxHeight: 300, padding: "10px 12px",
            fontSize: 14, lineHeight: 1.55, color: "var(--text-primary)",
            background: "var(--bg-secondary)", border: "1px solid var(--accent-color)",
            borderRadius: 8, resize: "vertical", fontFamily: "inherit",
            boxShadow: "0 0 0 2px var(--accent-glow)",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={save} style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6,
            cursor: "pointer", background: "var(--accent-color)", color: "#fff",
          }}>
            <Check size={14} /> Save
          </button>
          <button onClick={cancel} style={{
            display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: "pointer",
            background: "var(--bg-tertiary)", color: "var(--text-secondary)",
            border: "1px solid var(--border-color)",
          }}>
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
          if (prevAssistantModel && nextAssistantModel && prevAssistantModel !== nextAssistantModel) {
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
            <div className={`${styles.message} ${roleClass}`}>
            <div className={styles.avatar}>
              {msg.role === "user" ? "U" : msg.role === "system" ? "S" : "AI"}
            </div>
            <div className={styles.content}>
              {/* Header: role + timestamp + actions */}
              <div className={styles.messageHeader}>
                <div className={styles.roleLabel}>
                  {msg.role === "user" ? "You" : msg.role === "system" ? "System" : "Model"}
                  {msg.timestamp && (
                    <span className={styles.timestamp}>
                      {DateTime.fromISO(msg.timestamp).toLocaleString(DateTime.DATETIME_SHORT_WITH_SECONDS)}
                    </span>
                  )}
                </div>
                {!readOnly && (
                  <div className={styles.messageActions}>
                    {msg.role === "user" && (
                      <>
                        <button
                          className={styles.actionBtn}
                          onClick={() => setEditingIndex(editingIndex === i ? null : i)}
                          disabled={isGenerating}
                          title="Edit message"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className={styles.actionBtn}
                          onClick={() => onRerun?.(i)}
                          disabled={isGenerating}
                          title="Rerun this turn"
                        >
                          <RotateCcw size={14} />
                        </button>
                      </>
                    )}
                    {msg.content && <CopyButton text={msg.content} />}
                    <button
                      className={`${styles.actionBtn} ${styles.dangerBtn}`}
                      onClick={() => onDelete?.(i)}
                      title="Delete message"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                {readOnly && msg.content && (
                  <div className={styles.messageActions}>
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>

              {/* Thinking block */}
              {msg.thinking && <ThinkingBlock thinking={msg.thinking} />}

              {/* Images / media */}
              {msg.images && msg.images.length > 0 && (
                <div className={styles.imagePreviewRow}>
                  {msg.images.map((rawUrl, j) => {
                    const resolvedUrl = PrismService.getFileUrl(rawUrl);
                    const cat = getMimeCategory(rawUrl);
                    let clickHandler;
                    if (cat === "image") clickHandler = () => onImageClick?.(resolvedUrl);
                    else if (cat === "pdf" || cat === "text") clickHandler = () => onDocClick?.(resolvedUrl);
                    return <MediaPreview key={j} dataUrl={rawUrl} onClick={clickHandler} />;
                  })}
                </div>
              )}

              {/* Audio (TTS response) */}
              {msg.audio && (
                <div className={styles.audioPlayer}>
                  <audio controls autoPlay={!readOnly} src={PrismService.getFileUrl(msg.audio)} />
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
              ) : (
                msg.content && (
                  <div className={styles.text}>
                    <MarkdownContent content={msg.content} />
                  </div>
                )
              )}

              {/* Assistant metadata */}
              {msg.role === "assistant" && (msg.usage || msg.audio || msg.provider) && (
                <div className={styles.meta}>
                  {msg.provider && (
                    <span className={styles.metaProvider}>
                      <ProviderLogo provider={msg.provider} size={13} />
                      {PROVIDER_LABELS[msg.provider] || msg.provider}
                    </span>
                  )}
                  {msg.model && <>{" • "}{msg.model}</>}
                  {msg.voice ? ` • 🔊 ${msg.voice}` : ""}
                  {msg.usage?.inputTokens != null || msg.usage?.outputTokens != null
                    ? ` • ${(msg.usage.inputTokens || 0) + (msg.usage.outputTokens || 0)} tokens`
                    : ""}
                  {msg.usage?.characters != null ? ` • ${msg.usage.characters} chars` : ""}
                  {msg.content ? ` • ${msg.content.trim().split(/\s+/).filter(Boolean).length} words` : ""}
                  {msg.totalTime != null ? ` • ${msg.totalTime.toFixed(1)}s` : ""}
                  {msg.tokensPerSec ? ` • ${msg.tokensPerSec} tok/s` : ""}
                  {msg.provider === "lm-studio"
                    ? " • $0"
                    : msg.estimatedCost
                      ? ` • $${msg.estimatedCost.toFixed(5)}`
                      : ""}
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
