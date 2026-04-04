import TableComponent from "./TableComponent";
import RequestsTableComponent from "./RequestsTableComponent";
import {
  sessionIdColumn,
  projectColumn,
  userColumn,
  modalitiesColumn,
  modelsListColumn,
  providersListColumn,
  toolsColumn,

  requestCountColumn,
  tokenColumns,
  costColumns,
  latencyColumn,
  durationColumn,
  createdAtColumn,
} from "../utils/tableColumns";
import styles from "./SessionsTableComponent.module.css";

/**
 * SessionsTableComponent — reusable sessions table with expandable rows
 * showing both a conversations table and a requests table side by side.
 *
 * @param {Object}  props
 * @param {Array}   props.sessions       - Array of session objects
 * @param {string}  [props.emptyText]    - Text shown when no sessions
 * @param {boolean} [props.compact]      - Hide some columns for compact layouts
 * @param {boolean} [props.mini]         - Mini density mode
 * @param {string}  [props.title]        - Optional table title
 * @param {number}  [props.maxHeight]    - Optional max height for scrollable body
 * @param {string}  [props.sortKey]    - Current sort key (for server-side sorting)
 * @param {string}  [props.sortDir]    - Current sort direction
 * @param {Function} [props.onSort]    - (key, dir) => void (server-side sort)
 * @param {Function} [props.onRequestRowClick] - (request) => void, opens detail drawer
 */
export default function SessionsTableComponent({
  sessions = [],
  emptyText = "No sessions",
  compact = false,
  mini = false,
  title,
  maxHeight,
  sortKey,
  sortDir,
  onSort,
  onRequestRowClick,
}) {
  const SESSION_COLUMNS = [
    sessionIdColumn(),
    projectColumn(),
    userColumn(),
    modalitiesColumn({ fromConversations: true }),
    modelsListColumn(),
    providersListColumn(),
    toolsColumn(),

    requestCountColumn(),
    ...tokenColumns({ showDash: true }),
    ...costColumns(1, { costKey: "totalCost" }),
    latencyColumn("totalLatency", "Latency"),
    durationColumn(),
    createdAtColumn(),
  ];

  // Remove costShare for sessions — not useful without a global total
  const allColumns = SESSION_COLUMNS.filter((c) => c.key !== "costShare");

  const COMPACT_KEYS = [
    "id", "project", "username",
    "requestCount", "totalCost", "createdAt", "duration",
  ];
  const columns = compact
    ? allColumns.filter((c) => COMPACT_KEYS.includes(c.key))
    : allColumns;

  return (
    <TableComponent
      columns={columns}
      data={sessions}
      getRowKey={(s) => s.id}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      renderExpandedContent={(session) => (
        <div className={styles.expandedPanels}>
          <RequestsTableComponent
            requests={session.requests || []}
            emptyText="No requests"
            title="Requests"
            onRowClick={onRequestRowClick}
          />
        </div>
      )}
      emptyText={emptyText}
      title={title}
      maxHeight={maxHeight}
      mini={mini}
    />
  );
}
