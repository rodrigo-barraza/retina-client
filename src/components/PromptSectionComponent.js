"use client";

import styles from "./PromptSectionComponent.module.css";

/**
 * PromptSectionComponent — A labeled textarea section with icon header.
 *
 * Encapsulates the repeated pattern of icon + label + optional badge + textarea
 * used for system prompts, personas, and other multi-line text inputs.
 *
 * @param {React.ReactNode} icon        — Lucide icon or element for the header
 * @param {string}          label       — Header label text
 * @param {string}          [badge]     — Optional badge text (e.g. "Optional")
 * @param {string}          value       — Textarea value
 * @param {Function}        onChange     — (newValue) => void
 * @param {string}          [placeholder] — Textarea placeholder
 * @param {number}          [rows=2]    — Textarea rows
 * @param {string}          [className] — Additional class on the wrapper
 */
export default function PromptSectionComponent({
  icon,
  label,
  badge,
  value,
  onChange,
  placeholder,
  rows = 2,
  className,
}) {
  return (
    <div className={`${styles.section} ${className || ""}`}>
      <div className={styles.header}>
        {icon}
        <span>{label}</span>
        {badge && <span className={styles.badge}>{badge}</span>}
      </div>
      <textarea
        className={styles.textarea}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );
}
