"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Cpu, HardDrive, Zap, Database, Loader2 } from "lucide-react";
import ModalDialogComponent from "./ModalDialogComponent";
import { SliderComponent, ToggleComponent as ToggleSwitch } from "@rodrigo-barraza/components";
import ProviderLogo from "./ProviderLogos";
import { formatFileSize, formatContextTokens } from "../utils/utilities";
import styles from "./ModelLoadConfigPanel.module.css";

const LS_KEY_PREFIX = "lm-studio-load-config:";

// Architecture params are resolved server-side by Prism (gguf-arch.js).
// This fallback is used only if the API response doesn't include archParams.
const DEFAULT_ARCH_PARAMS = { layers: 32, kvHeads: 8, headDim: 128, attnRatio: 1.0, isKnown: false };

/**
 * Load persisted config for a model key from localStorage.
 */
function loadPersistedConfig(modelKey) {
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}${modelKey}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save config for a model key to localStorage.
 */
function savePersistedConfig(modelKey, config) {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${modelKey}`, JSON.stringify(config));
  } catch {
    // ignore quota errors
  }
}

/**
 * ModelLoadConfigPanel — LM Studio-style model load configuration modal.
 *
 * Shows context length slider, GPU offload slider (estimation),
 * flash attention toggle, and estimated VRAM/RAM usage bar.
 *
 * @param {object} model — The raw model object from LM Studio API
 * @param {Function} onLoad — (modelKey, options) => Promise<void>
 * @param {Function} onClose — Close the modal
 * @param {boolean} [loading] — Whether a load is in progress
 */
export default function ModelLoadConfigPanel({ model, onLoad, onClose, service, loading = false }) {
  const modelKey = model.key || model.name;
  const maxContext = model.max_context_length || model.contextLength || 131072;
  const sizeBytes = model.size_bytes || 0;
  const architecture = model.architecture || null;
  const params = model.params_string || model.params || null;
  const quantization =
    (typeof model.quantization === "object" ? model.quantization?.name : model.quantization) || null;

  // Architecture params come from the Prism backend (gguf-arch.js)
  const archParams = model.archParams || DEFAULT_ARCH_PARAMS;
  const totalLayers = archParams.layers;

  // Load persisted or default values
  const persisted = useMemo(() => loadPersistedConfig(modelKey), [modelKey]);

  const [contextLength, setContextLength] = useState(
    () => persisted?.contextLength || Math.min(4096, maxContext),
  );
  const [gpuLayers, setGpuLayers] = useState(
    () => persisted?.gpuLayers ?? totalLayers,
  );
  const [flashAttention, setFlashAttention] = useState(
    () => persisted?.flashAttention ?? true,
  );
  const [offloadKvCache, setOffloadKvCache] = useState(
    () => persisted?.offloadKvCache ?? true,
  );
  const [rememberSettings, setRememberSettings] = useState(
    () => !!persisted,
  );

  // -- Memory Estimation (from backend) --------------------
  const [memory, setMemory] = useState({ gpuGiB: 0, totalGiB: 0 });
  const [maxMemory, setMaxMemory] = useState({ gpuGiB: 0, totalGiB: 0 });
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!service?.estimateLmStudioMemory) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const [current, max] = await Promise.all([
          service.estimateLmStudioMemory(modelKey, {
            contextLength,
            gpuLayers,
            flashAttention,
            offloadKvCache,
          }),
          service.estimateLmStudioMemory(modelKey, {
            contextLength: maxContext,
            gpuLayers: totalLayers,
            flashAttention,
            offloadKvCache: true,
          }),
        ]);
        setMemory(current);
        setMaxMemory(max);
      } catch {
        // Silently ignore — estimation is non-critical
      }
    }, 100);

    return () => clearTimeout(debounceRef.current);
  }, [service, modelKey, contextLength, gpuLayers, flashAttention, offloadKvCache, maxContext, totalLayers]);

  const barMax = Math.max(maxMemory.totalGiB, memory.totalGiB, 1);



  const handleLoad = useCallback(() => {
    if (rememberSettings) {
      savePersistedConfig(modelKey, {
        contextLength,
        gpuLayers,
        flashAttention,
        offloadKvCache,
      });
    } else {
      // Clear any persisted config
      try {
        localStorage.removeItem(`${LS_KEY_PREFIX}${modelKey}`);
      } catch {
        // ignore
      }
    }

    onLoad(modelKey, {
      contextLength,
      flashAttention,
      offloadKvCache,
    });
  }, [modelKey, contextLength, gpuLayers, flashAttention, offloadKvCache, rememberSettings, onLoad]);

  // Keyboard shortcut: Ctrl+Enter to load
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleLoad();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [handleLoad]);

  const handleContextInput = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setContextLength(Math.max(2048, Math.min(val, maxContext)));
    }
  };

  const handleGpuInput = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val)) {
      setGpuLayers(Math.max(0, Math.min(val, totalLayers)));
    }
  };

  const formatGiB = (gib) => {
    if (gib < 0.01) return "0 GB";
    if (gib < 10) return `${gib.toFixed(2)} GB`;
    return `${gib.toFixed(1)} GB`;
  };

  return (
    <ModalDialogComponent
      title={
        <>
          <ProviderLogo provider="lm-studio" size={20} />
          {model.display_name || modelKey}
          {architecture && (
            <span className={styles.archBadge}>{architecture}</span>
          )}
        </>
      }
      onClose={onClose}
      size="md"
      footer={
        <>
          <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className={styles.loadBtn} onClick={handleLoad} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                Loading…
              </>
            ) : (
              <>
                Load Model
                <span className={styles.loadBtnShortcut}>Ctrl + Enter</span>
              </>
            )}
          </button>
        </>
      }
    >
      {/* Model info badges */}
      <div className={styles.modelInfo}>
        {sizeBytes > 0 && (
          <span className={styles.infoBadge}>
            <HardDrive size={11} />
            {formatFileSize(sizeBytes)}
          </span>
        )}
        {params && (
          <span className={styles.infoBadge}>
            <Cpu size={11} />
            {params}
          </span>
        )}
        {quantization && (
          <span className={styles.infoBadge}>
            {quantization}
          </span>
        )}
        {maxContext > 0 && (
          <span className={styles.infoBadge}>
            Max {formatContextTokens(maxContext)}
          </span>
        )}
      </div>

      {/* Estimated Memory Usage */}
      <div className={styles.memorySection}>
        <div className={styles.memoryHeader}>
          <span className={styles.memoryLabel}>
            Estimated Memory Usage
            <span className={styles.betaBadge}>Beta</span>
          </span>
          <div className={styles.memoryValues}>
            <span className={styles.memoryValue}>
              <span className={styles.memoryValueLabel}>GPU</span>
              <span className={styles.memoryValueNum}>
                {formatGiB(memory.gpuGiB)}
              </span>
            </span>
            <span className={styles.memoryValue}>
              <span className={styles.memoryValueLabel}>Total</span>
              <span className={styles.memoryValueNum}>
                {formatGiB(memory.totalGiB)}
              </span>
            </span>
          </div>
        </div>
        <div className={styles.memoryBarWrap}>
          <div
            className={styles.memoryBarTotal}
            style={{ width: `${Math.min((memory.totalGiB / barMax) * 100, 100)}%` }}
          />
          <div
            className={styles.memoryBarGpu}
            style={{ width: `${Math.min((memory.gpuGiB / barMax) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Context Length Slider */}
      <div className={styles.sliderSection}>
        <div className={styles.sliderHeader}>
          <span className={styles.sliderLabel}>
            <Database size={14} />
            Context Length
          </span>
          <input
            type="number"
            className={styles.sliderInput}
            value={contextLength}
            onChange={handleContextInput}
            min={2048}
            max={maxContext}
            step={1024}
          />
        </div>
        <span className={styles.sliderHint}>
          Model supports up to {maxContext.toLocaleString()} tokens
        </span>
        <SliderComponent
          min={2048}
          max={maxContext}
          step={1024}
          value={contextLength}
          onChange={(v) => setContextLength(v)}
        />
      </div>

      {/* GPU Offload Slider */}
      <div className={styles.sliderSection}>
        <div className={styles.sliderHeader}>
          <span className={styles.sliderLabel}>
            <Cpu size={14} />
            GPU Offload
            <span className={styles.betaBadge} style={{ marginLeft: 2 }}>
              Est.
            </span>
          </span>
          <input
            type="number"
            className={styles.sliderInput}
            value={gpuLayers}
            onChange={handleGpuInput}
            min={0}
            max={totalLayers}
          />
        </div>
        <span className={styles.sliderHint}>
          {gpuLayers} of {archParams.isKnown ? '' : '~'}{totalLayers} layers on GPU
        </span>
        <SliderComponent
          min={0}
          max={totalLayers}
          step={1}
          value={gpuLayers}
          onChange={(v) => setGpuLayers(v)}
        />
      </div>

      <div className={styles.divider} />

      {/* Toggle options */}
      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>
          <Zap size={14} />
          Flash Attention
          <span className={styles.toggleHint}>— saves memory, improves speed</span>
        </span>
        <ToggleSwitch
          checked={flashAttention}
          onChange={setFlashAttention}
          size="mini"
        />
      </div>

      <div className={styles.toggleRow}>
        <span className={styles.toggleLabel}>
          <Database size={14} />
          KV Cache → GPU
          <span className={styles.toggleHint}>— faster but uses more VRAM</span>
        </span>
        <ToggleSwitch
          checked={offloadKvCache}
          onChange={setOffloadKvCache}
          size="mini"
        />
      </div>

      <div className={styles.divider} />

      {/* Remember settings */}
      <label className={styles.rememberRow}>
        <input
          type="checkbox"
          className={styles.rememberCheckbox}
          checked={rememberSettings}
          onChange={(e) => setRememberSettings(e.target.checked)}
        />
        <span className={styles.rememberLabel}>
          Remember settings for <strong>{modelKey}</strong>
        </span>
      </label>
    </ModalDialogComponent>
  );
}
