import { useMemo } from "react";
import TableComponent from "./TableComponent";
import {
  benchmarkStatusColumn,
  benchmarkModelColumn,
  benchmarkResponseColumn,
  benchmarkLatencyColumn,
  benchmarkDurationColumn,
  benchmarkTokensInColumn,
  benchmarkTokensOutColumn,
  benchmarkTokPerSecColumn,
  benchmarkCostColumn,
  benchmarkMatchModeColumn,
} from "../utils/tableColumns";

/**
 * BenchmarksTableComponent — reusable table for displaying benchmark run
 * results (per-model pass/fail, response, latency, throughput, cost).
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
 */
export default function BenchmarksTableComponent({
  results = [],
  expectedValue,
  emptyText = "No results",
  mini = false,
  title,
  maxHeight,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
}) {
  const columns = useMemo(
    () => [
      benchmarkStatusColumn(),
      benchmarkModelColumn(),
      benchmarkMatchModeColumn(),
      benchmarkResponseColumn({ expectedValue }),
      benchmarkDurationColumn(),
      benchmarkLatencyColumn(),
      benchmarkTokensInColumn(),
      benchmarkTokensOutColumn(),
      benchmarkTokPerSecColumn(),
      benchmarkCostColumn(),
    ],
    [expectedValue],
  );

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={results}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      onRowClick={onRowClick}
      getRowKey={(r, i) => `${r.provider}:${r.label}:${i}`}
      emptyText={emptyText}
      mini={mini}
    />
  );
}
