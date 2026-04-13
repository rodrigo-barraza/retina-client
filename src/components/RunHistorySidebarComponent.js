"use client";

import { useState, useMemo } from "react";
import {
  History,
  CheckCircle2,
  XCircle,
  Coins,
  Clock,
  Loader2,
  ListChecks,
  AlertTriangle,
  Cpu,
  X,
  Brain,
  Wrench,
  Copy,
  Bot,
  Settings,
} from "lucide-react";
import BadgeComponent from "./BadgeComponent";
import ChatPreviewComponent from "./ChatPreviewComponent";
import TabBarComponent from "./TabBarComponent";
import ProviderLogo from "./ProviderLogos";
import { formatCost } from "../utils/utilities";
import styles from "./RunHistorySidebarComponent.module.css";

/**
 * RunHistorySidebarComponent — left sidebar for the benchmark detail page.
 * Two tabs: General (models/assertions/prompt) and Run History.
 *
 * Props:
 *   benchmark          — the benchmark document
 *   runHistory         — array of past runs
 *   activeRunId        — currently viewed run's id
 *   onViewRun          — callback(run) to switch to a run
 *   running            — whether a run is currently in progress
 *   streamingCompleted — number of completed models in the current streaming run
 *   thinkingMap        — Map<instanceId, boolean> per-model thinking toggle state
 *   onToggleThinking   — callback(instanceId) to toggle thinking
 *   toolsMap           — Map<instanceId, boolean> per-model tools toggle state
 *   onToggleTools      — callback(instanceId) to toggle tools
 *   agentInstances     — array of agent instances
 *   onRemoveAgent      — callback(instanceId) to remove agent
 *   onChangeAgentModel — callback(instanceId, provider, modelName) to change agent's backing model
 *   allModels          — flat array of all model definitions
 */
