"use client";

import { useMemo, useRef, useCallback, useState } from "react";
import { MessageSquare, Plus } from "lucide-react";
import HistoryList from "./HistoryList";
import ButtonComponent from "./ButtonComponent";
import { getModalities } from "../utils/utilities";
import styles from "./HistoryPanel.module.css";

/* ── Glitch text generator (ported from CycleButton) ──────── */
const SYMBOLS = "!@#$%^&*†‡§¶∆∇≈≠±×÷√∫∑∏⊗⊕⊘⊙◊♠♣♥♦★☆◈⬡⬢⟁⟐⧫⬟";
const ZALGO = [
  "\u0300","\u0301","\u0302","\u0303","\u0304","\u0305","\u0306",
  "\u0307","\u0308","\u0309","\u030A","\u030B","\u030C","\u030D",
  "\u030E","\u030F","\u0310","\u0311","\u0312","\u0313","\u0314",
  "\u0315","\u0316","\u0317","\u0318","\u0319","\u031A","\u031B",
  "\u0320","\u0321","\u0322","\u0323","\u0324","\u0325","\u0326",
  "\u0327","\u0328","\u0329","\u032A","\u032B","\u032C","\u032D",
  "\u0330","\u0331","\u0332","\u0333","\u0334","\u0335","\u0336",
  "\u0340","\u0341","\u0342","\u0343","\u0344","\u0345","\u0346",
  "\u0350","\u0351","\u0352","\u0353","\u0354","\u0355","\u0356",
];
const GLITCH_POOL = SYMBOLS + "ΣΩΨΞΘΔΛΠΦψξθδλπφ¿¡«»░▒▓█▄▀■□▪▫▬▲▼◆●○◎◇";

function glitchText(len = 6) {
  let result = "";
  for (let i = 0; i < len; i++) {
    result += GLITCH_POOL[Math.floor(Math.random() * GLITCH_POOL.length)];
    const marks = 1 + Math.floor(Math.random() * 2);
    for (let j = 0; j < marks; j++) {
      result += ZALGO[Math.floor(Math.random() * ZALGO.length)];
    }
  }
  return result;
}

export default function HistoryPanel({
  sessions = [],
  activeId,
  onSelect,
  onNew,
  onDelete,
  readOnly = false,
  showProject = false,
  showUsername = false,
  newIds,
  favorites = [],
  onToggleFavorite,
  initialProviders,
  initialSearch = "",
  disableNew,
  // Customisable labels — defaults match conversation-session context
  newLabel = "New Conversation",
  emptyText = "No recent chats",
  searchText = "Search conversations...",
  itemIcon,
  countLabel,
}) {
  const newBtnRef = useRef(null);
  const rainbowTimer = useRef(null);
  const glitchInterval = useRef(null);
  const [glitchLabel, setGlitchLabel] = useState(null);

  const handleNew = useCallback(() => {
    const el = newBtnRef.current;
    if (el) {
      // Rainbow hue-rotate
      el.classList.remove(styles.newBtnRainbow);
      void el.offsetWidth;
      el.classList.add(styles.newBtnRainbow);

      // Glitch text scramble — 30ms swaps for chaotic feel
      setGlitchLabel(glitchText());
      clearInterval(glitchInterval.current);
      glitchInterval.current = setInterval(() => {
        setGlitchLabel(glitchText());
      }, 30);

      clearTimeout(rainbowTimer.current);
      rainbowTimer.current = setTimeout(() => {
        el.classList.remove(styles.newBtnRainbow);
        clearInterval(glitchInterval.current);
        glitchInterval.current = null;
        setGlitchLabel(null);
      }, 1000);
    }
    onNew?.();
  }, [onNew]);

  // Normalize sessions into HistoryList items
  const items = useMemo(() => {
    return sessions.map((conv) => {
      const totalCost =
        conv.totalCost ||
        (conv.messages || []).reduce(
          (sum, m) => sum + (m.estimatedCost || 0),
          0,
        );

      const tags = [];
      if (showProject && conv.project) {
        tags.push({
          label: conv.project,
          style: {
            background: "var(--accent-subtle)",
            color: "var(--accent-color)",
          },
        });
      }
      if (conv.synthetic) {
        tags.push({
          label: "SYNTHETIC",
          style: {
            background: "rgba(168, 85, 247, 0.12)",
            color: "rgb(168, 85, 247)",
          },
        });
      }

      // Extract unique model names and providers used in this conversation
      const msgs = conv.messages || [];
      const modelNamesSet = new Set();
      const providersSet = new Set();

      // Look at messages from newest to oldest to order recent models first
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "assistant") {
          if (msgs[i].model) modelNamesSet.add(msgs[i].model);
          if (msgs[i].provider) providersSet.add(msgs[i].provider);
        }
      }

      // If no models found in messages, fall back to conv.model
      if (modelNamesSet.size === 0 && conv.model) {
        modelNamesSet.add(conv.model);
      }

      const modelNames = Array.from(modelNamesSet);
      const derivedProviders = conv.providers?.length > 0
        ? conv.providers
        : Array.from(providersSet);

      // Merge request-log toolCounts into modalities for accurate badge counts
      const baseModalities = conv.modalities || getModalities(conv.messages);
      const modalities = conv.toolCounts
        ? {
            ...baseModalities,
            functionCalling: Object.values(conv.toolCounts).reduce((s, c) => s + c, 0),
          }
        : baseModalities;

      return {
        id: conv.id,
        title: conv.title || "Untitled Chat",
        updatedAt: conv.updatedAt,
        createdAt: conv.createdAt,
        totalCost,
        modalities,
        providers: derivedProviders,
        tags,
        username: conv.username,
        modelNames,
        searchText: [
          conv.project || "",
          conv.username || "",
          ...(conv.messages || []).map((m) => m.content || ""),
        ].join(" "),
      };
    });
  }, [sessions, showProject]);

  return (
    <div className={styles.container}>
      {!readOnly && onNew && (
        <ButtonComponent
          ref={newBtnRef}
          variant="primary"
          size="sm"
          icon={glitchLabel ? undefined : Plus}
          onClick={handleNew}
          disabled={disableNew !== undefined ? disableNew : !activeId}
          className={`${styles.newBtn} ${glitchLabel ? styles.newBtnGlitch : ""}`}
          data-panel-close
        >
          {glitchLabel || newLabel}
        </ButtonComponent>
      )}
      <HistoryList
        items={items}
        activeId={activeId}
        onSelect={(item) => {
          const conv = sessions.find((c) => c.id === item.id);
          if (conv) onSelect(conv);
        }}
        onDelete={!readOnly && onDelete ? onDelete : undefined}
        icon={itemIcon || MessageSquare}
        readOnly={readOnly}
        emptyLabel={emptyText}
        searchPlaceholder={searchText}
        admin={showUsername}
        newIds={newIds}
        favorites={favorites}
        onToggleFavorite={onToggleFavorite}
        initialProviders={initialProviders}
        initialSearch={initialSearch}
        countLabel={countLabel}
      />
    </div>
  );
}
