"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mic2,
  Volume2,
  VolumeX,
  Square,
  Play,
  Pause,
  Download,
  X,
  Radio,
} from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import RainbowCanvasComponent from "./RainbowCanvasComponent";
import styles from "./AudioPlayerRecorderComponent.module.css";

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const BAR_WIDTH = 1.5;
const BAR_GAP = 1;

/* ── Draw waveform bars on a canvas ── */
function drawBars(canvas, peaks, progress, playedColor, unplayedColor) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const totalBars = Math.floor(w / (BAR_WIDTH + BAR_GAP));
  const mid = h / 2;

  for (let i = 0; i < totalBars; i++) {
    const peakIdx = Math.floor((i / totalBars) * peaks.length);
    const amp = peaks[peakIdx] ?? 0;
    const barH = Math.max(2, amp * (h * 0.8));

    ctx.fillStyle = i / totalBars <= progress ? playedColor : unplayedColor;
    ctx.fillRect(i * (BAR_WIDTH + BAR_GAP), mid - barH / 2, BAR_WIDTH, barH);
  }
}

/* ── Decode audio src into peaks + true duration ── */
async function decodePeaks(src, numPeaks = 200) {
  try {
    const resp = await fetch(src);
    const buffer = await resp.arrayBuffer();
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await audioCtx.decodeAudioData(buffer);
    audioCtx.close();

    const trueDuration = decoded.duration;
    const raw = decoded.getChannelData(0);
    const blockSize = Math.floor(raw.length / numPeaks);
    const peaks = [];
    for (let i = 0; i < numPeaks; i++) {
      let sum = 0;
      for (let j = 0; j < blockSize; j++) {
        sum += Math.abs(raw[i * blockSize + j]);
      }
      peaks.push(sum / blockSize);
    }
    const max = Math.max(...peaks, 0.01);
    return { peaks: peaks.map((p) => p / max), duration: trueDuration };
  } catch {
    return { peaks: new Array(numPeaks).fill(0.15), duration: null };
  }
}

/**
 * Dual-mode audio component:
 * - Playback: pass `src` → custom waveform player
 * - Recorder: pass `onRecordingComplete` → mic button / recording UI
 */
