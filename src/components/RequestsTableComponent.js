import { useMemo } from "react";
import TableComponent from "./TableComponent";
import { getRequestsColumns } from "../app/admin/requestsColumns";

/**
 * RequestsTableComponent — reusable admin table for displaying request logs.
 *
 * @param {Object}   props
 * @param {Array}    props.requests          - Array of request objects
 * @param {string}   [props.emptyText]       - Text shown when no data
 * @param {boolean}  [props.compact]         - Reduced column set
 * @param {boolean}  [props.mini]            - Mini density mode
 * @param {string}   [props.title]           - Optional table title
 * @param {number}   [props.maxHeight]       - Optional max height for scrollable body
 * @param {string}   [props.sortKey]         - Current sort key (for server-side sorting)
 * @param {string}   [props.sortDir]         - Current sort direction
 * @param {Function} [props.onSort]          - (key, dir) => void
 * @param {Function} [props.onRowClick]      - (request) => void
 * @param {Function} [props.onRowMouseEnter] - (row) => void
 * @param {Function} [props.onRowMouseLeave] - () => void
 * @param {Function} [props.getRowClassName] - (row) => string
 */
export default function RequestsTableComponent({
  requests = [],
  emptyText = "No requests yet",
  compact = false,
  mini = false,
  title,
  maxHeight = 420,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  onRowMouseEnter,
  onRowMouseLeave,
  getRowClassName,
}) {
  const totalCost = useMemo(
    () => requests.reduce((sum, r) => sum + (r.estimatedCost || 0), 0) || 1,
    [requests],
  );

  const totalDuration = useMemo(
    () => requests.reduce((sum, r) => sum + (r.totalTime || 0), 0) || 1,
    [requests],
  );

  const allColumns = useMemo(
    () => getRequestsColumns({ totalCost, totalDuration, mini }),
    [totalCost, totalDuration, mini],
  );

  const COMPACT_KEYS = [
    "timestamp",
    "project",
    "provider",
    "model",
    "estimatedCost",
    "totalTime",
    "success",
  ];
  const columns = compact
    ? allColumns.filter((c) => COMPACT_KEYS.includes(c.key))
    : allColumns;

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={requests}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      onRowClick={onRowClick}
      onRowMouseEnter={onRowMouseEnter}
      onRowMouseLeave={onRowMouseLeave}
      getRowClassName={getRowClassName}
      getRowKey={(r, i) => r.requestId || i}
      emptyText={emptyText}
      mini={mini}
    />
  );
}
