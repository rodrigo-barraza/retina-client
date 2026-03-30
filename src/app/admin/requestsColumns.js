import ModalityIconComponent from "../../components/ModalityIconComponent";
import ToolIconComponent from "../../components/ToolIconComponent";
import ProvidersBadgeComponent from "../../components/ProvidersBadgeComponent";
import BadgeComponent from "../../components/BadgeComponent";
import CostBadgeComponent from "../../components/CostBadgeComponent";
import {
  formatNumber,
  formatLatency,
  formatTokensPerSec,
  formatDateTime,
} from "../../utils/utilities";

export const getRequestsColumns = () => [
  {
    key: "timestamp",
    label: "Time",
    render: (r) => formatDateTime(r.timestamp),
  },
  { key: "project", label: "Project" },
  {
    key: "modality",
    label: "Modality",
    sortable: false,
    render: (r) => {
      if (!r.modalities) return <span style={{ color: "var(--text-muted)" }}>—</span>;
      return (
        <ModalityIconComponent
          modalities={r.modalities}
          size={13}
        />
      );
    },
  },
  {
    key: "endpoint",
    label: "Endpoint",
    render: (r) => (
      <BadgeComponent variant="endpoint">{r.endpoint || "-"}</BadgeComponent>
    ),
  },
  {
    key: "provider",
    label: "Provider",
    render: (r) => (
      <ProvidersBadgeComponent providers={r.provider ? [r.provider] : []} />
    ),
  },
  { key: "model", label: "Model" },
  {
    key: "toolsUsed",
    label: "Tools",
    sortable: true,
    align: "left",
    render: (r) => {
      if (!r.toolsUsed || !r.toolNames?.length) {
        return <span style={{ color: "var(--text-muted)" }}>—</span>;
      }
      return <ToolIconComponent toolNames={r.toolNames} />;
    },
  },
  {
    key: "inputTokens",
    label: "In Tokens",
    render: (r) => formatNumber(r.inputTokens),
    align: "right",
  },
  {
    key: "outputTokens",
    label: "Out Tokens",
    render: (r) => formatNumber(r.outputTokens),
    align: "right",
  },
  {
    key: "totalTokens",
    label: "Tokens",
    sortable: false,
    render: (r) => formatNumber((r.inputTokens || 0) + (r.outputTokens || 0)),
    align: "right",
  },
  {
    key: "estimatedCost",
    label: "Cost",
    render: (r) => <CostBadgeComponent cost={r.estimatedCost} />,
    align: "right",
  },
  {
    key: "tokensPerSec",
    label: "Tok/s",
    render: (r) => formatTokensPerSec(r.tokensPerSec),
    align: "right",
  },
  {
    key: "totalTime",
    label: "Latency",
    render: (r) => formatLatency(r.totalTime),
    align: "right",
  },
  {
    key: "success",
    label: "Status",
    render: (r) => (
      <BadgeComponent variant={r.success ? "success" : "error"}>
        {r.success ? "OK" : "ERR"}
      </BadgeComponent>
    ),
  },
];
