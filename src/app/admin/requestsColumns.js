import {
  Type,
  Image as ImageIcon,
  Volume2,
  Hash,
  ArrowRight,
  Wrench,
} from "lucide-react";
import { MODALITY_COLORS, TOOL_ICON_MAP, TOOL_COLORS } from "../../components/WorkflowNodeConstants";
import TooltipComponent from "../../components/TooltipComponent";
import BadgeComponent from "../../components/BadgeComponent";
import {
  formatNumber,
  formatCost,
  formatLatency,
  formatTokensPerSec,
} from "../../utils/utilities";
import styles from "./page.module.css";

export const getRequestsColumns = () => [
  {
    key: "timestamp",
    label: "Time",
    render: (r) => (r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"),
  },
  { key: "project", label: "Project" },
  {
    key: "modality",
    label: "Modality",
    sortable: false,
    render: (r) => {
      const map = {
        chat: {
          inIcon: Type,
          inColor: MODALITY_COLORS.text,
          outIcon: Type,
          outColor: MODALITY_COLORS.text,
          label: "Text → Text",
        },
        "chat/image-api": {
          inIcon: Type,
          inColor: MODALITY_COLORS.text,
          outIcon: ImageIcon,
          outColor: MODALITY_COLORS.image,
          label: "Text → Image",
        },
        "text-to-audio": {
          inIcon: Type,
          inColor: MODALITY_COLORS.text,
          outIcon: Volume2,
          outColor: MODALITY_COLORS.audio,
          label: "Text → Audio",
        },
        "audio-to-text": {
          inIcon: Volume2,
          inColor: MODALITY_COLORS.audio,
          outIcon: Type,
          outColor: MODALITY_COLORS.text,
          label: "Audio → Text",
        },
        live: {
          inIcon: Volume2,
          inColor: MODALITY_COLORS.audio,
          outIcon: Type,
          outColor: MODALITY_COLORS.text,
          outIcon2: Volume2,
          outColor2: MODALITY_COLORS.audio,
          label: "Speech → Text + Audio",
        },
        embed: {
          inIcon: Type,
          inColor: MODALITY_COLORS.text,
          outIcon: Hash,
          outColor: MODALITY_COLORS.embedding,
          label: "Text → Embedding",
        },
      };
      let m = map[r.endpoint];
      // Detect image-output models that go through the chat endpoint
      if ((!m || r.endpoint === "chat") && r.model && /image/i.test(r.model)) {
        m = map["chat/image-api"];
      }
      // Heuristic: detect legacy live records logged as "chat" before the endpoint fix
      if ((!m || r.endpoint === "chat") && r.requestId?.startsWith("live-")) {
        m = map["live"];
      }
      m = m || map["chat"];
      const InIcon = m.inIcon;
      const OutIcon = m.outIcon;
      const outParts = m.label.split(" → ")[1]?.split(" + ") || [m.label.split(" → ")[1]];
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <TooltipComponent label={m.label.split(" → ")[0]} position="top">
            <InIcon size={13} style={{ color: m.inColor }} />
          </TooltipComponent>
          <ArrowRight
            size={10}
            style={{ color: "var(--text-muted)", opacity: 0.5 }}
          />
          <TooltipComponent label={outParts[0]} position="top">
            <OutIcon size={13} style={{ color: m.outColor }} />
          </TooltipComponent>
          {m.outIcon2 && (() => {
            const OutIcon2 = m.outIcon2;
            return (
              <>
                <span style={{ color: "var(--text-muted)", opacity: 0.4, fontSize: 10, lineHeight: 1 }}>+</span>
                <TooltipComponent label={outParts[1] || ""} position="top">
                  <OutIcon2 size={13} style={{ color: m.outColor2 }} />
                </TooltipComponent>
              </>
            );
          })()}
        </span>
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
      <BadgeComponent variant="provider">{r.provider || "-"}</BadgeComponent>
    ),
  },
  { key: "model", label: "Model" },
  {
    key: "toolsUsed",
    label: "Tools",
    sortable: true,
    align: "left",
    render: (r) => {
      const names = r.toolNames;
      if (!r.toolsUsed || !names?.length) {
        return <span style={{ color: "var(--text-muted)" }}>—</span>;
      }

      const resolved = new Map();
      for (const raw of names) {
        if (TOOL_ICON_MAP[raw]) {
          // Direct match — canonical tool name (e.g. "Web Search")
          if (!resolved.has(raw)) resolved.set(raw, TOOL_ICON_MAP[raw]);
        } else {
          // Custom function call — group under "Function Calling"
          const fallbackIcon = TOOL_ICON_MAP["Function Calling"] || Wrench;
          if (!resolved.has("Function Calling")) {
            resolved.set("Function Calling", fallbackIcon);
          }
        }
      }
      return (
        <span className={styles.toolPills}>
          {[...resolved.entries()].map(([label, Icon]) => (
            <TooltipComponent key={label} label={label} position="top">
              <span className={styles.toolPill}>
                <Icon size={12} style={{ color: TOOL_COLORS[label] || "#f97316" }} />
              </span>
            </TooltipComponent>
          ))}
        </span>
      );
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
    render: (r) => formatCost(r.estimatedCost),
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
