import BadgeComponent from "../../../components/BadgeComponent";
import ProportionBarComponent from "../../../components/ProportionBarComponent";
import {
  createdAtColumn,
  statusColumn,
  emptyDash,
} from "../../../utils/tableColumns";
import { formatLatency } from "../../../utils/utilities";

/**
 * getToolRequestsColumns — column definitions for the tool-call telemetry table.
 *
 * @param {Object} [opts]
 * @param {number} [opts.totalDuration=1] — Total elapsed ms across all visible calls
 *                                          (used for Duration % proportion bar)
 */
export const getToolRequestsColumns = ({ totalDuration = 1 } = {}) => [
  createdAtColumn("timestamp"),
  {
    key: "toolName",
    label: "Tool",
    description: "The tool function that was invoked",
    sortable: true,
    render: (r) => (
      <BadgeComponent variant="provider">{r.toolName || "—"}</BadgeComponent>
    ),
  },
  {
    key: "domain",
    label: "Domain",
    description: "The functional domain this tool belongs to (e.g. Weather, Health, Compute)",
    sortable: true,
    render: (r) => (
      <BadgeComponent variant="info">{r.domain || "—"}</BadgeComponent>
    ),
  },
  {
    key: "method",
    label: "Method",
    description: "HTTP method used for the tool invocation",
    sortable: false,
    render: (r) => (
      <BadgeComponent variant={r.method === "POST" ? "warning" : "endpoint"}>
        {r.method || "—"}
      </BadgeComponent>
    ),
  },
  {
    key: "callerAgent",
    label: "Agent",
    description: "The agentic persona that triggered this tool call (e.g. CODING, LUPOS)",
    sortable: true,
    render: (r) =>
      r.callerAgent ? (
        <BadgeComponent variant="accent">{r.callerAgent}</BadgeComponent>
      ) : (
        emptyDash()
      ),
  },
  {
    key: "callerUsername",
    label: "User",
    description: "The user whose session triggered the tool call",
    sortable: true,
    render: (r) =>
      r.callerUsername ? (
        <BadgeComponent variant="provider">{r.callerUsername}</BadgeComponent>
      ) : (
        emptyDash()
      ),
  },
  {
    key: "elapsedMs",
    label: "Latency",
    description: "Server-side execution time for this tool call",
    sortable: true,
    align: "right",
    render: (r) => {
      if (!r.elapsedMs || r.elapsedMs <= 0) return emptyDash();
      // Convert ms to seconds for formatLatency
      return formatLatency(r.elapsedMs / 1000);
    },
  },
  {
    key: "durationShare",
    label: "Latency %",
    description: "Proportional share of total latency",
    sortable: true,
    sortValue: (r) => r.elapsedMs || 0,
    render: (r) => (
      <ProportionBarComponent
        value={r.elapsedMs || 0}
        total={totalDuration}
        color="var(--accent-color)"
      />
    ),
  },
  {
    key: "inBytes",
    label: "In",
    description: "Request payload size in bytes",
    sortable: true,
    align: "right",
    render: (r) =>
      r.inBytes > 0
        ? `${(r.inBytes / 1024).toFixed(1)} KB`
        : emptyDash(),
  },
  {
    key: "outBytes",
    label: "Out",
    description: "Response payload size in bytes",
    sortable: true,
    align: "right",
    render: (r) =>
      r.outBytes > 0
        ? `${(r.outBytes / 1024).toFixed(1)} KB`
        : emptyDash(),
  },
  {
    key: "callerIteration",
    label: "Iteration",
    description: "The agentic loop iteration that dispatched this tool call",
    sortable: true,
    align: "right",
    render: (r) =>
      r.callerIteration != null ? (
        <BadgeComponent variant="info">#{r.callerIteration}</BadgeComponent>
      ) : (
        emptyDash()
      ),
  },
  statusColumn(),
];
