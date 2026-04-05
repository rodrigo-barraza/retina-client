"use client";

import FormGroupComponent from "./FormGroupComponent";
import styles from "./BenchmarkFormComponent.module.css";

/**
 * BenchmarkFormComponent — Shared form body for creating/cloning benchmarks.
 *
 * Used by both BenchmarkPageComponent (New) and BenchmarkDetailPageComponent (Clone)
 * to eliminate the duplicated form field markup.
 *
 * @param {object}   form       — { name, systemPrompt, prompt, expectedValue, matchMode }
 * @param {Function} onChange   — (updater) => void — receives a state updater fn
 * @param {Array}    matchModes — Array of { value, label } for match mode dropdown
 */
export default function BenchmarkFormComponent({ form, onChange, matchModes }) {
  const update = (field) => (e) =>
    onChange((f) => ({ ...f, [field]: e.target.value }));

  return (
    <>
      <FormGroupComponent label="Name">
        <input
          type="text"
          value={form.name}
          onChange={update("name")}
          placeholder="e.g. Capital of France"
        />
      </FormGroupComponent>

      <FormGroupComponent label="System Prompt (optional)">
        <textarea
          value={form.systemPrompt}
          onChange={update("systemPrompt")}
          placeholder="You are a geography expert. Answer concisely."
          rows={2}
        />
      </FormGroupComponent>

      <FormGroupComponent label="User Prompt">
        <textarea
          value={form.prompt}
          onChange={update("prompt")}
          placeholder="What is the capital of France? Reply with just the city name."
          rows={3}
        />
      </FormGroupComponent>

      <div className={styles.formRow}>
        <FormGroupComponent label="Expected Value">
          <input
            type="text"
            value={form.expectedValue}
            onChange={update("expectedValue")}
            placeholder="Paris"
          />
        </FormGroupComponent>

        <FormGroupComponent label="Match Mode">
          <select value={form.matchMode} onChange={update("matchMode")}>
            {matchModes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </FormGroupComponent>
      </div>
    </>
  );
}
