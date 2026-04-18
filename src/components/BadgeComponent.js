import TooltipComponent from "./TooltipComponent";
import styles from "./BadgeComponent.module.css";

/**
 * BadgeComponent — standardized inline badge/pill.
 *
 * @param {"provider"|"endpoint"|"modality"|"success"|"error"|"info"|"accent"|"warning"} [variant="info"]
 * @param {React.ReactNode} children
 * @param {string} [className]
 * @param {string} [tooltip] — optional tooltip label shown on hover
 */
export default function BadgeComponent({
  variant = "info",
  children,
  className = "",
  mini = false,
  tooltip,
  ...rest
}) {
  const badge = (
    <span
      className={`${styles.badge} ${styles[variant] || ""} ${mini ? styles.mini : ""} ${className}`}
      {...rest}
    >
      {children}
    </span>
  );

  if (tooltip) {
    return (
      <TooltipComponent label={tooltip} position="top">
        {badge}
      </TooltipComponent>
    );
  }

  return badge;
}
