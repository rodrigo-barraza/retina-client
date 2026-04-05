import MessageList from "./MessageList";
import styles from "./ChatPreviewComponent.module.css";

/**
 * ChatPreviewComponent — Reusable container for rendering chat message
 * previews (with MessageList) or static prompt blocks (system + user).
 *
 * Usage A: Chat message preview (wraps MessageList)
 *   <ChatPreviewComponent messages={displayMessages} readOnly />
 *
 * Usage B: Prompt blocks (system prompt + user prompt)
 *   <ChatPreviewComponent systemPrompt="..." userPrompt="..." />
 */
export default function ChatPreviewComponent({
  // MessageList mode
  messages,
  readOnly = true,
  // Prompt block mode (when no messages array)
  systemPrompt,
  userPrompt,
  // Optional max-height override
  maxHeight,
  // Optional extra className
  className,
}) {
  // ── MessageList mode ──
  if (messages) {
    return (
      <div
        className={`${styles.chatPreview}${className ? ` ${className}` : ""}`}
        style={maxHeight ? { maxHeight } : undefined}
      >
        <MessageList
          messages={messages}
          readOnly={readOnly}
          systemPrompt={systemPrompt}
        />
      </div>
    );
  }

  // ── Prompt block mode ──
  const hasSystem = systemPrompt?.trim();
  const hasUser = userPrompt?.trim();

  if (!hasSystem && !hasUser) return null;

  return (
    <div className={`${styles.promptPreview}${className ? ` ${className}` : ""}`}>
      {hasSystem && (
        <div className={`${styles.promptBlock} ${styles.promptBlockSystem}`}>
          <span className={`${styles.promptLabel} ${styles.promptLabelSystem}`}>
            System Prompt
          </span>
          <span className={styles.promptContent}>{systemPrompt}</span>
        </div>
      )}
      {hasUser && (
        <div className={`${styles.promptBlock} ${styles.promptBlockUser}`}>
          <span className={`${styles.promptLabel} ${styles.promptLabelUser}`}>
            User Prompt
          </span>
          <span className={styles.promptContent}>{userPrompt}</span>
        </div>
      )}
    </div>
  );
}
