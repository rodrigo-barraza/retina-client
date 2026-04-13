"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, RotateCcw, Loader2, Check } from "lucide-react";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent";
import styles from "./SettingsPageComponent.module.css";

/**
 * SettingsPageComponent — server-side settings management.
 *
 * Currently exposes the "Memory" section, allowing users to configure
 * the models used for extraction, consolidation, and embedding.
 */
export default function SettingsPageComponent() {
  const [config, setConfig] = useState(null);
  const [settings, setSettings] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);

  // ── Load config + settings on mount ────────────────────────────────
  useEffect(() => {
    PrismService.getConfigWithLocalModels({
      onConfig: setConfig,
      onLocalMerge: setConfig,
    }).catch(console.error);

    PrismService.getSettings()
      .then(setSettings)
      .catch(console.error);

    PrismService.getSettingsDefaults()
      .then(setDefaults)
      .catch(console.error);
  }, []);

  // ── Persist changes ────────────────────────────────────────────────
  const persistSettings = useCallback(
    async (updatedSettings) => {
      setSaving(true);
      try {
        const result = await PrismService.updateSettings(updatedSettings);
        setSettings(result);
        setSaved(true);
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaved(false), 2000);
      } catch (err) {
        console.error("Failed to save settings:", err);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ── Model change handlers ──────────────────────────────────────────
  const handleExtractionModelSelect = useCallback(
    (provider, model) => {
      const updated = {
        memory: {
          ...settings?.memory,
          extractionProvider: provider,
          extractionModel: model,
        },
      };
      setSettings((s) => ({ ...s, ...updated }));
      persistSettings(updated);
    },
    [settings, persistSettings],
  );

  const handleConsolidationModelSelect = useCallback(
    (provider, model) => {
      const updated = {
        memory: {
          ...settings?.memory,
          consolidationProvider: provider,
          consolidationModel: model,
        },
      };
      setSettings((s) => ({ ...s, ...updated }));
      persistSettings(updated);
    },
    [settings, persistSettings],
  );

  const handleEmbeddingModelSelect = useCallback(
    (provider, model) => {
      const updated = {
        memory: {
          ...settings?.memory,
          embeddingProvider: provider,
          embeddingModel: model,
        },
      };
      setSettings((s) => ({ ...s, ...updated }));
      persistSettings(updated);
    },
    [settings, persistSettings],
  );

  // ── Reset to defaults ──────────────────────────────────────────────
  const handleResetMemory = useCallback(async () => {
    if (!defaults?.memory) return;
    const updated = { memory: { ...defaults.memory } };
    setSettings((s) => ({ ...s, ...updated }));
    await persistSettings(updated);
  }, [defaults, persistSettings]);

  // ── Loading state ──────────────────────────────────────────────────
  if (!config || !settings) {
    return (
      <div className={styles.container}>
        <PageHeaderComponent
          title="Settings"
          subtitle="Configure system-wide preferences"
        />
        <div className={styles.loading}>
          <Loader2 size={20} className={styles.spinning} />
          <span>Loading settings…</span>
        </div>
      </div>
    );
  }

  const mem = settings.memory || {};

  return (
    <div className={styles.container}>
      <PageHeaderComponent
        title="Settings"
        subtitle="Configure system-wide preferences"
      >
        <span className={`${styles.savedIndicator} ${saved ? styles.visible : ""}`}>
          <Check size={14} />
          Saved
        </span>
      </PageHeaderComponent>

      {/* ── Memory Models Section ──────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Brain size={16} className={styles.sectionIcon} />
          <span className={styles.sectionTitle}>Memory Models</span>
          <span className={styles.sectionSubtitle}>
            Models used for memory extraction, consolidation, and embedding
          </span>
        </div>

        <div className={styles.sectionBody}>
          {/* Extraction Model */}
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>Extraction Model</span>
              <span className={styles.rowDescription}>
                Extracts personal facts and knowledge from conversations
              </span>
            </div>
            <div className={styles.rowControl}>
              <ModelPickerPopoverComponent
                config={config}
                settings={{
                  provider: mem.extractionProvider || "",
                  model: mem.extractionModel || "",
                }}
                onSelectModel={handleExtractionModelSelect}
              />
            </div>
          </div>

          {/* Consolidation Model */}
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>Consolidation Model</span>
              <span className={styles.rowDescription}>
                Merges, deduplicates, and prunes stored memories
              </span>
            </div>
            <div className={styles.rowControl}>
              <ModelPickerPopoverComponent
                config={config}
                settings={{
                  provider: mem.consolidationProvider || "",
                  model: mem.consolidationModel || "",
                }}
                onSelectModel={handleConsolidationModelSelect}
              />
            </div>
          </div>

          {/* Embedding Model */}
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>Embedding Model</span>
              <span className={styles.rowDescription}>
                Generates vector embeddings for semantic memory search
              </span>
            </div>
            <div className={styles.rowControl}>
              <ModelPickerPopoverComponent
                config={config}
                settings={{
                  provider: mem.embeddingProvider || "",
                  model: mem.embeddingModel || "",
                }}
                onSelectModel={handleEmbeddingModelSelect}
              />
            </div>
          </div>
        </div>

        {/* Reset */}
        <div className={styles.resetRow}>
          <button
            className={styles.resetBtn}
            onClick={handleResetMemory}
            disabled={saving}
            title="Reset memory models to defaults"
          >
            <RotateCcw size={12} />
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}
