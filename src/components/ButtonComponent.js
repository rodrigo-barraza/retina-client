import { forwardRef } from "react";
import styles from "./ButtonComponent.module.css";
import SoundService from "@/services/SoundService";

/**
 * Standardized button component used across Retina and admin pages.
 * @param {Object} props
 * @param {"primary"|"secondary"|"disabled"|"destructive"|"creative"|"submit"} [props.variant="primary"]
 * @param {"xs"|"sm"|"md"|"lg"} [props.size="md"]
 * @param {React.ComponentType} [props.icon] - Lucide icon component
 * @param {boolean} [props.loading]
 * @param {boolean} [props.disabled]
 * @param {boolean} [props.fullWidth]
 * @param {boolean} [props.isGenerating] - Submit variant: shows stop icon with conic spinner
 * @param {React.ReactNode} props.children
 */
const ButtonComponent = forwardRef(function ButtonComponent({
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  isGenerating = false,
  children,
  className = "",
  onClick,
  ...rest
}, ref) {
  const isSubmit = variant === "submit";

  const classes = [
    styles.btn,
    styles[variant],
    styles[size],
    fullWidth ? styles.fullWidth : "",
    loading ? styles.loading : "",
    isSubmit && isGenerating ? styles.submitGenerating : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      ref={ref}
      className={classes}
      disabled={disabled || loading}
      type={isSubmit ? "submit" : "button"}
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
          {...(isSubmit && isGenerating ? { fill: "currentColor" } : {})}
        />
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
});

export default ButtonComponent;

