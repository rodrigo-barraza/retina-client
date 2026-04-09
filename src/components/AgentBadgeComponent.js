import { Bot } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./AgentBadgeComponent.module.css";

/**
 * AgentBadgeComponent — displays a single agent name with a bot icon,
 * or an "N agents" badge with a tooltip listing all names.
 *
 * @param {string[]} agents — array of agent name strings (e.g. ["CODING", "LUPOS"])
 * @param {string}   [className]
 * @param {boolean}  [mini]
 */
export default function AgentBadgeComponent({ agents = [], className = "", mini = false }) {
  if (!agents || agents.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const iconSize = mini ? 8 : 10;
  const cls = `${styles.badge} ${mini ? styles.mini : ""} ${className}`;

  if (agents.length === 1) {
    return (
      <span className={cls} title={agents[0]}>
        <Bot size={iconSize} />
        <span className={styles.agentName}>{agents[0]}</span>
      </span>
    );
  }

  return (
    <TooltipComponent label={agents.join(", ")} position="top">
      <span className={cls}>
        <Bot size={iconSize} />
        {agents.length} agents
      </span>
    </TooltipComponent>
  );
}
