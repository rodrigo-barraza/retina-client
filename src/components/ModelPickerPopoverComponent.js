"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Loader2 } from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import ModelsTableComponent from "./ModelsTableComponent";
import CloseButtonComponent from "./CloseButtonComponent";
import styles from "./ModelPickerPopoverComponent.module.css";

/**
 * ModelPickerPopoverComponent
 *
 * A single trigger pill that opens a rich, LM-Studio-style model picker
 * popover with a hoisted search field and a full ModelsTableComponent
 * (search, modality/tool/provider filter chips, sortable table).
 *
 * Supports two modes:
 *
 * **Single-select** (default) — clicking a model row calls
 * `onSelectModel(provider, name)` and closes the popover. The trigger
 * pill shows the currently-selected model name.
 *
 * **Multi-select** (`multiSelect={true}`) — clicking a row toggles
 * selection via `onSelectModel(rawModel)` and the popover stays open.
 * The trigger pill shows a count label ("Select Models" / "3 Models
 * Selected").  Provide `selectedKeys` (a Set of "provider:model" strings)
 * and optionally `renderActions` to render custom per-row controls.
 *
 * Props:
 *   config          — Prism config object with textToText, textToImage, etc.
 *   settings        — { provider, model, ... } (single-select mode)
 *   onSelectModel   — (provider, name) => void           (single-select)
 *                    — (rawModel)      => void           (multi-select)
 *   onLmStudioSelect — (rawModel) => void (lm-studio intercept)
 *   loadingProgress — number | null (0–1 progress bar on trigger)
 *   favorites       — string[] of "provider:model" keys
 *   onToggleFavorite — (key) => void
 *   readOnly        — boolean — disables trigger interaction
 *   multiSelect     — boolean — enables multi-select mode
 *   selectedKeys    — Set<string> of "provider:model" keys (multi-select)
 *   renderActions   — (rawModel) => ReactNode — per-row actions
 *   triggerLabel    — string — override the trigger label text
 *   triggerIcon     — ReactNode — override the trigger icon
 */