export default function RunHistorySidebarComponent({
  benchmark,
  runHistory = [],
  activeRunId,
  onViewRun,
  running = false,
  streamingCompleted = 0,
  // Model selection props
  selectedModels = [],
  onRemoveModel,
  onClearSelection,
  // Thinking toggle props
  thinkingMap = {},
  onToggleThinking,
  // Tools toggle props
  toolsMap = {},
  onToggleTools,
  // Agent instance props
  agentInstances = [],
  onRemoveAgent,
  onChangeAgentModel,
  allModels = [],
}) {
  const [activeTab, setActiveTab] = useState("general");

  // Derive assertions array (backward compat)
  const assertions = useMemo(() => {
    if (benchmark?.assertions?.length > 0) return benchmark.assertions;
    if (benchmark?.expectedValue) {
      return [{ expectedValue: benchmark.expectedValue, matchMode: benchmark.matchMode || "contains" }];
    }
    return [];
  }, [benchmark]);

  const operator = benchmark?.assertionOperator || "AND";

  if (!benchmark) return null;

  return (
    <div className={styles.container}>
      {/* ── Tab Bar ──────────────────────────────────────── */}
      <TabBarComponent
        tabs={[
          {
            key: "general",
            icon: <Settings size={14} />,
            tooltip: "General",
            badge: selectedModels.length + agentInstances.length,
            badgeDisabled: (selectedModels.length + agentInstances.length) === 0,
          },
          {
            key: "history",
            icon: <History size={14} />,
            tooltip: "Run History",
            badge: runHistory.length,
            badgeDisabled: runHistory.length === 0,
          },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* ════════════════════════════════════════════════════
          TAB: General — Models, Agents, Assertions, Prompt
          ════════════════════════════════════════════════════ */}
      {activeTab === "general" && (
        <div className={styles.tabContent}>
          {/* ── Assertions ──────────────────────────────── */}
          {assertions.length > 0 && (
            <div className={styles.assertionsSection}>
              <div className={styles.sectionLabel}>
                <ListChecks size={12} />
                Assertions
              </div>
              <div className={styles.assertionsList}>
                {assertions.map((a, i) => (
                  <div key={i} className={styles.assertionRow}>
                    {i > 0 && (
                      <BadgeComponent
                        variant={operator === "OR" ? "warning" : "info"}
                      >
                        {operator}
                      </BadgeComponent>
                    )}
                    <BadgeComponent variant="accent">
                      {a.matchMode || "contains"}
                    </BadgeComponent>
                    <span className={styles.assertionValue} title={a.expectedValue}>
                      {a.expectedValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Prompt Preview ──────────────────────────── */}
          {(benchmark.prompt || benchmark.systemPrompt) && (
            <div className={styles.promptSection}>
              <ChatPreviewComponent
                systemPrompt={benchmark.systemPrompt}
                messages={[
                  { role: "user", content: benchmark.prompt },
                ]}
                mini
              />
            </div>
          )}

          {/* ── Model Selection ─────────────────────────── */}
          <div className={styles.modelsSection}>
            <div className={styles.sectionLabel}>
              <Cpu size={12} />
              Models
              <span className={styles.modelCountBadge}>
                {selectedModels.length}
              </span>
            </div>

            {/* Selected model cards */}
            {selectedModels.length > 0 ? (
              <div className={styles.modelCards}>
                {selectedModels.map((m) => {
                  const label = m.display_name || m.label || m.name;
                  const isThinking = !!thinkingMap[m.instanceId];
                  const isTools = !!toolsMap[m.instanceId];
                  const supportsThinking = !!m.thinking;
                  // Count how many instances of this same model exist
                  const dupeCount = selectedModels.filter(
                    (s) => s.provider === m.provider && s.name === m.name
                  ).length;
                  return (
                    <div key={m.instanceId} className={styles.modelCard}>
                      <div className={styles.modelCardHeader}>
                        <ProviderLogo provider={m.provider} size={14} />
                        <span className={styles.modelCardName} title={label}>
                          {label}
                        </span>
                        {dupeCount > 1 && (
                          <span className={styles.dupeBadge} title={`${dupeCount} instances of this model`}>
                            <Copy size={8} />
                            {dupeCount}
                          </span>
                        )}
                        <button
                          className={styles.modelCardRemove}
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveModel?.(m.instanceId);
                          }}
                          title="Remove"
                        >
                          <X size={10} />
                        </button>
                      </div>
                      <div className={styles.modelCardFooter}>
                        <span className={styles.modelCardProvider}>
                          {m.provider}
                        </span>
                        <div className={styles.modelCardToggles}>
                          <button
                            className={`${styles.toolsToggle} ${isTools ? styles.toolsToggleActive : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleTools?.(m.instanceId);
                            }}
                            title={isTools ? "Disable tools" : "Enable tools (calculator)"}
                          >
                            <Wrench size={10} />
                            <span>Tools</span>
                          </button>
                          {supportsThinking && (
                            <button
                              className={`${styles.thinkingToggle} ${isThinking ? styles.thinkingToggleActive : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleThinking?.(m.instanceId);
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
                })}
              </div>
            ) : (
              <div className={styles.emptyModels}>
                Use the model picker above to select models
              </div>
            )}

            {/* Agent instance cards + Clear all */}
            {(selectedModels.length > 0 || agentInstances.length > 0) && (
              <>
                {agentInstances.length > 0 && (
                  <div className={styles.modelCards}>
                    {agentInstances.map((a) => {
                      const isThinking = !!thinkingMap[a.instanceId];
                      // Filter to models that support function calling
                      const fcModels = allModels.filter((m) =>
                        (m.tools || []).includes("Function Calling")
                      );
                      const currentKey = a.provider && a.modelName
                        ? `${a.provider}:${a.modelName}`
                        : "";
                      // Find current model to check thinking support
                      const currentModelDef = allModels.find(
                        (m) => m.provider === a.provider && m.name === a.modelName
                      );
                      const supportsThinking = currentModelDef?.thinking || (currentModelDef?.tools || []).includes("Thinking");
                      return (
                        <div key={a.instanceId} className={`${styles.modelCard} ${styles.agentCard}`}>
                          <div className={styles.modelCardHeader}>
                            <Bot size={14} className={styles.agentBotIcon} />
                            <span className={styles.modelCardName} title={a.name}>
                              {a.name}
                            </span>
                            <span className={styles.agentBadge}>Agent</span>
                            <button
                              className={styles.modelCardRemove}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveAgent?.(a.instanceId);
                              }}
                              title="Remove"
                            >
                              <X size={10} />
                            </button>
                          </div>
                          {/* Model selector */}
                          <div className={styles.agentModelSelect}>
                            {a.provider && (
                              <ProviderLogo provider={a.provider} size={12} />
                            )}
                            <select
                              className={styles.agentSelect}
                              value={currentKey}
                              onChange={(e) => {
                                const [p, ...rest] = e.target.value.split(":");
                                onChangeAgentModel?.(a.instanceId, p, rest.join(":"));
                              }}
                            >
                              <option value="" disabled>Select model…</option>
                              {fcModels.map((m) => (
                                <option key={`${m.provider}:${m.name}`} value={`${m.provider}:${m.name}`}>
                                  {m.display_name || m.label || m.name} ({m.provider})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.modelCardFooter}>
                            <span className={styles.modelCardProvider}>
                              {a.description}
                            </span>
                            <div className={styles.modelCardToggles}>
                              {supportsThinking && (
                                <button
                                  className={`${styles.thinkingToggle} ${isThinking ? styles.thinkingToggleActive : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleThinking?.(a.instanceId);
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
                    })}
                  </div>
                )}
                <div className={styles.modelActions}>
                  <button
                    className={styles.clearModelsBtn}
                    onClick={onClearSelection}
                  >
                    Clear all
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════
          TAB: Run History
          ════════════════════════════════════════════════════ */}
      {activeTab === "history" && (
        <div className={styles.tabContent}>
          {/* ── Running Banner ──────────────────────────── */}
          {running && (
            <div className={styles.runningBanner}>
              <Loader2 size={14} className={styles.spinIcon} />
              Running… {streamingCompleted > 0 ? `${streamingCompleted} done` : ""}
            </div>
          )}

          {/* ── Run History List ────────────────────────── */}
          <div className={styles.list}>
            {runHistory.length === 0 ? (
              <div className={styles.empty}>
                <Clock size={14} />
                No runs yet
              </div>
            ) : (
              runHistory.map((run, idx) => {
                const isActive = activeRunId === run.id;
                const passRate = run.summary.total > 0
                  ? (run.summary.passed / run.summary.total) * 100
                  : 0;
                const totalCost =
                  run.summary.totalCost ??
                  run.models?.reduce((s, r) => s + (r.estimatedCost || 0), 0) ??
                  0;

                return (
                  <div
                    key={run.id}
                    className={`${styles.runItem} ${isActive ? styles.runItemActive : ""} ${run.aborted ? styles.runItemAborted : ""}`}
                    onClick={() => onViewRun(run)}
                    data-panel-close
                  >
                    <div className={styles.runItemHeader}>
                      <span className={styles.runIndex}>#{runHistory.length - idx}</span>
                      <span className={styles.runDate}>
                        {new Date(run.completedAt).toLocaleString()}
                      </span>
                      {run.aborted && (
                        <AlertTriangle size={11} style={{ color: "var(--warning)", flexShrink: 0 }} />
                      )}
                    </div>
                    <div className={styles.runStats}>
                      <span className={styles.statPassed}>
                        <CheckCircle2 size={10} />
                        {run.summary.passed}
                      </span>
                      <span className={styles.statFailed}>
                        <XCircle size={10} />
                        {run.summary.failed + (run.summary.errored || 0)}
                      </span>
                      {totalCost > 0 && (
                        <span className={styles.statCost}>
                          <Coins size={10} />
                          {formatCost(totalCost)}
                        </span>
                      )}
                      <div className={`${styles.miniPassBar} ${styles.miniPassBarHasRuns}`}>
                        <div
                          className={styles.miniPassBarFill}
                          style={{ width: `${passRate}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
