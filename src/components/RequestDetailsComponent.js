"use client";

import { useEffect, useRef } from "react";

import styles from "./RequestDetailsComponent.module.css";
import { CloseButtonComponent } from "@rodrigo-barraza/components";

/**
 * RequestDetailsComponent — a slide-in drawer for displaying request detail views.
 * Uses click-outside detection to close when clicking anywhere outside the drawer.
 *
 * @param {boolean} open — whether the drawer is visible
 * @param {Function} onClose — callback to close the drawer
 * @param {string} title — drawer header title
 * @param {Array<{title: string, items: Array<{label: string, value: React.ReactNode}>}> sections
 * @param {React.ReactNode} [children] — additional content rendered after sections
 */
export default function RequestDetailsComponent({
  open,
  onClose,
  title = "Detail",
  sections = [],
  children,
}) {
  const drawerRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    const handleMouseDown = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={drawerRef} className={styles.drawer}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <CloseButtonComponent onClick={onClose} />
      </div>
      <div className={styles.body}>
        {sections.map((section, si) => (
          <div key={si} className={styles.section}>
            <div className={styles.sectionTitle}>{section.title}</div>
            <div className={styles.grid}>
              {section.items.map((item, ii) => (
                <div key={ii} className={styles.item}>
                  <span className={styles.label}>{item.label}</span>
                  <span
                    className={`${styles.value} ${item.mono ? styles.mono : ""}`}
                  >
                    {item.value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {children}
      </div>
    </div>
  );
}
