"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  BookOpen,
  Sparkles,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import ToggleSwitchComponent from "./ToggleSwitch.js";
import styles from "./SkillsPanel.module.css";

const CONTENT_WARN_CHARS = 2000;
const CONTENT_MAX_CHARS = 10000;

/**
 * SkillsPanel — CRUD interface for project-scoped agent skills.
 *
 * Skills are Markdown knowledge blocks stored in MongoDB and injected
 * into the agent's system prompt by SystemPromptAssembler. They give
 * the LLM domain-specific context, coding conventions, or project
 * rules without consuming tool call slots.
 */
export default function SkillsPanel({ skills, onSkillsChange, project }) {
  const [editingSkill, setEditingSkill] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);

  // ── CRUD ─────────────────────────────────────────────────────

  const handleCreate = useCallback(() => {
    setEditingSkill({
      name: "",
      description: "",
      content: "",
      enabled: true,
    });
    setIsNew(true);
  }, []);

  const handleEdit = useCallback((skill) => {
    setEditingSkill({ ...skill });
    setIsNew(false);
  }, []);

  const handleCancel = useCallback(() => {
    setEditingSkill(null);
    setIsNew(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingSkill.name?.trim() || !editingSkill.content?.trim()) return;
    setSaving(true);
    try {
      const payload = {
        ...editingSkill,
        ...(project ? { project } : {}),
      };

      if (isNew) {
        await PrismService.createSkill(payload);
      } else {
        await PrismService.updateSkill(
          editingSkill.id || editingSkill._id,
          payload,
        );
      }

      setEditingSkill(null);
      setIsNew(false);
      onSkillsChange();
    } catch (err) {
      console.error("Failed to save skill:", err);
    } finally {
      setSaving(false);
    }
  }, [editingSkill, isNew, onSkillsChange, project]);

  const handleDelete = useCallback((id) => {
    setConfirmingDeleteId(id);
  }, []);

  const confirmDelete = useCallback(
    async (id) => {
      try {
        await PrismService.deleteSkill(id);
        setConfirmingDeleteId(null);
        onSkillsChange();
      } catch (err) {
        console.error("Failed to delete skill:", err);
      }
    },
    [onSkillsChange],
  );

  const handleToggle = useCallback(
    async (skill) => {
      try {
        await PrismService.updateSkill(skill.id || skill._id, {
          enabled: !skill.enabled,
        });
        onSkillsChange();
      } catch (err) {
        console.error("Failed to toggle skill:", err);
      }
    },
    [onSkillsChange],
  );

  // ── Edit / Create Form ───────────────────────────────────────

  if (editingSkill) {
    const contentLen = editingSkill.content?.length || 0;
    const isOverWarn = contentLen > CONTENT_WARN_CHARS;
    const isOverMax = contentLen > CONTENT_MAX_CHARS;

    return (
      <div className={styles.container}>
        <div className={styles.formHeader}>
          <h3>{isNew ? "New Skill" : "Edit Skill"}</h3>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.form}>
          <div className={styles.formGroup}>
            <label>Skill Name</label>
            <input
              type="text"
              className={styles.input}
              value={editingSkill.name}
              onChange={(e) =>
                setEditingSkill((s) => ({
                  ...s,
                  name: e.target.value
                    .replace(/[^a-zA-Z0-9_-]/g, "-")
                    .toLowerCase(),
                }))
              }
              placeholder="javascript-conventions"
            />
            <span className={styles.hint}>
              kebab-case identifier for this skill
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>Description</label>
            <input
              type="text"
              className={styles.input}
              value={editingSkill.description}
              onChange={(e) =>
                setEditingSkill((s) => ({
                  ...s,
                  description: e.target.value,
                }))
              }
              placeholder="Coding style rules and project conventions"
            />
            <span className={styles.hint}>
              Short summary shown in the skill list
            </span>
          </div>

          <div className={styles.formGroup}>
            <label>Content (Markdown)</label>
            <textarea
              className={`${styles.textarea} ${styles.contentTextarea}`}
              value={editingSkill.content}
              onChange={(e) => {
                const value = e.target.value;
                if (value.length <= CONTENT_MAX_CHARS) {
                  setEditingSkill((s) => ({ ...s, content: value }));
                }
              }}
              placeholder={`## Coding Guidelines\n\n- Always use const over let\n- Prefer async/await over .then()\n- Use JSDoc comments for public functions\n- ...`}
            />
            <div
              className={`${styles.charCounter} ${isOverMax ? styles.charCounterDanger : isOverWarn ? styles.charCounterWarn : ""}`}
            >
              {contentLen.toLocaleString()} / {CONTENT_MAX_CHARS.toLocaleString()} chars
              {isOverWarn && !isOverMax && " ⚠️ nearing limit"}
            </div>
          </div>

          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Enabled</span>
            <ToggleSwitchComponent
              checked={editingSkill.enabled}
              onChange={(v) =>
                setEditingSkill((s) => ({ ...s, enabled: v }))
              }
              size="small"
            />
          </div>

          <div className={styles.formActions}>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={
                saving ||
                !editingSkill.name?.trim() ||
                !editingSkill.content?.trim()
              }
            >
              <Save size={14} />
              {saving ? "Saving..." : isNew ? "Create Skill" : "Save Changes"}
            </button>
            <button className={styles.cancelFormBtn} onClick={handleCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── List View ────────────────────────────────────────────────

  const enabledCount = skills.filter((s) => s.enabled).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          Skills ({enabledCount}/{skills.length})
        </span>
        <div className={styles.headerActions}>
          <button className={styles.addBtn} onClick={handleCreate}>
            <Plus size={12} />
            New Skill
          </button>
        </div>
      </div>

      {skills.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <Sparkles size={24} />
          </div>
          <div className={styles.emptyTitle}>No skills yet</div>
          <div className={styles.emptySubtitle}>
            Skills are Markdown knowledge blocks injected into the agent&apos;s
            system prompt. Add coding conventions, project rules, or
            domain-specific context.
          </div>
          <button className={styles.addBtn} onClick={handleCreate}>
            <Plus size={12} />
            Create your first skill
          </button>
        </div>
      )}

      {skills.map((skill) => {
        const skillId = skill.id || skill._id;
        const isConfirming = confirmingDeleteId === skillId;

        return (
          <div
            key={skillId}
            className={`${styles.skillCard} ${!skill.enabled ? styles.skillCardDisabled : ""}`}
          >
            <div className={styles.skillCardHeader}>
              <div className={styles.skillIcon}>
                <BookOpen size={14} />
              </div>
              <div className={styles.skillInfo}>
                <div className={styles.skillName}>{skill.name}</div>
                {skill.description && (
                  <div className={styles.skillDescription}>
                    {skill.description}
                  </div>
                )}
              </div>
              <div className={styles.skillActions}>
                <ToggleSwitchComponent
                  checked={skill.enabled}
                  onChange={() => handleToggle(skill)}
                  size="small"
                />
                <button
                  className={styles.skillActionBtn}
                  onClick={() => handleEdit(skill)}
                  title="Edit skill"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  className={`${styles.skillActionBtn} ${styles.skillDeleteBtn}`}
                  onClick={() => handleDelete(skillId)}
                  title="Delete skill"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {skill.content && (
              <div className={styles.skillContentPreview}>
                {skill.content.slice(0, 200)}
              </div>
            )}

            {skill.content && (
              <div
                className={`${styles.skillCharCount} ${skill.content.length > CONTENT_WARN_CHARS ? styles.skillCharCountWarn : ""}`}
              >
                {skill.content.length.toLocaleString()} chars
              </div>
            )}

            {isConfirming && (
              <div className={styles.confirmRow}>
                <span className={styles.confirmLabel}>
                  Delete &ldquo;{skill.name}&rdquo;?
                </span>
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnYes}`}
                  onClick={() => confirmDelete(skillId)}
                >
                  Delete
                </button>
                <button
                  className={`${styles.confirmBtn} ${styles.confirmBtnNo}`}
                  onClick={() => setConfirmingDeleteId(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
