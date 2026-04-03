"use client";

import NavigationSidebarComponent from "../../components/NavigationSidebarComponent";
import BenchmarkPageComponent from "../../components/BenchmarkPageComponent";
import styles from "./page.module.css";

export default function BenchmarkPage() {
  return (
    <div className={styles.pageWrapper}>
      <NavigationSidebarComponent mode="user" />
      <div className={styles.page}>
        <BenchmarkPageComponent />
      </div>
    </div>
  );
}
