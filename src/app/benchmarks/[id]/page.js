"use client";

import { useParams } from "next/navigation";
import NavigationSidebarComponent from "../../../components/NavigationSidebarComponent";
import BenchmarkDetailPageComponent from "../../../components/BenchmarkDetailPageComponent";
import styles from "../page.module.css";

export default function BenchmarkDetailPage() {
  const { id } = useParams();
  return (
    <div className={styles.pageWrapper}>
      <NavigationSidebarComponent mode="user" />
      <div className={styles.page}>
        <BenchmarkDetailPageComponent benchmarkId={id} />
      </div>
    </div>
  );
}
