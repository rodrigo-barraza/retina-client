import { useMemo } from "react";
import { MessageSquare } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { MODALITY_ICONS } from "./WorkflowNodeConstants";
import styles from "./WorkflowHeaderStatsComponent.module.css";

export default function WorkflowHeaderStatsComponent({ nodes = [], edgeCount = 0 }) {
  const workflowStats = useMemo(() => {
    const modelNodes = nodes.filter((n) => !n.nodeType);
    const models = [...new Map(modelNodes.map((n) => [`${n.provider}:${n.modelName}`, { provider: n.provider, name: n.displayName || n.modelName }])).values()];
    const modalities = new Set();
    for (const n of nodes) {
      // Only boundary nodes: input assets define workflow inputs, viewers define outputs
      if (n.nodeType === "input") {
        for (const t of n.outputTypes || []) if (t !== "conversation") modalities.add(t);
      } else if (n.nodeType === "viewer") {
        for (const t of n.inputTypes || []) if (t !== "conversation") modalities.add(t);
      }
    }
    const conversationCount = modelNodes.length;
    return { models, modalities: [...modalities], conversationCount };
  }, [nodes]);

  return (
    <>
      <span className={styles.headerBadge}>
        {nodes.length} nodes · {edgeCount} edges
      </span>
      {workflowStats.modalities.length > 0 && (
        <span className={styles.headerBadge}>
          {workflowStats.modalities.map((mod) => {
            const info = MODALITY_ICONS[mod];
            if (!info) return null;
            const Icon = info.icon;
            return <Icon key={mod} size={11} style={{ color: info.color }} title={info.label} />;
          })}
        </span>
      )}
      {workflowStats.models.length > 0 && (
        <span className={styles.headerBadge}>
          {workflowStats.models.map((m) => (
            <span key={`${m.provider}:${m.name}`} className={styles.headerModelTag} title={m.name}>
              <ProviderLogo provider={m.provider} size={11} />
              {m.name}
            </span>
          ))}
        </span>
      )}
      {workflowStats.conversationCount > 0 && (
        <span className={styles.headerBadge} title="Conversations created per run">
          <MessageSquare size={11} />
          {workflowStats.conversationCount}
        </span>
      )}
    </>
  );
}
