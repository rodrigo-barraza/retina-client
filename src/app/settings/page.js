"use client";

import NavigationSidebarComponent from "../../components/NavigationSidebarComponent";
import SettingsPageComponent from "../../components/SettingsPageComponent";
import styles from "./page.module.css";

export default function SettingsPage() {
  return (
    <div className={styles.pageWrapper}>
      <NavigationSidebarComponent mode="user" />
      <div className={styles.page}>
        <SettingsPageComponent />
      </div>
    </div>
  );
}
