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
 * When `activeModel` is provided, a synthetic "running" row is appended
 * to the table with a progress bar overlay, replacing the old streaming feed.
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

  // Build display data: completed results + optional synthetic running row
  const displayData = useMemo(() => {
    if (!activeModel) return results;
    const runningRow = {
      _running: true,
      _progress: activeProgress,
      _phase: activePhase,
      provider: activeModel.provider,
      model: activeModel.model,
      label: activeModel.label || activeModel.model,
    };
    return [...results, runningRow];
  }, [results, activeModel, activeProgress, activePhase]);

  // Assign a CSS class for the running row (progress bar overlay)
  const getRowClassName = useCallback((row) => {
    if (!row._running) return "";
    return styles.runningRow;
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
