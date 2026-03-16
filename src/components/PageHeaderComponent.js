import styles from "./PageHeaderComponent.module.css";

export default function PageHeaderComponent({ title, subtitle, children }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {children && <div className={styles.headerActions}>{children}</div>}
    </div>
  );
}
