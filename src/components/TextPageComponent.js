"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Sparkles, ExternalLink, Image as ImageIcon, Code, Eye } from "lucide-react";
import Link from "next/link";
import { IrisService } from "../services/IrisService";
import MarkdownContent from "./MarkdownContent";
import PaginationComponent from "./PaginationComponent";
import PageHeaderComponent from "./PageHeaderComponent";
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
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState("raw");
  const PAGE_SIZE = 30;

  const loadText = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (origin !== "all") params.origin = origin;
      if (search) params.search = search;
      if (!isAdmin) params.project = "retina";

      const result = await IrisService.getText(params);
      setTexts(result.data || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to load text:", err);
    } finally {
      setLoading(false);
    }
  }, [page, origin, search, isAdmin]);

  useEffect(() => {
    loadText();
  }, [loadText]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.page}>
      <PageHeaderComponent
        title="Text"
        subtitle={`${total} messages across conversations`}
      />

      {/* Filters */}
      <FilterBarComponent>
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
          {texts.map((t, i) => (
            <div key={`${t.convId}-${i}`} className={styles.textCard}>
              <div className={styles.textHeader}>
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
          ))}
        </div>
      )}

      {!loading && texts.length === 0 && <EmptyMessage message="No text content found" />}

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
