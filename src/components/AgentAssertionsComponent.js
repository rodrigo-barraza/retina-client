"use client";

import { Plus, Trash2, MessageSquare, Wrench, Brain, RotateCcw } from "lucide-react";
import FormGroupComponent from "./FormGroupComponent";
import IconButtonComponent from "./IconButtonComponent";
import ButtonComponent from "./ButtonComponent";
import BadgeComponent from "./BadgeComponent";
import styles from "./AgentAssertionsComponent.module.css";

/**
 * Agent Assertion Types — behavioral assertions for agent benchmarks.
 *
 * These differ from model assertions (text match) because they verify
 * agentic behavior: whether the agent replied, used tools, thought, etc.
 *
 * Each type has:
 *   - value:       Unique key stored in the assertion object
 *   - label:       Human-readable name
 *   - icon:        Lucide icon component
 *   - hasOperand:  Whether it accepts a numeric operand (e.g. "at least 3")
 *   - operators:   Available comparison operators (if hasOperand)
 *   - placeholder: Input placeholder text
 *   - description: Tooltip / help text
 */
export const AGENT_ASSERTION_TYPES = [
  {
    value: "replied",
    label: "Replied",
    icon: MessageSquare,
    hasOperand: false,
    description: "Agent produced a non-empty text response",
  },
  {
    value: "used_tool_calls",
    label: "Used Tool Calls",
    icon: Wrench,
    hasOperand: true,
    operators: [
      { value: "gte", label: "At least (≥)" },
      { value: "lte", label: "At most (≤)" },
      { value: "eq", label: "Exactly (=)" },
      { value: "gt", label: "More than (>)" },
      { value: "lt", label: "Less than (<)" },
    ],
    placeholder: "e.g. 3",
    description: "Number of tool calls the agent made",
  },
  {
    value: "thought",
    label: "Thought",
    icon: Brain,
    hasOperand: false,
    description: "Agent used extended thinking / chain-of-thought",
  },
  {
    value: "max_turns",
    label: "Max Turns",
    icon: RotateCcw,
    hasOperand: true,
    operators: [
      { value: "gte", label: "At least (≥)" },
      { value: "lte", label: "At most (≤)" },
      { value: "eq", label: "Exactly (=)" },
      { value: "gt", label: "More than (>)" },
      { value: "lt", label: "Less than (<)" },
    ],
    placeholder: "e.g. 5",
    description: "Maximum number of agentic loop turns",
  },
];

const ASSERTION_TYPE_MAP = Object.fromEntries(
  AGENT_ASSERTION_TYPES.map((t) => [t.value, t])
);

/**
 * AgentAssertionsComponent — assertion editor for agent benchmarks.
 *
 * Renders a list of behavioral assertions (replied, tool calls, thought, max turns)
 * with AND/OR combinators between them.
 *
 * @param {Array}    assertions       — Array of { type, operator?, operand? }
 * @param {string}   assertionOperator — "AND" | "OR"
 * @param {Function} onAssertionsChange   — (nextAssertions) => void
 * @param {Function} onOperatorChange     — (nextOperator) => void
 */
export default function AgentAssertionsComponent({
  assertions,
  assertionOperator,
  onAssertionsChange,
  onOperatorChange,
}) {
  const operator = assertionOperator || "AND";

  // Which assertion types are already used (for the "Add" dropdown)
  const usedTypes = new Set(assertions.map((a) => a.type));

  const addAssertion = (type) => {
    const typeDef = ASSERTION_TYPE_MAP[type];
    const newAssertion = {
      type,
      ...(typeDef?.hasOperand && { operator: typeDef.operators[0].value, operand: "" }),
    };
    onAssertionsChange([...assertions, newAssertion]);
  };

  const removeAssertion = (idx) => {
    const next = assertions.filter((_, i) => i !== idx);
    onAssertionsChange(next.length > 0 ? next : []);
  };

  const updateAssertion = (idx, field, value) => {
    const next = assertions.map((a, i) =>
      i === idx ? { ...a, [field]: value } : a
    );
    onAssertionsChange(next);
  };

  const toggleOperator = () => {
    onOperatorChange(operator === "OR" ? "AND" : "OR");
  };

  // Available types that haven't been added yet
  const availableTypes = AGENT_ASSERTION_TYPES.filter((t) => !usedTypes.has(t.value));

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.label}>Agent Assertions</span>
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
        {availableTypes.length > 0 && (
          <div className={styles.addDropdown}>
            <ButtonComponent
              variant="disabled"
              size="xs"
              icon={Plus}
              onClick={() => addAssertion(availableTypes[0].value)}
            >
              Add
            </ButtonComponent>
          </div>
        )}
      </div>

      {assertions.length === 0 && (
        <div className={styles.emptyState}>
          <p>No assertions configured. Add at least one to evaluate agent behavior.</p>
          <div className={styles.quickAdd}>
            {AGENT_ASSERTION_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  className={styles.quickAddBtn}
                  onClick={() => addAssertion(t.value)}
                  title={t.description}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {assertions.length > 0 && (
        <div className={styles.list}>
          {assertions.map((a, i) => {
            const typeDef = ASSERTION_TYPE_MAP[a.type];
            if (!typeDef) return null;
            const Icon = typeDef.icon;
            return (
              <div key={`${a.type}-${i}`} className={styles.row}>
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
                <div className={styles.fields}>
                  <div className={styles.typeLabel}>
                    <Icon size={13} />
                    <span>{typeDef.label}</span>
                  </div>
                  {typeDef.hasOperand && (
                    <div className={styles.operandGroup}>
                      <FormGroupComponent label="Condition">
                        <select
                          value={a.operator || typeDef.operators[0].value}
                          onChange={(e) => updateAssertion(i, "operator", e.target.value)}
                        >
                          {typeDef.operators.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </FormGroupComponent>
                      <FormGroupComponent label="Value">
                        <input
                          type="number"
                          min="0"
                          value={a.operand ?? ""}
                          onChange={(e) => updateAssertion(i, "operand", e.target.value)}
                          placeholder={typeDef.placeholder}
                        />
                      </FormGroupComponent>
                    </div>
                  )}
                  {!typeDef.hasOperand && (
                    <div className={styles.noOperand}>
                      <span className={styles.noOperandHint}>{typeDef.description}</span>
                    </div>
                  )}
                  <div className={styles.removeBtn}>
                    <IconButtonComponent
                      icon={<Trash2 size={14} />}
                      onClick={() => removeAssertion(i)}
                      variant="destructive"
                      tooltip="Remove assertion"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
