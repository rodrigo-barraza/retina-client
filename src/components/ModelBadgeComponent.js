import { Cpu } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import TooltipComponent from "./TooltipComponent";
import styles from "./ModelBadgeComponent.module.css";

/**
 * ModelBadgeComponent — displays a single model name or a "N models" badge
 * with a tooltip listing all model names.
 *
 * @param {string[]} models — array of model name strings
 * @param {string} [provider] — provider key for single-model icon (e.g. "openai", "google")
 * @param {string[]} [providers] — provider keys; when a single unique provider exists, its logo is shown
 * @param {string} [className]
 * @param {boolean} [mini]
 */
export default function ModelBadgeComponent({ models = [], provider, providers, className = "", mini = false }) {
  if (!models || models.length === 0) {
    return <span style={{ color: "var(--text-muted)" }}>—</span>;
  }

  const iconSize = mini ? 8 : 10;
  const cls = `${styles.badge} ${mini ? styles.mini : ""} ${className}`;

  /* Resolve a single provider key from explicit prop or providers array */
  const resolvedProvider = provider || (providers?.length === 1 ? providers[0] : null);
  const providerIcon = resolvedProvider
    ? <ProviderLogo provider={resolvedProvider} size={iconSize} />
    : null;

  if (models.length === 1) {
    return (
      <TooltipComponent label={models[0]} position="top">
        <span className={cls}>
          {providerIcon || <Cpu size={iconSize} />}
          <span className={styles.modelName}>{models[0]}</span>
        </span>
      </TooltipComponent>
    );
  }

  return (
    <TooltipComponent label={models.join(", ")} position="top">
      <span className={cls}>
        {providerIcon || <Cpu size={iconSize} />}
        {models.length} models
      </span>
    </TooltipComponent>
  );
}
