"use client";

import { Star, Type, Image, Volume2, FileText as DocIcon } from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import styles from "./SidebarFilterComponent.module.css";

const MODALITY_FILTERS = [
  { key: "text", icon: Type, title: "Text" },
  { key: "image", icon: Image, title: "Image" },
  { key: "audio", icon: Volume2, title: "Audio" },
  { key: "doc", icon: DocIcon, title: "Document" },
];

/**
 * SidebarFilterComponent — reusable filter bar for sidebar panels.
 * Renders optional Favorite toggle, Modality icon buttons, and Provider logo buttons.
 *
 * Props:
 *   modalities           — array of { key, icon, title } objects to show (auto-detected or all)
 *   providers            — array of provider name strings
 *   activeModality       — currently selected modality key (null = all)
 *   activeProvider       — currently selected provider (null = all)
 *   onModalityChange     — (key | null) => void
 *   onProviderChange     — (provider | null) => void
 *   showFavoritesOnly    — boolean
 *   onFavoritesToggle    — () => void  (omit to hide favorite filter)
 *   hasFavorites         — boolean, whether any favorites exist
 */
export default function SidebarFilterComponent({
  modalities = [],
  providers = [],
  activeModality = null,
  activeProvider = null,
  onModalityChange,
  onProviderChange,
  showFavoritesOnly = false,
  onFavoritesToggle,
  _hasFavorites = false,
}) {
  const showFavoriteRow = !!onFavoritesToggle;
  const showModalityRow = modalities.length >= 2;
  const showProviderRow = providers.length >= 2;

  if (!showFavoriteRow && !showModalityRow && !showProviderRow) return null;

  return (
    <div className={styles.filterSection}>
      {showFavoriteRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Favorite</span>
          <div className={styles.filterBar}>
            <button
              className={`${styles.filterBtn} ${showFavoritesOnly ? styles.filterBtnActive : ""}`}
              onClick={onFavoritesToggle}
              title="Show favorites only"
            >
              <Star size={13} fill={showFavoritesOnly ? "currentColor" : "none"} />
            </button>
          </div>
        </div>
      )}

      {showModalityRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Modality</span>
          <div className={styles.filterBar}>
            {modalities.map(({ key, icon: Icon, title }) => (
              <button
                key={key}
                className={`${styles.filterBtn} ${activeModality === key ? styles.filterBtnActive : ""}`}
                onClick={() => onModalityChange(activeModality === key ? null : key)}
                title={title}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>
        </div>
      )}

      {showProviderRow && (
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>Provider</span>
          <div className={styles.filterBar}>
            {providers.map((p) => (
              <button
                key={p}
                className={`${styles.filterBtn} ${activeProvider === p ? styles.filterBtnActive : ""}`}
                onClick={() => onProviderChange(activeProvider === p ? null : p)}
                title={p}
              >
                <ProviderLogo provider={p} size={13} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export { MODALITY_FILTERS };
