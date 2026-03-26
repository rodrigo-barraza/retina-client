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
  Globe,
  Wrench,
  Code,
  Monitor,
  Search,
  Brain,
  DollarSign,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import SelectDropdown from "./SelectDropdown";
import ToggleSwitch from "./ToggleSwitch";

import SystemPromptModal from "./SystemPromptModal";
import styles from "./SettingsPanel.module.css";
import { MODALITY_COLORS, TOOL_COLORS } from "./WorkflowNodeConstants";

export default function SettingsPanel({
  config,
  settings,
  onChange,
  _hasAssistantImages,
  _inferenceMode,
  readOnly = false,
  onSystemPromptClick,
  showSystemPromptModal = false,
  onCloseSystemPromptModal,
  workflows = [],
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



  // Tools that have toggle switches
  const TOGGLEABLE_TOOLS = new Set([
    "Thinking",
    "Web Search",
    "Google Search",
    "Web Fetch",
    "Code Execution",
    "URL Context",
    "Function Calling",
  ]);

  // Icon map for tools
  const TOOL_ICONS = {
    Thinking: <Brain size={12} style={{ color: TOOL_COLORS["Thinking"] }} />,
    "Web Search": (
      <Globe size={12} style={{ color: TOOL_COLORS["Web Search"] }} />
    ),
    "Google Search": (
      <Globe size={12} style={{ color: TOOL_COLORS["Google Search"] }} />
    ),
    "Web Fetch": (
      <Globe size={12} style={{ color: TOOL_COLORS["Web Fetch"] }} />
    ),
    "Function Calling": (
      <Wrench size={12} style={{ color: TOOL_COLORS["Function Calling"] }} />
    ),
    "Code Execution": (
      <Code size={12} style={{ color: TOOL_COLORS["Code Execution"] }} />
    ),
    "Computer Use": (
      <Monitor size={12} style={{ color: TOOL_COLORS["Computer Use"] }} />
    ),
    "File Search": (
      <Search size={12} style={{ color: TOOL_COLORS["File Search"] }} />
    ),
    "Image Generation": (
      <ImageIcon size={12} style={{ color: TOOL_COLORS["Image Generation"] }} />
    ),
    "URL Context": (
      <Globe size={12} style={{ color: TOOL_COLORS["URL Context"] }} />
    ),
  };

  // Get toggle state/handler for a tool
  const getToolToggle = (tool) => {
    switch (tool) {
      case "Thinking":
        return {
          checked: settings.thinkingEnabled || false,
          onChange: handleThinkingEnabledChange,
          disabled: false,
        };
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

        {readOnly && (
          <div className={styles.sectionTitle}>
            <Cpu size={16} /> Model Settings
          </div>
        )}

        {readOnly && (
          <div className={styles.formGroup}>
            <label>Provider</label>
            <div className={styles.readOnlyValue}>
              <ProviderLogo provider={settings.provider} size={16} />
              {PROVIDER_LABELS[settings.provider] || settings.provider || "-"}
            </div>
          </div>
        )}

        {readOnly && settings.provider && (
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
            {selectedModelDef.modelType === "audio" && (
              <Volume2 size={12} />
            )}
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
              const entries = Object.entries(arena).filter(
                ([, v]) => v != null,
              );
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
                        {TOOL_ICONS[tool] || (
                          <Wrench
                            size={12}
                            style={{ color: TOOL_COLORS[tool] }}
                          />
                        )}
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

        {/* readOnly: show voice if saved even without TTS model context */}
        {readOnly && !isTTS && settings.voice && (
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
