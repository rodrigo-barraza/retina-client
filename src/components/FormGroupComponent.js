"use client";

import styles from "./FormGroupComponent.module.css";

/**
 * FormGroupComponent — A labeled form field wrapper.
 *
 * @param {string} label — The label text
 * @param {boolean} [readOnly=false] — Render readOnlyContent instead of children
 * @param {React.ReactNode} [readOnlyContent] — Content shown in read-only mode
 * @param {React.ReactNode} children — The input element(s)
 * @param {string} [className] — Additional class on the wrapper
 * @param {object} [style] — Inline styles on the wrapper
 */
export default function FormGroupComponent({
  label,
  hint,
  readOnly = false,
  readOnlyContent,
  children,
  className,
  style,
}) {
  return (
    <div
      className={`${styles.formGroup}${className ? ` ${className}` : ""}`}
      style={style}
    >
      {label && <label>{label}</label>}
      {readOnly ? (
        <div className={styles.readOnlyValue}>{readOnlyContent ?? "—"}</div>
      ) : (
        children
      )}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  );
}

/**
 * Re-export the inputField class for raw <input> elements that need
 * consistent styling without a full FormGroupComponent wrapper.
 */
export { styles as formGroupStyles };
