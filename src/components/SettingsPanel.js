"use client";
// No React hooks needed — state is managed by parent
import {
  Cpu,
  Edit3,
  Type,
  Image as ImageIcon,
  Mic,
  Volume2,
  Video,
  FileText,
  Wrench,
  Brain,
  DollarSign,
  GitBranch,
  ExternalLink,
  AudioLines,
  MessageSquare,
  Layers,
  Zap,
  Coins,
  Hash,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import SelectDropdown from "./SelectDropdown";
import ToggleSwitch from "./ToggleSwitch";

import SystemPromptModal from "./SystemPromptModal";
import styles from "./SettingsPanel.module.css";
import {
  MODALITY_COLORS,
  TOOL_COLORS,
  TOOL_ICON_MAP,
  TOGGLEABLE_TOOLS,
} from "./WorkflowNodeConstants";

/** Format a cost value — matches formatCost from utilities (5 decimal places) */
function formatCostBadge(cost) {
  if (cost === null || cost === undefined) return "$0.00";
  return `$${cost.toFixed(5)}`;
}

export default function SettingsPanel({
  config,
  settings,
  onChange,
  _hasAssistantImages,
  _inferenceMode,
  readOnly = false,
  hideProviderModel = false,
  onSystemPromptClick,
  showSystemPromptModal = false,
  onCloseSystemPromptModal,
  workflows = [],
  conversationStats = null,
}) {
  const { _providers = {}, textToText = {} } = config || {};
  const textModelsMap = textToText.models || {};
  const audioToTextModelsMap = config?.audioToText?.models || {};
  const ttsModelsMap = config?.textToSpeech?.models || {};
  const imageModelsMap = config?.textToImage?.models || {};

  // Build a merged models map: textToText + textToImage + audioToText + textToSpeech
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
    // Merge text models first, then image, then transcription, then TTS — deduplicated by name
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

  const _handleSystemPromptChange = (e) =>
    onChange({ systemPrompt: e.target.value });
  const handleThinkingEnabledChange = (val) =>
    onChange({ thinkingEnabled: val });

  const currentProviderModels = modelsMap[settings.provider] || [];
  const selectedModelDef = currentProviderModels.find(
    (m) => m.name === settings.model,
  );

  const isTranscription = selectedModelDef?._isTranscription === true;
  const isTTS = selectedModelDef?._isTTS === true;
  const isSpecialModel = isTranscription || isTTS;

  // Provider-aware display labels for generic tool names
  const TOOL_LABELS = {
    google: { "Web Search": "Google Search" },
    anthropic: selectedModelDef?.webFetch ? { "Web Search": "Web Fetch" } : {},
  };
  const providerToolLabels = TOOL_LABELS[settings.provider] || {};
  const getToolLabel = (tool) => providerToolLabels[tool] || tool;

  // Get toggle state/handler for a tool
  const getToolToggle = (tool) => {
    switch (tool) {
      case "Thinking": {
        const isLmStudio = settings.provider === "lm-studio";
        const isLive = selectedModelDef?.liveAPI;
        const canDisable =
          !selectedModelDef?.thinkingLevels ||
          selectedModelDef.thinkingLevels.includes("minimal");
        const alwaysOn = !canDisable && settings.provider === "google";
        return {
          checked: isLive
            ? (settings.liveThinkingLevel || "none") !== "none"
            : isLmStudio || alwaysOn || settings.thinkingEnabled || false,
          onChange: isLive
            ? (val) =>
                onChange({
                  liveThinkingLevel: val ? "low" : "none",
                })
            : alwaysOn
              ? () => {} // can't disable
              : handleThinkingEnabledChange,
          disabled: isLmStudio || alwaysOn,
        };
      }
      case "Web Search":
      case "Google Search":
      case "Web Fetch":
        return {
          checked: settings.webSearchEnabled || false,
          onChange: (val) => onChange({ webSearchEnabled: val }),
          disabled: settings.codeExecutionEnabled,
        };
      case "Code Execution":
        return {
          checked: settings.codeExecutionEnabled || false,
          onChange: (val) => {
            const updates = { codeExecutionEnabled: val };
            if (val) {
              updates.webSearchEnabled = false;
              updates.urlContextEnabled = false;
            }
            onChange(updates);
          },
          disabled: false,
        };
      case "URL Context":
        return {
          checked: settings.urlContextEnabled || false,
          onChange: (val) => onChange({ urlContextEnabled: val }),
          disabled: settings.codeExecutionEnabled,
        };
      case "Function Calling":
        return {
          checked: settings.functionCallingEnabled || false,
          onChange: (val) => onChange({ functionCallingEnabled: val }),
          disabled: false,
        };
      default:
        return null;
    }
  };
  return (
    <>
      <div className={styles.container}>
        {conversationStats && (
          <div className={styles.conversationStats}>
            <div className={styles.statsHeader}>
              <Layers size={12} style={{ marginRight: 4 }} /> Conversation
            </div>
            <div className={styles.statsBadges}>
              <span className={styles.statBadge}>
                <MessageSquare size={11} />
                {conversationStats.messageCount} message{conversationStats.messageCount !== 1 ? "s" : ""}
                {conversationStats.deletedCount > 0 && (
                  <span className={styles.statBadgeSub}>
                    ({conversationStats.deletedCount} deleted)
                  </span>
                )}
              </span>
              {conversationStats.requestCount > 0 && (
                <span className={styles.statBadge}>
                  <Zap size={11} />
                  {conversationStats.requestCount} request{conversationStats.requestCount !== 1 ? "s" : ""}
                </span>
              )}
              {conversationStats.uniqueModels.length > 0 && (
                <span className={styles.statBadge}>
                  <Cpu size={11} />
                  {conversationStats.uniqueModels.length === 1
                    ? conversationStats.uniqueModels[0]
                    : `${conversationStats.uniqueModels.length} models`}
                </span>
              )}
              {conversationStats.totalTokens.total > 0 && (
                <>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {conversationStats.totalTokens.input.toLocaleString()} tokens in
                  </span>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {conversationStats.totalTokens.output.toLocaleString()} tokens out
                  </span>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {conversationStats.totalTokens.total.toLocaleString()} tokens total
                  </span>
                </>
              )}
              {conversationStats.totalCost > 0 && (
                <span className={`${styles.statBadge} ${styles.statBadgeCost}`}>
                  <Coins size={11} />
                  {formatCostBadge(conversationStats.totalCost)}
                  {conversationStats.originalTotalCost - conversationStats.totalCost > 0.000001 && (
                    <span className={styles.statBadgeSub}>
                      ({formatCostBadge(conversationStats.originalTotalCost)} total)
                    </span>
                  )}
                </span>
              )}
              {conversationStats.usedTools?.length > 0 &&
                conversationStats.usedTools.map((tool) => {
                  const ToolIcon = TOOL_ICON_MAP[tool.name] || Wrench;
                  const color = TOOL_COLORS[tool.name] || "#c4956a";
                  return (
                    <span
                      key={tool.name}
                      className={styles.statBadge}
                      style={{
                        color,
                        borderColor: `color-mix(in srgb, ${color} 30%, transparent)`,
                      }}
                    >
                      <ToolIcon size={11} />
                      {tool.name}
                      <span className={styles.statBadgeCount}>×{tool.count}</span>
                    </span>
                  );
                })}
              {/* Modality icons: input → output */}
              {conversationStats.modalities &&
                Object.values(conversationStats.modalities).some(Boolean) && (
                  <span className={styles.statBadge}>
                    {conversationStats.modalities.textIn && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.text }} title="Text input">
                        <Type size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.imageIn && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.image }} title="Image input">
                        <ImageIcon size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.audioIn && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.audio }} title="Audio input">
                        <Volume2 size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.videoIn && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.video }} title="Video input">
                        <Video size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.docIn && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.pdf }} title="Document input">
                        <FileText size={11} />
                      </span>
                    )}
                    {(conversationStats.modalities.textIn ||
                      conversationStats.modalities.imageIn ||
                      conversationStats.modalities.audioIn ||
                      conversationStats.modalities.videoIn ||
                      conversationStats.modalities.docIn) &&
                      (conversationStats.modalities.textOut ||
                        conversationStats.modalities.imageOut ||
                        conversationStats.modalities.audioOut) && (
                        <span className={styles.modalityArrow}>→</span>
                      )}
                    {conversationStats.modalities.textOut && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.text }} title="Text output">
                        <Type size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.imageOut && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.image }} title="Image output">
                        <ImageIcon size={11} />
                      </span>
                    )}
                    {conversationStats.modalities.audioOut && (
                      <span className={styles.modalityDot} style={{ color: MODALITY_COLORS.audio }} title="Audio output">
                        <Volume2 size={11} />
                      </span>
                    )}
                  </span>
                )}
            </div>
          </div>
        )}

        {workflows.length > 0 && (
          <div className={styles.modalities} style={{ marginBottom: 12 }}>
            <div className={styles.modalitiesHeader}>
              <GitBranch size={12} style={{ marginRight: 4 }} /> Workflow
            </div>
            {workflows.map((wf) => (
              <a
                key={wf._id}
                href={`/workflows/${wf._id}`}
                className={styles.workflowLink}
              >
                <span className={styles.modalityIcon}>
                  <GitBranch size={12} />
                </span>
                <span className={styles.modalityName}>
                  {wf.workflowName || "Untitled Workflow"}
                </span>
                <span className={styles.modalityStatus}>
                  <ExternalLink size={10} />
                </span>
              </a>
            ))}
          </div>
        )}

        {readOnly && !hideProviderModel && (
          <div className={styles.sectionTitle}>
            <Cpu size={16} /> Model Settings
          </div>
        )}

        {readOnly && !hideProviderModel && (
          <div className={styles.formGroup}>
            <label>Provider</label>
            <div className={styles.readOnlyValue}>
              <ProviderLogo provider={settings.provider} size={16} />
              {PROVIDER_LABELS[settings.provider] || settings.provider || "-"}
            </div>
          </div>
        )}

        {readOnly && !hideProviderModel && settings.provider && (
          <div className={styles.formGroup}>
            <label>Model</label>
            <div
              className={styles.readOnlyValue}
              style={{
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "center",
                height: "auto",
                padding: "8px 10px",
                gap: 2,
              }}
            >
              <span>{selectedModelDef?.label || settings.model || "-"}</span>
              {selectedModelDef?.label &&
                selectedModelDef.label !== settings.model && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontWeight: 400,
                    }}
                  >
                    {settings.model}
                  </span>
                )}
            </div>
          </div>
        )}

        {selectedModelDef?.modelType && (
          <div className={styles.modelTypeBadge}>
            {selectedModelDef.modelType === "conversation" && (
              <Type size={12} />
            )}
            {selectedModelDef.modelType === "audio" && <Volume2 size={12} />}
            {selectedModelDef.modelType === "embed" && <Cpu size={12} />}
            {selectedModelDef.modelType} model
          </div>
        )}
        {selectedModelDef &&
          (() => {
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
            const modalities = allTypes
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
            if (modalities.length === 0) return null;
            return (
              <div className={styles.modalities}>
                <div className={styles.modalitiesHeader}>Modalities</div>
                {modalities.map((m) => (
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
        {selectedModelDef?.pricing &&
          (() => {
            const PRICING_LABELS = {
              inputPerMillion: { label: "Input", unit: "/ 1M tokens" },
              cachedInputPerMillion: {
                label: "Cached Input",
                unit: "/ 1M tokens",
              },
              outputPerMillion: { label: "Output", unit: "/ 1M tokens" },
              inputOver272kPerMillion: {
                label: "Input >272K",
                unit: "/ 1M tokens",
              },
              outputOver272kPerMillion: {
                label: "Output >272K",
                unit: "/ 1M tokens",
              },
              audioInputPerMillion: {
                label: "Audio Input",
                unit: "/ 1M tokens",
              },
              audioOutputPerMillion: {
                label: "Audio Output",
                unit: "/ 1M tokens",
              },
              imageInputPerMillion: {
                label: "Image Input",
                unit: "/ 1M tokens",
              },
              cachedImageInputPerMillion: {
                label: "Cached Img Input",
                unit: "/ 1M tokens",
              },
              imageOutputPerMillion: {
                label: "Image Output",
                unit: "/ 1M tokens",
              },
              perCharacter: { label: "Per Character", unit: "" },
              perMinute: { label: "Per Minute", unit: "" },
              webSearchPer1kCalls: {
                label: "Web Search",
                unit: "/ 1K calls",
              },
            };
            const entries = Object.entries(selectedModelDef.pricing)
              .filter(([key]) => PRICING_LABELS[key])
              .map(([key, value]) => ({ ...PRICING_LABELS[key], value }));
            return entries.length > 0 ? (
              <div className={styles.modalities}>
                <div className={styles.modalitiesHeader}>Pricing</div>
                {entries.map((e) => (
                  <div key={e.label} className={styles.modalityRow}>
                    <span className={styles.modalityIcon}>
                      <DollarSign size={12} />
                    </span>
                    <span className={styles.modalityName}>{e.label}</span>
                    <span
                      className={`${styles.modalityStatus} ${styles.pricingValue}`}
                    >
                      ${e.value} {e.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}
        {(() => {
          const arena = selectedModelDef?.arena;
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
            <div className={styles.modalities}>
              <div className={styles.modalitiesHeader}>Arena Scores</div>
              {entries.map(([key, value]) => (
                <div key={key} className={styles.modalityRow}>
                  <span className={styles.modalityIcon}>
                    <Brain size={12} />
                  </span>
                  <span className={styles.modalityName}>
                    {arenaLabels[key] || key}
                  </span>
                  <span
                    className={`${styles.modalityStatus} ${styles.arenaValue}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          );
        })()}
        {selectedModelDef?.tools && selectedModelDef.tools.length > 0 && (
          <div className={styles.modalities}>
            <div className={styles.modalitiesHeader}>Tools</div>
            {selectedModelDef.tools.map((tool) => {
              const toggle = TOGGLEABLE_TOOLS.has(tool)
                ? getToolToggle(tool)
                : null;
              return (
                <div
                  key={tool}
                  className={`${styles.modalityRow} ${toggle ? styles.toolToggleRow : ""}`}
                >
                  <span className={styles.modalityIcon}>
                    {(() => {
                      const ToolIcon = TOOL_ICON_MAP[tool];
                      return ToolIcon ? (
                        <ToolIcon
                          size={12}
                          style={{ color: TOOL_COLORS[tool] }}
                        />
                      ) : (
                        <Wrench
                          size={12}
                          style={{ color: TOOL_COLORS[tool] }}
                        />
                      );
                    })()}
                  </span>
                  <span className={styles.modalityName}>
                    {getToolLabel(tool)}
                  </span>
                  {readOnly ? (
                    toggle ? (
                      <span
                        className={`${styles.modalityStatus} ${toggle.checked ? styles.modalityActive : ""}`}
                      >
                        {toggle.checked ? "On" : "Off"}
                      </span>
                    ) : (
                      <span
                        className={`${styles.modalityStatus} ${styles.modalityActive}`}
                      >
                        Supported
                      </span>
                    )
                  ) : toggle ? (
                    <ToggleSwitch
                      checked={toggle.checked}
                      onChange={toggle.onChange}
                      disabled={toggle.disabled}
                      size="small"
                    />
                  ) : (
                    <span
                      className={`${styles.modalityStatus} ${styles.modalityActive}`}
                    >
                      Supported
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isTTS &&
          (() => {
            const providerVoices =
              config?.textToSpeech?.voices?.[settings.provider] || [];
            const defaultVoice =
              config?.textToSpeech?.defaultVoices?.[settings.provider] || "";
            const currentVoice = settings.voice || defaultVoice;
            if (readOnly) {
              return currentVoice ? (
                <div className={styles.formGroup}>
                  <label>Voice</label>
                  <div className={styles.readOnlyValue}>
                    <Mic size={14} /> {currentVoice}
                  </div>
                </div>
              ) : null;
            }
            const voiceOptions = providerVoices.map((v) => ({
              value: v.name || v.voice_id || v,
              label: `${v.label || v.name || v}${v.gender ? ` (${v.gender})` : ""}`,
              icon: <Mic size={18} />,
            }));
            return voiceOptions.length > 0 ? (
              <div className={styles.formGroup}>
                <label>Voice</label>
                <SelectDropdown
                  value={currentVoice}
                  options={voiceOptions}
                  onChange={(val) => onChange({ voice: val })}
                  placeholder="Select Voice"
                  icon={<Mic size={18} />}
                />
              </div>
            ) : null;
          })()}

        {/* Google models (non-live): Thinking Level dropdown — always visible */}
        {!selectedModelDef?.liveAPI &&
          settings.provider === "google" &&
          selectedModelDef?.thinkingLevels &&
          !readOnly &&
          (() => {
            const canDisable =
              selectedModelDef.thinkingLevels.includes("minimal");
            const options = [
              ...(canDisable ? [{ value: "none", label: "No Thinking" }] : []),
              ...selectedModelDef.thinkingLevels.map((level) => ({
                value: level,
                label: level.charAt(0).toUpperCase() + level.slice(1),
              })),
            ];
            const currentValue =
              settings.thinkingEnabled === false && canDisable
                ? "none"
                : settings.thinkingLevel || "high";
            return (
              <div className={styles.formGroup}>
                <label>Thinking Level</label>
                <SelectDropdown
                  value={currentValue}
                  options={options}
                  onChange={(val) =>
                    onChange({
                      thinkingLevel: val === "none" ? undefined : val,
                      thinkingEnabled: val !== "none",
                    })
                  }
                  icon={<Brain size={18} />}
                />
              </div>
            );
          })()}

        {/* Live API model: Voice + Thinking Level dropdowns */}
        {selectedModelDef?.liveAPI &&
          !readOnly &&
          (() => {
            const googleVoices = config?.textToSpeech?.voices?.google || [];
            const currentLiveVoice = settings.liveVoice || "Puck";
            const voiceOptions = googleVoices.map((v) => ({
              value: v.name,
              label: `${v.name} (${v.gender})`,
              icon: <AudioLines size={18} />,
            }));
            return voiceOptions.length > 0 ? (
              <div className={styles.formGroup}>
                <label>Voice</label>
                <SelectDropdown
                  value={currentLiveVoice}
                  options={voiceOptions}
                  onChange={(val) => onChange({ liveVoice: val })}
                  placeholder="Select Voice"
                  icon={<AudioLines size={18} />}
                />
              </div>
            ) : null;
          })()}

        {selectedModelDef?.liveAPI &&
          !readOnly &&
          selectedModelDef?.thinkingLevels &&
          (() => {
            const canDisable =
              selectedModelDef.thinkingLevels.includes("minimal");
            const options = [
              ...(canDisable ? [{ value: "none", label: "No Thinking" }] : []),
              ...selectedModelDef.thinkingLevels.map((level) => ({
                value: level,
                label: level.charAt(0).toUpperCase() + level.slice(1),
              })),
            ];
            return (
              <div className={styles.formGroup}>
                <label>Thinking Level</label>
                <SelectDropdown
                  value={
                    settings.liveThinkingLevel ||
                    (canDisable ? "none" : selectedModelDef.thinkingLevels[0])
                  }
                  options={options}
                  onChange={(val) =>
                    onChange({
                      liveThinkingLevel: val,
                      thinkingEnabled: val !== "none",
                    })
                  }
                  icon={<Brain size={18} />}
                />
              </div>
            );
          })()}

        {/* readOnly: show live voice if saved */}
        {readOnly && selectedModelDef?.liveAPI && settings.liveVoice && (
          <div className={styles.formGroup}>
            <label>Voice</label>
            <div className={styles.readOnlyValue}>
              <AudioLines size={14} /> {settings.liveVoice}
            </div>
          </div>
        )}

        {readOnly &&
          selectedModelDef?.liveAPI &&
          settings.liveThinkingLevel && (
            <div className={styles.formGroup}>
              <label>Thinking Level</label>
              <div className={styles.readOnlyValue}>
                <Brain size={14} />{" "}
                {settings.liveThinkingLevel === "none"
                  ? "No Thinking"
                  : settings.liveThinkingLevel}
              </div>
            </div>
          )}

        {/* readOnly: show voice if saved even without TTS model context */}
        {readOnly && !isTTS && !selectedModelDef?.liveAPI && settings.voice && (
          <div className={styles.formGroup}>
            <label>Voice</label>
            <div className={styles.readOnlyValue}>
              <Mic size={14} /> {settings.voice}
            </div>
          </div>
        )}

        {!isSpecialModel && !readOnly && (
          <button
            className={`${styles.systemPromptBtn} ${settings.systemPrompt && settings.systemPrompt !== "You are a helpful AI assistant" && settings.systemPrompt !== "You are a helpful AI assistant." ? styles.systemPromptActive : ""}`}
            onClick={() => onSystemPromptClick?.()}
          >
            <Edit3 size={16} />
            System Prompt
          </button>
        )}

        {readOnly &&
          settings.systemPrompt &&
          settings.systemPrompt !== "You are a helpful AI assistant" &&
          settings.systemPrompt !== "You are a helpful AI assistant." && (
            <div className={styles.formGroup}>
              <label>
                <Edit3 size={12} /> System Prompt
              </label>
              <div className={styles.readOnlySystemPrompt}>
                {settings.systemPrompt}
              </div>
            </div>
          )}
      </div>

      {!readOnly && showSystemPromptModal && (
        <SystemPromptModal
          activePrompt={settings.systemPrompt}
          onApply={(text) => onChange({ systemPrompt: text })}
          onClose={() => onCloseSystemPromptModal?.()}
        />
      )}
    </>
  );
}
