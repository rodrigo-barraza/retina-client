"use client";

import { useEffect, useMemo } from "react";
import { X, FileText } from "lucide-react";
import styles from "./DocumentViewer.module.css";

function decodeDataUrl(dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return { mimeType: "unknown", text: "" };
  const mimeType = match[1];
  const base64 = match[2];
  try {
    const text = atob(base64);
    return { mimeType, text };
  } catch {
    return { mimeType, text: "" };
  }
}

export default function DocumentViewer({ dataUrl, onClose }) {
  const { mimeType } = decodeDataUrl(dataUrl);
  const isPdf = mimeType === "application/pdf";
  const content = useMemo(
    () => (!isPdf ? decodeDataUrl(dataUrl).text : null),
    [dataUrl, isPdf],
  );

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.viewer} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <FileText size={18} />
            <span>{isPdf ? "PDF Document" : "Text Document"}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className={styles.body}>
          {isPdf ? (
            <iframe
              src={dataUrl}
              className={styles.pdfFrame}
              title="PDF Viewer"
            />
          ) : (
            <pre className={styles.textContent}>{content}</pre>
          )}
        </div>
      </div>
    </div>
  );
}
