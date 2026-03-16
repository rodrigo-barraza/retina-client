"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, User, Sparkles, ExternalLink, Image as ImageIcon, Code, Eye } from "lucide-react";
import Link from "next/link";
import { IrisService } from "../services/IrisService";
import MarkdownContent from "./MarkdownContent";
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
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Text</h1>
        <p className={styles.pageSubtitle}>
          {total} messages across conversations
        </p>
      </div>

      {/* Filters */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Source</span>
          <div className={styles.pills}>
            {ORIGIN_FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  className={`${styles.pill} ${origin === f.key ? styles.pillActive : ""}`}
                  onClick={() => { setOrigin(f.key); setPage(1); }}
                >
                  {Icon && <Icon size={12} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <form className={styles.searchBox} onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search text content..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        {/* Raw / Preview toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "raw" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("raw")}
            title="Raw text"
          >
            <Code size={14} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "preview" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("preview")}
            title="Markdown preview"
          >
            <Eye size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>Loading messages...</div>
      )}

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

      {!loading && texts.length === 0 && (
        <div className={styles.empty}>No text content found</div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <span className={styles.pageInfo}>
            Page {page} of {totalPages} · {total} total
          </span>
          <div className={styles.pageButtons}>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
