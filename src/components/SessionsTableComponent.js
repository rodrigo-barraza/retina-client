import SortableTableComponent from "./SortableTableComponent";
import ConversationsTableComponent from "./ConversationsTableComponent";
import RequestsTableComponent from "./RequestsTableComponent";
import {
  sessionIdColumn,
  projectColumn,
  userColumn,
  modalitiesColumn,
  modelsListColumn,
  providersListColumn,
  toolsColumn,
  conversationCountColumn,
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
 * @param {Function} [props.onRequestRowClick] - (request) => void, opens detail drawer
 */
export default function SessionsTableComponent({
  sessions = [],
  emptyText = "No sessions",
  compact = false,
  mini = false,
  title,
  maxHeight,
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
    conversationCountColumn(),
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
    "id", "project", "username", "conversationCount",
    "requestCount", "totalCost", "createdAt", "duration",
  ];
  const columns = compact
    ? allColumns.filter((c) => COMPACT_KEYS.includes(c.key))
    : allColumns;

  return (
    <SortableTableComponent
      columns={columns}
      data={sessions}
      getRowKey={(s) => s.id}
      renderExpandedContent={(session) => (
        <div className={styles.expandedPanels}>
          <ConversationsTableComponent
            conversations={session.conversations || []}
            emptyText="No conversations linked"
            sessionId={session.id}
            compact
            mini
            title="Conversations"
          />
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
