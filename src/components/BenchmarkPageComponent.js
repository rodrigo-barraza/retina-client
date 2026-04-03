"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Play,
  Trash2,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Target,
  Clock,
  ChevronLeft,
  History,
  X,
} from "lucide-react";
import PrismService from "../services/PrismService";
import PageHeaderComponent from "./PageHeaderComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import EmptyStateComponent from "./EmptyStateComponent";
import FormGroupComponent from "./FormGroupComponent";
import ModalOverlayComponent from "./ModalOverlayComponent";
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
  temperature: 0,
  maxTokens: 256,
  tags: "",
};

export default function BenchmarkPageComponent() {
  // ── State ──────────────────────────────────────────────────
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);
  const [latestRun, setLatestRun] = useState(null);
  const [runHistory, setRunHistory] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModels, setSelectedModels] = useState(new Set());
  const [showModelSelector, setShowModelSelector] = useState(false);

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

  // ── Load models for selector ───────────────────────────────
  const loadModels = useCallback(async () => {
    try {
      const { models } = await PrismService.getBenchmarkModels();
      setAvailableModels(models || []);
    } catch (err) {
      console.error("Failed to load benchmark models:", err);
    }
  }, []);

  // ── Select a benchmark → load detail + latest run ──────────
  const selectBenchmark = useCallback(async (benchmark) => {
    setSelectedBenchmark(benchmark);
    setLatestRun(null);
    setRunHistory([]);
    setActiveRunId(null);

    try {
      const detail = await PrismService.getBenchmark(benchmark.id);
      if (detail.latestRun) {
        setLatestRun(detail.latestRun);
        setActiveRunId(detail.latestRun.id);
      }
    } catch (err) {
      console.error("Failed to load benchmark detail:", err);
    }

    try {
      const { runs } = await PrismService.getBenchmarkRuns(benchmark.id);
      setRunHistory(runs || []);
    } catch (err) {
      console.error("Failed to load run history:", err);
    }
  }, []);

  // ── Create / Edit ──────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  }, []);

  const openEdit = useCallback(
    (e, benchmark) => {
      e.stopPropagation();
      setEditingId(benchmark.id);
      setForm({
        name: benchmark.name,
        prompt: benchmark.prompt,
        systemPrompt: benchmark.systemPrompt || "",
        expectedValue: benchmark.expectedValue,
        matchMode: benchmark.matchMode || "contains",
        temperature: benchmark.temperature ?? 0,
        maxTokens: benchmark.maxTokens ?? 256,
        tags: (benchmark.tags || []).join(", "),
      });
      setShowModal(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        temperature: parseFloat(form.temperature) || 0,
        maxTokens: parseInt(form.maxTokens, 10) || 256,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
      };

      if (editingId) {
        await PrismService.updateBenchmark(editingId, payload);
      } else {
        await PrismService.createBenchmark(payload);
      }

      setShowModal(false);
      setForm(INITIAL_FORM);
      await loadBenchmarks();

      // Refresh selected benchmark if editing
      if (editingId && selectedBenchmark?.id === editingId) {
        const detail = await PrismService.getBenchmark(editingId);
        setSelectedBenchmark(detail);
      }
    } catch (err) {
      console.error("Failed to save benchmark:", err);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, loadBenchmarks, selectedBenchmark]);

  // ── Delete ─────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (e, id) => {
      e.stopPropagation();
      if (!confirm("Delete this benchmark and all its runs?")) return;
      try {
        await PrismService.deleteBenchmark(id);
        if (selectedBenchmark?.id === id) {
          setSelectedBenchmark(null);
          setLatestRun(null);
        }
        await loadBenchmarks();
      } catch (err) {
        console.error("Failed to delete benchmark:", err);
      }
    },
    [loadBenchmarks, selectedBenchmark],
  );

  // ── Run benchmark ──────────────────────────────────────────
  const handleRun = useCallback(async () => {
    if (!selectedBenchmark) return;
    setRunning(true);

    try {
      const models =
        selectedModels.size > 0
          ? availableModels.filter((m) =>
              selectedModels.has(`${m.provider}:${m.model}`),
            )
          : undefined;

      const run = await PrismService.runBenchmark(selectedBenchmark.id, models);
      setLatestRun(run);
      setActiveRunId(run.id);

      // Refresh run history
      const { runs } = await PrismService.getBenchmarkRuns(
        selectedBenchmark.id,
      );
      setRunHistory(runs || []);

      // Refresh benchmarks list to update summary badges
      await loadBenchmarks();
    } catch (err) {
      console.error("Failed to run benchmark:", err);
    } finally {
      setRunning(false);
    }
  }, [selectedBenchmark, selectedModels, availableModels, loadBenchmarks]);

  // ── View a past run ────────────────────────────────────────
  const viewRun = useCallback((run) => {
    setLatestRun(run);
    setActiveRunId(run.id);
  }, []);

  // ── Toggle model selection ─────────────────────────────────
  const toggleModel = useCallback((key) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAllModels = useCallback(() => {
    setSelectedModels(
      new Set(availableModels.map((m) => `${m.provider}:${m.model}`)),
    );
  }, [availableModels]);

  const clearModelSelection = useCallback(() => {
    setSelectedModels(new Set());
  }, []);

  // ── Open model selector (lazy-load models) ─────────────────
  const openModelSelector = useCallback(() => {
    if (availableModels.length === 0) loadModels();
    setShowModelSelector((v) => !v);
  }, [availableModels, loadModels]);

  // ── Render: Detail View ────────────────────────────────────
  if (selectedBenchmark) {
    return (
      <div className={styles.container}>
        <PageHeaderComponent
          title="Benchmark"
          subtitle={selectedBenchmark.name}
          backHref="#"
        >
          <ButtonComponent
            variant="ghost"
            size="sm"
            icon={ChevronLeft}
            onClick={() => {
              setSelectedBenchmark(null);
              setLatestRun(null);
              setShowModelSelector(false);
            }}
          >
            Back
          </ButtonComponent>
        </PageHeaderComponent>

        <div className={styles.content}>
          <div className={styles.detailPanel}>
            {/* ── Benchmark Info ── */}
            <div className={styles.detailHeader}>
              <div className={styles.detailTitle}>
                {selectedBenchmark.name}
              </div>
              <div className={styles.detailMeta}>
                <BadgeComponent variant="accent">
                  {selectedBenchmark.matchMode || "contains"}
                </BadgeComponent>
                <span className={styles.expectedValue}>
                  Expected: {selectedBenchmark.expectedValue}
                </span>
                {selectedBenchmark.tags?.map((tag) => (
                  <span key={tag} className={styles.tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.detailPrompt}>
              {selectedBenchmark.prompt}
            </div>

            {/* ── Actions ── */}
            <div className={styles.detailActions}>
              <ButtonComponent
                variant="primary"
                size="sm"
                icon={Play}
                onClick={handleRun}
                loading={running}
                disabled={running}
              >
                {selectedModels.size > 0
                  ? `Run (${selectedModels.size} models)`
                  : "Run All Models"}
              </ButtonComponent>
              <ButtonComponent
                variant="secondary"
                size="sm"
                icon={Target}
                onClick={openModelSelector}
              >
                Select Models
              </ButtonComponent>
              <ButtonComponent
                variant="ghost"
                size="sm"
                icon={Pencil}
                onClick={(e) => openEdit(e, selectedBenchmark)}
              >
                Edit
              </ButtonComponent>
            </div>

            {/* ── Model Selector ── */}
            {showModelSelector && (
              <div>
                <div className={styles.modelSelectorLabel}>
                  Select specific models to benchmark (leave empty for all):
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <button
                    className={styles.selectAllBtn}
                    onClick={selectAllModels}
                  >
                    Select All
                  </button>
                  <button
                    className={styles.selectAllBtn}
                    onClick={clearModelSelection}
                  >
                    Clear
                  </button>
                </div>
                <div className={styles.modelSelectorGrid}>
                  {availableModels.map((m) => {
                    const key = `${m.provider}:${m.model}`;
                    return (
                      <button
                        key={key}
                        className={`${styles.modelChip} ${selectedModels.has(key) ? styles.selected : ""}`}
                        onClick={() => toggleModel(key)}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Running Progress ── */}
            {running && (
              <div className={styles.runProgress}>
                <div className={styles.progressSpinner} />
                <div className={styles.progressText}>
                  Running benchmark against{" "}
                  {selectedModels.size > 0
                    ? `${selectedModels.size} models`
                    : "all models"}
                  …
                </div>
              </div>
            )}

            {/* ── Results ── */}
            {latestRun && !running && (
              <div className={styles.resultsSection}>
                <div className={styles.resultsSectionHeader}>
                  <div className={styles.resultsSectionTitle}>Results</div>
                  <span
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {new Date(latestRun.completedAt).toLocaleString()}
                  </span>
                </div>

                {/* Summary Bar */}
                <div className={styles.summaryBar}>
                  <div className={styles.summaryItem}>
                    <span
                      className={styles.summaryValue}
                      style={{ color: "var(--text-primary)" }}
                    >
                      {latestRun.summary.total}
                    </span>
                    <span className={styles.summaryLabel}>Total</span>
                  </div>
                  <div className={styles.summaryDivider} />
                  <div className={styles.summaryItem}>
                    <span
                      className={styles.summaryValue}
                      style={{ color: "var(--success)" }}
                    >
                      {latestRun.summary.passed}
                    </span>
                    <span className={styles.summaryLabel}>Passed</span>
                  </div>
                  <div className={styles.summaryDivider} />
                  <div className={styles.summaryItem}>
                    <span
                      className={styles.summaryValue}
                      style={{ color: "var(--danger)" }}
                    >
                      {latestRun.summary.failed}
                    </span>
                    <span className={styles.summaryLabel}>Failed</span>
                  </div>
                  {latestRun.summary.errored > 0 && (
                    <>
                      <div className={styles.summaryDivider} />
                      <div className={styles.summaryItem}>
                        <span
                          className={styles.summaryValue}
                          style={{ color: "var(--warning)" }}
                        >
                          {latestRun.summary.errored}
                        </span>
                        <span className={styles.summaryLabel}>Errors</span>
                      </div>
                    </>
                  )}
                  <div className={styles.summaryDivider} />
                  <div className={styles.summaryItem}>
                    <div className={styles.passBar}>
                      <div
                        className={styles.passBarFill}
                        style={{
                          width: `${(latestRun.summary.passed / latestRun.summary.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className={styles.summaryLabel}>
                      {Math.round(
                        (latestRun.summary.passed / latestRun.summary.total) *
                          100,
                      )}
                      %
                    </span>
                  </div>
                </div>

                {/* Results Table */}
                <table className={styles.resultsTable}>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Model</th>
                      <th>Response</th>
                      <th>Latency</th>
                      <th>Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestRun.models.map((result, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className={styles.statusCell}>
                            {result.error ? (
                              <AlertTriangle
                                size={16}
                                className={styles.errorIcon}
                              />
                            ) : result.passed ? (
                              <CheckCircle2
                                size={16}
                                className={styles.passIcon}
                              />
                            ) : (
                              <XCircle
                                size={16}
                                className={styles.failIcon}
                              />
                            )}
                            <span>
                              {result.error
                                ? "Error"
                                : result.passed
                                  ? "Pass"
                                  : "Fail"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.modelCell}>
                            <span className={styles.modelName}>
                              {result.label}
                            </span>
                            <span className={styles.modelProvider}>
                              {result.provider}
                            </span>
                          </div>
                        </td>
                        <td>
                          {result.error ? (
                            <span className={styles.errorMessage}>
                              {result.error}
                            </span>
                          ) : (
                            <span
                              className={styles.responseCell}
                              title={result.response}
                            >
                              {result.response || "—"}
                            </span>
                          )}
                        </td>
                        <td className={styles.latencyCell}>
                          {result.latency ? `${result.latency.toFixed(2)}s` : "—"}
                        </td>
                        <td className={styles.costCell}>
                          {result.estimatedCost != null
                            ? `$${result.estimatedCost.toFixed(6)}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Run History ── */}
            {runHistory.length > 0 && (
              <div className={styles.resultsSection}>
                <div className={styles.resultsSectionTitle}>
                  <History size={14} style={{ marginRight: 6 }} />
                  Run History ({runHistory.length})
                </div>
                <div className={styles.runHistoryList}>
                  {runHistory.map((run) => (
                    <div
                      key={run.id}
                      className={`${styles.runHistoryItem} ${activeRunId === run.id ? styles.activeRun : ""}`}
                      onClick={() => viewRun(run)}
                    >
                      <div className={styles.runHistoryMeta}>
                        <span className={styles.runHistoryDate}>
                          {new Date(run.completedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className={styles.runHistoryStats}>
                        <span className={styles.passCount}>
                          {run.summary.passed} ✓
                        </span>
                        <span className={styles.failCount}>
                          {run.summary.failed + (run.summary.errored || 0)} ✗
                        </span>
                        <div className={styles.passBar}>
                          <div
                            className={styles.passBarFill}
                            style={{
                              width: `${(run.summary.passed / run.summary.total) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Render: List View ──────────────────────────────────────
  return (
    <div className={styles.container}>
      <PageHeaderComponent
        title="Benchmark"
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
            {benchmarks.map((b) => (
              <div
                key={b.id}
                className={styles.benchmarkCard}
                onClick={() => selectBenchmark(b)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{b.name}</div>
                  <div className={styles.cardActions}>
                    <button
                      className={styles.cardActionBtn}
                      onClick={(e) => openEdit(e, b)}
                      title="Edit"
                    >
                      <Pencil size={14} />
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
                  <div className={styles.runSummary}>
                    <Clock size={12} />
                    <span className={styles.noRuns}>
                      Click to run
                    </span>
                  </div>
                  <ButtonComponent variant="ghost" size="xs" icon={Play}>
                    Run
                  </ButtonComponent>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <ModalOverlayComponent
          onClose={() => setShowModal(false)}
          portal
        >
          <div className={styles.modalPanel}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {editingId ? "Edit Benchmark" : "New Benchmark"}
              </span>
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

              <FormGroupComponent label="Prompt">
                <textarea
                  value={form.prompt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, prompt: e.target.value }))
                  }
                  placeholder="What is the capital of France? Reply with just the city name."
                  rows={3}
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

              <div className={styles.formRow}>
                <FormGroupComponent label="Temperature">
                  <input
                    type="number"
                    value={form.temperature}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        temperature: e.target.value,
                      }))
                    }
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </FormGroupComponent>

                <FormGroupComponent label="Max Tokens">
                  <input
                    type="number"
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        maxTokens: e.target.value,
                      }))
                    }
                    min={1}
                    max={4096}
                  />
                </FormGroupComponent>
              </div>

              <FormGroupComponent label="Tags (comma-separated)">
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, tags: e.target.value }))
                  }
                  placeholder="geography, factual"
                />
              </FormGroupComponent>
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
                {editingId ? "Save Changes" : "Create"}
              </ButtonComponent>
            </div>
          </div>
        </ModalOverlayComponent>
      )}
    </div>
  );
}
