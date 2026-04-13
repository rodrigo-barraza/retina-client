"use client";

import { useMemo } from "react";
import { Bot, X, Brain } from "lucide-react";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent";
import styles from "./AgentCardComponent.module.css";

/**
 * AgentCardComponent — a card for a single agent instance in the benchmark sidebar.
 *
 * Uses ModelPickerPopoverComponent for model selection instead of a native <select>.
 *
 * Props:
 *   agent            — { instanceId, agentId, name, description, provider, modelName }
 *   isThinking       — boolean — whether thinking is enabled for this agent
 *   supportsThinking — boolean — whether the current backing model supports thinking
 *   config           — Prism config object (used by ModelPickerPopoverComponent)
 *   onRemove         — callback(instanceId)
 *   onChangeModel    — callback(instanceId, provider, modelName)
 *   onToggleThinking — callback(instanceId)
 */
export default function AgentCardComponent({
  agent,
  isThinking = false,
  supportsThinking = false,
  config,
  onRemove,
  onChangeModel,
  onToggleThinking,
}) {
  // Filter config to only FC-capable models for the picker
  const fcConfig = useMemo(() => {
    if (!config) return null;
    const textModelsMap = config.textToText?.models || {};
    const filteredTextModels = {};

    for (const [provider, models] of Object.entries(textModelsMap)) {
      const fcModels = models.filter((m) =>
        m.tools?.includes("Function Calling"),
      );
      if (fcModels.length > 0) filteredTextModels[provider] = fcModels;
    }

    const filteredProviderList = (config.providerList || []).filter(
      (p) => filteredTextModels[p],
    );

    return {
      ...config,
      providerList: filteredProviderList,
      textToText: {
        ...config.textToText,
        models: filteredTextModels,
      },
      // Suppress non-text sections in the picker
      textToImage: { models: {} },
      textToSpeech: { models: {}, voices: {}, defaultVoices: {} },
      audioToText: { models: {} },
    };
  }, [config]);

  // Build settings-like object for the trigger display
  const pickerSettings = useMemo(() => ({
    provider: agent.provider || "",
    model: agent.modelName || "",
  }), [agent.provider, agent.modelName]);

  const handlePickerSelect = (provider, name) => {
    onChangeModel?.(agent.instanceId, provider, name);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Bot size={14} className={styles.botIcon} />
        <span className={styles.name} title={agent.name}>
          {agent.name}
        </span>
        <span className={styles.badge}>Agent</span>
        <button
          className={styles.removeBtn}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.(agent.instanceId);
          }}
          title="Remove"
        >
          <X size={10} />
        </button>
      </div>

      {/* Model selector — uses ModelPickerPopoverComponent trigger */}
      <ModelPickerPopoverComponent
        config={fcConfig}
        settings={pickerSettings}
        onSelectModel={handlePickerSelect}
      />

      <div className={styles.footer}>
        <span className={styles.description}>
          {agent.description}
        </span>
        <div className={styles.toggles}>
          {supportsThinking && (
            <button
              className={`${styles.thinkingToggle} ${isThinking ? styles.thinkingToggleActive : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleThinking?.(agent.instanceId);
              }}
              title={isThinking ? "Disable thinking" : "Enable thinking"}
            >
              <Brain size={10} />
              <span>Think</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
