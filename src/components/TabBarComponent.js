"use client";

import styles from "./TabBarComponent.module.css";

/**
 * TabBarComponent — An inline tab switcher for sidebars/panels.
 *
 * @param {Array<{key: string, label?: string, icon?: React.ReactNode, badge?: number|string, disabled?: boolean}>} tabs
 * @param {string} activeTab — The currently active tab key
 * @param {Function} onChange — (key: string) => void
 * @param {string} [className] — Additional class on the container
 */
export default function TabBarComponent({
  tabs = [],
  activeTab,
  onChange,
  className,
}) {
  return (
    <div
      className={`${styles.tabBar}${className ? ` ${className}` : ""}`}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`${styles.tab}${activeTab === tab.key ? ` ${styles.tabActive}` : ""}${tab.disabled ? ` ${styles.tabDisabled}` : ""}${tab.badgeDisabled ? ` ${styles.tabDimmed}` : ""}`}
          onClick={() => !tab.disabled && onChange(tab.key)}
        >
          {tab.icon}
          {tab.label}
          {tab.badge != null && (
            <span className={`${styles.tabBadge}${tab.badgeDisabled ? ` ${styles.tabBadgeDisabled}` : ""}`}>{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export { styles as tabBarStyles };
