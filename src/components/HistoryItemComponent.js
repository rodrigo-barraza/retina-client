"use client";

import {
  Download,
  Copy,
  Star,
  Trash2,
} from "lucide-react";
import IconButtonComponent from "./IconButtonComponent";
import ModalityIconComponent from "./ModalityIconComponent";
import { DateTime } from "luxon";
import styles from "./HistoryItemComponent.module.css";
import CostBadgeComponent from "./CostBadgeComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";

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
 *   icon          — lucide icon component rendered at the start
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
  icon: ItemIcon,
  readOnly = false,
  admin = false,
  isNew = false,
  isFavorite = false,
  onToggleFavorite,
  className,
  dataPanelClose = false,
  children,
}) {
  const dt = DateTime.fromISO(item.updatedAt || item.createdAt).toRelative();
  const mod = item.modalities || {};

  return (
    <div
      className={`${styles.item} ${isActive ? styles.active : ""} ${className || ""}`}
      onClick={() => onClick?.(item)}
      {...(dataPanelClose ? { "data-panel-close": true } : {})}
    >
      {ItemIcon && (
        <div className={styles.icon}>
          <ItemIcon size={14} />
        </div>
      )}
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
        <div className={styles.title}>
          {item.title || "Untitled"}
          {isNew && <span className={styles.newBadge}>NEW</span>}
        </div>
        <div className={styles.meta}>
          {admin && item.username && item.username !== "unknown" && (
            <span className={styles.usernameTag}>{item.username}</span>
          )}
          {item.tags?.map((tag) => (
            <span key={tag.label} className={styles.tag} style={tag.style}>
              {tag.label}
            </span>
          ))}
          <span className={styles.time}>{dt}</span>
          <CostBadgeComponent cost={item.totalCost} mini showIcon={false} />
        </div>
        {(item.modelNames?.length > 0 || item.modelName) && (
          <ModelBadgeComponent
            models={item.modelNames?.length > 0 ? item.modelNames : [item.modelName]}
            className={styles.modelBadge}
          />
        )}
        <ModalityIconComponent modalities={mod} />
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
