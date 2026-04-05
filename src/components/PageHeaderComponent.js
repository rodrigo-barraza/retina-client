import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./PageHeaderComponent.module.css";

/**
 * PageHeaderComponent — unified page header with optional back navigation.
 *
 * @param {string} title
 * @param {string} [subtitle]
 * @param {string} [backHref] — if provided, renders a back arrow link
 * @param {React.ReactNode} [children] — right-side action slot
 */
export default function PageHeaderComponent({
  title,
  subtitle,
  backHref,
  children,
}) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.headerLeft}>
        {backHref && (
          <Link href={backHref} className={styles.backBtn}>
            <ArrowLeft size={16} />
          </Link>
        )}
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {children && <div className={styles.headerActions}>{children}</div>}
    </div>
  );
}
