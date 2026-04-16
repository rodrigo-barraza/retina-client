"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./StreamingCursorComponent.module.css";

/**
 * StreamingCursorComponent — Renders an inline rainbow caret cursor
 * with a rapidly-cycling random "scramble" character to its left.
 *
 * The scramble character rotates through letters, digits, and symbols
 * at ~30 fps, giving a glitchy/matrix-style feel while text streams in.
 *
 * Props:
 *   @param {boolean} active - Whether streaming is in progress
 */

const SCRAMBLE_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷ΔΩπΣφψλαβγ∞∑∏√∂∫≈≠≤≥∈∉∩∪⊂⊃∀∃∇☰☷☶☵☴☳";
const SCRAMBLE_INTERVAL_MS = 35;

export default function StreamingCursorComponent({ active, standalone }) {
  const [char, setChar] = useState("_");
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setChar(
        SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)],
      );
    }, SCRAMBLE_INTERVAL_MS);

    return () => clearInterval(intervalRef.current);
  }, [active]);

  if (!active) return null;

  const cursor = (
    <span className={styles.streamingCursorWrapper} aria-hidden="true">
      <span className={styles.scrambleChar}>{char}</span>
      <span className={styles.caret}>▎</span>
    </span>
  );

  if (standalone) {
    return <div className={styles.standaloneCursor}>{cursor}</div>;
  }

  return cursor;
}
