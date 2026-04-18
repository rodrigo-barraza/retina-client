"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Network, Bot, RotateCcw, Loader2, Check } from "lucide-react";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent";
import CustomAgentsPanel from "./CustomAgentsPanel";
import ButtonComponent from "./ButtonComponent";
import CardComponent from "./CardComponent";
import styles from "./SettingsPageComponent.module.css";

/**
 * SettingsPageComponent — server-side settings management.
 *
 * Exposes:
 *   - "Memory Models" section for extraction, consolidation, and embedding
 *   - "Agent Defaults" section for subagent/worker model configuration
 */
export default function SettingsPageComponent() {
  const [config, setConfig] = useState(null);
  const [settings, setSettings] = useState(null);
  const [defaults, setDefaults] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimerRef = useRef(null);
  const [customAgents, setCustomAgents] = useState([]);
  const [availableTools, setAvailableTools] = useState([]);

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

    // Fetch custom agents
    PrismService.getCustomAgents()
      .then(setCustomAgents)
      .catch(console.error);

    // Fetch all available tools (unfiltered) for the tool picker
    PrismService.getBuiltInToolSchemas()
      .then(setAvailableTools)
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

  // ── Memory model change handlers ───────────────────────────────────
  const handleExtractionModelSelect = useCallback(
    (provider, model) => {
      const updated = {
        memory: {
          ...settings?.memory,
          extractionProvider: provider || "",
          extractionModel: model || "",
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
          consolidationProvider: provider || "",
          consolidationModel: model || "",
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
          embeddingProvider: provider || "",
          embeddingModel: model || "",
        },
      };
      setSettings((s) => ({ ...s, ...updated }));
      persistSettings(updated);
    },
    [settings, persistSettings],
  );

  // ── Agent model change handlers ────────────────────────────────────
  const handleSubagentModelSelect = useCallback(
    (provider, model) => {
      const updated = {
        agents: {
          ...settings?.agents,
          subagentProvider: provider || "",
          subagentModel: model || "",
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

  const handleResetAgents = useCallback(async () => {
    if (!defaults?.agents) return;
    const updated = { agents: { ...defaults.agents } };
    setSettings((s) => ({ ...s, ...updated }));
    await persistSettings(updated);
  }, [defaults, persistSettings]);

  // ── Custom agents refresh ──────────────────────────────────────────
  const loadCustomAgents = useCallback(async () => {
    try {
      const list = await PrismService.getCustomAgents();
      setCustomAgents(list);
    } catch (err) {
      console.error("Failed to load custom agents:", err);
    }
  }, []);

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
  const agentDefaults = settings.agents || {};

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

      {/* ── Custom Agents Section ──────────────────────────────────── */}
      <CardComponent className={styles.section}>
        <CardComponent.Header
          icon={Bot}
          title="Custom Agents"
          subtitle="Create your own agent personas with custom prompts and tools"
        />

        <CustomAgentsPanel
          agents={customAgents}
          onAgentsChange={loadCustomAgents}
          availableTools={availableTools}
        />
      </CardComponent>

      {/* ── Memory Models Section ──────────────────────────────────── */}
      <CardComponent className={styles.section}>
        <CardComponent.Header
          icon={Brain}
          title="Memory Models"
          subtitle="Models used for memory extraction, consolidation, and embedding"
        />

        <CardComponent.Body>
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
                modelTypeFilter="conversation"
                allowDeselect
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
                modelTypeFilter="conversation"
                allowDeselect
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
                modelTypeFilter="embed"
                allowDeselect
              />
            </div>
          </div>
        </CardComponent.Body>

        {/* Reset */}
        <CardComponent.Footer>
          <ButtonComponent
            variant="disabled"
            size="sm"
            icon={RotateCcw}
            onClick={handleResetMemory}
            disabled={saving}
          >
            Reset to Defaults
          </ButtonComponent>
        </CardComponent.Footer>
      </CardComponent>

      {/* ── Agent Defaults Section ─────────────────────────────────── */}
      <CardComponent className={styles.section}>
        <CardComponent.Header
          icon={Network}
          title="Agent Defaults"
          subtitle="Default model for subagent workers spawned by the coordinator"
        />

        <CardComponent.Body>
          {/* Subagent Model */}
          <div className={styles.row}>
            <div className={styles.rowLabel}>
              <span className={styles.rowTitle}>Subagent Model</span>
              <span className={styles.rowDescription}>
                Cloud model used when local GPU slots are full or unavailable.
                Workers queue on the local provider if not configured.
              </span>
            </div>
            <div className={styles.rowControl}>
              <ModelPickerPopoverComponent
                config={config}
                settings={{
                  provider: agentDefaults.subagentProvider || "",
                  model: agentDefaults.subagentModel || "",
                }}
                onSelectModel={handleSubagentModelSelect}
                modelTypeFilter="conversation"
                allowDeselect
              />
            </div>
          </div>
        </CardComponent.Body>

        {/* Reset */}
        <CardComponent.Footer>
          <ButtonComponent
            variant="disabled"
            size="sm"
            icon={RotateCcw}
            onClick={handleResetAgents}
            disabled={saving}
          >
            Reset to Defaults
          </ButtonComponent>
        </CardComponent.Footer>
      </CardComponent>
    </div>
  );
}
