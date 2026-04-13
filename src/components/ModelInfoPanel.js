"use client";

import {
  Type,
  Image as ImageIcon,
  Volume2,
  Video,
  FileText,
  Brain,
  DollarSign,
} from "lucide-react";
import styles from "./SettingsPanel.module.css";
import ModelTypeBadgeComponent from "./ModelTypeBadgeComponent";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";

/**
 * ModelInfoPanel — Displays model metadata: type badge,
 * token limits, pricing, and arena scores.
 *
 * Extracted from SettingsPanel to live in its own "Info" tab.
 *
 * @param {object} config    — Full Prism config (used to resolve model definitions)
 * @param {object} settings  — Current settings (provider, model)
 */
export default function ModelInfoPanel({
  config,
  settings,
}) {
  const { textToText = {} } = config || {};
  const textModelsMap = textToText.models || {};
  const audioToTextModelsMap = config?.audioToText?.models || {};
  const ttsModelsMap = config?.textToSpeech?.models || {};
  const imageModelsMap = config?.textToImage?.models || {};

  // Build a merged models map identical to SettingsPanel
  const allProviderKeys = new Set([
    ...Object.keys(textModelsMap),
    ...Object.keys(imageModelsMap),
    ...Object.keys(audioToTextModelsMap),
    ...Object.keys(ttsModelsMap),
  ]);
  const modelsMap = {};
  for (const p of allProviderKeys) {
    const textModels = textModelsMap[p] || [];
    const imgModels = (imageModelsMap[p] || []).map((m) => ({
      ...m,
      label: `${m.label} (Image)`,
      _isImageGen: true,
    }));
    const sttModels = (audioToTextModelsMap[p] || []).map((m) => ({
      ...m,
      label: `${m.label} (Transcribe)`,
      _isTranscription: true,
    }));
    const ttsModels = (ttsModelsMap[p] || []).map((m) => ({
      ...m,
      label: `${m.label} (TTS)`,
      _isTTS: true,
    }));
    const seen = new Set();
    const merged = [];
    for (const m of [...textModels, ...imgModels, ...sttModels, ...ttsModels]) {
      if (!seen.has(m.name)) {
        seen.add(m.name);
        merged.push(m);
      }
    }
    modelsMap[p] = merged;
  }

  const currentProviderModels = modelsMap[settings.provider] || [];
  const selectedModelDef = currentProviderModels.find(
    (m) => m.name === settings.model,
  );


  if (!selectedModelDef) {
    return (
      <div className={styles.container}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Model Info</div>
          <div className={styles.modalityRow}>
            <span className={styles.modalityName} style={{ opacity: 0.5 }}>
              Select a model to view details
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Model Type Badge */}
      {selectedModelDef.modelType && (
        <ModelTypeBadgeComponent modelType={selectedModelDef.modelType} />
      )}

      {/* Modalities */}
      {(() => {
        const allTypes = ["text", "image", "audio", "video", "pdf"];
        const inputs = selectedModelDef.inputTypes || [];
        const outputs = selectedModelDef.outputTypes || [];
        const iconMap = {
          text: <Type size={12} />,
          image: <ImageIcon size={12} />,
          audio: <Volume2 size={12} />,
          video: <Video size={12} />,
          pdf: <FileText size={12} />,
        };
        const mods = allTypes
          .map((t) => {
            const isIn = inputs.includes(t);
            const isOut = outputs.includes(t);
            let status = null;
            if (isIn && isOut) status = "Input & Output";
            else if (isIn) status = "Input only";
            else if (isOut) status = "Output only";
            return { type: t, status, supported: isIn || isOut };
          })
          .filter((m) => m.supported);
        if (mods.length === 0) return null;
        return (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Modalities</div>
            {mods.map((m) => (
              <div key={m.type} className={styles.modalityRow}>
                <span
                  className={styles.modalityIcon}
                  style={{ color: MODALITY_COLORS[m.type] }}
                >
                  {iconMap[m.type]}
                </span>
                <span className={styles.modalityName}>{m.type}</span>
                <span
                  className={`${styles.modalityStatus} ${styles.modalityActive}`}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Token Limits */}
      {(selectedModelDef.contextLength || selectedModelDef.maxOutputTokens) && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>Token Limits</div>
          {selectedModelDef.contextLength && (
            <div className={styles.modalityRow}>
              <span className={styles.modalityName}>Context Window</span>
              <span className={`${styles.modalityStatus} ${styles.modalityActive}`}>
                {selectedModelDef.contextLength.toLocaleString()} tokens
              </span>
            </div>
          )}
          {selectedModelDef.maxOutputTokens && (
            <div className={styles.modalityRow}>
              <span className={styles.modalityName}>Max Output</span>
              <span className={`${styles.modalityStatus} ${styles.modalityActive}`}>
                {selectedModelDef.maxOutputTokens.toLocaleString()} tokens
              </span>
            </div>
          )}
        </div>
      )}


      {/* Pricing */}
      {(() => {
        const PRICING_LABELS = {
          inputPerMillion: { label: "Input", unit: "/ 1M tokens" },
          cachedInputPerMillion: { label: "Cached Input", unit: "/ 1M tokens" },
          outputPerMillion: { label: "Output", unit: "/ 1M tokens" },
          inputOver272kPerMillion: { label: "Input >272K", unit: "/ 1M tokens" },
          outputOver272kPerMillion: { label: "Output >272K", unit: "/ 1M tokens" },
          audioInputPerMillion: { label: "Audio Input", unit: "/ 1M tokens" },
          audioOutputPerMillion: { label: "Audio Output", unit: "/ 1M tokens" },
          imageInputPerMillion: { label: "Image Input", unit: "/ 1M tokens" },
          cachedImageInputPerMillion: { label: "Cached Img Input", unit: "/ 1M tokens" },
          imageOutputPerMillion: { label: "Image Output", unit: "/ 1M tokens" },
          perCharacter: { label: "Per Character", unit: "" },
          perMinute: { label: "Per Minute", unit: "" },
          webSearchPer1kCalls: { label: "Web Search", unit: "/ 1K calls" },
        };
        if (!selectedModelDef.pricing) return null;
        const entries = Object.entries(selectedModelDef.pricing)
          .filter(([key]) => PRICING_LABELS[key])
          .map(([key, value]) => ({ ...PRICING_LABELS[key], value }));
        return entries.length > 0 ? (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Pricing</div>
            {entries.map((e) => (
              <div key={e.label} className={styles.modalityRow}>
                <span className={styles.modalityIcon}>
                  <DollarSign size={12} />
                </span>
                <span className={styles.modalityName}>{e.label}</span>
                <span className={`${styles.modalityStatus} ${styles.pricingValue}`}>
                  ${e.value} {e.unit}
                </span>
              </div>
            ))}
          </div>
        ) : null;
      })()}

      {/* Arena Scores */}
      {(() => {
        const arena = selectedModelDef.arena;
        if (!arena) return null;
        const arenaLabels = {
          text: "Text",
          code: "Code",
          vision: "Vision",
          document: "Document",
          textToImage: "Text to Image",
          imageEdit: "Image Edit",
          search: "Search",
        };
        const entries = Object.entries(arena).filter(([, v]) => v != null);
        if (entries.length === 0) return null;
        return (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Arena Scores</div>
            {entries.map(([key, value]) => (
              <div key={key} className={styles.modalityRow}>
                <span className={styles.modalityIcon}>
                  <Brain size={12} />
                </span>
                <span className={styles.modalityName}>
                  {arenaLabels[key] || key}
                </span>
                <span className={`${styles.modalityStatus} ${styles.arenaValue}`}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        );
      })()}


    </div>
  );
}
