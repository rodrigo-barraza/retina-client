"use client";

import { Send, CornerDownLeft, Loader2, Trash2 } from "lucide-react";
import styles from "./ChatArea.module.css";
import { useEffect, useRef, useState } from "react";

export default function ChatArea({ messages, isGenerating, onSend, onDelete }) {
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSend(input);
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messagesList}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <h3>Welcome to Retina</h3>
            <p>Select a provider and model, then type a message to start.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`${styles.message} ${msg.role === "user" ? styles.userNode : styles.aiNode}`}
          >
            <div className={styles.avatar}>
              {msg.role === "user" ? "U" : "AI"}
            </div>
            <div className={styles.content}>
              <div className={styles.messageHeader}>
                <div className={styles.roleLabel}>
                  {msg.role === "user" ? "You" : "Model"}
                </div>
                <button
                  className={styles.deleteMsgBtn}
                  onClick={() => onDelete(i)}
                  title="Delete message"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className={styles.text}>{msg.content}</div>
              {msg.usage && (
                <div className={styles.meta}>
                  {msg.provider} • {msg.model} • {msg.usage.totalTokens} tokens
                  {msg.estimatedCost
                    ? ` • $${msg.estimatedCost.toFixed(5)}`
                    : ""}
                </div>
              )}
            </div>
          </div>
        ))}

        {isGenerating && (
          <div className={`${styles.message} ${styles.aiNode}`}>
            <div className={styles.avatar}>
              <Loader2 size={16} className={styles.spin} />
            </div>
            <div className={styles.content}>Thinking...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className={styles.inputWrapper}>
        <form onSubmit={handleSubmit} className={styles.inputBox}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
          />
          <button type="submit" disabled={!input.trim() || isGenerating}>
            {isGenerating ? (
              <Loader2 size={18} className={styles.spin} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        <div className={styles.hint}>
          Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd>{" "}
          for new line
        </div>
      </div>
    </div>
  );
}
