"use client";

import {
  Star,
  User,
  Sparkles,
  ExternalLink,
  Image as ImageIcon,
  Music,
  Film,
  FileText,
} from "lucide-react";
import Link from "next/link";
import PrismService from "../services/PrismService";
import AudioPlayerRecorderComponent from "./AudioPlayerRecorderComponent";
import DateTimeBadgeComponent from "./DateTimeBadgeComponent";
import ModelBadgeComponent from "./ModelBadgeComponent";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";
import styles from "./MediaCardComponent.module.css";

/* ── Helpers ── */

function resolveUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("minio://")) return PrismService.getFileUrl(url);
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  return url;
}

function MediaTypeIcon({ type, size = 32 }) {
  const color = MODALITY_COLORS[type] || MODALITY_COLORS.image;
  if (type === "audio") return <Music size={size} style={{ color }} />;
  if (type === "video") return <Film size={size} style={{ color }} />;
  if (type === "pdf") return <FileText size={size} style={{ color }} />;
  return <ImageIcon size={size} style={{ color }} />;
}

function OriginBadge({ origin }) {
  return (
    <span
      className={`${styles.originBadge} ${origin === "ai" ? styles.originAi : styles.originUser}`}
    >
      {origin === "ai" ? (
        <>
          <Sparkles size={10} /> Generated
        </>
      ) : (
        <>
          <User size={10} /> Uploaded
        </>
      )}
    </span>
  );
}

/**
 * MediaCardComponent — a reusable card for rendering media previews.
 *
 * @param {object}   media           — the media item ({ url, mediaType, origin, convId, convTitle, model, timestamp })
 * @param {string}   [convBasePath]  — base path for conversation links (default: "/conversations")
 * @param {boolean}  [compact]       — smaller variant for drawers / side panels
 * @param {boolean}  [showInfo]      — show the footer with conv link, model, and date (default: true)
 * @param {boolean}  [showOrigin]    — show the origin badge overlay (default: true)
 * @param {boolean}  [showFavorite]  — show the favorite button (default: false)
 * @param {boolean}  [isFavorite]    — whether the item is currently favorited
 * @param {Function} [onFavorite]    — callback when the favorite button is clicked
 * @param {Function} [onImageClick]  — callback when an image is clicked (for lightbox)
 */
export default function MediaCardComponent({
  media,
  convBasePath = "/conversations",
  compact = false,
  showInfo = true,
  showOrigin = true,
  showFavorite = false,
  isFavorite = false,
  onFavorite,
  onImageClick,
}) {
  const resolvedUrl = resolveUrl(media.url);
  const m = media;

  const cardClasses = [
    styles.card,
    compact && styles.compact,
    !showInfo && styles.standalone,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cardClasses}>
      {showFavorite && (
        <button
          className={`${styles.favBtn} ${isFavorite ? styles.favBtnActive : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite?.();
          }}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <Star size={12} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      )}

      <div className={styles.preview}>
        {m.mediaType === "image" && resolvedUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={resolvedUrl}
            alt=""
            className={styles.previewImage}
            loading="lazy"
            onClick={() => onImageClick?.(resolvedUrl)}
            onError={(e) => {
              e.target.style.display = "none";
              e.target.parentElement.classList.add(styles.placeholder);
              const icon = document.createElement("span");
              icon.textContent = "🖼";
              icon.style.fontSize = "32px";
              icon.style.opacity = "0.3";
              e.target.parentElement.appendChild(icon);
            }}
          />
        ) : m.mediaType === "video" && resolvedUrl ? (
          <video
            src={resolvedUrl}
            className={styles.previewVideo}
            muted
            preload="metadata"
            onMouseEnter={(e) => e.target.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.target.pause();
              e.target.currentTime = 0;
            }}
          />
        ) : m.mediaType === "audio" && resolvedUrl ? (
          <div
            className={styles.previewAudio}
            onClick={(e) => e.stopPropagation()}
          >
            <AudioPlayerRecorderComponent src={resolvedUrl} square />
          </div>
        ) : m.mediaType === "pdf" && resolvedUrl ? (
          <iframe
            src={resolvedUrl}
            className={styles.previewPdf}
            title="PDF preview"
          />
        ) : (
          <div className={styles.placeholder}>
            <MediaTypeIcon type={m.mediaType} />
            <span>{m.mediaType}</span>
          </div>
        )}

        {showOrigin && m.origin && <OriginBadge origin={m.origin} />}
      </div>

      {showInfo && (
        <div className={styles.info}>
          {m.convId && m.convTitle && (
            <Link
              href={`${convBasePath}/${m.convId}`}
              className={styles.convLink}
              title={m.convTitle}
            >
              <ExternalLink size={10} />
              <span>{m.convTitle}</span>
            </Link>
          )}
          <div className={styles.meta}>
            {m.model && (
              <ModelBadgeComponent models={[m.model.split("/").pop()]} provider={m.provider} mini />
            )}
            {m.timestamp && (
              <DateTimeBadgeComponent date={m.timestamp} mini />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Re-exports for consumers ── */
export { resolveUrl, MediaTypeIcon, OriginBadge };
