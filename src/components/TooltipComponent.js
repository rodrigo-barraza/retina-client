"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import styles from "./TooltipComponent.module.css";

/**
 * TooltipComponent — a reusable pop-up bubble that appears on click.
 *
 * Props:
 *   label      — text to display inside the tooltip bubble
 *   position   — "top" | "bottom" | "left" | "right" (default: "top")
 *   children   — the trigger element(s) to wrap
 *   className  — optional extra class on the wrapper
 */
export default function TooltipComponent({
  label,
  position = "top",
  children,
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);

  const show = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1600);
  }, []);

  /* Dismiss when clicking outside */
  useEffect(() => {
    if (!visible) return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        clearTimeout(timerRef.current);
        setVisible(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [visible]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!label) return children;

  return (
    <span
      ref={wrapperRef}
      className={`${styles.wrapper} ${className}`}
      onClick={show}
    >
      {children}
      <span
        className={`${styles.bubble} ${styles[position]} ${visible ? styles.visible : ""}`}
        aria-hidden={!visible}
      >
        {label}
      </span>
    </span>
  );
}
