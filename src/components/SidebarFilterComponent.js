"use client";

import { Star, Type, Image, Volume2, Video, FileText as DocIcon, Wrench, Globe, Code, Brain } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import TooltipComponent from "./TooltipComponent";
import styles from "./SidebarFilterComponent.module.css";

const MODALITY_FILTERS = [
  { key: "text", icon: Type, title: "Text" },
  { key: "image", icon: Image, title: "Image" },
  { key: "audio", icon: Volume2, title: "Audio" },
  { key: "video", icon: Video, title: "Video" },
  { key: "doc", icon: DocIcon, title: "Document" },
];

const TOOL_FILTERS = [
  { key: "thinking", icon: Brain, title: "Thinking" },
  { key: "webSearch", icon: Globe, title: "Web Search" },
  { key: "codeExecution", icon: Code, title: "Code Execution" },
  { key: "functionCalling", icon: Wrench, title: "Function Calling" },
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
 *   activeModality       — currently selected modality key (null = all)
 *   activeTool           — currently selected tool key (null = all)
 *   activeProvider       — currently selected provider (null = all)
 *   onModalityChange     — (key | null) => void
 *   onToolChange         — (key | null) => void
 *   onProviderChange     — (provider | null) => void
 *   showFavoritesOnly    — boolean
 *   onFavoritesToggle    — () => void  (omit to hide favorite filter)
 *   hasFavorites         — boolean, whether any favorites exist
 */
export default function SidebarFilterComponent({
  modalities = [],
  tools = [],
  providers = [],
  activeModality = null,
  activeTool = null,
  activeProvider = null,
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

  if (!showFavoriteRow && !showModalityRow && !showToolRow && !showProviderRow) return null;

  return (
    <div className={styles.filterSection}>
      {showFavoriteRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Favorite</span>
          <div className={styles.filterBar}>
            <TooltipComponent label="Favorites" position="bottom">
              <button
                className={`${styles.filterBtn} ${showFavoritesOnly ? styles.filterBtnActive : ""}`}
                onClick={onFavoritesToggle}
              >
                <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} />
              </button>
            </TooltipComponent>
          </div>
        </div>
      )}

      {showModalityRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Modality</span>
          <div className={styles.filterBar}>
            {modalities.map(({ key, icon: Icon, title }) => (
              <TooltipComponent key={key} label={title} position="bottom">
                <button
                  className={`${styles.filterBtn} ${activeModality === key ? styles.filterBtnActive : ""}`}
                  onClick={() => onModalityChange(activeModality === key ? null : key)}
                >
                  <Icon size={13} />
                </button>
              </TooltipComponent>
            ))}
          </div>
        </div>
      )}

      {showToolRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Tools</span>
          <div className={styles.filterBar}>
            {tools.map(({ key, icon: Icon, title }) => (
              <TooltipComponent key={key} label={title} position="bottom">
                <button
                  className={`${styles.filterBtn} ${activeTool === key ? styles.filterBtnActive : ""}`}
                  onClick={() => onToolChange(activeTool === key ? null : key)}
                >
                  <Icon size={13} />
                </button>
              </TooltipComponent>
            ))}
          </div>
        </div>
      )}

      {showProviderRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Provider</span>
          <div className={styles.filterBar}>
            {providers.map((p) => (
              <TooltipComponent key={p} label={p} position="bottom">
                <button
                  className={`${styles.filterBtn} ${activeProvider === p ? styles.filterBtnActive : ""}`}
                  onClick={() => onProviderChange(activeProvider === p ? null : p)}
                >
                  <ProviderLogo provider={p} size={13} />
                </button>
              </TooltipComponent>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { MODALITY_FILTERS, TOOL_FILTERS };
