"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./SelectDropdown.module.css";

/**
 * Custom dropdown component that supports rendering arbitrary content
 * (icons, logos, etc.) in each option.
 *
 *  options: [{ value, label, icon?, disabled? }]
 */
export default function SelectDropdown({
  value,
  options = [],
  onChange,
  placeholder = "Select...",
  icon = null,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  const handleSelect = useCallback(
    (opt) => {
      if (opt.disabled) return;
      onChange(opt.value);
      setOpen(false);
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className={styles.dropdown} ref={containerRef}>
      {/* Hidden sizer — forces width to widest option */}
      <div className={styles.sizer} aria-hidden="true">
        {options.map((opt) => (
          <span key={opt.value} className={styles.sizerItem}>
            {icon && <span className={styles.triggerIcon}>{icon}</span>}
            {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
            <span>{opt.label}</span>
          </span>
        ))}
      </div>
      <button
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={styles.triggerContent}>
          {icon && <span className={styles.triggerIcon}>{icon}</span>}
          <span className={styles.triggerLabel}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown
          size={14}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
      </button>

      {open && (
        <div className={styles.menu}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.option} ${opt.value === value ? styles.optionSelected : ""} ${opt.disabled ? styles.optionDisabled : ""}`}
              onClick={() => handleSelect(opt)}
              disabled={opt.disabled}
            >
              {opt.icon && (
                <span className={styles.optionIcon}>{opt.icon}</span>
              )}
              <span className={styles.optionLabel}>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
