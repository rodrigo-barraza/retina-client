import ToolIconComponent from "../../components/ToolIconComponent";
import CostBadgeComponent from "../../components/CostBadgeComponent";
import {
  modelColumn,
  providerColumn,
  projectColumn,
  modalitiesColumn,
  endpointColumn,
  tokenColumns,
  statusColumn,
  createdAtColumn,
  latencyColumn,
  emptyDash,
} from "../../utils/tableColumns";

export const getRequestsColumns = () => [
  createdAtColumn("timestamp"),
  projectColumn(),
  modalitiesColumn(),
  endpointColumn(),
  providerColumn(),
  modelColumn(),
  {
    key: "toolsUsed",
    label: "Tools",
    sortable: true,
    align: "left",
    render: (r) => {
      if (!r.toolsUsed || !r.toolNames?.length) return emptyDash();
      return <ToolIconComponent toolNames={r.toolNames} />;
    },
  },
  ...tokenColumns({ inputKey: "inputTokens", outputKey: "outputTokens", tpsKey: "tokensPerSec" }),
  {
    key: "estimatedCost",
    label: "Cost",
    render: (r) => <CostBadgeComponent cost={r.estimatedCost} />,
    align: "right",
  },
  latencyColumn("totalTime", "Latency"),
  statusColumn(),
];
