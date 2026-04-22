"use client";
import { useState } from "react";
import {
  Cpu,
  Edit3,
  Mic,
  Brain,
  GitBranch,
  ExternalLink,
  AudioLines,
  Layers,
} from "lucide-react";
import ProviderLogo, { resolveProviderLabel } from "./ProviderLogos";
import SelectDropdown from "./SelectDropdown";
import ToggleSwitch from "./ToggleSwitch";
import CycleButton from "./CycleButton";
import ModalityIconComponent from "./ModalityIconComponent";
import SystemPromptModal from "./SystemPromptModal";
import ModelBadgeComponent from "./ModelBadgeComponent";
import styles from "./SettingsPanel.module.css";
import CostBadgeComponent from "./CostBadgeComponent";
import TokenCountBadgeComponent from "./TokenCountBadgeComponent";
import RequestCountBadgeComponent from "./RequestCountBadgeComponent";
import MessageCountBadgeComponent from "./MessageCountBadgeComponent";
import StopwatchBadgeComponent from "./StopwatchBadgeComponent";
import StatsTabBarComponent from "./StatsTabBarComponent";
import { formatCost, CAPABILITY_TOOL_NAMES } from "../utils/utilities";
import { TOGGLEABLE_TOOLS } from "./WorkflowNodeConstants";
import ToolBadgeComponent from "./ToolBadgeComponent";
import ToolCallBadgeComponent from "./ToolCallBadgeComponent";
import useTokenRate from "../hooks/useTokenRate";
import useTtft from "../hooks/useTtft";

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
  canSpawnWorkers = false,
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

  // ── Live token rate + elapsed time (reusable hook) ────────────
  const {
    perfNow,
    needsTicker,
    turnActive,
    totalElapsedTime,
    liveTokensPerSec,
    computedTokPerSec,
    hasActiveWorkers,
  } = useTokenRate(sessionStats);

  // ── Live TTFT (Time To First Token) ───────────────────────────
  const { liveTtft, isLiveTtft } = useTtft(sessionStats, perfNow, needsTicker);

  // ── Stats tab (All / Orchestrator / Workers) ──────────────
  const [statsTab, setStatsTab] = useState("all");
  const showStatsTabBar =
    canSpawnWorkers && !!(sessionStats?.orchestrator || sessionStats?.workers);

  // Resolve which stats object to render based on active tab
  const activeStats = sessionStats
    ? statsTab === "orchestrator"
      ? sessionStats.orchestrator
      : statsTab === "workers"
        ? sessionStats.workers
        : sessionStats
    : null;

  // Compute displayed elapsed for the active tab
  const activeElapsedTime =
    statsTab === "all"
      ? totalElapsedTime
      : activeStats?.completedElapsedTime || 0;

  const renderStatsBadges = (stats, showFull) => (
    <div className={styles.statsBadges}>
      <MessageCountBadgeComponent
        count={stats.messageCount}
        deletedCount={stats.deletedCount}
      />
      <RequestCountBadgeComponent count={stats.requestCount} />
      {stats.uniqueModels?.length > 0 && (
        <ModelBadgeComponent
          models={stats.uniqueModels}
          providers={stats.uniqueProviders}
        />
      )}
      {stats.totalTokens?.total > 0 && (
        <>
          <TokenCountBadgeComponent
            value={stats.totalTokens.input}
            label="tokens in"
          />
          <TokenCountBadgeComponent
            value={stats.totalTokens.output}
            label="tokens out"
          />
          <TokenCountBadgeComponent
            value={stats.totalTokens.total}
            label="tokens total"
          />
          {stats.totalTokens.cacheRead > 0 && (
            <TokenCountBadgeComponent
              value={stats.totalTokens.cacheRead}
              label="cached read"
            />
          )}
          {stats.totalTokens.cacheWrite > 0 && (
            <TokenCountBadgeComponent
              value={stats.totalTokens.cacheWrite}
              label="cached write"
            />
          )}
          {stats.totalTokens.reasoning > 0 && (
            <TokenCountBadgeComponent
              value={stats.totalTokens.reasoning}
              label="reasoning"
            />
          )}
        </>
      )}
      {liveTokensPerSec !== null ? (
        <span
          className={`${styles.statBadge} ${(computedTokPerSec !== null || hasActiveWorkers || turnActive) ? styles.speedBadge : styles.staleSpeedBadge}`}
        >
          ⚡ {liveTokensPerSec.toFixed(1)} tok/s
        </span>
      ) : (
        stats.avgTokensPerSec != null && (
          <span className={`${styles.statBadge} ${styles.avgSpeedBadge}`}>
            ⚡ {stats.avgTokensPerSec.toFixed(1)} tok/s
          </span>
        )
      )}
      {/* TTFT badge — live during processing, latched after first token, static after completion */}
      {liveTtft !== null ? (
        <span
          className={`${styles.statBadge} ${isLiveTtft ? styles.ttftBadgeLive : styles.ttftBadge}`}
        >
          ⏱ {liveTtft.toFixed(isLiveTtft ? 1 : 2)}s TTFT
        </span>
      ) : (
        (stats.avgTimeToGeneration ?? sessionStats?.lastTimeToGeneration) !=
          null && (
          <span className={`${styles.statBadge} ${styles.ttftBadge}`}>
            ⏱{" "}
            {(
              stats.avgTimeToGeneration ?? sessionStats?.lastTimeToGeneration
            ).toFixed(2)}
            s TTFT
          </span>
        )
      )}
      <CostBadgeComponent cost={stats.totalCost} />
      {stats.originalTotalCost > 0 &&
        stats.originalTotalCost !== stats.totalCost && (
          <span className={`${styles.statBadge} ${styles.statBadgeSub}`}>
            ({formatCost(stats.originalTotalCost)} total)
          </span>
        )}
      {showFull && activeElapsedTime > 0 && (
        <StopwatchBadgeComponent
          seconds={activeElapsedTime}
          live={!!stats.currentTurnStart}
        />
      )}
      {!showFull && stats.completedElapsedTime > 0 && (
        <StopwatchBadgeComponent
          seconds={stats.completedElapsedTime}
          live={false}
        />
      )}
      {(() => {
        // When viewing "all" stats and there are workers, aggregate tools from orchestrator and workers
        const displayTools = (() => {
          if (
            statsTab !== "all" ||
            !sessionStats?.workers ||
            !sessionStats?.orchestrator
          ) {
            return stats.usedTools || [];
          }

          // Merge tools from orchestrator and workers
          const toolMap = new Map();

          // Add orchestrator tools
          if (sessionStats.orchestrator?.usedTools) {
            for (const tool of sessionStats.orchestrator.usedTools) {
              toolMap.set(
                tool.name,
                (toolMap.get(tool.name) || 0) + (tool.count || 1),
              );
            }
          }

          // Add worker tools
          if (sessionStats.workers?.usedTools) {
            for (const tool of sessionStats.workers.usedTools) {
              toolMap.set(
                tool.name,
                (toolMap.get(tool.name) || 0) + (tool.count || 1),
              );
            }
          }

          // Convert back to array and sort by count
          return Array.from(toolMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        })();

        if (!displayTools?.length) return null;

        const capabilities = displayTools.filter((t) =>
          CAPABILITY_TOOL_NAMES.has(t.name),
        );
        const toolCalls = displayTools.filter(
          (t) => !CAPABILITY_TOOL_NAMES.has(t.name),
        );
        return (
          <>
            {capabilities.map((tool) => (
              <ToolBadgeComponent
                key={tool.name}
                name={tool.name}
                count={tool.count}
              />
            ))}
            {toolCalls.map((tool) => (
              <ToolCallBadgeComponent
                key={tool.name}
                name={tool.name}
                count={tool.count}
              />
            ))}
          </>
        );
      })()}
      {stats.modalities && Object.values(stats.modalities).some(Boolean) && (
        <ModalityIconComponent modalities={stats.modalities} />
      )}
    </div>
  );

  return (
    <>
      <div className={styles.container}>
        <div className={styles.sessionStats}>
          <div className={styles.statsHeader}>
            <Layers size={12} style={{ marginRight: 4 }} /> {sessionLabel}
            {showStatsTabBar && (
              <StatsTabBarComponent
                activeTab={statsTab}
                onChange={setStatsTab}
              />
            )}
          </div>
          {activeStats ? (
            renderStatsBadges(activeStats, statsTab === "all")
          ) : (
            <div className={styles.statsBadges}>
              <MessageCountBadgeComponent count={0} />
            </div>
          )}
        </div>

        {workflows.length > 0 && (
          <div className={styles.section} style={{ marginBottom: 12 }}>
            <div className={styles.sectionHeader}>
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
              {resolveProviderLabel(settings.provider) || "-"}
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
        {agentToggles?.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>Agent</div>
            {agentToggles.map((toggle) => (
              <div
                key={toggle.key}
                className={`${styles.modalityRow} ${styles.toolToggleRow}`}
              >
                <span className={styles.modalityIcon}>{toggle.icon}</span>
                <span className={styles.modalityName}>{toggle.label}</span>
                {toggle.type === "cycle" ? (
                  <CycleButton
                    value={toggle.value}
                    isActive={toggle.isActive}
                    onClick={toggle.onChange}
                    title={toggle.title}
                  />
                ) : (
                  <ToggleSwitch
                    checked={toggle.checked}
                    onChange={toggle.onChange}
                    size="mini"
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Tools ───────────────────────────────────────────────── */}
        {selectedModelDef?.tools &&
          selectedModelDef.tools.length > 0 &&
          (() => {
            const TOOL_LABELS = {
              google: { "Web Search": "Google Search" },
              anthropic: selectedModelDef?.webFetch
                ? { "Web Search": "Web Fetch" }
                : {},
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
                  const alwaysOn =
                    !canDisable && settings.provider === "google";
                  const modelName = (settings.model || "").toLowerCase();
                  const nameBasedThinking = [
                    "qwen3",
                    "deepseek-r1",
                    "deepseek-v3",
                    "gpt-oss",
                    "gemma-4",
                  ].some((p) => modelName.includes(p));
                  const lmCanToggle =
                    isLmStudio &&
                    (selectedModelDef?.thinking || nameBasedThinking);
                  const lmLocked = isLmStudio && !lmCanToggle;
                  return {
                    checked: isLive
                      ? (settings.liveThinkingLevel || "none") !== "none"
                      : lmLocked || alwaysOn
                        ? true
                        : isLmStudio
                          ? settings.thinkingEnabled !== false
                          : settings.thinkingEnabled || false,
                    onChange: isLive
                      ? (val) =>
                          onChange({ liveThinkingLevel: val ? "low" : "none" })
                      : lmLocked || alwaysOn
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
                case "Tool Calling":
                  return {
                    checked:
                      lockedTools?.has("Tool Calling") ||
                      settings.functionCallingEnabled ||
                      false,
                    onChange: lockedTools?.has("Tool Calling")
                      ? () => {}
                      : (val) => onChange({ functionCallingEnabled: val }),
                    disabled: !!lockedTools?.has("Tool Calling"),
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
              <div className={styles.section}>
                <div className={styles.sectionHeader}>Native Tools</div>
                {selectedModelDef.tools.map((tool) => {
                  const toggle = TOGGLEABLE_TOOLS.has(tool)
                    ? getToolToggle(tool)
                    : null;
                  return (
                    <div
                      key={tool}
                      className={`${styles.modalityRow} ${toggle ? styles.toolToggleRow : ""}`}
                    >
                      <ToolBadgeComponent
                        name={getToolLabel(tool)}
                        tooltip={tool}
                      />
                      <span style={{ flex: 1 }} />
                      {readOnly ? (
                        toggle ? (
                          <span
                            className={`${styles.modalityStatus} ${toggle.checked ? styles.modalityActive : ""}`}
                          >
                            {tool === "Image Generation"
                              ? toggle.checked
                                ? "Forced"
                                : "Default"
                              : toggle.checked
                                ? "On"
                                : "Off"}
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
                          size="mini"
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
