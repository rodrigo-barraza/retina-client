"use client";

import { useState, useEffect } from "react";
import {
  Wrench,
  Paperclip,
  Pencil,
  Image as ImageIcon,
  Volume2,
  Video,
  FileText,
  Send,
  Square,
} from "lucide-react";
import TooltipComponent from "./TooltipComponent";
import styles from "./ChatInputButton.module.css";
import SoundService from "@/services/SoundService";

const TYPE_ICON_MAP = {
  paperclip: Paperclip,
  image: ImageIcon,
  audio: Volume2,
  video: Video,
  pdf: FileText,
};

function RotatingUploadIcon({ types, size = 18 }) {
  const allTypes = ["paperclip", ...types];
  const [activeIndex, setActiveIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (allTypes.length <= 1) return;
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % allTypes.length);
        setIsTransitioning(false);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [allTypes.length]);

  if (allTypes.length === 1) {
    const Icon = TYPE_ICON_MAP[allTypes[0]] || Paperclip;
    return <Icon size={size} />;
  }

  const currentType = allTypes[activeIndex];
  const nextType = allTypes[(activeIndex + 1) % allTypes.length];
  const CurrentIcon = TYPE_ICON_MAP[currentType] || Paperclip;
  const NextIcon = TYPE_ICON_MAP[nextType] || Paperclip;

  return (
    <div className={styles.rotatingIconContainer}>
      <div
        className={`${styles.rotatingIconTrack} ${isTransitioning ? styles.rotatingIconSlide : ""}`}
      >
        <span className={styles.rotatingIconItem}>
          <CurrentIcon size={size} />
        </span>
        <span className={styles.rotatingIconItem}>
          <NextIcon size={size} />
        </span>
      </div>
    </div>
  );
}

const ICON_MAP = {
  wrench: Wrench,
  pencil: Pencil,
  paperclip: Paperclip,
};

/**
 * Unified input button for the ChatArea input row.
 *
 * @param {"button"|"submit"} [variant="button"] — "submit" renders the accent-colored send/stop button.
 * @param {boolean} [isGenerating] — When variant="submit", shows the stop icon with a conic-gradient spinner.
 */
export default function ChatInputButton({
  icon,
  uploadTypes,
  onClick,
  label,
  isActive = false,
  disabled = false,
  className = "",
  tooltipPosition = "top",
  variant = "button",
  isGenerating = false,
  ...props
}) {
  const isSubmit = variant === "submit";

  const classes = [
    styles.chatInputBtn,
    isActive ? styles.active : "",
    isSubmit ? styles.submit : "",
    isSubmit && isGenerating ? styles.submitGenerating : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  let IconElement = null;
  if (isSubmit) {
    IconElement = isGenerating ? (
      <Square size={14} fill="currentColor" />
    ) : (
      <Send size={18} />
    );
  } else if (icon === "upload" && uploadTypes) {
    IconElement = <RotatingUploadIcon types={uploadTypes} size={18} />;
  } else if (typeof icon === "string") {
    const Comp = ICON_MAP[icon];
    if (Comp) IconElement = <Comp size={18} />;
  } else {
    IconElement = icon;
  }

  const button = (
    <button
      type={isSubmit ? "submit" : "button"}
      className={classes}
      onClick={(e) => { SoundService.playClickButton({ event: e }); onClick?.(e); }}
      onMouseEnter={(e) => SoundService.playHoverButton({ event: e })}
      disabled={disabled}
      aria-label={label}
      {...props}
    >
      {IconElement}
    </button>
  );

  // Submit variant doesn't need a tooltip (the action is self-evident)
  if (isSubmit) return button;

  return (
    <TooltipComponent label={label} position={tooltipPosition} trigger="hover">
      {button}
    </TooltipComponent>
  );
}
