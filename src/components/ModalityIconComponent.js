"use client";

import {
  Type,
  Image,
  Volume2,
  Video,
  FileText as DocIcon,
  Globe,
  Code,
  Brain,
  Hash,
} from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";
import styles from "./ModalityIconComponent.module.css";

/**
 * MODALITY_ICON_DEFS — data-driven icon list for input/output modalities
 * and tool-capability badges. Used by ModalityIconComponent to avoid
 * hand-coding every icon/tooltip/color permutation.
 */
const INPUT_MODALITIES = [
  { key: "textIn", label: "Text input", icon: Type, color: MODALITY_COLORS.text },
  { key: "imageIn", label: "Image input", icon: Image, color: MODALITY_COLORS.image },
  { key: "audioIn", label: "Audio input", icon: Volume2, color: MODALITY_COLORS.audio },
  { key: "videoIn", label: "Video input", icon: Video, color: MODALITY_COLORS.video },
  { key: "docIn", label: "Document input", icon: DocIcon, color: MODALITY_COLORS.pdf },
];

const OUTPUT_MODALITIES = [
  { key: "textOut", label: "Text output", icon: Type, color: MODALITY_COLORS.text },
  { key: "imageOut", label: "Image output", icon: Image, color: MODALITY_COLORS.image },
  { key: "audioOut", label: "Audio output", icon: Volume2, color: MODALITY_COLORS.audio },
  { key: "embeddingOut", label: "Embedding output", icon: Hash, color: MODALITY_COLORS.embedding },
];

const TOOL_MODALITIES = [
  { key: "thinking", label: "Thinking", icon: Brain, color: MODALITY_COLORS.thinking },
  { key: "webSearch", label: "Web search", icon: Globe, color: MODALITY_COLORS.webSearch },
  { key: "codeExecution", label: "Code execution", icon: Code, color: MODALITY_COLORS.codeExecution },
];

/**
 * ModalityIconComponent — renders a compact row of input → output modality
 * icons plus tool-capability badges from a modalities object.
 *
 * Props:
 *   modalities  — object with boolean keys (textIn, imageIn, textOut, etc.)
 *   size        — icon size in px (default 11)
 *   className   — extra root class name
 */
export default function ModalityIconComponent({
  modalities,
  size = 11,
  className,
}) {
  if (!modalities || !Object.values(modalities).some(Boolean)) return null;

  const mod = modalities;

  const activeInputs = INPUT_MODALITIES.filter((m) => mod[m.key]);
  const activeOutputs = OUTPUT_MODALITIES.filter((m) => mod[m.key]);
  const activeTools = TOOL_MODALITIES.filter((m) => mod[m.key]);
  const hasInputs = activeInputs.length > 0;
  const hasOutputs = activeOutputs.length > 0;
  const hasTools = activeTools.length > 0;

  const renderIcon = (def) => (
    <TooltipComponent key={def.key} label={def.label} position="top">
      <span className={styles.modalityIcon} style={{ color: def.color }}>
        <def.icon size={size} />
      </span>
    </TooltipComponent>
  );

  return (
    <div className={`${styles.modalitiesRow} ${className || ""}`}>
      <span className={styles.badge}>
        {activeInputs.map(renderIcon)}
        {hasInputs && hasOutputs && (
          <span className={styles.modalityArrow}>→</span>
        )}
        {activeOutputs.map(renderIcon)}
      </span>
      {hasTools &&
        activeTools.map((def) => (
          <span
            key={def.key}
            className={styles.badge}
            style={{ color: def.color, borderColor: `color-mix(in srgb, ${def.color} 30%, transparent)` }}
          >
            <def.icon size={size} />
          </span>
        ))}
    </div>
  );
}
