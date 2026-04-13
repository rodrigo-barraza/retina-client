"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Target,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import PrismService from "../services/PrismService";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import CostBadgeComponent from "./CostBadgeComponent";
import SearchInputComponent from "./SearchInputComponent";
import styles from "./BenchmarkSidebarComponent.module.css";

/**
 * BenchmarkSidebarComponent — a navigable list of all benchmarks,
 * intended to live in the ThreePanelLayout rightSidebar slot.
 *
 * Props:
 *   activeBenchmarkId — highlight the currently viewed benchmark
 */
export default function BenchmarkSidebarComponent({ activeBenchmarkId }) {
  const router = useRouter();
  const pathname = usePathname();

  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeBenchmarkIds, setActiveBenchmarkIds] = useState(new Set());

  // ── Load benchmarks ────────────────────────────────────────
  const loadBenchmarks = useCallback(async () => {
    try {
      const { benchmarks: data } = await PrismService.getBenchmarks();
      setBenchmarks(data || []);
    } catch (err) {
      console.error("Failed to load benchmarks:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBenchmarks();
  }, [loadBenchmarks]);

  // ── Poll active benchmarks (running indicator) ─────────────
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const { activeIds } = await PrismService.getActiveBenchmarks();
        if (!cancelled) setActiveBenchmarkIds(new Set(activeIds || []));
      } catch { /* ignore */ }
    };

    poll();
    const interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Filtered list ──────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return benchmarks;
    const q = search.toLowerCase();
    return benchmarks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.prompt?.toLowerCase().includes(q) ||
        b.expectedValue?.toLowerCase().includes(q) ||
        b.assertions?.some((a) => a.expectedValue?.toLowerCase().includes(q)),
    );
  }, [benchmarks, search]);

  // ── Navigate ───────────────────────────────────────────────
  const navigate = useCallback(
    (benchmark) => {
      router.push(`/benchmarks/${benchmark.id}`);
    },
    [router],
  );

  const navigateToNew = useCallback(() => {
    router.push("/benchmarks/new");
  }, [router]);

  const isOnNewPage = pathname === "/benchmarks/new";

  return (
    <div className={styles.container}>
      {/* New Benchmark */}
      <ButtonComponent
        variant="primary"
        size="sm"
        icon={Plus}
        onClick={navigateToNew}
        disabled={isOnNewPage}
        className={styles.newBtn}
        data-panel-close
      >
        New Benchmark
      </ButtonComponent>

      {/* Search */}
      <div className={styles.searchWrap}>
        <SearchInputComponent
          value={search}
          onChange={setSearch}
          placeholder="Search benchmarks…"
        />
      </div>

      {/* "All Benchmarks" link */}
      <button
        className={`${styles.allLink} ${pathname === "/benchmarks" && !activeBenchmarkId ? styles.allLinkActive : ""}`}
        onClick={() => router.push("/benchmarks")}
        data-panel-close
      >
        <Target size={13} />
        All Benchmarks
        <span className={styles.allLinkCount}>{benchmarks.length}</span>
      </button>

      {/* List */}
      <div className={styles.list}>
        {loading ? (
          <div className={styles.empty}>
            <Loader2 size={16} className={styles.spinIcon} />
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            {search ? "No matches" : "No benchmarks yet"}
          </div>
        ) : (
          filtered.map((b) => {
            const isActive = activeBenchmarkId === b.id;
            const isRunning = activeBenchmarkIds.has(b.id);
            const run = b.latestRun;

            return (
              <div
                key={b.id}
                className={`${styles.item} ${isActive ? styles.itemActive : ""} ${isRunning ? styles.itemRunning : ""}`}
                onClick={() => navigate(b)}
                data-panel-close
              >
                <div className={styles.itemHeader}>
                  {isRunning && (
                    <Loader2 size={12} className={styles.spinIcon} />
                  )}
                  <span className={styles.itemName}>{b.name}</span>
                </div>

                <div className={styles.itemMeta}>
                  <BadgeComponent variant="accent" mini>
                    {b.assertions?.[0]?.matchMode || b.matchMode || "contains"}
                  </BadgeComponent>
                  <span className={styles.itemExpected}>
                    {b.assertions?.[0]?.expectedValue || b.expectedValue}
                  </span>
                  {(b.assertions?.length || 0) > 1 && (
                    <BadgeComponent variant={b.assertionOperator === "OR" ? "warning" : "info"} mini>
                      +{b.assertions.length - 1}
                    </BadgeComponent>
                  )}
                </div>

                {/* Latest run summary */}
                {run ? (
                  <div className={styles.itemStats}>
                    <span className={styles.statPassed}>
                      <CheckCircle2 size={10} />
                      {run.summary.passed}
                    </span>
                    <span className={styles.statFailed}>
                      <XCircle size={10} />
                      {run.summary.failed + (run.summary.errored || 0)}
                    </span>
                    <CostBadgeComponent cost={b.cumulativeCost} mini />
                    {/* Pass rate bar */}
                    <div className={styles.miniPassBar}>
                      <div
                        className={styles.miniPassBarFill}
                        style={{
                          width: `${(run.summary.passed / run.summary.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className={styles.itemStats}>
                    <Clock size={10} />
                    <span className={styles.noRuns}>No runs yet</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
