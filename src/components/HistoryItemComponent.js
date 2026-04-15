"use client";

import {
  Download,
  Copy,
  Star,
  Trash2,
} from "lucide-react";
import IconButtonComponent from "./IconButtonComponent";
import ModalityIconComponent from "./ModalityIconComponent";
import ModelToolsComponent from "./ModelToolsComponent";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import styles from "./HistoryItemComponent.module.css";
import CostBadgeComponent from "./CostBadgeComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";
import SoundService from "@/services/SoundService";

/**
 * HistoryItemComponent — a single row within HistoryList or any list that
 * needs the same visual treatment (admin association lists, etc.).
 *
 * Props:
 *   item          — { id, title, subtitle, updatedAt, createdAt, totalCost,
 *                     modalities, modelName, tags[], username }
 *   isActive      — boolean, highlights the row
 *   onClick       — (item) => void
 *   onDelete      — (id) => void  (omit to hide)
 *   onDownload    — (id) => void  (omit to hide)
 *   onCopy        — (id) => void  (omit to hide)

 *   readOnly      — disables destructive actions
 *   admin         — shows username tag, hides delete
 *   isNew         — shows NEW badge
 *   isFavorite    — boolean
 *   onToggleFavorite — (id) => void (omit to hide star)
 *   className     — extra root class
 *   dataPanelClose — adds data-panel-close attr (for mobile drawer close)
 *   children      — optional extra content appended inside the row
 */
export default function HistoryItemComponent({
  item,
  isActive = false,
  onClick,
  onDelete,
  onDownload,
  onCopy,

  readOnly = false,
  admin = false,
  isNew = false,
  isFavorite = false,
  onToggleFavorite,
  className,
  dataPanelClose = false,
  children,
}) {
  const itemDate = item.updatedAt || item.createdAt;
  const mod = item.modalities || {};
  const hasModalities = mod && Object.keys(mod).length > 0;
  const hasModel = item.modelNames?.length > 0 || item.modelName;

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ""} ${className || ""}`}
      {...SoundService.interactive(() => onClick?.(item))}
      {...(dataPanelClose ? { "data-panel-close": true } : {})}
    >
      {onToggleFavorite && (
        <button
          className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item.id);
          }}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}
      <div className={styles.content}>
        {/* Row 1: time + tags (left) · cost (right) */}
        <div className={styles.topRow}>
          <div className={styles.topLeft}>
            <DateTimeBadgeComponent date={itemDate} mini />
            {admin && item.username && item.username !== "unknown" && (
              <span className={styles.usernameTag}>{item.username}</span>
            )}
            {item.tags?.map((tag) => (
              <span key={tag.label} className={styles.tag} style={tag.style}>
                {tag.label}
              </span>
            ))}
          </div>
          <CostBadgeComponent cost={item.totalCost} showIcon={false} />
        </div>

        {/* Row 2: title */}
        <div className={styles.title}>
          {item.title || "Untitled"}
          {isNew && <span className={styles.newBadge}>NEW</span>}
        </div>

        {/* Row 3: model badge */}
        {hasModel && (
          <ModelBadgeComponent
            models={item.modelNames?.length > 0 ? item.modelNames : [item.modelName]}
            className={styles.modelBadge}
          />
        )}

        {/* Row 4: modalities (left) · tools (right) */}
        {hasModalities && (
          <div className={styles.bottomRow}>
            <ModalityIconComponent modalities={mod} />
            <ModelToolsComponent tools={mod} />
          </div>
        )}

        {children}
      </div>
      {/* Actions */}
      <div className={styles.actions}>
        {onDownload && (
          <IconButtonComponent
            icon={<Download size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onDownload(item.id);
            }}
            tooltip="Download"
            hoverReveal
          />
        )}
        {onCopy && (
          <IconButtonComponent
            icon={<Copy size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onCopy(item.id);
            }}
            tooltip="Copy"
            hoverReveal
          />
        )}
        {!readOnly && !admin && onDelete && (
          <IconButtonComponent
            icon={<Trash2 size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            tooltip="Delete"
            variant="danger"
            hoverReveal
          />
        )}
      </div>
    </div>
  );
}
