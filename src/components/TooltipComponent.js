"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./TooltipComponent.module.css";

/**
 * TooltipComponent — a reusable pop-up bubble rendered via portal.
 *
 * Uses createPortal to render the bubble at document.body level,
 * completely escaping any parent overflow / stacking-context clipping.
 *
 * Props:
 *   label      — text to display inside the tooltip bubble
 *   position   — "top" | "bottom" | "left" | "right" (default: "top")
 *   trigger    — "hover" | "click" (default: "hover")
 *   delay      — delay in ms before showing on hover (default: 300)
 *   children   — the trigger element(s) to wrap
 *   className  — optional extra class on the wrapper
 */
export default function TooltipComponent({
  label,
  position = "top",
  trigger = "hover",
  delay = 300,
  children,
  className = "",
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);

  /** Calculate fixed position based on wrapper rect + desired position */
  const updateCoords = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const GAP = 8;
    let top, left;

    switch (position) {
      case "bottom":
        top = rect.bottom + GAP;
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        left = rect.left - GAP;
        break;
      case "right":
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        break;
      case "top":
      default:
        top = rect.top - GAP;
        left = rect.left + rect.width / 2;
        break;
    }

    setCoords({ top, left });
  }, [position]);

  // ── Click trigger ──
  const show = useCallback(() => {
    if (trigger !== "click") return;
    clearTimeout(timerRef.current);
    updateCoords();
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 1600);
  }, [trigger, updateCoords]);

  // ── Hover trigger ──
  const handleMouseEnter = useCallback(() => {
    if (trigger !== "hover") return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateCoords();
      setVisible(true);
    }, delay);
  }, [trigger, delay, updateCoords]);

  const handleMouseLeave = useCallback(() => {
    if (trigger !== "hover") return;
    clearTimeout(timerRef.current);
    setVisible(false);
  }, [trigger]);

  /* Dismiss when clicking outside (click trigger) */
  useEffect(() => {
    if (!visible || trigger !== "click") return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        clearTimeout(timerRef.current);
        setVisible(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, [visible, trigger]);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  if (!label) return children;

  const bubble = visible
    ? createPortal(
        <span
          className={`${styles.bubble} ${styles[position]} ${styles.visible}`}
          style={{ top: coords.top, left: coords.left }}
        >
          {label}
        </span>,
        document.body,
      )
    : null;

  return (
    <span
      ref={wrapperRef}
      className={`${styles.wrapper} ${trigger === "hover" ? styles.hoverTrigger : ""} ${className}`}
      onClick={trigger === "click" ? show : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {bubble}
    </span>
  );
}
