import { useMemo, useCallback } from "react";
import TableComponent from "./TableComponent";
import {
  benchmarkStatusColumn,
  benchmarkModelColumn,
  benchmarkToolsColumn,
  benchmarkThinkingColumn,
  benchmarkSizeColumn,
  benchmarkResponseColumn,
  benchmarkLatencyColumn,
  benchmarkDurationColumn,
  benchmarkTokensInColumn,
  benchmarkTokensOutColumn,
  benchmarkTokPerSecColumn,
  benchmarkCostColumn,
  benchmarkDateColumn,
  benchmarkMatchModeColumn,
} from "../utils/tableColumns";
import styles from "./BenchmarksTableComponent.module.css";

/**
 * BenchmarksTableComponent — reusable table for displaying benchmark run
 * results (per-model pass/fail, response, latency, throughput, cost).
 *
 * Eager row population: when `pendingTargets` is provided, all model
 * rows are shown immediately (as "Queued"). Completed results replace
 * their pending counterparts, the active model shows a progress bar,
 * and remaining targets appear dimmed with a queued indicator.
 *
 * @param {Object}   props
 * @param {Array}    props.results           - Array of per-model result objects from a benchmark run
 * @param {string}   [props.emptyText]       - Text shown when no results
 * @param {boolean}  [props.mini]            - Mini density mode
 * @param {string}   [props.title]           - Optional table title
 * @param {number}   [props.maxHeight]       - Optional max height for scrollable body
 * @param {string}   [props.sortKey]         - Current sort key
 * @param {string}   [props.sortDir]         - Current sort direction
 * @param {Function} [props.onSort]          - (key, dir) => void
 * @param {string}   [props.expectedValue]   - Expected value to highlight in responses
 * @param {Function} [props.onRowClick]      - (row) => void — called when a row is clicked
 * @param {string}   [props.activeRowKey]    - Key of the currently active/selected row
 * @param {Object}   [props.activeModel]     - Currently running model { provider, model, label, isLocal }
 * @param {number}   [props.activeProgress]  - 0–1 progress of the active model
 * @param {string}   [props.activePhase]     - Phase label ("Connecting", "Generating", etc.)
 * @param {Array}    [props.pendingTargets]  - Full list of model targets for the current run
 */
export default function BenchmarksTableComponent({
  results = [],
  expectedValue,
  modelConfigMap = {},
  emptyText = "No results",
  mini = false,
  title,
  maxHeight,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  activeRowKey,
  activeModel,
  activeProgress = 0,
  activePhase = "",
  pendingTargets = [],
}) {
  const columns = useMemo(
    () => [
      benchmarkStatusColumn(),
      benchmarkModelColumn(),
      benchmarkToolsColumn(),
      benchmarkThinkingColumn(),
      benchmarkSizeColumn({ modelConfigMap }),
      benchmarkMatchModeColumn(),
      benchmarkResponseColumn({ expectedValue }),
      benchmarkDurationColumn(),
      benchmarkLatencyColumn(),
      benchmarkTokensInColumn(),
      benchmarkTokensOutColumn(),
      benchmarkTokPerSecColumn(),
      benchmarkCostColumn(),
      benchmarkDateColumn(),
    ],
    [expectedValue, modelConfigMap],
  );

  // Build display data: completed results + active running row + queued pending rows
  const displayData = useMemo(() => {
    // No pending targets — fall back to simple results-only mode
    if (!pendingTargets.length) {
      if (!activeModel) return results;
      // Legacy path: single synthetic running row
      const runningRow = {
        _running: true,
        _progress: activeProgress,
        _phase: activePhase,
        provider: activeModel.provider,
        model: activeModel.model,
        label: activeModel.label || activeModel.model,
      };
      return [...results, runningRow];
    }

    // Eager population: build a row for every target
    // Track which targets have completed results by index (order-preserving)
    const rows = [];
    const completedByIndex = new Map();

    // Map completed results back to their target index by matching provider + model/display_name
    // Results arrive in order, so the i-th result of a given provider:model corresponds
    // to the i-th target with that same provider:model.
    const targetCounters = new Map(); // "provider:model" → next expected index among targets
    const resultCounters = new Map(); // "provider:model" → next result index

    // First pass: count how many times each target key appears
    for (let i = 0; i < pendingTargets.length; i++) {
      const t = pendingTargets[i];
      const tKey = `${t.provider}:${t.model}`;
      if (!targetCounters.has(tKey)) targetCounters.set(tKey, []);
      targetCounters.get(tKey).push(i);
    }

    // Map each result to its target index
    for (const r of results) {
      const rKey = `${r.provider}:${r.model}`;
      const count = resultCounters.get(rKey) || 0;
      const indices = targetCounters.get(rKey);
      if (indices && count < indices.length) {
        completedByIndex.set(indices[count], r);
      }
      resultCounters.set(rKey, count + 1);
    }

    for (let i = 0; i < pendingTargets.length; i++) {
      const target = pendingTargets[i];

      // Check if this target has a completed result
      if (completedByIndex.has(i)) {
        rows.push(completedByIndex.get(i));
        continue;
      }

      // Check if this is the currently active model
      if (activeModel && activeModel.provider === target.provider && activeModel.model === target.model) {
        // Verify it's the right instance (first unfinished one for this key)
        const rKey = `${target.provider}:${target.model}`;
        const completedCount = resultCounters.get(rKey) || 0;
        const indices = targetCounters.get(rKey);
        const isActiveInstance = indices && indices.indexOf(i) === completedCount;

        if (isActiveInstance) {
          rows.push({
            _running: true,
            _progress: activeProgress,
            _phase: activePhase,
            provider: activeModel.provider,
            model: activeModel.model,
            label: activeModel.label || activeModel.model,
          });
          continue;
        }
      }

      // Pending/queued
      rows.push({
        _pending: true,
        provider: target.provider,
        model: target.model,
        label: target.display_name || target.model,
      });
    }

    return rows;
  }, [results, activeModel, activeProgress, activePhase, pendingTargets]);

  // Assign a CSS class for running/pending rows
  const getRowClassName = useCallback((row) => {
    if (row._running) return styles.runningRow;
    if (row._pending) return styles.pendingRow;
    return "";
  }, []);

  // Build a custom style variable for progress width on running rows
  const getRowStyle = useCallback((row) => {
    if (!row._running) return undefined;
    return { "--progress": `${activeProgress * 100}%` };
  }, [activeProgress]);

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={displayData}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      onRowClick={onRowClick}
      activeRowKey={activeRowKey}
      getRowKey={(r, i) => `${r.provider}:${r.label}:${i}`}
      getRowClassName={getRowClassName}
      getRowStyle={getRowStyle}
      emptyText={emptyText}
      mini={mini}
      storageKey="benchmarks"
    />
  );
}
