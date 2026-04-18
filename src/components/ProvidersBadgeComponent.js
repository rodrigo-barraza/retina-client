import { Layers } from "lucide-react";
import ProviderLogo, { resolveProviderLabel } from "./ProviderLogos";
import TooltipComponent from "./TooltipComponent";
import styles from "./ProvidersBadgeComponent.module.css";

/**
 * ProvidersBadgeComponent — displays a single provider name with its logo,
 * or a "N providers" badge with the Layers icon and a tooltip listing all names.
 *
 * @param {string[]} providers — array of provider key strings (e.g. "openai", "google")
 * @param {string}   [className]
 * @param {boolean}  [mini]
 */
export default function ProvidersBadgeComponent({ providers = [], className = "", mini = false }) {
  if (!providers || providers.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const iconSize = mini ? 8 : 10;
  const cls = `${styles.badge} ${mini ? styles.mini : ""} ${className}`;

  const displayLabel = (key) => resolveProviderLabel(key);

  if (providers.length === 1) {
    return (
      <TooltipComponent label={displayLabel(providers[0])} position="top">
        <span className={cls}>
          <ProviderLogo provider={providers[0]} size={iconSize} />
          <span className={styles.providerName}>{displayLabel(providers[0])}</span>
        </span>
      </TooltipComponent>
    );
  }

  const tooltipText = providers.map(displayLabel).join(", ");

  return (
    <TooltipComponent label={tooltipText} position="top">
      <span className={cls}>
        <Layers size={iconSize} />
        {providers.length} providers
      </span>
    </TooltipComponent>
  );
}
