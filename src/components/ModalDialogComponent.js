"use client";

import ModalOverlayComponent from "./ModalOverlayComponent";
import CloseButtonComponent from "./CloseButtonComponent";
import styles from "./ModalDialogComponent.module.css";

/**
 * ModalDialogComponent — Structured modal dialog with header, body, and footer.
 *
 * Wraps ModalOverlayComponent with a standard panel layout (title bar,
 * scrollable body, sticky footer) so consumers only provide content.
 *
 * @param {string}  title        — Header title text
 * @param {Function} onClose     — Called when X/overlay/Escape dismisses the modal
 * @param {React.ReactNode} [footer] — Footer content (typically action buttons)
 * @param {"sm"|"md"|"lg"} [size="md"] — Panel width preset
 * @param {string}  [className]  — Additional class on the panel div
 * @param {React.ReactNode} children — Body content
 */
export default function ModalDialogComponent({
  title,
  onClose,
  footer,
  size = "md",
  className,
  children,
}) {
  const panelClass = [
    styles.panel,
    styles[`size_${size}`],
    className || "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ModalOverlayComponent onClose={onClose} portal>
      <div className={panelClass}>
        <div className={styles.header}>
          <span className={styles.title}>{title}</span>
          <CloseButtonComponent onClick={onClose} size={16} />
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </ModalOverlayComponent>
  );
}
