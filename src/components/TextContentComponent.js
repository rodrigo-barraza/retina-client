"use client";

import { useState, useCallback, useRef } from "react";
import { Code, BookOpen } from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import styles from "./TextContentComponent.module.css";

/**
 * Reusable text content block with Raw / Preview toggle.
 *
 * @param {string}   label       – Section heading (e.g. "Text Content")
 * @param {string}   value       – The text to display / edit
 * @param {function} [onChange]  – If provided, the textarea is editable
 * @param {boolean}  [readOnly]  – Force read-only even when onChange is provided
 * @param {string}   [placeholder] – Textarea placeholder
 * @param {string}   [className] – Extra wrapper class
 */
export default function TextContentComponent({
  label,
  value = "",
  onChange,
  readOnly = false,
  placeholder = "Enter text...",
  className,
}) {
  const [preview, setPreview] = useState(false);
  const textareaRef = useRef(null);

  const isEditable = !!onChange && !readOnly;

  const autoResize = useCallback((el) => {
    if (!el) return;
    textareaRef.current = el;
    if (isEditable) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [isEditable]);

  return (
    <div className={`${styles.wrapper} ${className || ""}`}>
      <div className={styles.headerRow}>
        <label className={styles.label}>{label}</label>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${!preview ? styles.tabActive : ""}`}
            onClick={() => setPreview(false)}
          >
            <Code size={10} />
            Raw
          </button>
          <button
            className={`${styles.tab} ${preview ? styles.tabActive : ""}`}
            onClick={() => setPreview(true)}
          >
            <BookOpen size={10} />
            Preview
          </button>
        </div>
      </div>

      {preview ? (
        <div className={styles.markdownPreview}>
          {value ? (
            <MarkdownContent content={value} />
          ) : (
            <span className={styles.previewEmpty}>Nothing to preview</span>
          )}
        </div>
      ) : (
        <textarea
          ref={autoResize}
          className={`${styles.textarea} ${!isEditable ? styles.textareaReadOnly : ""}`}
          value={value}
          onChange={isEditable ? (e) => {
            onChange(e.target.value);
            autoResize(e.target);
          } : undefined}
          readOnly={!isEditable}
          placeholder={isEditable ? placeholder : undefined}
        />
      )}
    </div>
  );
}
