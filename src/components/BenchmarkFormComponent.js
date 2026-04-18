"use client";

import { Plus, Trash2 } from "lucide-react";
import FormGroupComponent from "./FormGroupComponent";
import TextAreaComponent from "./TextAreaComponent";
import IconButtonComponent from "./IconButtonComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import { benchmarkPresets } from "../utils/benchmarkPresets";
import styles from "./BenchmarkFormComponent.module.css";

/**
 * BenchmarkFormComponent — Shared form body for creating/cloning benchmarks.
 *
 * Supports multiple "assertions" — each is an { expectedValue, matchMode } pair.
 * Assertions can be combined with AND or OR logic (conjunction vs disjunction).
 *
 * Used by both BenchmarkPageComponent (New) and BenchmarkDetailPageComponent (Clone)
 * to eliminate the duplicated form field markup.
 *
 * @param {object}   form       — { name, systemPrompt, prompt, assertions, assertionOperator }
 * @param {Function} onChange   — (updater) => void — receives a state updater fn
 * @param {Array}    matchModes — Array of { value, label } for match mode dropdown
 */
export default function BenchmarkFormComponent({ form, onChange, matchModes }) {
  const update = (field) => (e) =>
    onChange((f) => ({ ...f, [field]: e.target.value }));

  const updateTextArea = (field) => (e) =>
    onChange((f) => ({ ...f, [field]: e.target.value }));

  const handlePresetChange = (e) => {
    const idx = parseInt(e.target.value, 10);
    if (!isNaN(idx) && benchmarkPresets[idx]) {
      const preset = benchmarkPresets[idx];
      onChange((f) => ({
        ...f,
        name: preset.name,
        systemPrompt: preset.systemPrompt,
        prompt: preset.prompt,
        assertions: preset.assertions.map(a => ({ ...a })), // deep copy
        assertionOperator: preset.assertionOperator || "AND",
      }));
      // Reset the select back to default so it can be used again if needed
      e.target.value = "";
    }
  };

  // ── Assertion helpers ─────────────────────────────────────

  const assertions = form.assertions || [
    { expectedValue: form.expectedValue || "", matchMode: form.matchMode || "contains" },
  ];

  const addAssertion = () => {
    onChange((f) => ({
      ...f,
      assertions: [...(f.assertions || [{ expectedValue: f.expectedValue || "", matchMode: f.matchMode || "contains" }]), { expectedValue: "", matchMode: "contains" }],
    }));
  };

  const removeAssertion = (idx) => {
    onChange((f) => {
      const next = [...(f.assertions || [])];
      next.splice(idx, 1);
      return { ...f, assertions: next.length > 0 ? next : [{ expectedValue: "", matchMode: "contains" }] };
    });
  };

  const updateAssertion = (idx, field) => (e) => {
    onChange((f) => {
      const next = [...(f.assertions || [{ expectedValue: f.expectedValue || "", matchMode: f.matchMode || "contains" }])];
      next[idx] = { ...next[idx], [field]: e.target.value };
      return { ...f, assertions: next };
    });
  };

  const toggleOperator = () => {
    onChange((f) => ({
      ...f,
      assertionOperator: f.assertionOperator === "OR" ? "AND" : "OR",
    }));
  };

  const operator = form.assertionOperator || "AND";

  return (
    <>
      <FormGroupComponent label="Load Preset (Optional)">
        <select onChange={handlePresetChange} defaultValue="">
          <option value="" disabled>-- Select an industry standard benchmark --</option>
          {benchmarkPresets.map((p, idx) => (
            <option key={idx} value={idx}>
              {p.name}
            </option>
          ))}
        </select>
      </FormGroupComponent>

      <FormGroupComponent label="Name">
        <input
          type="text"
          value={form.name}
          onChange={update("name")}
          placeholder="e.g. Capital of France"
        />
      </FormGroupComponent>

      <FormGroupComponent label="System Prompt (optional)">
        <TextAreaComponent
          value={form.systemPrompt}
          onChange={updateTextArea("systemPrompt")}
          placeholder="You are a geography expert. Answer concisely."
          minRows={5}
          maxRows={12}
        />
      </FormGroupComponent>

      <FormGroupComponent label="User Prompt">
        <TextAreaComponent
          value={form.prompt}
          onChange={updateTextArea("prompt")}
          placeholder="What is the capital of France? Reply with just the city name."
          minRows={7}
          maxRows={14}
        />
      </FormGroupComponent>

      {/* ── Assertions ── */}
      <div className={styles.assertionsSection}>
        <div className={styles.assertionsHeader}>
          <span className={styles.assertionsLabel}>Assertions</span>
          {assertions.length > 1 && (
            <button
              type="button"
              className={`${styles.operatorToggle} ${operator === "OR" ? styles.operatorOr : ""}`}
              onClick={toggleOperator}
              title={`Switch to ${operator === "AND" ? "OR" : "AND"} — currently requires ${operator === "AND" ? "ALL" : "ANY"} to pass`}
            >
              {operator}
            </button>
          )}
          <ButtonComponent
            variant="disabled"
            size="xs"
            icon={Plus}
            onClick={addAssertion}
          >
            Add
          </ButtonComponent>
        </div>

        <div className={styles.assertionsList}>
          {assertions.map((a, i) => (
            <div key={i} className={styles.assertionRow}>
              {/* Operator divider between assertions */}
              {i > 0 && (
                <div className={styles.operatorDivider}>
                  <span className={styles.operatorDividerLine} />
                  <BadgeComponent variant={operator === "OR" ? "warning" : "accent"} mini>
                    {operator}
                  </BadgeComponent>
                  <span className={styles.operatorDividerLine} />
                </div>
              )}
              <div className={styles.assertionFields}>
                <FormGroupComponent label={i === 0 ? "Expected Value" : `Expected Value ${i + 1}`}>
                  <input
                    type="text"
                    value={a.expectedValue}
                    onChange={updateAssertion(i, "expectedValue")}
                    placeholder="Paris"
                  />
                </FormGroupComponent>

                <FormGroupComponent label="Match Mode">
                  <select value={a.matchMode} onChange={updateAssertion(i, "matchMode")}>
                    {matchModes.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </FormGroupComponent>

                {assertions.length > 1 && (
                  <div className={styles.assertionRemove}>
                    <IconButtonComponent
                      icon={<Trash2 size={14} />}
                      onClick={() => removeAssertion(i)}
                      variant="destructive"
                      tooltip="Remove assertion"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
