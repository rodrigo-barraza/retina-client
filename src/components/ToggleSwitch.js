"use client";

import styles from "./ToggleSwitch.module.css";
import SoundService from "@/services/SoundService";

/**
 * Reusable toggle-switch component, styled to match SelectDropdown.
 *
 *  checked   : boolean
 *  onChange  : (checked: boolean) => void
 *  label?    : string  — optional label text rendered beside the track
 *  disabled? : boolean
 *  size?     : "default" | "small"
 */
export default function ToggleSwitch({
  checked = false,
  onChange,
  label = "",
  disabled = false,
  size = "default",
}) {
  const isSmall = size === "small";

  return (
    <label
      className={`${styles.toggle} ${disabled ? styles.disabled : ""} ${isSmall ? styles.small : ""}`}
      onMouseEnter={(e) => SoundService.playHoverButton({ event: e })}
    >
      <input
        type="checkbox"
        className={styles.hiddenInput}
        checked={checked}
        disabled={disabled}
        onChange={(e) => { SoundService.playClickButton({ event: e }); onChange(e.target.checked); }}
      />
      <span
        className={`${styles.track} ${checked ? styles.active : ""}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={styles.knob} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
