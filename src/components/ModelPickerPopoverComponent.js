"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X } from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import ModelGrid from "./ModelGrid";
import styles from "./ModelPickerPopoverComponent.module.css";

/**
 * ModelPickerPopoverComponent
 *
 * A single trigger pill in the header that opens a rich, LM-Studio-style
 * model picker popover with a hoisted search field and a full ModelGrid
 * (search, modality/tool/provider filter chips, sortable table).
 *
 * Props:
 *   config          — Prism config object with textToText, textToImage, etc.
 *   settings        — { provider, model, ... }
 *   onSelectModel   — (provider, modelName) => void
 *   favorites       — string[] of "provider:model" keys
 *   onToggleFavorite — (key) => void
 */
export default function ModelPickerPopoverComponent({
  config,
  settings,
  onSelectModel,
  favorites = [],
  onToggleFavorite,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [popoverStyle, setPopoverStyle] = useState({});
  const triggerRef = useRef(null);
  const searchRef = useRef(null);

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
    const popoverW = Math.min(860, viewportW - 32);

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
        !e.target.closest("[data-model-picker-trigger]")
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

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

  // ── Current selection display ─────────────────────────────────────────
  const currentModel = allModels.find(
    (m) => m.provider === settings?.provider && m.name === settings?.model,
  );
  const displayLabel = currentModel?.label || settings?.model || "Select Model";

  // ── Handle model selection ─────────────────────────────────────────────
  const handleSelect = useCallback(
    (rawModel) => {
      const provider = rawModel.provider || "lm-studio";
      const name = rawModel.name || rawModel.key;
      onSelectModel(provider, name);
      setOpen(false);
    },
    [onSelectModel],
  );

  return (
    <>
      {/* ── Trigger pill ─────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={open ? () => setOpen(false) : openPopover}
        data-model-picker-trigger
        title="Switch model"
      >
        <span className={styles.triggerContent}>
          {settings?.provider && (
            <ProviderLogo provider={settings.provider} size={16} />
          )}
          <span className={styles.triggerLabel}>{displayLabel}</span>
        </span>
        <ChevronDown
          size={14}
          className={`${styles.chevron} ${open ? styles.chevronOpen : ""}`}
        />
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
                onChange={(e) => setSearch(e.target.value)}
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
              <button
                className={styles.closeBtn}
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body: ModelGrid with search disabled (hoisted above) */}
            <div className={styles.popoverBody}>
              <ModelGrid
                models={filteredModels}
                onSelect={handleSelect}
                showSearch={false}
                showProviderFilter
                favorites={favorites}
                onToggleFavorite={onToggleFavorite}
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
};

function inferOrganization(modelName, provider) {
  if (PROVIDER_ORG_MAP[provider]) return PROVIDER_ORG_MAP[provider];
  for (const [pattern, org] of ORG_MAP) {
    if (pattern.test(modelName)) return org;
  }
  return null;
}
