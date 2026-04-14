import styles from "./ButtonComponent.module.css";
import SoundService from "@/services/SoundService";

/**
 * Standardized button component used across Retina and admin pages.
 * @param {Object} props
 * @param {"primary"|"secondary"|"ghost"|"danger"} [props.variant="primary"]
 * @param {"xs"|"sm"|"md"|"lg"} [props.size="md"]
 * @param {React.ComponentType} [props.icon] - Lucide icon component
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.fullWidth]
 * @param {React.ReactNode} props.children
 */
export default function ButtonComponent({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  children,
  className = "",
  onClick,
  ...rest
}) {
  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    loading ? styles.loading : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      className={classes}
      disabled={disabled || loading}
      onMouseEnter={(e) => SoundService.playHoverButton({ event: e })}
      onClick={(e) => { SoundService.playClickButton({ event: e }); onClick?.(e); }}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} />
      ) : Icon ? (
        <Icon
          size={
            size === "xs" ? 12 : size === "sm" ? 14 : size === "lg" ? 18 : 16
          }
        />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}