export default function ModelPickerPopoverComponent({
  config,
  settings,
  onSelectModel,
  onLmStudioSelect,
  loadingProgress,
  favorites = [],
  onToggleFavorite,
  readOnly = false,
  multiSelect = false,
  selectedKeys,
  renderActions,
  triggerLabel: triggerLabelProp,
  triggerIcon: triggerIconProp,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [popoverStyle, setPopoverStyle] = useState({});
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const triggerRef = useRef(null);
  const bodyRef = useRef(null);
  const searchRef = useRef(null);
  const highlightedRowRef = useCallback((el) => {
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  // ── Build unified model list across all sections ─────────────────────
  const allModels = buildAllModels(config);

  // ── Filter by search ─────────────────────────────────────────────────
  const filteredModels = search.trim()
    ? allModels.filter((m) => {
        const q = search.toLowerCase();
        return (
          (m.name || "").toLowerCase().includes(q) ||
          (m.label || "").toLowerCase().includes(q) ||
          (PROVIDER_LABELS[m.provider] || m.provider || "")
            .toLowerCase()
            .includes(q) ||
          (m.organization || "").toLowerCase().includes(q) ||
          (m.params || "").toLowerCase().includes(q)
        );
      })
    : allModels;

  // ── Position the popover below the trigger, centered on the ChatArea ─
  const positionPopover = useCallback(() => {
    if (!triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const popoverW = Math.min(1600, viewportW - 32);

    // Center horizontally relative to the ChatArea (the main content section)
    const chatArea = document.querySelector("[data-chat-area]");
    let left;
    if (chatArea) {
      const areaRect = chatArea.getBoundingClientRect();
      left = areaRect.left + areaRect.width / 2 - popoverW / 2;
    } else {
      left = viewportW / 2 - popoverW / 2;
    }

    // Clamp to viewport edges
    if (left < 16) left = 16;
    if (left + popoverW > viewportW - 16) left = viewportW - 16 - popoverW;

    setPopoverStyle({
      top: triggerRect.bottom + 8,
      left,
      width: popoverW,
    });
  }, []);

  const openPopover = useCallback(() => {
    positionPopover();
    setOpen(true);
    setSearch("");
  }, [positionPopover]);

  // Focus search when popover opens
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 60);
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        !e.target.closest("[data-model-picker-popover]") &&
        !e.target.closest("[data-model-picker-trigger]") &&
        !e.target.closest("[data-column-filter]")
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Handle model selection ─────────────────────────────────────────────
  const handleSelect = useCallback(
    (rawModel) => {
      if (multiSelect) {
        // Multi-select: toggle selection, keep popover open
        onSelectModel(rawModel);
        return;
      }

      // Single-select: select and close
      const provider = rawModel.provider || "lm-studio";
      const name = rawModel.name || rawModel.key;

      // Intercept lm-studio models → show config panel first
      if (provider === "lm-studio" && onLmStudioSelect) {
        onLmStudioSelect(rawModel);
        setOpen(false);
        setHighlightIndex(-1);
        return;
      }

      onSelectModel(provider, name);
      setOpen(false);
      setHighlightIndex(-1);
    },
    [onSelectModel, onLmStudioSelect, multiSelect],
  );

  // Keyboard navigation (Escape / ArrowUp / ArrowDown / Enter)
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }

      // Arrow navigation
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((prev) => {
          const max = filteredModels.length - 1;
          if (max < 0) return -1;
          return prev < max ? prev + 1 : 0;
        });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((prev) => {
          const max = filteredModels.length - 1;
          if (max < 0) return -1;
          return prev > 0 ? prev - 1 : max;
        });
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (highlightIndex >= 0 && highlightIndex < filteredModels.length) {
          handleSelect(filteredModels[highlightIndex]);
        }
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, highlightIndex, filteredModels, handleSelect]);

  // Re-position on scroll / resize / ChatArea resize (sidebar transitions)
  useEffect(() => {
    if (!open) return;
    const reposition = () => positionPopover();
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, {
      passive: true,
      capture: true,
    });

    // Watch the ChatArea for size changes (sidebar open/close transitions)
    const chatArea = document.querySelector("[data-chat-area]");
    let ro;
    if (chatArea) {
      ro = new ResizeObserver(reposition);
      ro.observe(chatArea);
    }

    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, { capture: true });
      ro?.disconnect();
    };
  }, [open, positionPopover]);


  // ── Trigger display ───────────────────────────────────────────────────
  const currentModel = allModels.find(
    (m) => m.provider === settings?.provider && m.name === settings?.model,
  );
  const LOCAL_PROVIDERS = new Set(["lm-studio", "ollama", "vllm", "llama-cpp"]);

  // Build display label
  const displayLabel = (() => {
    // Custom trigger label override
    if (triggerLabelProp) return triggerLabelProp;

    // Multi-select: show selection count
    if (multiSelect) {
      const count = selectedKeys?.size || 0;
      if (count === 0) return "Select Models";
      if (count === 1) return "1 Model Selected";
      return `${count} Models Selected`;
    }

    // Single-select: show current model name
    const rawLabel = currentModel?.label || settings?.model || "Select Model";
    const provider = currentModel?.provider || settings?.provider;
    if (!provider || LOCAL_PROVIDERS.has(provider)) return rawLabel;
    const providerName = PROVIDER_LABELS[provider] || provider;
    return `${providerName}'s ${rawLabel}`;
  })();

  // Trigger icon
  const triggerIconElement = (() => {
    if (triggerIconProp) return triggerIconProp;
    if (multiSelect) return null;
    if (loadingProgress != null) {
      return <Loader2 size={14} className={styles.triggerSpinner} />;
    }
    return settings?.provider ? (
      <ProviderLogo provider={settings.provider} size={16} />
    ) : null;
  })();

  // Active row key(s) for highlighting selected models in the table
  const activeRowKey = (() => {
    if (!multiSelect) {
      return currentModel
        ? `${currentModel.provider}-${currentModel.name}`
        : undefined;
    }
    // Multi-select: no single active row styling (handled by renderActions)
    return undefined;
  })();

  return (
    <>
      {/* ── Trigger pill ─────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""} ${readOnly ? styles.triggerReadOnly : ""} ${loadingProgress != null ? styles.triggerLoading : ""} ${multiSelect && selectedKeys?.size > 0 ? styles.triggerActive : ""}`}
        onClick={
          readOnly ? undefined : open ? () => setOpen(false) : openPopover
        }
        data-model-picker-trigger
        title={readOnly ? displayLabel : multiSelect ? "Select models" : "Switch model"}
        style={readOnly ? { cursor: "default" } : undefined}
      >
        <span className={styles.triggerContent}>
          {triggerIconElement}
          <span className={styles.triggerLabel}>
            {loadingProgress != null
              ? `Loading… ${Math.round((loadingProgress ?? 0) * 100)}%`
              : displayLabel}
          </span>
        </span>
        {!readOnly && loadingProgress == null && (
          <ChevronDown
            size={14}
            className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
          />
        )}
        {/* Progress bar overlay */}
        {loadingProgress != null && (
          <span
            className={styles.triggerProgressBar}
            style={{ transform: `scaleX(${loadingProgress ?? 0})` }}
          />
        )}
      </button>

      {/* ── Popover portal ─────────────────────────────────────────── */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className={styles.popover}
            style={popoverStyle}
            data-model-picker-popover
          >
            {/* Header: search + close */}
            <div className={styles.popoverHeader}>
              <Search size={16} className={styles.searchIcon} />
              <input
                ref={searchRef}
                className={styles.searchInput}
                placeholder="Type to filter models…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightIndex(-1);
                }}
              />
              {search && (
                <button
                  className={styles.searchClear}
                  onClick={() => setSearch("")}
                  title="Clear"
                >
                  <X size={14} />
                </button>
              )}
              <CloseButtonComponent onClick={() => setOpen(false)} size={16} />
            </div>

            {/* Body: ModelsTableComponent with search disabled (hoisted above) */}
            <div ref={bodyRef} className={styles.popoverBody}>
              <ModelsTableComponent
                models={filteredModels}
                onSelect={handleSelect}
                showSearch={false}
                showProviderFilter
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
                renderActions={renderActions}
                activeRowKey={activeRowKey}
                highlightedRowKey={
                  highlightIndex >= 0 && filteredModels[highlightIndex]
                    ? `${filteredModels[highlightIndex].provider}-${filteredModels[highlightIndex].name}`
                    : undefined
                }
                highlightedRowRef={highlightedRowRef}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────

