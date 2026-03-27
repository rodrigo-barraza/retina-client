"use client";

import { useRef, useState, useCallback } from "react";
import { Paperclip, ImageIcon, Mic2, Video } from "lucide-react";
import DrawingCanvas from "./DrawingCanvas";
import AudioPlayerRecorderComponent from "./AudioPlayerRecorderComponent";
import styles from "./AssetInputOptions.module.css";

/**
 * Shared asset input options for empty file input nodes.
 * Shows icon buttons: Upload file, Create drawing, Record audio, Record webcam.
 *
 * Props:
 *   onFile(dataUrl, mimeType) – called when a file/asset is ready
 *   compact – smaller icon buttons for node view (default false = sidebar view)
 */
export default function AssetInputOptions({ onFile, compact = false }) {
  const fileInputRef = useRef(null);
  const [showDrawing, setShowDrawing] = useState(false);
  const [showAudioRec, setShowAudioRec] = useState(false);
  const [showWebcam, setShowWebcam] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onFile?.(reader.result, file.type);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onFile?.(reader.result, file.type);
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // ── Webcam ──
  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      setShowWebcam(true);
      // Assign stream after render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      // Camera permission denied
    }
  }, []);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowWebcam(false);
  }, []);

  const captureWebcam = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    onFile?.(dataUrl, "image/png");
    stopWebcam();
  }, [onFile, stopWebcam]);

  const iconSize = compact ? 14 : 16;

  // ── Webcam fullscreen view ──
  if (showWebcam) {
    return (
      <div
        className={`${styles.container} ${compact ? styles.compact : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={styles.webcamPreview}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={styles.webcamVideo}
          />
          <div className={styles.webcamActions}>
            <button
              type="button"
              className={styles.captureBtn}
              onClick={captureWebcam}
              title="Capture photo"
            />
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={stopWebcam}
              title="Cancel"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Audio recording inline view ──
  if (showAudioRec) {
    return (
      <div
        className={`${styles.container} ${compact ? styles.compact : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={styles.audioRecWrap}>
          <AudioPlayerRecorderComponent
            onRecordingComplete={(dataUrl) => {
              onFile?.(dataUrl, "audio/webm");
              setShowAudioRec(false);
            }}
          />
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setShowAudioRec(false)}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`${styles.container} ${compact ? styles.compact : ""}`}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />

        <div className={styles.optionGrid}>
          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => fileInputRef.current?.click()}
            title="Upload file"
          >
            <Paperclip size={iconSize} />
            {!compact && <span>Upload</span>}
          </button>

          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => setShowDrawing(true)}
            title="Create drawing"
          >
            <ImageIcon size={iconSize} />
            {!compact && <span>Draw</span>}
          </button>

          <button
            type="button"
            className={styles.optionBtn}
            onClick={() => setShowAudioRec(true)}
            title="Record audio"
          >
            <Mic2 size={iconSize} />
            {!compact && <span>Record</span>}
          </button>

          <button
            type="button"
            className={styles.optionBtn}
            onClick={startWebcam}
            title="Webcam capture"
          >
            <Video size={iconSize} />
            {!compact && <span>Webcam</span>}
          </button>
        </div>

        <label
          className={styles.dropZone}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Paperclip size={compact ? 12 : 14} />
          <span>Drop or upload file</span>
          <input
            type="file"
            accept="image/*,audio/*,video/*,.pdf,.txt,.md,.json,.csv"
            className={styles.hiddenInput}
            onChange={handleFileChange}
          />
        </label>
      </div>

      {showDrawing && (
        <DrawingCanvas
          onClose={() => setShowDrawing(false)}
          onSave={(dataUrl) => {
            onFile?.(dataUrl, "image/png");
            setShowDrawing(false);
          }}
        />
      )}
    </>
  );
}