export default function AudioPlayerRecorderComponent({
  src,
  onRecordingComplete,
  onRemove,
  compact = false,
  square = false,
  streaming = false,
}) {
  // ─── Recorder state ───
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recTimerRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const recCanvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const recPeaksRef = useRef([]);

  // ─── Player state ───
  const audioRef = useRef(null);
  const playerCanvasRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [peaks, setPeaks] = useState(null);
  const playAnimRef = useRef(null);
  const prevSrcRef = useRef(src);

  // ── Reset player state when src changes (prevents stale audio across conversations) ──
  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      // Fully reset player state
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setPeaks(null);
      // Reset the HTMLAudioElement to prevent zombie paused state
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
        // Force reload when src changes to clear internal media state
        audio.load();
      }
    }
  }, [src]);

  // ── Cleanup on unmount — stop any playing audio ──
  useEffect(() => {
    const audio = audioRef.current;
    const animRef = playAnimRef;
    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // ── Decode audio for playback waveform + true duration ──
  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    decodePeaks(src).then(({ peaks: p, duration: d }) => {
      if (cancelled) return;
      setPeaks(p);
      // Use decoded duration as source of truth (WebM metadata often reports Infinity)
      if (d != null && Number.isFinite(d) && d > 0) setDuration(d);
    });
    return () => {
      cancelled = true;
    };
  }, [src]);

  // ── Draw / redraw player waveform ──
  const redrawPlayer = useCallback(() => {
    const canvas = playerCanvasRef.current;
    if (!canvas || !peaks) return;
    const progress = duration > 0 ? currentTime / duration : 0;
    drawBars(canvas, peaks, progress, "#888888", "#333333");
  }, [peaks, currentTime, duration]);

  useEffect(() => {
    redrawPlayer();
  }, [redrawPlayer]);

  // ── Smooth playback animation ──
  useEffect(() => {
    if (!isPlaying) {
      if (playAnimRef.current) cancelAnimationFrame(playAnimRef.current);
      return;
    }
    const tick = () => {
      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
      playAnimRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (playAnimRef.current) cancelAnimationFrame(playAnimRef.current);
    };
  }, [isPlaying]);

  // ── Recorder: waveform ──
  const stopWaveform = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const drawLiveWaveform = useCallback(() => {
    const canvas = recCanvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const maxBars = Math.floor(canvas.width / (BAR_WIDTH + BAR_GAP));
    let frameCount = 0;

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      // Only sample a new peak every ~4 frames (~15 peaks/sec at 60fps)
      frameCount++;
      if (frameCount % 4 === 0) {
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / bufferLength);
        // Amplify heavily and add a small noise floor
        const peak = Math.min(1, Math.max(0.05, rms * 8));

        recPeaksRef.current.push(peak);
        if (recPeaksRef.current.length > maxBars) {
          recPeaksRef.current = recPeaksRef.current.slice(-maxBars);
        }
      }

      // Redraw every frame for smoothness
      const ctx = canvas.getContext("2d");
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const curPeaks = recPeaksRef.current;
      const mid = h / 2;
      const startX = w - curPeaks.length * (BAR_WIDTH + BAR_GAP);
      for (let i = 0; i < curPeaks.length; i++) {
        const amp = curPeaks[i];
        const barH = Math.max(2, amp * (h * 0.85));
        ctx.fillStyle = "#ef4444";
        ctx.fillRect(
          startX + i * (BAR_WIDTH + BAR_GAP),
          mid - barH / 2,
          BAR_WIDTH,
          barH,
        );
      }
    };
    draw();
  }, []);

  useEffect(() => {
    if (isRecording && analyserRef.current) drawLiveWaveform();
    return () => {
      if (!isRecording) stopWaveform();
    };
  }, [isRecording, drawLiveWaveform, stopWaveform]);

  useEffect(() => {
    if (isRecording) {
      recTimerRef.current = setInterval(() => {
        setRecSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(recTimerRef.current);
    }
    return () => clearInterval(recTimerRef.current);
  }, [isRecording]);

  const startRecording = async () => {
    try {
      setRecSeconds(0);
      recPeaksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;

      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = (ev) => {
          onRecordingComplete?.(ev.target.result);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      // Microphone permission denied or unavailable
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    stopWaveform();
  };

  // ── Player helpers ──
  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const handleCanvasSeek = (e) => {
    const canvas = playerCanvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    audio.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setMuted(val === 0);
    if (audioRef.current) {
      audioRef.current.volume = val;
      audioRef.current.muted = val === 0;
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (audioRef.current) audioRef.current.muted = next;
  };

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = "audio.webm";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // ───────────────────────────────────────────
  // MODE: Streaming (live audio indicator)
  // ───────────────────────────────────────────
  if (streaming && !src) {
    return (
      <div
        className={`${styles.audioThumb} ${styles.audioStreaming} ${compact ? styles.audioCompact : ""}`}
      >
        <div className={styles.streamingCanvasWrap}>
          <RainbowCanvasComponent turbo className={styles.streamingCanvas} />
        </div>
        <div className={styles.streamingOverlay}>
          <div className={styles.streamingIcon}>
            <Radio size={14} />
          </div>
          <div className={styles.streamingBars}>
            {Array.from({ length: 24 }).map((_, i) => (
              <span
                key={i}
                className={styles.streamingBar}
                style={{ animationDelay: `${(i * 0.07).toFixed(2)}s` }}
              />
            ))}
          </div>
          <span className={styles.streamingLabel}>Playing audio…</span>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────
  // MODE: Playback
  // ───────────────────────────────────────────
  if (src) {
    if (square) {
      return (
        <div
          className={styles.audioSquare}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onLoadedMetadata={(e) => {
              if (Number.isFinite(e.target.duration))
                setDuration(e.target.duration);
            }}
            onDurationChange={(e) => {
              if (Number.isFinite(e.target.duration))
                setDuration(e.target.duration);
            }}
            onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            hidden
          />

          <div className={styles.squareWaveWrap} onClick={handleCanvasSeek}>
            <canvas
              ref={playerCanvasRef}
              className={styles.squareWaveCanvas}
              width={200}
              height={100}
            />
          </div>

          <div className={styles.squareControls}>
            <button
              type="button"
              className={styles.playBtn}
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause size={10} /> : <Play size={10} />}
            </button>
            <span className={styles.timer}>
              {formatTime(currentTime)}/{formatTime(duration)}
            </span>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={toggleMute}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          </div>
        </div>
      );
    }
    return (
      <div
        className={`${styles.audioThumb} ${compact ? styles.audioCompact : ""}`}
      >
        <audio
          ref={audioRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.target.duration))
              setDuration(e.target.duration);
          }}
          onDurationChange={(e) => {
            if (Number.isFinite(e.target.duration))
              setDuration(e.target.duration);
          }}
          onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          hidden
        />

        <button
          type="button"
          className={styles.playBtn}
          onClick={togglePlayback}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={11} /> : <Play size={11} />}
        </button>

        <div className={styles.waveformWrap} onClick={handleCanvasSeek}>
          <canvas
            ref={playerCanvasRef}
            className={styles.waveformCanvas}
            width={300}
            height={28}
          />
        </div>

        <span className={styles.timer}>
          {formatTime(currentTime)}/{formatTime(duration)}
        </span>

        <button
          type="button"
          className={styles.iconBtn}
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
          title="Volume"
        />

        <button
          type="button"
          className={styles.iconBtn}
          onClick={handleDownload}
          title="Download"
        >
          <Download size={14} />
        </button>

        {onRemove && (
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onRemove}
            title="Remove"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  // ───────────────────────────────────────────
  // MODE: Recording (active)
  // ───────────────────────────────────────────
  if (isRecording) {
    return (
      <div className={`${styles.audioThumb} ${styles.audioRecording}`}>
        <button
          type="button"
          className={styles.stopBtn}
          onClick={stopRecording}
          title="Stop recording"
        >
          <Square size={10} />
        </button>

        <div className={styles.waveformWrap}>
          <canvas
            ref={recCanvasRef}
            className={styles.waveformCanvas}
            width={300}
            height={28}
          />
        </div>

        <span className={styles.recTimer}>{formatTime(recSeconds)}</span>

        <Volume2 size={14} className={styles.fadedIcon} />
        <div className={styles.fadedSlider} />
        <Download size={14} className={styles.fadedIcon} />
        <X size={14} className={styles.fadedIcon} />
      </div>
    );
  }

  // ───────────────────────────────────────────
  // MODE: Idle (mic button)
  // ───────────────────────────────────────────
  return (
    <TooltipComponent label="Record audio" position="top" trigger="hover">
      <button
        type="button"
        className={styles.micBtn}
        onClick={startRecording}
        aria-label="Record Audio"
      >
        <Mic2 size={18} />
      </button>
    </TooltipComponent>
  );
}
