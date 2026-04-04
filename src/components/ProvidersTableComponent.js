import TableComponent from "./TableComponent";
import ProportionBarComponent from "./ProportionBarComponent";
import {
  providerColumn,
  requestsColumn,
  modelCountColumn,
  tokenColumns,
  costColumns,
  latencyColumn,
  countLinkColumns,
  PROVIDER_COLORS,
} from "../utils/tableColumns";

/**
 * ProvidersTableComponent — reusable admin table for displaying provider-level
 * aggregated stats (requests, tokens, cost, latency, etc.).
 *
 * @param {Object}  props
 * @param {Array}   props.providers         - Array of provider stat objects
 * @param {number}  [props.totalRequests]   - Sum of all provider requests (for proportion bars)
 * @param {number}  [props.totalCost]       - Sum of all provider costs (for proportion bars)
 * @param {string}  [props.emptyText]       - Text shown when no data
 * @param {boolean} [props.compact]         - Reduced column set
 * @param {string}  [props.title]           - Optional table title
 * @param {number}  [props.maxHeight]       - Optional max height for scrollable body
 */
export default function ProvidersTableComponent({
  providers = [],
  totalRequests: totalRequestsProp,
  totalCost: totalCostProp,
  emptyText = "No data yet",
  compact = false,
  title = "Providers",
  maxHeight = 420,
}) {
  const totalRequests =
    (totalRequestsProp ??
    providers.reduce((s, p) => s + p.totalRequests, 0)) || 1;
  const totalCost =
    (totalCostProp ??
    providers.reduce((s, p) => s + (p.totalCost || 0), 0)) || 1;

  const allColumns = [
    providerColumn(),
    requestsColumn(),
    {
      key: "usage",
      label: "Usage",
      sortValue: (p) => p.totalRequests,
      render: (p, i) => (
        <ProportionBarComponent
          value={p.totalRequests}
          total={totalRequests}
          color={PROVIDER_COLORS[i % PROVIDER_COLORS.length]}
        />
      ),
    },
    modelCountColumn(),
    ...tokenColumns(),
    ...costColumns(totalCost),
    latencyColumn(),
    ...countLinkColumns("provider", (row) => row.provider),
  ];

  const COMPACT_KEYS = [
    "provider",
    "totalRequests",
    "modelCount",
    "totalCost",
    "avgLatency",
  ];
  const columns = compact
    ? allColumns.filter((c) => COMPACT_KEYS.includes(c.key))
    : allColumns;

  return (
    <TableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={providers}
      getRowKey={(p) => p.provider}
      emptyText={emptyText}
    />
  );
}
