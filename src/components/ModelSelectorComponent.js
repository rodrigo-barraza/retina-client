"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Search, X } from "lucide-react";
import { PROVIDER_LABELS } from "./ProviderLogos";
import ModelsTableComponent from "./ModelsTableComponent";
import PrismService from "../services/PrismService";
import CloseButtonComponent from "./CloseButtonComponent";
import styles from "./ModelSelectorComponent.module.css";

/**
 * Flatten all text-to-text conversation models from the Prism config
 * into a flat array tagged with their provider.
 */
function flattenConversationModels(config) {
  if (!config) return [];
  const providers = config.textToText?.models || {};
  const results = [];
  for (const [provider, models] of Object.entries(providers)) {
    for (const m of models) {
      if (m.listed === false) continue;
      if (m.outputTypes && !m.outputTypes.includes("text")) continue;
      results.push({ ...m, provider });
    }
  }
  return results;
}

/**
 * ModelSelectorComponent
 *
 * A reusable inline model selection panel inspired by the
 * ModelPickerPopoverComponent's popoverBody. Provides a contained
 * search bar, filter chips (via ModelsTableComponent), and multi-select
 * or single-select callbacks.
 *
 * This is the "body" of the model picker popover — without the trigger
 * pill or portal — making it embeddable directly into any page layout.
 *
 * Props:
 *   models           — Pre-fetched model array. When provided, the
 *                       component skips its own config fetch.
 *   selectedKeys     — Set<string> of "provider:model" keys (multi-select)
 *   onSelect         — (rawModel) => void — called when a model row is clicked
 *   renderActions    — (rawModel) => ReactNode — custom per-row actions
 *   favorites        — string[] of "provider:model" favorite keys
 *   onToggleFavorite — (key) => void
 *   onClose          — () => void — optional close handler (renders ✕ button)
 *   maxHeight        — number — max height for the scrollable body
 *   placeholder      — string — search placeholder text
 */
export default function ModelSelectorComponent({
  models: modelsProp,
  selectedKeys,
  onSelect,
  renderActions,
  favorites = [],
  onToggleFavorite,
  onClose,
  maxHeight,
  placeholder = "Search models…",
}) {
  const [search, setSearch] = useState("");
  const [allModels, setAllModels] = useState(modelsProp || []);
  const [loading, setLoading] = useState(!modelsProp);
  const searchRef = useRef(null);

  // ── Auto-fetch models if none provided ──────────────────────
  useEffect(() => {
    if (modelsProp) {
      setAllModels(modelsProp);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const config = await PrismService.getConfig();
        const cloud = flattenConversationModels(config);
        if (!cancelled) setAllModels(cloud);

        if (config?.localProviders?.length > 0) {
          PrismService.getLocalConfig()
            .then(({ models: localModels }) => {
              const merged = PrismService.mergeLocalModels(config, localModels);
              if (!cancelled) setAllModels(flattenConversationModels(merged));
            })
            .catch(() => {});
        }
      } catch (err) {
        console.error("ModelSelectorComponent: failed to load models", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modelsProp]);

  // Focus search on mount
  useEffect(() => {
    setTimeout(() => searchRef.current?.focus(), 80);
  }, []);

  // ── Filter by search ────────────────────────────────────────
  const filteredModels = useMemo(() => {
    if (!search.trim()) return allModels;
    const q = search.toLowerCase();
    return allModels.filter((m) =>
      (m.name || "").toLowerCase().includes(q) ||
      (m.label || "").toLowerCase().includes(q) ||
      (PROVIDER_LABELS[m.provider] || m.provider || "")
        .toLowerCase()
        .includes(q) ||
      (m.params || "").toLowerCase().includes(q)
    );
  }, [allModels, search]);

  // ── Keyboard: Escape closes ─────────────────────────────────
  useEffect(() => {
    if (!onClose) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading models…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* ── Header: search + close ─────────────────────────── */}
      <div className={styles.header}>
        <Search size={15} className={styles.searchIcon} />
        <input
          ref={searchRef}
          className={styles.searchInput}
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            className={styles.searchClear}
            onClick={() => setSearch("")}
            title="Clear"
          >
            <X size={13} />
          </button>
        )}
        {onClose && (
          <CloseButtonComponent onClick={onClose} size={15} />
        )}
      </div>

      {/* ── Body: ModelsTableComponent ─────────────────────── */}
      <div className={styles.body}>
        <ModelsTableComponent
          models={filteredModels}
          onSelect={onSelect}
          showSearch={false}
          showProviderFilter
          favorites={favorites}
          onToggleFavorite={onToggleFavorite}
          renderActions={renderActions}
          maxHeight={maxHeight}
          activeRowKey={
            selectedKeys?.size === 1
              ? (() => {
                  const key = [...selectedKeys][0];
                  const [provider, ...nameParts] = key.split(":");
                  return `${provider}-${nameParts.join(":")}`;
                })()
              : undefined
          }
        />
      </div>
    </div>
  );
}