function buildAllModels(config) {
  if (!config) return [];
  const seen = new Map();

  const sections = [
    { key: "textToText", suffix: "" },
    { key: "textToImage", suffix: " (Image)" },
    { key: "audioToText", suffix: " (Transcribe)" },
    { key: "textToSpeech", suffix: " (TTS)" },
  ];

  for (const { key, suffix } of sections) {
    const modelsMap = config[key]?.models || {};
    for (const [provider, models] of Object.entries(modelsMap)) {
      for (const m of models) {
        const id = `${provider}:${m.name}`;
        if (!seen.has(id)) {
          seen.set(id, {
            ...m,
            provider,
            label:
              m.label + (suffix && !m.label.endsWith(suffix) ? suffix : ""),
            organization: inferOrganization(m.name, provider),
          });
        }
      }
    }
  }

  return [...seen.values()];
}

const ORG_MAP = [
  [/^qwen/i, "Alibaba / Qwen"],
  [/^granite/i, "IBM"],
  [/^llama/i, "Meta"],
  [/^mistral|mixtral/i, "Mistral AI"],
  [/^phi[-\d]/i, "Microsoft"],
  [/^gemma/i, "Google"],
  [/^nemotron/i, "NVIDIA"],
  [/^falcon/i, "TII"],
  [/^deepseek/i, "DeepSeek"],
  [/^codellama/i, "Meta"],
  [/^vicuna|alpaca|openchat|hermes/i, "Community"],
  [/^smollm/i, "HuggingFace"],
  [/^bartowski/i, "Bartowski"],
];

const PROVIDER_ORG_MAP = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google DeepMind",
  cohere: "Cohere",
  groq: "Groq",
  mistral: "Mistral AI",
  xai: "xAI",
  "together-ai": "Together AI",
  "lm-studio": null,
  ollama: null,
  "llama-cpp": null,
};

function inferOrganization(modelName, provider) {
  if (PROVIDER_ORG_MAP[provider]) return PROVIDER_ORG_MAP[provider];
  for (const [pattern, org] of ORG_MAP) {
    if (pattern.test(modelName)) return org;
  }
  return null;
}
