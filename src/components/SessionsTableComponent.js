import {
  FolderOpen,
  MessageSquare,
  Zap,
  Clock,
} from "lucide-react";
import SortableTableComponent from "./SortableTableComponent";
import ConversationsTableComponent from "./ConversationsTableComponent";
import ProjectBadgeComponent from "./ProjectBadgeComponent";
import UserBadgeComponent from "./UserBadgeComponent";
import CostBadgeComponent from "./CostBadgeComponent";
import ModalityIconComponent from "./ModalityIconComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";
import ProvidersBadgeComponent from "./ProvidersBadgeComponent";
import ToolIconComponent from "./ToolIconComponent";
import { formatNumber, formatDateTime, formatLatency, formatTokensPerSec } from "../utils/utilities";

import styles from "./SessionsTableComponent.module.css";

/** Merge modalities from all conversations into a single object */
function mergeModalities(conversations) {
  const merged = {};
  for (const c of conversations) {
    if (!c.modalities) continue;
    for (const [key, val] of Object.entries(c.modalities)) {
      if (val) merged[key] = true;
    }
  }
  return Object.keys(merged).length > 0 ? merged : null;
}

/** Format session duration from startedAt/finishedAt */
function formatDuration(session) {
  if (!session.startedAt || !session.finishedAt) return null;
  const ms = new Date(session.finishedAt) - new Date(session.startedAt);
  if (ms < 1000) return "<1s";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`;
}

const SESSION_COLUMNS = [
  {
    key: "id",
    label: "Session",
    sortable: false,
    render: (s) => (
      <span className={styles.sessionIdCell}>
        <FolderOpen size={12} className={styles.sessionIcon} />
        <span className={styles.sessionIdText}>{s.id.slice(0, 8)}</span>
      </span>
    ),
  },
  {
    key: "project",
    label: "Project",
    sortable: false,
    render: (s) => <ProjectBadgeComponent project={s.project} />,
  },
  {
    key: "username",
    label: "User",
    sortable: false,
    render: (s) => <UserBadgeComponent username={s.username} />,
  },
  {
    key: "modalities",
    label: "Modalities",
    sortable: false,
    render: (s) => {
      const merged = mergeModalities(s.conversations || []);
      if (!merged) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return <ModalityIconComponent modalities={merged} size={12} />;
    },
  },
  {
    key: "models",
    label: "Models",
    sortable: false,
    render: (s) => <ModelBadgeComponent models={s.models} />,
  },
  {
    key: "providers",
    label: "Providers",
    sortable: false,
    render: (s) => <ProvidersBadgeComponent providers={s.providers} />,
  },
  {
    key: "toolNames",
    label: "Tools",
    sortable: false,
    align: "left",
    render: (s) => <ToolIconComponent toolNames={s.toolNames} />,
  },
  {
    key: "conversationCount",
    label: "Convos",
    sortable: true,
    align: "right",
    render: (s) => {
      const count = s.conversationCount || (s.conversations || []).length || 0;
      return (
        <span className={styles.countCell}>
          <MessageSquare size={10} />
          {count}
        </span>
      );
    },
  },
  {
    key: "requestCount",
    label: "Requests",
    sortable: true,
    align: "right",
    render: (s) =>
      (s.requestCount || 0) > 0 ? (
        <span className={styles.countCell}>
          <Zap size={10} />
          {s.requestCount}
        </span>
      ) : (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ),
  },
  {
    key: "totalInputTokens",
    label: "In Tokens",
    sortable: true,
    align: "right",
    render: (s) =>
      (s.totalInputTokens || 0) > 0 ? (
        formatNumber(s.totalInputTokens)
      ) : (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ),
  },
  {
    key: "totalOutputTokens",
    label: "Out Tokens",
    sortable: true,
    align: "right",
    render: (s) =>
      (s.totalOutputTokens || 0) > 0 ? (
        formatNumber(s.totalOutputTokens)
      ) : (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ),
  },
  {
    key: "avgTokensPerSec",
    label: "Tok/s",
    sortable: true,
    align: "right",
    render: (s) => formatTokensPerSec(s.avgTokensPerSec),
  },
  {
    key: "totalLatency",
    label: "Latency",
    sortable: true,
    align: "right",
    render: (s) =>
      s.totalLatency > 0 ? (
        formatLatency(s.totalLatency)
      ) : (
        <span style={{ color: "var(--text-muted)" }}>—</span>
      ),
  },
  {
    key: "totalCost",
    label: "Cost",
    sortable: true,
    align: "right",
    render: (s) => <CostBadgeComponent cost={s.totalCost} />,
  },
  {
    key: "duration",
    label: "Duration",
    sortable: false,
    align: "right",
    render: (s) => {
      const dur = formatDuration(s);
      if (!dur) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return (
        <span className={styles.durationCell}>
          <Clock size={10} />
          {dur}
        </span>
      );
    },
  },
  {
    key: "createdAt",
    label: "Created",
    sortable: true,
    align: "right",
    render: (s) => {
      return formatDateTime(s.createdAt);
    },
  },
];

/**
 * SessionsTableComponent — reusable sessions table with expandable conversation rows.
 *
 * @param {Object}  props
 * @param {Array}   props.sessions       - Array of session objects
 * @param {string}  [props.emptyText]    - Text shown when no sessions
 * @param {boolean} [props.compact]      - Hide some columns for compact layouts
 * @param {boolean} [props.mini]         - Mini density mode
 * @param {string}  [props.title]        - Optional table title
 * @param {number}  [props.maxHeight]    - Optional max height for scrollable body
 */
export default function SessionsTableComponent({
  sessions = [],
  emptyText = "No sessions",
  compact = false,
  mini = false,
  title,
  maxHeight,
}) {
  // In compact mode, show a reduced column set
  const columns = compact
    ? SESSION_COLUMNS.filter((c) =>
        ["id", "project", "username", "conversationCount", "requestCount", "totalCost", "createdAt", "duration"].includes(c.key),
      )
    : SESSION_COLUMNS;

  return (
    <SortableTableComponent
      columns={columns}
      data={sessions}
      getRowKey={(s) => s.id}
      renderExpandedContent={(session) => (
        <ConversationsTableComponent
          conversations={session.conversations || []}
          emptyText="No conversations linked"
          compact
          mini
        />
      )}
      emptyText={emptyText}
      title={title}
      maxHeight={maxHeight}
      mini={mini}
    />
  );
}
