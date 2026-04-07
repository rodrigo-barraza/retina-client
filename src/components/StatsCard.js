import styles from "./StatsCard.module.css";

export default function StatsCard({
  label,
  value,
  subtitle,
  icon: Icon,
  variant = "accent",
  loading = false,
  className,
  onMouseEnter,
  onMouseLeave,
}) {
  if (loading) {
    return (
      <div className={`${styles.card} ${className || ""}`}>
        <div className={styles.header}>
          <div className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        </div>
        <div className={`${styles.skeleton} ${styles.skeletonValue}`} />
      </div>
    );
  }

  return (
    <div
      className={`${styles.card} ${className || ""}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
        {Icon && (
          <div className={`${styles.icon} ${styles[variant] || ""}`}>
            <Icon size={14} />
          </div>
        )}
      </div>
      <span className={styles.value}>{value}</span>
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
    </div>
  );
}
