"use client";

import { useState, useEffect, useCallback } from "react";
import { Image as ImageIcon, Music, Film, User, Sparkles, ExternalLink, Grid, List, Search } from "lucide-react";
import Link from "next/link";
import { IrisService } from "../services/IrisService";
import { PrismService } from "../services/PrismService";
import ComboboxFilter from "./ComboboxFilter";
import styles from "./MediaPageComponent.module.css";

const ORIGIN_FILTERS = [
  { key: "all", label: "All" },
  { key: "user", label: "Uploaded", icon: User },
  { key: "ai", label: "Generated", icon: Sparkles },
];

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "image", label: "Images", icon: ImageIcon },
  { key: "audio", label: "Audio", icon: Music },
  { key: "video", label: "Video", icon: Film },
];

function resolveUrl(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("minio://")) return PrismService.getFileUrl(url);
  if (url.startsWith("data:")) return url;
  if (url.startsWith("http")) return url;
  return url;
}

function MediaTypeIcon({ type, size = 32 }) {
  if (type === "audio") return <Music size={size} />;
  if (type === "video") return <Film size={size} />;
  return <ImageIcon size={size} />;
}

function OriginBadge({ origin, className }) {
  return (
    <span className={`${className} ${origin === "ai" ? styles.originAi : styles.originUser}`}>
      {origin === "ai" ? <><Sparkles size={10} /> Generated</> : <><User size={10} /> Uploaded</>}
    </span>
  );
}

export default function MediaPageComponent({ mode = "user" }) {
  const isAdmin = mode === "admin";
  const convBasePath = isAdmin ? "/admin/conversations" : "/conversations";

  const [media, setMedia] = useState([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState([]);
  const [usernames, setUsernames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("all");
  const [type, setType] = useState("all");
  const [project, setProject] = useState("");
  const [username, setUsername] = useState("");
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 60;

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (origin !== "all") params.origin = origin;
      if (type !== "all") params.type = type;
      if (project) params.project = project;
      if (username) params.username = username;
      if (search) params.search = search;

      const result = await IrisService.getMedia(params);
      setMedia(result.data || []);
      setTotal(result.total || 0);
      if (result.projects) setProjects(result.projects);
      if (result.usernames) setUsernames(result.usernames);
    } catch (err) {
      console.error("Failed to load media:", err);
    } finally {
      setLoading(false);
    }
  }, [page, origin, type, project, username, search]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className={styles.content}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Media</h1>
        <p className={styles.pageSubtitle}>
          {total} files across conversations
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

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Type</span>
          <div className={styles.pills}>
            {TYPE_FILTERS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  className={`${styles.pill} ${type === f.key ? styles.pillActive : ""}`}
                  onClick={() => { setType(f.key); setPage(1); }}
                >
                  {Icon && <Icon size={12} />}
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>Project</span>
          <ComboboxFilter
            options={projects}
            value={project}
            onChange={(v) => { setProject(v); setPage(1); }}
            placeholder="All Projects"
            allLabel="All Projects"
          />
        </div>

        {isAdmin && (
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>User</span>
            <ComboboxFilter
              options={usernames}
              value={username}
              onChange={(v) => { setUsername(v); setPage(1); }}
              placeholder="All Users"
              allLabel="All Users"
            />
          </div>
        )}

        <form className={styles.searchBox} onSubmit={handleSearch}>
          <Search size={14} />
          <input
            type="text"
            placeholder="Search by conversation..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className={styles.searchInput}
          />
        </form>

        {/* View mode toggle */}
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === "grid" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <Grid size={14} />
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === "list" ? styles.viewBtnActive : ""}`}
            onClick={() => setViewMode("list")}
            title="List view"
          >
            <List size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div className={styles.loading}>Loading media...</div>
      )}

      {/* ── Grid View ── */}
      {!loading && viewMode === "grid" && (
        <div className={styles.mediaGrid}>
          {media.map((m, i) => {
            const resolvedUrl = resolveUrl(m.url);
            return (
              <div key={`${m.convId}-${i}`} className={styles.mediaCard}>
                <div className={styles.mediaPreview}>
                  {m.mediaType === "image" && resolvedUrl ? (
                    <img
                      src={resolvedUrl}
                      alt={`${m.origin === "ai" ? "Generated" : "Uploaded"} image`}
                      className={styles.mediaImage}
                      loading="lazy"
                    />
                  ) : (
                    <div className={styles.mediaPlaceholder}>
                      <MediaTypeIcon type={m.mediaType} />
                      <span>{m.mediaType}</span>
                    </div>
                  )}
                  <OriginBadge origin={m.origin} className={styles.originBadge} />
                </div>
                <div className={styles.mediaInfo}>
                  <Link href={`${convBasePath}/${m.convId}`} className={styles.convLink} title={m.convTitle}>
                    <ExternalLink size={10} />
                    <span>{m.convTitle}</span>
                  </Link>
                  <div className={styles.mediaMeta}>
                    {m.model && <span className={styles.modelTag}>{m.model.split("/").pop()}</span>}
                    {m.timestamp && (
                      <span className={styles.time}>
                        {new Date(m.timestamp).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── List View ── */}
      {!loading && viewMode === "list" && (
        <div className={styles.listWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 60 }}>Preview</th>
                <th>Type</th>
                <th>Source</th>
                <th>Conversation</th>
                <th>Project</th>
                <th>Model</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {media.map((m, i) => {
                const resolvedUrl = resolveUrl(m.url);
                return (
                  <tr key={`${m.convId}-${i}`}>
                    <td>
                      <div className={styles.listThumb}>
                        {m.mediaType === "image" && resolvedUrl ? (
                          <img
                            src={resolvedUrl}
                            alt={`${m.origin === "ai" ? "Generated" : "Uploaded"} image`}
                            className={styles.listThumbImg}
                            loading="lazy"
                          />
                        ) : (
                          <div className={styles.listThumbPlaceholder}>
                            <MediaTypeIcon type={m.mediaType} size={16} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.typeBadge}>{m.mediaType}</span>
                    </td>
                    <td>
                      <OriginBadge origin={m.origin} className={styles.originPill} />
                    </td>
                    <td>
                      <Link href={`${convBasePath}/${m.convId}`} className={styles.convLink} title={m.convTitle}>
                        <ExternalLink size={10} />
                        <span>{m.convTitle}</span>
                      </Link>
                    </td>
                    <td>
                      {m.project ? (
                        <span className={styles.projectTag}>{m.project}</span>
                      ) : (
                        <span className={styles.time}>—</span>
                      )}
                    </td>
                    <td>
                      {m.model ? (
                        <span className={styles.modelTag}>{m.model.split("/").pop()}</span>
                      ) : (
                        <span className={styles.time}>—</span>
                      )}
                    </td>
                    <td>
                      <span className={styles.time}>
                        {m.timestamp ? new Date(m.timestamp).toLocaleDateString() : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && media.length === 0 && (
        <div className={styles.empty}>No media found</div>
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
