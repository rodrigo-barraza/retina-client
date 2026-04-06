import { useMemo, useCallback } from "react";
import TableComponent from "./TableComponent";
import styles from "./BenchmarkDashboardComponent.module.css";
import {
  dashboardModelColumn,
  dashboardProviderColumn,
  dashboardTestsColumn,
  dashboardPassedColumn,
  dashboardFailedColumn,
  dashboardPassRateColumn,
  dashboardAvgLatencyColumn,
  dashboardCostColumn,
} from "../utils/tableColumns";

/**
 * BenchmarkDashboardTableComponent — reusable table for the /benchmarks
 * dashboard, displaying aggregated per-model performance stats.
 * Uses the shared TableComponent base with column definitions from
 * tableColumns.js, following the same pattern as BenchmarksTableComponent,
 * ConversationsTableComponent, etc.
 *
 * @param {Object}   props
 * @param {Array}    props.models           - Array of aggregated model stats
 * @param {Function} [props.onRowClick]     - (row) => void — called when a row is clicked
 * @param {Object}   [props.selectedModel]  - Currently selected model row (for highlight)
 * @param {string}   [props.emptyText]      - Text shown when no data
 * @param {string}   [props.title]          - Optional table title
 * @param {number}   [props.maxHeight]      - Optional max height for scrollable body
 */
export default function BenchmarkDashboardTableComponent({
  models = [],
  onRowClick,
  selectedModel,
  emptyText = "No benchmark data",
  title,
  maxHeight,
}) {
  const columns = useMemo(
    () => [
      dashboardPassRateColumn(),
      dashboardPassedColumn(),
      dashboardFailedColumn(),
      dashboardModelColumn(),
      dashboardProviderColumn(),
      dashboardTestsColumn(),
      dashboardAvgLatencyColumn(),
      dashboardCostColumn(),
    ],
    [],
  );

  const getRowClassName = useCallback(
    (row) => {
      if (
        selectedModel &&
        row.model === selectedModel.model &&
        row.provider === selectedModel.provider
      ) {
        return styles.selectedRow;
      }
      return "";
    },
    [selectedModel],
  );

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={models}
      getRowKey={(m) => `${m.provider}:${m.model}`}
      onRowClick={onRowClick}
      getRowClassName={getRowClassName}
      emptyText={emptyText}
      storageKey="benchmark-dashboard"
    />
  );
}
