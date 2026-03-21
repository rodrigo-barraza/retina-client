"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Sparkles, ExternalLink, Image as ImageIcon, Code, Eye, Star } from "lucide-react";
import Link from "next/link";
import IrisService from "../services/IrisService";
import PrismService from "../services/PrismService";
import MarkdownContent from "./MarkdownContent";
import ComboboxFilter from "./ComboboxFilter";
import PaginationComponent from "./PaginationComponent";
import PageHeaderComponent from "./PageHeaderComponent";
import DatePickerComponent from "./DatePickerComponent";
import { LoadingMessage, EmptyMessage } from "./StateMessageComponent";
import { FilterBarComponent, FilterGroupComponent, FilterPillsComponent, SearchInputComponent, ViewModeToggleComponent } from "./FilterBarComponent";
import styles from "./TextPageComponent.module.css";

const ORIGIN_FILTERS = [
  { key: "all", label: "All" },
  { key: "user", label: "Prompts", icon: User },
  { key: "ai", label: "Responses", icon: Sparkles },
];

export default function TextPageComponent({ mode = "user" }) {
  const isAdmin = mode === "admin";
  const convBasePath = isAdmin ? "/admin/conversations" : "/conversations";

  const [texts, setTexts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("raw");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const PAGE_SIZE = 30;

  const loadText = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (origin !== "all") params.origin = origin;
      if (search) params.search = search;
      if (provider) params.provider = provider;
      if (model) params.model = model;
      if (dateRange.from) params.from = new Date(dateRange.from).toISOString();
      if (dateRange.to) params.to = new Date(dateRange.to + "T23:59:59").toISOString();

      const service = isAdmin ? IrisService : PrismService;
      const result = await service.getText(params);
      setTexts(result.data || []);
      setTotal(result.total || 0);
      if (result.providers) setProviders(result.providers);
      if (result.models) setModels(result.models);
    } catch (err) {
      console.error("Failed to load text:", err);
    } finally {
      setLoading(false);
    }
  }, [page, origin, search, provider, model, dateRange, isAdmin]);

  useEffect(() => {
    loadText();
  }, [loadText]);

  useEffect(() => {
    PrismService.getFavorites("text")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleFavorite = async (textKey) => {
    if (favoriteKeys.includes(textKey)) {
      setFavoriteKeys((prev) => prev.filter((k) => k !== textKey));
      PrismService.removeFavorite("text", textKey).catch(() => {});
    } else {
      setFavoriteKeys((prev) => [...prev, textKey]);
      PrismService.addFavorite("text", textKey).catch(() => {});
    }
  };

  const getTextKey = (t, i) => `${t.convId}-${t.origin}-${i}`;

  const displayTexts = showFavoritesOnly
    ? texts.filter((t, i) => favoriteKeys.includes(getTextKey(t, i)))
    : texts;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <PageHeaderComponent
        title="Text"
        subtitle={`${total} messages across conversations`}
      />

      {/* Filters */}
      <FilterBarComponent>
        <FilterGroupComponent label="Favorites">
          <FilterPillsComponent
            options={[
              { value: "all", label: "All" },
              { value: "favorites", label: "★ Favorites" },
            ]}
            value={showFavoritesOnly ? "favorites" : "all"}
            onChange={(v) => setShowFavoritesOnly(v === "favorites")}
          />
        </FilterGroupComponent>

        <FilterGroupComponent label="Source">
          <FilterPillsComponent
            options={ORIGIN_FILTERS}
            value={origin}
            onChange={(v) => { setOrigin(v); setPage(1); }}
          />
        </FilterGroupComponent>

        <SearchInputComponent
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={handleSearch}
          placeholder="Search text content..."
        />

        <FilterGroupComponent label="Date">
          <DatePickerComponent
            from={dateRange.from}
            to={dateRange.to}
            onChange={(v) => { setDateRange(v); setPage(1); }}
            storageKey="retina-date-range"
          />
        </FilterGroupComponent>

        <FilterGroupComponent label="Provider">
          <ComboboxFilter
            options={providers}
            value={provider}
            onChange={(v) => { setProvider(v); setModel(""); setPage(1); }}
            placeholder="All Providers"
            allLabel="All Providers"
          />
        </FilterGroupComponent>

        <FilterGroupComponent label="Model">
          <ComboboxFilter
            options={provider ? models.filter((m) => m.startsWith(provider + "/")) : models}
            value={model}
            onChange={(v) => { setModel(v); setPage(1); }}
            placeholder="All Models"
            allLabel="All Models"
          />
        </FilterGroupComponent>

        {/* Raw / Preview toggle */}
        <ViewModeToggleComponent
          mode={viewMode}
          onChange={setViewMode}
          modes={[
            { key: "raw", icon: Code, title: "Raw text" },
            { key: "preview", icon: Eye, title: "Markdown preview" }
          ]}
        />
      </FilterBarComponent>

      {loading && <LoadingMessage message="Loading messages..." />}

      {/* Text List */}
      {!loading && (
        <div className={styles.textList}>
          {displayTexts.map((t, i) => {
            const textKey = getTextKey(t, i);
            const isFav = favoriteKeys.includes(textKey);
            return (
            <div key={`${t.convId}-${i}`} className={styles.textCard}>
              <div className={styles.textHeader}>
                <button
                  className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ""}`}
                  onClick={() => toggleFavorite(textKey)}
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                >
                  <Star size={11} fill={isFav ? "currentColor" : "none"} />
                </button>
                <span className={`${styles.roleBadge} ${t.origin === "ai" ? styles.roleAi : styles.roleUser}`}>
                  {t.origin === "ai" ? <><Sparkles size={10} /> Response</> : <><User size={10} /> Prompt</>}
                </span>
                <Link
                  href={`${convBasePath}/${t.convId}`}
                  className={styles.convLink}
                  title={t.convTitle}
                >
                  <ExternalLink size={10} />
                  <span>{t.convTitle}</span>
                </Link>
                {t.hasImages && (
                  <span className={styles.attachmentTag}>
                    <ImageIcon size={10} /> +media
                  </span>
                )}
                {t.model && (
                  <span className={styles.modelTag}>{t.model.split("/").pop()}</span>
                )}
                {t.timestamp && (
                  <span className={styles.time}>
                    {new Date(t.timestamp).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className={styles.textContent}>
                {viewMode === "preview" ? (
                  <MarkdownContent content={t.content} />
                ) : (
                  <span className={styles.rawText}>
                    {t.content.length > 600
                      ? t.content.substring(0, 600) + "…"
                      : t.content}
                  </span>
                )}
              </div>
              {t.estimatedCost > 0 && (
                <div className={styles.textFooter}>
                  <span className={styles.cost}>${t.estimatedCost.toFixed(5)}</span>
                </div>
              )}
            </div>
          );
          })}
        </div>
      )}

      {!loading && displayTexts.length === 0 && <EmptyMessage message="No text content found" />}

      {/* Pagination */}
      <PaginationComponent
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={setPage}
      />
    </div>
  );
}
