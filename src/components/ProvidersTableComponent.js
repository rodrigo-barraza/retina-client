import {
  FolderOpen,
  MessageSquare,
  Workflow,
} from "lucide-react";
import SortableTableComponent from "./SortableTableComponent";
import ProvidersBadgeComponent from "./ProvidersBadgeComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";
import CountLinkComponent from "./CountLinkComponent";
import CostBadgeComponent from "./CostBadgeComponent";
import ProportionBarComponent from "./ProportionBarComponent";
import {
  formatNumber,
  formatLatency,
  formatTokensPerSec,
} from "../utils/utilities";

const PROVIDER_COLORS = [
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ef4444",
  "#06b6d4",
];

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
    {
      key: "provider",
      label: "Provider",
      render: (p) => (
        <ProvidersBadgeComponent providers={p.provider ? [p.provider] : []} />
      ),
    },
    {
      key: "totalRequests",
      label: "Requests",
      align: "right",
      render: (p) => formatNumber(p.totalRequests),
    },
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
    {
      key: "modelCount",
      label: "Models",
      sortValue: (p) => (p.models?.length || p.modelCount || 0),
      render: (p) => (
        <ModelBadgeComponent models={p.models || []} />
      ),
    },
    {
      key: "totalInputTokens",
      label: "Tokens In",
      render: (p) => formatNumber(p.totalInputTokens),
    },
    {
      key: "totalOutputTokens",
      label: "Tokens Out",
      render: (p) => formatNumber(p.totalOutputTokens),
    },
    {
      key: "avgTokensPerSec",
      label: "Tok/s",
      render: (p) => formatTokensPerSec(p.avgTokensPerSec),
    },
    {
      key: "totalCost",
      label: "Cost",
      render: (p) => <CostBadgeComponent cost={p.totalCost} />,
    },
    {
      key: "costShare",
      label: "Cost %",
      sortValue: (p) => p.totalCost,
      render: (p) => (
        <ProportionBarComponent
          value={p.totalCost}
          total={totalCost}
          color="var(--warning)"
        />
      ),
    },
    {
      key: "avgLatency",
      label: "Avg Latency",
      render: (p) => formatLatency(p.avgLatency),
    },
    {
      key: "sessionCount",
      label: "Sessions",
      align: "right",
      render: (p) => (
        <CountLinkComponent
          count={p.sessionCount}
          href={`/admin/sessions?provider=${encodeURIComponent(p.provider)}`}
          icon={FolderOpen}
        />
      ),
    },
    {
      key: "conversationCount",
      label: "Conversations",
      align: "right",
      render: (p) => (
        <CountLinkComponent
          count={p.conversationCount}
          href={`/admin/conversations?provider=${encodeURIComponent(p.provider)}`}
          icon={MessageSquare}
        />
      ),
    },
    {
      key: "workflowCount",
      label: "Workflows",
      align: "right",
      render: (p) => (
        <CountLinkComponent
          count={p.workflowCount}
          href={`/admin/workflows?provider=${encodeURIComponent(p.provider)}`}
          icon={Workflow}
        />
      ),
    },
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
    <SortableTableComponent
      title={title}
      maxHeight={maxHeight}
      columns={columns}
      data={providers}
      getRowKey={(p) => p.provider}
      emptyText={emptyText}
    />
  );
}
