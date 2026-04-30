"use client";

import { useMemo } from "react";
import { ModalComponent } from "@rodrigo-barraza/components";
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

  return (
    <ModalComponent
      title={isPdf ? "PDF Document" : "Text Document"}
      onClose={onClose}
      variant="dark"
      size="lg"
      className={styles.viewer}
    >
      {isPdf ? (
        <iframe
          src={dataUrl}
          className={styles.pdfFrame}
          title="PDF Viewer"
        />
      ) : (
        <pre className={styles.textContent}>{content}</pre>
      )}
    </ModalComponent>
  );
}
