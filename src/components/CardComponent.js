import styles from "./CardComponent.module.css";

/**
 * CardComponent — generic compound card with header, body, and footer slots.
 *
 * Compound sub-components:
 *   CardComponent.Header   — top bar with icon, title, subtitle, and trailing actions
 *   CardComponent.Body     — main content area
 *   CardComponent.Footer   — bottom bar (e.g. reset / action buttons)
 *
 * Props (root):
 *   className — optional extra class
 *   children  — CardComponent.Header / Body / Footer
 *   style     — optional inline styles (use --card-accent to theme)
 */
export default function CardComponent({ className, style, children }) {
  return (
    <div
      className={`${styles.card}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {children}
    </div>
  );
}

/**
 * CardComponent.Header
 *
 * Props:
 *   icon      — Lucide icon component (rendered at 16px)
 *   title     — string
 *   subtitle  — string (right-aligned)
 *   children  — optional trailing content (badges, actions)
 *   className — optional extra class
 */
function CardHeader({ icon: Icon, title, subtitle, children, className }) {
  return (
    <div className={`${styles.header}${className ? ` ${className}` : ""}`}>
      {Icon && <Icon size={16} className={styles.icon} />}
      {title && <span className={styles.title}>{title}</span>}
      {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      {children}
    </div>
  );
}

/**
 * CardComponent.Body
 *
 * Props:
 *   children  — content
 *   className — optional extra class
 */
function CardBody({ children, className }) {
  return (
    <div className={`${styles.body}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

/**
 * CardComponent.Footer
 *
 * Props:
 *   children  — content (typically action buttons)
 *   className — optional extra class
 */
function CardFooter({ children, className }) {
  return (
    <div className={`${styles.footer}${className ? ` ${className}` : ""}`}>
      {children}
    </div>
  );
}

CardComponent.Header = CardHeader;
CardComponent.Body = CardBody;
CardComponent.Footer = CardFooter;
