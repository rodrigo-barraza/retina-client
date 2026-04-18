import { Layers, Bot, Users } from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./StatsTabBarComponent.module.css";

/**
 * StatsTabBarComponent — segmented control for switching between
 * "All", "Orchestrator" and "Workers" stats views.
 *
 * Only rendered when the active agent can spawn worker sub-agents;
 * the parent is responsible for gating visibility via the `visible` prop
 * (or simply not rendering the component).
 *
 * @param {object}   props
 * @param {string}   props.activeTab  - Current tab key ("all" | "orchestrator" | "workers")
 * @param {Function} props.onChange   - Called with the new tab key on click
 */

const TABS = [
  { key: "all",          label: "All",          icon: <Layers size={10} /> },
  { key: "orchestrator", label: "Orchestrator",  icon: <Bot size={10} /> },
  { key: "workers",      label: "Workers",       icon: <Users size={10} /> },
];

export default function StatsTabBarComponent({ activeTab, onChange }) {
  return (
    <div className={styles.statsTabBar}>
      {TABS.map((tab) => (
        <TooltipComponent key={tab.key} label={tab.label} position="bottom" delay={200}>
          <button
            className={`${styles.statsTabBtn}${activeTab === tab.key ? ` ${styles.statsTabBtnActive}` : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon}
          </button>
        </TooltipComponent>
      ))}
    </div>
  );
}
