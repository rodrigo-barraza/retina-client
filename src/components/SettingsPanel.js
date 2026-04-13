"use client";
import { useState, useEffect } from "react";
import {
  Cpu,
  Edit3,
  Mic,
  Wrench,
  Brain,
  GitBranch,
  ExternalLink,
  AudioLines,
  MessageSquare,
  Layers,
  Zap,
  Hash,
  Timer,
  Type,
  Image as ImageIcon,
  Volume2,
  Video,
  FileText,
} from "lucide-react";
import ProviderLogo, { PROVIDER_LABELS } from "./ProviderLogos";
import SelectDropdown from "./SelectDropdown";
import ToggleSwitch from "./ToggleSwitch";
import ModalityIconComponent from "./ModalityIconComponent";
import ModelToolsComponent from "./ModelToolsComponent";
import SystemPromptModal from "./SystemPromptModal";
import styles from "./SettingsPanel.module.css";
import CostBadgeComponent from "./CostBadgeComponent";
import { formatCost, formatElapsedTime } from "../utils/utilities";
import {
  MODALITY_COLORS,
  TOOL_COLORS,
  TOOL_ICON_MAP,
  TOGGLEABLE_TOOLS,
} from "./WorkflowNodeConstants";



export default function SettingsPanel({
  config,
  settings,
  onChange,
  _hasAssistantImages,
  _inferenceMode,
  readOnly = false,
  hideProviderModel = false,
  hideSystemPrompt = false,
  onSystemPromptClick,
  showSystemPromptModal = false,
  onCloseSystemPromptModal,
  workflows = [],
  sessionStats = null,
  lockedTools,
  sessionType = "conversation",
  agentToggles,
}) {
  const sessionLabel = sessionType === "agent" ? "Session" : "Conversation";
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

  const currentProviderModels = modelsMap[settings.provider] || [];
  const selectedModelDef = currentProviderModels.find(
    (m) => m.name === settings.model,
  );

  const isTranscription = selectedModelDef?._isTranscription === true;
  const isTTS = selectedModelDef?._isTTS === true;
  const isSpecialModel = isTranscription || isTTS;

  // ── Live elapsed time ticker ──────────────────────────────────
  // Store current time in state so render stays pure (no Date.now() calls)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (!sessionStats?.currentTurnStart) return;
    // Immediate tick via microtask to avoid synchronous setState in effect body
    const immediate = setTimeout(() => setNowMs(Date.now()), 0);
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearTimeout(immediate); clearInterval(id); };
  }, [sessionStats?.currentTurnStart]);

  // Compute displayed elapsed: completed turns + live current turn
  const completedTime = sessionStats?.completedElapsedTime || 0;
  const liveExtra = sessionStats?.currentTurnStart
    ? Math.max(0, (nowMs - sessionStats.currentTurnStart) / 1000)
    : 0;
  const totalElapsedTime = completedTime + liveExtra;

  return (
    <>
      <div className={styles.container}>
        {sessionStats && (
          <div className={styles.sessionStats}>
            <div className={styles.statsHeader}>
              <Layers size={12} style={{ marginRight: 4 }} /> {sessionLabel}
            </div>
            <div className={styles.statsBadges}>
              <span className={styles.statBadge}>
                <MessageSquare size={11} />
                {sessionStats.messageCount} message{sessionStats.messageCount !== 1 ? "s" : ""}
                {sessionStats.deletedCount > 0 && (
                  <span className={styles.statBadgeSub}>
                    ({sessionStats.deletedCount} deleted)
                  </span>
                )}
              </span>
              {sessionStats.requestCount > 0 && (
                <span className={styles.statBadge}>
                  <Zap size={11} />
                  {sessionStats.requestCount} request{sessionStats.requestCount !== 1 ? "s" : ""}
                </span>
              )}
              {sessionStats.uniqueModels.length > 0 && (
                <span className={styles.statBadge}>
                  <Cpu size={11} />
                  {sessionStats.uniqueModels.length === 1
                    ? sessionStats.uniqueModels[0]
                    : `${sessionStats.uniqueModels.length} models`}
                </span>
              )}
              {sessionStats.totalTokens.total > 0 && (
                <>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {sessionStats.totalTokens.input.toLocaleString()} tokens in
                  </span>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {sessionStats.totalTokens.output.toLocaleString()} tokens out
                  </span>
                  <span className={styles.statBadge}>
                    <Hash size={11} />
                    {sessionStats.totalTokens.total.toLocaleString()} tokens total
                  </span>
                </>
              )}
              <CostBadgeComponent cost={sessionStats.totalCost} />
              {sessionStats.originalTotalCost > 0 && sessionStats.originalTotalCost !== sessionStats.totalCost && (
                <span className={`${styles.statBadge} ${styles.statBadgeSub}`}>
                  ({formatCost(sessionStats.originalTotalCost)} total)
                </span>
              )}
              {totalElapsedTime > 0 && (
                <span className={`${styles.statBadge} ${sessionStats.currentTurnStart ? styles.statBadgeLive : ""}`}>
                  <Timer size={11} />
                  {formatElapsedTime(totalElapsedTime)}
                </span>
              )}
              {sessionStats.usedTools?.length > 0 &&
                sessionStats.usedTools.map((tool) => {
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
              {sessionStats.modalities &&
                Object.values(sessionStats.modalities).some(Boolean) && (
                  <>
                    <ModalityIconComponent
                      modalities={sessionStats.modalities}
                    />
                    <ModelToolsComponent
                      tools={sessionStats.modalities}
                    />
                  </>
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

        {!isSpecialModel && !readOnly && !hideSystemPrompt && (
          <button
            className={`${styles.systemPromptBtn} ${settings.systemPrompt ? styles.systemPromptActive : ""}`}
            onClick={() => onSystemPromptClick?.()}
          >
            <Edit3 size={16} />
            System Prompt
          </button>
        )}

        {readOnly && !hideSystemPrompt && settings.systemPrompt && (
            <div className={styles.formGroup}>
              <label>
                <Edit3 size={12} /> System Prompt
              </label>
              <div className={styles.readOnlySystemPrompt}>
                {settings.systemPrompt}
              </div>
            </div>
          )}

        {/* ── Agent Toggles (Plan, Auto, Iterations) ──────────────── */}
        {agentToggles && (
          <div className={styles.modalities}>
            <div className={styles.modalitiesHeader}>Agent</div>
            {agentToggles.map((toggle) => (
              <div
                key={toggle.key}
                className={`${styles.modalityRow} ${styles.toolToggleRow}`}
              >
                <span className={styles.modalityIcon}>
                  {toggle.icon}
                </span>
                <span className={styles.modalityName}>
                  {toggle.label}
                </span>
                <ToggleSwitch
                  checked={toggle.checked}
                  onChange={toggle.onChange}
                  size="small"
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Modalities ──────────────────────────────────────────── */}
        {selectedModelDef && (() => {
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
            <div className={styles.modalities}>
              <div className={styles.modalitiesHeader}>Modalities</div>
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

        {/* ── Tools ───────────────────────────────────────────────── */}
        {selectedModelDef?.tools && selectedModelDef.tools.length > 0 && (() => {
          const TOOL_LABELS = {
            google: { "Web Search": "Google Search" },
            anthropic: selectedModelDef?.webFetch ? { "Web Search": "Web Fetch" } : {},
          };
          const providerToolLabels = TOOL_LABELS[settings.provider] || {};
          const getToolLabel = (tool) => providerToolLabels[tool] || tool;

          const getToolToggle = (tool) => {
            switch (tool) {
              case "Thinking": {
                const isLmStudio = settings.provider === "lm-studio";
                const isLive = selectedModelDef?.liveAPI;
                const canDisable =
                  !selectedModelDef?.thinkingLevels ||
                  selectedModelDef.thinkingLevels.includes("minimal");
                const alwaysOn = !canDisable && settings.provider === "google";
                const modelName = (settings.model || "").toLowerCase();
                const nameBasedThinking = ["qwen3", "deepseek-r1", "deepseek-v3", "gpt-oss", "gemma-4"]
                  .some((p) => modelName.includes(p));
                const lmCanToggle = isLmStudio && (selectedModelDef?.thinking || nameBasedThinking);
                const lmLocked = isLmStudio && !lmCanToggle;
                return {
                  checked: isLive
                    ? (settings.liveThinkingLevel || "none") !== "none"
                    : lmLocked || alwaysOn
                      ? true
                      : isLmStudio
                        ? (settings.thinkingEnabled !== false)
                        : (settings.thinkingEnabled || false),
                  onChange: isLive
                    ? (val) => onChange({ liveThinkingLevel: val ? "low" : "none" })
                    : (lmLocked || alwaysOn)
                      ? () => {}
                      : (val) => onChange({ thinkingEnabled: val }),
                  disabled: lmLocked || alwaysOn,
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
                  checked: lockedTools?.has("Function Calling") || settings.functionCallingEnabled || false,
                  onChange: lockedTools?.has("Function Calling") ? () => {} : (val) => onChange({ functionCallingEnabled: val }),
                  disabled: !!lockedTools?.has("Function Calling"),
                };
              case "Image Generation":
                return {
                  checked: settings.forceImageGeneration || false,
                  onChange: (val) => onChange({ forceImageGeneration: val }),
                  disabled: false,
                };
              default:
                return null;
            }
          };

          return (
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
                          {tool === "Image Generation"
                            ? (toggle.checked ? "Forced" : "Default")
                            : (toggle.checked ? "On" : "Off")}
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
          );
        })()}
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
