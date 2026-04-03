import ToolIconComponent from "../../components/ToolIconComponent";
import {
  modelColumn,
  providerColumn,
  projectColumn,
  modalitiesColumn,
  endpointColumn,
  tokenColumns,
  costColumns,
  statusColumn,
  createdAtColumn,
  latencyColumn,
  emptyDash,
  valueOrDash,
} from "../../utils/tableColumns";
import { formatLatency } from "../../utils/utilities";
import ProportionBarComponent from "../../components/ProportionBarComponent";

/**
 * getRequestsColumns — shared column definitions for the requests table.
 *
 * @param {Object} [opts]
 * @param {number} [opts.totalCost=1] — Total cost across all visible requests
 *                                       (used for the Cost % proportion bar)
 * @param {number} [opts.totalDuration=1] — Total duration across all visible requests
 *                                          (used for Duration % proportion bar)
 * @param {boolean} [opts.mini=false] — Mini density mode
 */
export const getRequestsColumns = ({ totalCost = 1, totalDuration = 1, mini = false } = {}) => [
  createdAtColumn("timestamp"),
  projectColumn(),
  modalitiesColumn({ mini }),
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
      return <ToolIconComponent toolNames={r.toolNames} size={mini ? 10 : undefined} />;
    },
  },
  ...tokenColumns({ inputKey: "inputTokens", outputKey: "outputTokens", tpsKey: "tokensPerSec" }),
  ...costColumns(totalCost, { costKey: "estimatedCost", mini }),
  latencyColumn("totalTime", "Latency"),
  {
    key: "duration",
    label: "Duration",
    sortable: true,
    sortValue: (r) => r.totalTime || 0,
    align: "right",
    render: (r) => valueOrDash(r.totalTime, (v) => formatLatency(v)),
  },
  {
    key: "durationShare",
    label: "Duration %",
    sortable: true,
    sortValue: (r) => r.totalTime || 0,
    render: (r) => (
      <ProportionBarComponent
        value={r.totalTime || 0}
        total={totalDuration}
        color="var(--accent-color)"
        mini={mini}
      />
    ),
  },
  statusColumn(),
];
