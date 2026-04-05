"use client";

import { Settings2 } from "lucide-react";
import SelectDropdown from "./SelectDropdown";
import SliderComponent from "./SliderComponent";
import styles from "./SettingsPanel.module.css";

export default function ParametersPanelComponent({
  settings,
  onChange,
  config,
  readOnly = false,
}) {
  const textModelsMap = config?.textToText?.models || {};
  const imageModelsMap = config?.textToImage?.models || {};
  const audioToTextModelsMap = config?.audioToText?.models || {};
  const ttsModelsMap = config?.textToSpeech?.models || {};

  // Build merged models map
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
      _isImageGen: true,
    }));
    const sttModels = (audioToTextModelsMap[p] || []).map((m) => ({
      ...m,
      _isTranscription: true,
    }));
    const ttsModels = (ttsModelsMap[p] || []).map((m) => ({
      ...m,
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
  const isReasoning =
    selectedModelDef?.thinking ||
    (settings.model || "").includes("o1") ||
    (settings.model || "").includes("o3");
  const isTranscription = selectedModelDef?._isTranscription === true;
  const isTTS = selectedModelDef?._isTTS === true;
  const isSpecialModel = isTranscription || isTTS;

  const handleTempChange = (val) => onChange({ temperature: val });
  const handleMaxTokensChange = (val) => onChange({ maxTokens: val });
  const handleTopPChange = (val) => onChange({ topP: val });
  const handleTopKChange = (val) => onChange({ topK: val });
  const handleFreqPenaltyChange = (val) => onChange({ frequencyPenalty: val });
  const handlePresPenaltyChange = (val) => onChange({ presencePenalty: val });
  const handleMinPChange = (val) => onChange({ minP: val });
  const handleRepeatPenaltyChange = (val) => onChange({ repeatPenalty: val });
  const handleSeedChange = (e) => onChange({ seed: e.target.value });
  const handleStopSeqChange = (e) =>
    onChange({ stopSequences: e.target.value });
  const handleReasoningEffortChange = (val) =>
    onChange({ reasoningEffort: val });
  const handleThinkingLevelChange = (val) => onChange({ thinkingLevel: val });
  const handleThinkingBudgetChange = (e) =>
    onChange({ thinkingBudget: e.target.value });
  const handleVerbosityChange = (val) => onChange({ verbosity: val });
  const handleReasoningSummaryChange = (val) =>
    onChange({ reasoningSummary: val });

  if (isSpecialModel || settings.provider === "ollama") {
    return (
      <div className={styles.container}>
        <div className={styles.sectionTitle}>
          <Settings2 size={16} /> Parameters
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
          No configurable parameters for this model type.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionTitle}>
        <Settings2 size={16} /> Parameters
      </div>

      {(() => {
        const thinkingLocked =
          isReasoning &&
          settings.thinkingEnabled &&
          settings.provider === "anthropic";
        return (
          <div className={styles.formGroup}>
            <label>
              Temperature (
              {thinkingLocked ? "1 — Locked" : settings.temperature})
            </label>
            {!readOnly && (
              <SliderComponent
                min={0}
                max={2}
                step={0.1}
                value={thinkingLocked ? 1 : settings.temperature}
                onChange={handleTempChange}
                disabled={thinkingLocked}
              />
            )}
          </div>
        );
      })()}

      <div className={styles.formGroup}>
        <label>Max Tokens ({settings.maxTokens})</label>
        {!readOnly && (
          <SliderComponent
            min={256}
            max={32000}
            step={256}
            value={settings.maxTokens}
            onChange={handleMaxTokensChange}
          />
        )}
      </div>

      {(isReasoning && selectedModelDef?.responsesAPI) ||
      (readOnly && settings.reasoningEffort) ? (
        <>
          <div className={styles.formGroup}>
            <label>Reasoning Effort</label>
            {readOnly ? (
              <div className={styles.readOnlyValue}>
                {settings.reasoningEffort || "high"}
              </div>
            ) : (
              <SelectDropdown
                value={settings.reasoningEffort || "high"}
                options={[
                  { value: "none", label: "None" },
                  { value: "low", label: "Low" },
                  { value: "medium", label: "Medium" },
                  { value: "high", label: "High" },
                  { value: "xhigh", label: "Extra High" },
                ]}
                onChange={handleReasoningEffortChange}
              />
            )}
          </div>

          {(selectedModelDef?.reasoningSummary ||
            (readOnly && settings.reasoningSummary)) && (
            <div className={styles.formGroup}>
              <label>Reasoning Summary</label>
              {readOnly ? (
                <div className={styles.readOnlyValue}>
                  {settings.reasoningSummary || "auto"}
                </div>
              ) : (
                <SelectDropdown
                  value={settings.reasoningSummary || "auto"}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "concise", label: "Concise" },
                    { value: "detailed", label: "Detailed" },
                  ]}
                  onChange={handleReasoningSummaryChange}
                />
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Thinking sub-settings — shown when Thinking is toggled on */}
      {isReasoning &&
        !selectedModelDef?.responsesAPI &&
        (settings.thinkingEnabled || (settings.provider === "lm-studio" && settings.thinkingEnabled !== false)) && (
          <>
            {["openai", "lm-studio", "vllm", "anthropic", "ollama", "llama-cpp"].includes(
              settings.provider,
            ) && (
              <div className={styles.formGroup}>
                <label>Reasoning Effort</label>
                <SelectDropdown
                  value={settings.reasoningEffort || "high"}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                  onChange={handleReasoningEffortChange}
                />
              </div>
            )}

            {settings.provider === "google" &&
              selectedModelDef?.thinkingLevels && (
                <div className={styles.formGroup}>
                  <label>Thinking Level</label>
                  <SelectDropdown
                    value={settings.thinkingLevel || "high"}
                    options={selectedModelDef.thinkingLevels.map((level) => ({
                      value: level,
                      label: level.charAt(0).toUpperCase() + level.slice(1),
                    }))}
                    onChange={handleThinkingLevelChange}
                  />
                </div>
              )}

            {["anthropic", "google"].includes(settings.provider) && (
              <div className={styles.formGroup}>
                <label>Thinking Budget (Tokens)</label>
                <input
                  type="number"
                  placeholder="e.g. 1024"
                  value={settings.thinkingBudget || ""}
                  onChange={handleThinkingBudgetChange}
                  className={styles.inputField}
                />
              </div>
            )}
          </>
        )}

      {selectedModelDef?.verbosity && (
        <div className={styles.formGroup}>
          <label>Verbosity</label>
          <SelectDropdown
            value={settings.verbosity || ""}
            options={[
              { value: "", label: "Default" },
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
              { value: "high", label: "High" },
            ]}
            onChange={handleVerbosityChange}
          />
        </div>
      )}

      {!isReasoning && !readOnly && (
        <>
          <div className={styles.formGroup}>
            <label>Top P ({settings.topP})</label>
            <SliderComponent
              min={0}
              max={1}
              step={0.05}
              value={settings.topP}
              onChange={handleTopPChange}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Stop Sequences (comma separated)</label>
            <input
              type="text"
              placeholder="\n, Human:"
              value={settings.stopSequences || ""}
              onChange={handleStopSeqChange}
              className={styles.inputField}
            />
          </div>

          {["anthropic", "google", "llama-cpp", "lm-studio", "vllm"].includes(settings.provider) && (
            <div className={styles.formGroup}>
              <label>Top K ({settings.topK})</label>
              <SliderComponent
                min={0}
                max={100}
                step={1}
                value={settings.topK}
                onChange={handleTopKChange}
              />
            </div>
          )}

          {["llama-cpp", "lm-studio", "vllm"].includes(settings.provider) && (
            <div className={styles.formGroup}>
              <label>Min P ({settings.minP ?? 0})</label>
              <SliderComponent
                min={0}
                max={1}
                step={0.01}
                value={settings.minP ?? 0}
                onChange={handleMinPChange}
              />
            </div>
          )}

          {["llama-cpp", "lm-studio", "vllm"].includes(settings.provider) && (
            <div className={styles.formGroup}>
              <label>Repeat Penalty ({settings.repeatPenalty ?? 1})</label>
              <SliderComponent
                min={1}
                max={2}
                step={0.05}
                value={settings.repeatPenalty ?? 1}
                onChange={handleRepeatPenaltyChange}
              />
            </div>
          )}

          {["llama-cpp", "lm-studio", "vllm"].includes(settings.provider) && (
            <div className={styles.formGroup}>
              <label>Seed</label>
              <input
                type="number"
                placeholder="Random"
                value={settings.seed ?? ""}
                onChange={handleSeedChange}
                className={styles.inputField}
              />
            </div>
          )}

          {["openai", "lm-studio", "vllm", "google", "llama-cpp"].includes(
            settings.provider,
          ) && (
            <>
              <div className={styles.formGroup}>
                <label>Frequency Penalty ({settings.frequencyPenalty})</label>
                <SliderComponent
                  min={-2}
                  max={2}
                  step={0.1}
                  value={settings.frequencyPenalty}
                  onChange={handleFreqPenaltyChange}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Presence Penalty ({settings.presencePenalty})</label>
                <SliderComponent
                  min={-2}
                  max={2}
                  step={0.1}
                  value={settings.presencePenalty}
                  onChange={handlePresPenaltyChange}
                />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
