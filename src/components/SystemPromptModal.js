"use client";

import { useState, useRef, useCallback } from "react";
import { Plus } from "lucide-react";
import { SelectComponent, TextAreaComponent, InputComponent, ModalComponent } from "@rodrigo-barraza/components";
import styles from "./SystemPromptModal.module.css";
import { LS_SYSTEM_INSTRUCTIONS } from "../constants";

function loadInstructions() {
  try {
    const raw = localStorage.getItem(LS_SYSTEM_INSTRUCTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveInstructions(list) {
  localStorage.setItem(LS_SYSTEM_INSTRUCTIONS, JSON.stringify(list));
}

export default function SystemPromptModal({ activePrompt, onApply, onClose }) {
  const [instructions, setInstructions] = useState(() => loadInstructions());
  const [selectedId, setSelectedId] = useState(() => {
    const list = loadInstructions();
    const match = list.find((i) => i.body === activePrompt);
    return match ? match.id : null;
  });
  const [title, setTitle] = useState(() => {
    const list = loadInstructions();
    const match = list.find((i) => i.body === activePrompt);
    return match ? match.title : "";
  });
  const [body, setBody] = useState(activePrompt || "");
  const saveTimerRef = useRef(null);

  // Debounced auto-save
  const persistInstruction = useCallback(
    (id, newTitle, newBody) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setInstructions((prev) => {
          const updated = prev.map((i) =>
            i.id === id ? { ...i, title: newTitle, body: newBody } : i,
          );
          saveInstructions(updated);
          return updated;
        });
        onApply(newBody);
      }, 400);
    },
    [onApply],
  );

  const handleSelectInstruction = (val) => {
    if (val === "__new__") {
      // Create new
      const newId = Date.now().toString();
      const newInstruction = { id: newId, title: "", body: "" };
      setInstructions((prev) => {
        const updated = [...prev, newInstruction];
        saveInstructions(updated);
        return updated;
      });
      setSelectedId(newId);
      setTitle("");
      setBody("");
      onApply("");
      return;
    }
    const found = instructions.find((i) => i.id === val);
    if (found) {
      setSelectedId(found.id);
      setTitle(found.title);
      setBody(found.body);
      onApply(found.body);
    }
  };

  const handleTitleChange = (e) => {
    const val = e.target.value;
    setTitle(val);
    if (selectedId) {
      persistInstruction(selectedId, val, body);
    } else {
      // Auto-create instruction
      const newId = Date.now().toString();
      const newInstruction = { id: newId, title: val, body };
      setInstructions((prev) => {
        const updated = [...prev, newInstruction];
        saveInstructions(updated);
        return updated;
      });
      setSelectedId(newId);
    }
  };

  const handleBodyChange = (e) => {
    const val = e.target.value;
    setBody(val);
    if (selectedId) {
      persistInstruction(selectedId, title, val);
    } else {
      // Auto-create instruction
      const newId = Date.now().toString();
      const newInstruction = { id: newId, title, body: val };
      setInstructions((prev) => {
        const updated = [...prev, newInstruction];
        saveInstructions(updated);
        return updated;
      });
      setSelectedId(newId);
      onApply(val);
    }
  };

  const handleDelete = () => {
    if (!selectedId) return;
    setInstructions((prev) => {
      const updated = prev.filter((i) => i.id !== selectedId);
      saveInstructions(updated);
      return updated;
    });
    setSelectedId(null);
    setTitle("");
    setBody("");
    onApply("");
  };

  // Build dropdown options
  const dropdownOptions = [
    ...instructions.map((i) => ({
      value: i.id,
      label: i.title || "Untitled Instruction",
    })),
    {
      value: "__new__",
      label: "＋ Create new instruction",
      icon: <Plus size={14} />,
    },
  ];

  return (
    <ModalComponent title="System Instructions" onClose={onClose} size="md" className={styles.modal}>
      <div className={styles.body}>
        <div className={styles.field}>
          <label>Saved Instructions</label>
          <SelectComponent
            value={selectedId || ""}
            options={dropdownOptions}
            onChange={handleSelectInstruction}
            placeholder="Select or create an instruction..."
          />
        </div>

        <div className={styles.field}>
          <label>Title</label>
          <InputComponent
            placeholder="e.g. Code Review Assistant"
            value={title}
            onChange={handleTitleChange}
          />
        </div>

        <div className={styles.field}>
          <label>System Prompt</label>
          <TextAreaComponent
            className={styles.textarea}
            minRows={10}
            maxRows={20}
            placeholder="You are a helpful AI assistant..."
            value={body}
            onChange={handleBodyChange}
          />
        </div>

        {selectedId && (
          <button className={styles.deleteBtn} onClick={handleDelete}>
            Delete this instruction
          </button>
        )}
      </div>
    </ModalComponent>
  );
}
