"use client";

import { Settings2, Cpu, Edit3 } from "lucide-react";
import styles from "./SettingsPanel.module.css";

export default function SettingsPanel({ config, settings, onChange }) {
  const { providers = {}, textToText = {} } = config || {};
  const modelsMap = textToText.models || {};
  const providerList = config?.providerList || [];

  const handleProviderChange = (e) => {
    const pv = e.target.value;
    const defaultMod =
      textToText.defaults?.[pv] || modelsMap[pv]?.[0]?.name || "";
    onChange({ provider: pv, model: defaultMod });
  };

  const handleModelChange = (e) => onChange({ model: e.target.value });
  const handleSystemPromptChange = (e) =>
    onChange({ systemPrompt: e.target.value });
  const handleTempChange = (e) =>
    onChange({ temperature: parseFloat(e.target.value) });
  const handleMaxTokensChange = (e) =>
    onChange({ maxTokens: parseInt(e.target.value) });

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>
        <Cpu size={16} /> Model Settings
      </div>

      <div className={styles.formGroup}>
        <label>Provider</label>
        <select value={settings.provider || ""} onChange={handleProviderChange}>
          <option value="" disabled>
            Select Provider
          </option>
          {providerList
            .filter((p) => modelsMap[p])
            .map((p) => (
              <option key={p} value={p}>
                {p.toUpperCase()}
              </option>
            ))}
        </select>
      </div>

      {settings.provider && modelsMap[settings.provider] && (
        <div className={styles.formGroup}>
          <label>Model</label>
          <select value={settings.model || ""} onChange={handleModelChange}>
            {modelsMap[settings.provider].map((m) => (
              <option key={m.name} value={m.name}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className={styles.sectionTitle}>
        <Edit3 size={16} /> Context
      </div>

      <div className={styles.formGroup}>
        <label>System Prompt</label>
        <textarea
          rows={5}
          placeholder="You are a helpful AI assistant..."
          value={settings.systemPrompt}
          onChange={handleSystemPromptChange}
        />
      </div>

      <div className={styles.sectionTitle}>
        <Settings2 size={16} /> Parameters
      </div>

      <div className={styles.formGroup}>
        <label>Temperature ({settings.temperature})</label>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={settings.temperature}
          onChange={handleTempChange}
        />
      </div>

      <div className={styles.formGroup}>
        <label>Max Tokens ({settings.maxTokens})</label>
        <input
          type="range"
          min="256"
          max="32000"
          step="256"
          value={settings.maxTokens}
          onChange={handleMaxTokensChange}
        />
      </div>
    </div>
  );
}
