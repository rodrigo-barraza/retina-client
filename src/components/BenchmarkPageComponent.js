"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Play,
  Trash2,
  Pencil,
  Target,
  Clock,
  X,
  Coins,
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
  temperature: 0,
  maxTokens: 256,
  tags: "",
};

export default function BenchmarkPageComponent() {
  const router = useRouter();

  // ── State ──────────────────────────────────────────────────
  const [benchmarks, setBenchmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);

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

  // ── Create / Edit ──────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setShowModal(true);
  }, []);

  const openEdit = useCallback((e, benchmark) => {
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
  }, []);

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
    } catch (err) {
      console.error("Failed to save benchmark:", err);
    } finally {
      setSaving(false);
    }
  }, [form, editingId, loadBenchmarks]);

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
                onClick={() => navigateToBenchmark(b)}
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
                  {b.latestRun ? (
                    <div className={styles.runSummary}>
                      <span className={styles.passCount}>
                        {b.latestRun.summary.passed} ✓
                      </span>
                      <span className={styles.failCount}>
                        {b.latestRun.summary.failed + (b.latestRun.summary.errored || 0)} ✗
                      </span>
                      {b.latestRun.summary.totalCost > 0 && (
                        <span className={styles.runCost}>
                          <Coins size={10} />
                          {formatCost(b.latestRun.summary.totalCost)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className={styles.runSummary}>
                      <Clock size={12} />
                      <span className={styles.noRuns}>Click to run</span>
                    </div>
                  )}
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
        <ModalOverlayComponent onClose={() => setShowModal(false)} portal>
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
