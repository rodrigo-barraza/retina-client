"use client";

import { Search } from "lucide-react";
import styles from "./FilterBarComponent.module.css";

export function FilterBarComponent({ children, className = "" }) {
  return <div className={`${styles.filterBar} ${className}`}>{children}</div>;
}

export function FilterGroupComponent({ label, children }) {
  return (
    <div className={styles.filterGroup}>
      {label && <span className={styles.filterLabel}>{label}</span>}
      {children}
    </div>
  );
}

export function FilterPillsComponent({ options, value, onChange }) {
  return (
    <div className={styles.pills}>
      {options.map((f) => {
        const Icon = f.icon;
        return (
          <button
            key={f.key}
            type="button"
            className={`${styles.pill} ${value === f.key ? styles.pillActive : ""}`}
            onClick={() => onChange(f.key)}
          >
            {Icon && <Icon size={12} />}
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInputComponent({ value, onChange, onSubmit, placeholder = "Search..." }) {
  return (
    <form className={styles.searchBox} onSubmit={onSubmit}>
      <Search size={14} />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.searchInput}
      />
    </form>
  );
}

export function ViewModeToggleComponent({ mode, onChange, modes }) {
  return (
    <div className={styles.viewToggle}>
      {modes.map((m) => {
        const Icon = m.icon;
        return (
          <button
            key={m.key}
            type="button"
            className={`${styles.viewBtn} ${mode === m.key ? styles.viewBtnActive : ""}`}
            onClick={() => onChange(m.key)}
            title={m.title}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}

export function FilterInputComponent({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      type="text"
      className={`${styles.filterInput} ${className}`}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function FilterSelectComponent({ value, onChange, options, className = "" }) {
  return (
    <select
      className={`${styles.filterSelect} ${className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function FilterClearButton({ onClick, children = "Clear" }) {
  return (
    <button type="button" className={styles.clearBtn} onClick={onClick}>
      {children}
    </button>
  );
}
