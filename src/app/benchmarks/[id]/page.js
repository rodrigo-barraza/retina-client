"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import NavigationSidebarComponent from "../../../components/NavigationSidebarComponent";
import BenchmarkDetailPageComponent from "../../../components/BenchmarkDetailPageComponent";
import BenchmarkSidebarComponent from "../../../components/BenchmarkSidebarComponent";
import styles from "../page.module.css";

export default function BenchmarkDetailPage() {
  const { id } = useParams();
  const [isRunning, setIsRunning] = useState(false);
  return (
    <div className={styles.pageWrapper}>
      <NavigationSidebarComponent mode="user" isGenerating={isRunning} />
      <div className={styles.page}>
        <BenchmarkDetailPageComponent
          benchmarkId={id}
          onRunningChange={setIsRunning}
          sidebar={<BenchmarkSidebarComponent activeBenchmarkId={id} />}
        />
      </div>
    </div>
  );
}
