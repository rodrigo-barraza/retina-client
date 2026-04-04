import TableComponent from "./TableComponent";
import {
  projectColumn,
  requestsColumn,
  usageColumn,
  providerCountColumn,
  modelCountColumn,
  tokenColumns,
  costColumns,
  latencyColumn,
  countLinkColumns,
} from "../utils/tableColumns";

/**
 * ProjectsTableComponent — reusable admin table for displaying project-level
 * aggregated stats (requests, tokens, cost, latency, etc.).
 *
 * @param {Object}  props
 * @param {Array}   props.projects          - Array of project stat objects
 * @param {number}  [props.totalRequests]   - Sum of all project requests (for proportion bars)
 * @param {number}  [props.totalCost]       - Sum of all project costs (for proportion bars)
 * @param {string}  [props.emptyText]       - Text shown when no data
 * @param {boolean} [props.compact]         - Reduced column set
 * @param {string}  [props.title]           - Optional table title
 * @param {number}  [props.maxHeight]       - Optional max height for scrollable body
 */
export default function ProjectsTableComponent({
  projects = [],
  totalRequests: totalRequestsProp,
  totalCost: totalCostProp,
  emptyText = "No projects yet",
  compact = false,
  title = "Projects",
  maxHeight = 420,
}) {
  const totalRequests =
    (totalRequestsProp ?? projects.reduce((s, x) => s + x.totalRequests, 0)) || 1;
  const totalCost =
    (totalCostProp ?? projects.reduce((s, x) => s + (x.totalCost || 0), 0)) || 1;

  const allColumns = [
    projectColumn(),
    requestsColumn(),
    usageColumn(totalRequests),
    providerCountColumn(),
    modelCountColumn(),
    ...tokenColumns(),
    ...costColumns(totalCost),
    latencyColumn(),
    ...countLinkColumns("project", (row) => row.project),
  ];

  const COMPACT_KEYS = [
    "project",
    "totalRequests",
    "totalCost",
    "avgLatency",
    "sessionCount",
    "conversationCount",
  ];
  const columns = compact
    ? allColumns.filter((c) => COMPACT_KEYS.includes(c.key))
    : allColumns;

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={projects}
      getRowKey={(p, i) => p.project || i}
      emptyText={emptyText}
    />
  );
}
