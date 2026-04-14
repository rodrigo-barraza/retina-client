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
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef(null);
  const timerRef = useRef(null);
  const showTimerRef = useRef(null);
  const unmountTimerRef = useRef(null);

  const [resolvedPosition, setResolvedPosition] = useState(position);

  /** Calculate fixed position based on wrapper rect + desired position,
   *  flipping to the opposite side when there isn't enough viewport space. */
  const updateCoords = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const GAP = 8;
    const TOOLTIP_HEIGHT_EST = 32; // approximate tooltip height for flip check
    let top, left;
    let resolved = position;

    switch (position) {
      case "top":
        // Flip to bottom if not enough room above
        if (rect.top - GAP - TOOLTIP_HEIGHT_EST < 0) {
          resolved = "bottom";
          top = rect.bottom + GAP;
        } else {
          top = rect.top - GAP;
        }
        left = rect.left + rect.width / 2;
        break;
      case "bottom":
        // Flip to top if not enough room below
        if (rect.bottom + GAP + TOOLTIP_HEIGHT_EST > window.innerHeight) {
          resolved = "top";
          top = rect.top - GAP;
        } else {
          top = rect.bottom + GAP;
        }
        left = rect.left + rect.width / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2;
        if (rect.left - GAP < 100) {
          resolved = "right";
          left = rect.right + GAP;
        } else {
          left = rect.left - GAP;
        }
        break;
      case "right":
        top = rect.top + rect.height / 2;
        if (rect.right + GAP + 100 > window.innerWidth) {
          resolved = "left";
          left = rect.left - GAP;
        } else {
          left = rect.right + GAP;
        }
        break;
      default:
        top = rect.top - GAP;
        left = rect.left + rect.width / 2;
        break;
    }

    setResolvedPosition(resolved);
    setCoords({ top, left });
  }, [position]);

  const showTooltip = useCallback(() => {
    clearTimeout(unmountTimerRef.current);
    clearTimeout(showTimerRef.current);
    updateCoords();
    setMounted(true);
    showTimerRef.current = setTimeout(() => {
      setVisible(true);
    }, 10);
  }, [updateCoords]);

  const hideTooltip = useCallback(() => {
    clearTimeout(showTimerRef.current);
    setVisible(false);
    unmountTimerRef.current = setTimeout(() => {
      setMounted(false);
    }, 200); // duration matches CSS transition
  }, []);

  // ── Click trigger ──
  const show = useCallback(() => {
    if (trigger !== "click") return;
    clearTimeout(timerRef.current);
    showTooltip();
    timerRef.current = setTimeout(() => {
      hideTooltip();
    }, 1600);
  }, [trigger, showTooltip, hideTooltip]);

  // ── Hover trigger ──
  const handleMouseEnter = useCallback(() => {
    if (trigger !== "hover") return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      showTooltip();
    }, delay);
  }, [trigger, delay, showTooltip]);

  const handleMouseLeave = useCallback(() => {
    if (trigger !== "hover") return;
    clearTimeout(timerRef.current);
    hideTooltip();
  }, [trigger, hideTooltip]);

  /* Dismiss when clicking outside (click trigger) */
  useEffect(() => {
    if (!visible || trigger !== "click") return;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        clearTimeout(timerRef.current);
        hideTooltip();
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () =>
      document.removeEventListener("pointerdown", handleClickOutside);
  }, [visible, trigger, hideTooltip]);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(showTimerRef.current);
      clearTimeout(unmountTimerRef.current);
    };
  }, []);

  if (!label) return children;

  const bubble = mounted
    ? createPortal(
        <span
          className={`${styles.bubble} ${styles[resolvedPosition]} ${visible ? styles.visible : ""}`}
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
