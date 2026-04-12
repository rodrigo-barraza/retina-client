"use client";

import { useMemo } from "react";
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
} from "lucide-react";
import BadgeComponent from "./BadgeComponent";
import ChatPreviewComponent from "./ChatPreviewComponent";
import ProviderLogo from "./ProviderLogos";
import { formatCost } from "../utils/utilities";
import styles from "./RunHistorySidebarComponent.module.css";

/**
 * RunHistorySidebarComponent — left sidebar for the benchmark detail page.
 * Shows the benchmark's assertions and run history list.
 *
 * Props:
 *   benchmark          — the benchmark document
 *   runHistory         — array of past runs
 *   activeRunId        — currently viewed run's id
 *   onViewRun          — callback(run) to switch to a run
 *   running            — whether a run is currently in progress
 *   streamingCompleted — number of completed models in the current streaming run
 *   thinkingMap        — Map<"provider:model", boolean> per-model thinking toggle state
 *   onToggleThinking   — callback(key) to toggle thinking for a model
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
}) {
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
      {/* ── Model Selection ─────────────────────────────────── */}
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
              const key = `${m.provider}:${m.name}`;
              const label = m.display_name || m.label || m.name;
              const isThinking = !!thinkingMap[key];
              const isTools = !!toolsMap[key];
              const supportsThinking = !!m.thinking;
              return (
                <div key={key} className={styles.modelCard}>
                  <div className={styles.modelCardHeader}>
                    <ProviderLogo provider={m.provider} size={14} />
                    <span className={styles.modelCardName} title={label}>
                      {label}
                    </span>
                    <button
                      className={styles.modelCardRemove}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveModel?.(key);
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
                          onToggleTools?.(key);
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
                            onToggleThinking?.(key);
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

        {/* Clear action */}
        {selectedModels.length > 0 && (
          <div className={styles.modelActions}>
            <button
              className={styles.clearModelsBtn}
              onClick={onClearSelection}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* ── Assertions ──────────────────────────────────────── */}
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

      {/* ── Prompt Preview ──────────────────────────────────── */}
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

      {/* ── Running Banner ──────────────────────────────────── */}
      {running && (
        <div className={styles.runningBanner}>
          <Loader2 size={14} className={styles.spinIcon} />
          Running… {streamingCompleted > 0 ? `${streamingCompleted} done` : ""}
        </div>
      )}

      {/* ── Run History ─────────────────────────────────────── */}
      <div className={styles.historyHeader}>
        <div className={styles.historyLabel}>
          <History size={12} />
          Run History
        </div>
        {runHistory.length > 0 && (
          <span className={styles.historyCount}>{runHistory.length}</span>
        )}
      </div>

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
                  <div className={styles.miniPassBar}>
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
  );
}
