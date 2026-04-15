"use client";

import { useState, useMemo } from "react";
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ListChecks,
  AlertTriangle,
  Cpu,
  Settings,
} from "lucide-react";
import AgentCardComponent from "./AgentCardComponent";
import ModelCardComponent from "./ModelCardComponent";
import BadgeComponent from "./BadgeComponent";
import ChatPreviewComponent from "./ChatPreviewComponent";
import TabBarComponent from "./TabBarComponent";
import CostBadgeComponent from "./CostBadgeComponent";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import BenchmarkBarComponent from "./BenchmarkBarComponent";
import SoundService from "@/services/SoundService";
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
  onChangeModel,
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
  // Config for ModelPickerPopoverComponent inside AgentCardComponent
  config,
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
                  const isThinking = !!thinkingMap[m.instanceId];
                  const isTools = !!toolsMap[m.instanceId];
                  const supportsThinking = !!m.thinking;
                  const dupeCount = selectedModels.filter(
                    (s) => s.provider === m.provider && s.name === m.name
                  ).length;
                  return (
                    <ModelCardComponent
                      key={m.instanceId}
                      model={m}
                      dupeCount={dupeCount}
                      isThinking={isThinking}
                      supportsThinking={supportsThinking}
                      isTools={isTools}
                      config={config}
                      onRemove={onRemoveModel}
                      onChangeModel={onChangeModel}
                      onToggleThinking={onToggleThinking}
                      onToggleTools={onToggleTools}
                    />
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
                      const currentModelDef = allModels.find(
                        (m) => m.provider === a.provider && m.name === a.modelName
                      );
                      const supportsThinking = currentModelDef?.thinking || (currentModelDef?.tools || []).includes("Thinking");
                      return (
                        <AgentCardComponent
                          key={a.instanceId}
                          agent={a}
                          isThinking={isThinking}
                          supportsThinking={supportsThinking}
                          config={config}
                          onRemove={onRemoveAgent}
                          onChangeModel={onChangeAgentModel}
                          onToggleThinking={onToggleThinking}
                        />
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
                const totalCost =
                  run.summary.totalCost ??
                  run.models?.reduce((s, r) => s + (r.estimatedCost || 0), 0) ??
                  0;

                return (
                  <div
                    key={run.id}
                    className={`${styles.runItem} ${isActive ? styles.runItemActive : ""} ${run.aborted ? styles.runItemAborted : ""}`}
                    {...SoundService.interactive(() => onViewRun(run))}
                    data-panel-close
                  >
                    <div className={styles.runItemHeader}>
                      <DateTimeBadgeComponent date={run.completedAt} mini />
                      <CostBadgeComponent cost={totalCost} mini />
                      <span className={styles.runIndex}>#{runHistory.length - idx}</span>
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
                      <BenchmarkBarComponent
                        passed={run.summary.passed}
                        total={run.summary.total}
                        mini
                      />
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
