"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Trash2,
  Copy,
  Target,
  Clock,
  X,
  Coins,
  Loader2,
} from "lucide-react";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import EmptyStateComponent from "./EmptyStateComponent";
import FormGroupComponent from "./FormGroupComponent";
import ModalOverlayComponent from "./ModalOverlayComponent";
import { formatCost } from "../utils/utilities";
import styles from "./BenchmarkPageComponent.module.css";

const MATCH_MODES = [
  { value: "contains", label: "Contains" },
  { value: "exact", label: "Exact" },
  { value: "startsWith", label: "Starts With" },
  { value: "regex", label: "Regex" },
];

const INITIAL_FORM = {
  name: "",
  prompt: "",
  systemPrompt: "",
  expectedValue: "",
  matchMode: "contains",
};

export default function BenchmarkPageComponent({ sidebar }) {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [activeBenchmarkIds, setActiveBenchmarkIds] = useState(new Set());

  // ── Derived: aggregate cost across all benchmarks ────────
  const totalCost = useMemo(
    () =>
      benchmarks.reduce(
        (sum, b) => sum + (b.cumulativeCost || 0),
        0,
      ),
    [benchmarks],
  );

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

  // ── Create / Clone ─────────────────────────────────────────
  const openCreate = useCallback(() => {
    setForm(INITIAL_FORM);
    setShowModal(true);
  }, []);

  const openClone = useCallback((e, benchmark) => {
    e.stopPropagation();
    setForm({
      name: `${benchmark.name} (copy)`,
      prompt: benchmark.prompt,
      systemPrompt: benchmark.systemPrompt || "",
      expectedValue: benchmark.expectedValue,
      matchMode: benchmark.matchMode || "contains",
    });
    setShowModal(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = { ...form };
      await PrismService.createBenchmark(payload);

      setShowModal(false);
      setForm(INITIAL_FORM);
      await loadBenchmarks();
    } catch (err) {
      console.error("Failed to save benchmark:", err);
    } finally {
      setSaving(false);
    }
  }, [form, loadBenchmarks]);

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (e, id) => {
      e.stopPropagation();
      if (!confirm("Delete this benchmark and all its runs?")) return;
      try {
        await PrismService.deleteBenchmark(id);
        await loadBenchmarks();
      } catch (err) {
        console.error("Failed to delete benchmark:", err);
      }
    },
    [loadBenchmarks],
  );

  // ── Navigate to detail ─────────────────────────────────────
  const navigateToBenchmark = useCallback(
    (benchmark) => {
      router.push(`/benchmarks/${benchmark.id}`);
    },
    [router],
  );

  // ── Render: List View ──────────────────────────────────────
  return (
    <div className={styles.container}>
      <PageHeaderComponent
        title="Benchmarks"
        subtitle="Custom LLM accuracy tests"
      >
        <ButtonComponent
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={openCreate}
        >
          New Benchmark
        </ButtonComponent>
      </PageHeaderComponent>

      <div className={styles.content}>
        <div className={styles.contentMain}>
          {totalCost > 0 && (
            <div className={styles.totalCostBar}>
              <Coins size={14} className={styles.costIcon} />
              <span className={styles.totalCostLabel}>Total Cost · All Runs</span>
              <span className={styles.totalCostValue}>{formatCost(totalCost)}</span>
            </div>
          )}
          {loading ? (
            <div className={styles.runProgress}>
              <div className={styles.progressSpinner} />
              <div className={styles.progressText}>Loading benchmarks…</div>
            </div>
          ) : benchmarks.length === 0 ? (
            <EmptyStateComponent
              icon={<Target size={36} />}
              title="No Benchmarks Yet"
              subtitle="Create your first benchmark test to evaluate LLM accuracy across models."
            >
              <ButtonComponent
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={openCreate}
              >
                Create Benchmark
              </ButtonComponent>
            </EmptyStateComponent>
          ) : (
            <div className={styles.benchmarkGrid}>
              {benchmarks.map((b) => {
                const isRunning = activeBenchmarkIds.has(b.id);
                return (
                <div
                  key={b.id}
                  className={`${styles.benchmarkCard} ${isRunning ? styles.benchmarkCardRunning : ""}`}
                  onClick={() => navigateToBenchmark(b)}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitle}>
                      {isRunning && (
                        <span className={styles.runningIndicator}>
                          <Loader2 size={12} className={styles.spinIcon} />
                          Running
                        </span>
                      )}
                      {b.name}
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={styles.cardActionBtn}
                        onClick={(e) => openClone(e, b)}
                        title="Clone"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        className={`${styles.cardActionBtn} ${styles.danger}`}
                        onClick={(e) => handleDelete(e, b.id)}
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardMeta}>
                    <div className={styles.promptPreview}>{b.prompt}</div>
                    <div className={styles.metaRow}>
                      <span className={styles.metaLabel}>Expect</span>
                      <span className={styles.expectedValue}>
                        {b.expectedValue}
                      </span>
                      <BadgeComponent variant="accent" mini>
                        {b.matchMode || "contains"}
                      </BadgeComponent>
                    </div>
                  </div>

                  {b.tags?.length > 0 && (
                    <div className={styles.tagsRow}>
                      {b.tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className={styles.cardFooter}>
                    {b.latestRun ? (
                      <div className={styles.runSummary}>
                        <BadgeComponent variant="accent" mini>Latest</BadgeComponent>
                        <span className={styles.passCount}>
                          {b.latestRun.summary.passed} ✓
                        </span>
                        <span className={styles.failCount}>
                          {b.latestRun.summary.failed + (b.latestRun.summary.errored || 0)} ✗
                        </span>
                        {b.latestRun.summary.totalCost > 0 && (
                          <span className={styles.runCost}>
                            {formatCost(b.latestRun.summary.totalCost)}
                          </span>
                        )}
                        {b.cumulativeCost > 0 && (
                          <>
                            <span className={styles.footerDivider} />
                            <span className={styles.cumulativeCost}>
                              Σ {formatCost(b.cumulativeCost)}
                            </span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className={styles.runSummary}>
                        <Clock size={12} />
                        <span className={styles.noRuns}>No runs yet</span>
                      </div>
                    )}
                    <ButtonComponent variant="ghost" size="xs" icon={Play}>
                      Run
                    </ButtonComponent>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {sidebar && (
          <aside className={styles.sidebarPanel}>
            <div className={styles.sidebarHeader}>Benchmarks</div>
            {sidebar}
          </aside>
        )}
      </div>

      {/* ── Create / Clone Modal ── */}
      {showModal && (
        <ModalOverlayComponent onClose={() => setShowModal(false)} portal>
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>New Benchmark</span>
              <button
                className={styles.cardActionBtn}
                onClick={() => setShowModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <FormGroupComponent label="Name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder="e.g. Capital of France"
                />
              </FormGroupComponent>

              <FormGroupComponent label="System Prompt (optional)">
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, systemPrompt: e.target.value }))
                  }
                  placeholder="You are a geography expert. Answer concisely."
                  rows={2}
                />
              </FormGroupComponent>

              <FormGroupComponent label="User Prompt">
                <textarea
                  value={form.prompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prompt: e.target.value }))
                  }
                  placeholder="What is the capital of France? Reply with just the city name."
                  rows={3}
                />
              </FormGroupComponent>

              <div className={styles.formRow}>
                <FormGroupComponent label="Expected Value">
                  <input
                    type="text"
                    value={form.expectedValue}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        expectedValue: e.target.value,
                      }))
                    }
                    placeholder="Paris"
                  />
                </FormGroupComponent>

                <FormGroupComponent label="Match Mode">
                  <select
                    value={form.matchMode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, matchMode: e.target.value }))
                    }
                  >
                    {MATCH_MODES.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </FormGroupComponent>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <ButtonComponent
                variant="secondary"
                size="sm"
                onClick={() => setShowModal(false)}
              >
                Cancel
              </ButtonComponent>
              <ButtonComponent
                variant="primary"
                size="sm"
                onClick={handleSave}
                loading={saving}
                disabled={!form.name || !form.prompt || !form.expectedValue}
              >
                Create
              </ButtonComponent>
            </div>
          </div>
        </ModalOverlayComponent>
      )}
    </div>
  );
}
