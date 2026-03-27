"use client";

import {
  Star,
  Type,
  Image,
  Volume2,
  Video,
  FileText as DocIcon,
  Globe,
  Code,
  Brain,
} from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import { FilterIconButtonGroupComponent } from "./FilterBarComponent";
import { MODALITY_COLORS, TOOL_COLORS } from "./WorkflowNodeConstants";
import styles from "./SidebarFilterComponent.module.css";

const MODALITY_FILTERS = [
  { key: "text", icon: Type, title: "Text", color: MODALITY_COLORS.text },
  { key: "image", icon: Image, title: "Image", color: MODALITY_COLORS.image },
  { key: "audio", icon: Volume2, title: "Audio", color: MODALITY_COLORS.audio },
  { key: "video", icon: Video, title: "Video", color: MODALITY_COLORS.video },
  { key: "doc", icon: DocIcon, title: "Document", color: MODALITY_COLORS.pdf },
];

const TOOL_FILTERS = [
  {
    key: "thinking",
    icon: Brain,
    title: "Thinking",
    color: TOOL_COLORS["Thinking"],
  },
  {
    key: "webSearch",
    icon: Globe,
    title: "Web Search",
    color: TOOL_COLORS["Web Search"],
  },
  {
    key: "codeExecution",
    icon: Code,
    title: "Code Execution",
    color: TOOL_COLORS["Code Execution"],
  },
  {
    key: "functionCalling",
    title: "Function Calling",
    color: TOOL_COLORS["Function Calling"],
    customRender: () => (
      <span
        style={{
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "monospace",
          lineHeight: 1,
          color: "inherit",
        }}
      >
        ƒ()
      </span>
    ),
  },
];

/**
 * SidebarFilterComponent — reusable filter bar for sidebar panels.
 * Renders optional Favorite toggle, Modality icon buttons, Tool icon buttons,
 * and Provider logo buttons.
 *
 * Props:
 *   modalities           — array of { key, icon, title } objects to show (auto-detected or all)
 *   tools                — array of { key, icon, title } objects to show (auto-detected or all)
 *   providers            — array of provider name strings
 *   activeModalities     — Set of active modality keys (empty Set = all)
 *   activeTools          — Set of active tool keys (empty Set = all)
 *   activeProviders      — Set of active provider strings (empty Set = all)
 *   onModalityChange     — (Set) => void
 *   onToolChange         — (Set) => void
 *   onProviderChange     — (Set) => void
 *   showFavoritesOnly    — boolean
 *   onFavoritesToggle    — () => void  (omit to hide favorite filter)
 *   hasFavorites         — boolean, whether any favorites exist
 */
export default function SidebarFilterComponent({
  modalities = [],
  tools = [],
  providers = [],
  activeModalities = new Set(),
  activeTools = new Set(),
  activeProviders = new Set(),
  onModalityChange,
  onToolChange,
  onProviderChange,
  showFavoritesOnly = false,
  onFavoritesToggle,
  _hasFavorites = false,
}) {
  const showFavoriteRow = !!onFavoritesToggle;
  const showModalityRow = modalities.length >= 2;
  const showToolRow = tools.length >= 1;
  const showProviderRow = providers.length >= 2;

  if (!showFavoriteRow && !showModalityRow && !showToolRow && !showProviderRow)
    return null;

  return (
    <div className={styles.filterSection}>
      {showFavoriteRow && (
        <FilterIconButtonGroupComponent
          options={[{ key: "fav", icon: Star, label: "Favorites" }]}
          activeKeys={new Set(showFavoritesOnly ? ["fav"] : [])}
          onChange={() => onFavoritesToggle()}
        />
      )}

      {showModalityRow && (
        <FilterIconButtonGroupComponent
          options={modalities.map((m) => ({
            key: m.key,
            icon: m.icon,
            label: m.title,
            color: m.color,
          }))}
          activeKeys={activeModalities}
          onChange={onModalityChange}
        />
      )}

      {showToolRow && (
        <FilterIconButtonGroupComponent
          options={tools.map((t) => ({
            key: t.key,
            icon: t.icon,
            label: t.title,
            color: t.color,
            customRender: t.customRender,
          }))}
          activeKeys={activeTools}
          onChange={onToolChange}
        />
      )}

      {showProviderRow && (
        <FilterIconButtonGroupComponent
          options={providers.map((p) => ({
            key: p,
            customRender: () => <ProviderLogo provider={p} size={14} />,
            label: p,
          }))}
          activeKeys={activeProviders}
          onChange={onProviderChange}
        />
      )}
    </div>
  );
}

export { MODALITY_FILTERS, TOOL_FILTERS };
