"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Image as ImageIcon,
  Music,
  Film,
  FileText,
  User,
  Sparkles,
  ExternalLink,
  Grid,
  List,
  Star,
} from "lucide-react";
import Link from "next/link";
import IrisService from "../services/IrisService";
import PrismService from "../services/PrismService";
import ComboboxFilter from "./ComboboxFilter";
import ImagePreviewComponent from "./ImagePreviewComponent";
import AudioRecorderComponent from "./AudioRecorderComponent";
import PaginationComponent from "./PaginationComponent";
import SortableTableComponent from "./SortableTableComponent";
import PageHeaderComponent from "./PageHeaderComponent";
import DatePickerComponent from "./DatePickerComponent";
import { LoadingMessage, EmptyMessage } from "./StateMessageComponent";
import {
  FilterBarComponent,
  FilterGroupComponent,
  FilterPillsComponent,
  SearchInputComponent,
  ViewModeToggleComponent,
} from "./FilterBarComponent";
import { MODALITY_COLORS } from "./WorkflowNodeConstants";
import { buildDateRangeParams } from "../utils/utilities";
import styles from "./MediaPageComponent.module.css";
import { LS_DATE_RANGE } from "../constants";

const ORIGIN_FILTERS = [
  { key: "all", label: "All" },
  { key: "user", label: "Uploaded", icon: User },
  { key: "ai", label: "Generated", icon: Sparkles },
];

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  {
    key: "image",
    label: "Images",
    icon: ImageIcon,
    color: MODALITY_COLORS.image,
  },
  { key: "audio", label: "Audio", icon: Music, color: MODALITY_COLORS.audio },
  { key: "video", label: "Video", icon: Film, color: MODALITY_COLORS.video },
  { key: "pdf", label: "PDF", icon: FileText, color: MODALITY_COLORS.pdf },
];

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

function OriginBadge({ origin, className }) {
  return (
    <span
      className={`${className} ${origin === "ai" ? styles.originAi : styles.originUser}`}
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

export default function MediaPageComponent({
  mode = "user",
  project: externalProject,
}) {
  const isAdmin = mode === "admin";
  const convBasePath = isAdmin ? "/admin/conversations" : "/conversations";

  const [media, setMedia] = useState([]);
  const [total, setTotal] = useState(0);
  const [projects, setProjects] = useState([]);
  const [usernames, setUsernames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("all");
  const [type, setType] = useState("all");
  const [internalProject, setInternalProject] = useState("");
  const project = externalProject ?? internalProject;
  const [username, setUsername] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [favoriteKeys, setFavoriteKeys] = useState([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const PAGE_SIZE = 60;

  const loadMedia = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: PAGE_SIZE };
      if (origin !== "all") params.origin = origin;
      if (type !== "all") params.type = type;
      if (isAdmin) {
        if (project) params.project = project;
        if (username) params.username = username;
      }
      if (search) params.search = search;
      if (provider) params.provider = provider;
      if (model) params.model = model;
      Object.assign(params, buildDateRangeParams(dateRange));

      const service = isAdmin ? IrisService : PrismService;
      const result = await service.getMedia(params);
      setMedia(result.data || []);
      setTotal(result.total || 0);
      if (result.projects) setProjects(result.projects);
      if (result.usernames) setUsernames(result.usernames);
      if (result.providers) setProviders(result.providers);
      if (result.models) setModels(result.models);
    } catch (err) {
      console.error("Failed to load media:", err);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    origin,
    type,
    project,
    username,
    search,
    provider,
    model,
    dateRange,
    isAdmin,
  ]);

  useEffect(() => {
    loadMedia();
  }, [loadMedia]);

  useEffect(() => {
    PrismService.getFavorites("media")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const toggleFavorite = async (mediaKey) => {
    if (favoriteKeys.includes(mediaKey)) {
      setFavoriteKeys((prev) => prev.filter((k) => k !== mediaKey));
      PrismService.removeFavorite("media", mediaKey).catch(() => {});
    } else {
      setFavoriteKeys((prev) => [...prev, mediaKey]);
      PrismService.addFavorite("media", mediaKey).catch(() => {});
    }
  };

  const getMediaKey = (m, i) => `${m.convId}-${m.mediaType}-${i}`;

  const displayMedia = showFavoritesOnly
    ? media.filter((m, i) => favoriteKeys.includes(getMediaKey(m, i)))
    : media;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const listColumns = [
    {
      key: "preview",
      label: "Preview",
      sortable: false,
      render: (m) => {
        const resolvedUrl = resolveUrl(m.url);
        return (
          <div className={styles.listThumb}>
            {m.mediaType === "image" && resolvedUrl ? (
              <img
                src={resolvedUrl}
                alt={`${m.origin === "ai" ? "Generated" : "Uploaded"} image`}
                className={styles.listThumbImg}
                style={{ cursor: "pointer" }}
                loading="lazy"
                onClick={() => setLightboxSrc(resolvedUrl)}
              />
            ) : m.mediaType === "video" && resolvedUrl ? (
              <video
                src={resolvedUrl}
                className={styles.listThumbImg}
                muted
                preload="metadata"
              />
            ) : m.mediaType === "audio" && resolvedUrl ? (
              <div
                className={styles.listThumbAudio}
                onClick={(e) => e.stopPropagation()}
              >
                <AudioRecorderComponent src={resolvedUrl} compact />
              </div>
            ) : m.mediaType === "pdf" && resolvedUrl ? (
              <iframe
                src={resolvedUrl}
                className={styles.listThumbPdf}
                title="PDF"
              />
            ) : (
              <div className={styles.listThumbPlaceholder}>
                <MediaTypeIcon type={m.mediaType} size={16} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "type",
      label: "Type",
      render: (m) => (
        <span
          className={styles.typeBadge}
          style={{ color: MODALITY_COLORS[m.mediaType] }}
        >
          {m.mediaType}
        </span>
      ),
    },
    {
      key: "source",
      label: "Source",
      render: (m) => (
        <OriginBadge origin={m.origin} className={styles.originPill} />
      ),
    },
    {
      key: "conversation",
      label: "Conversation",
      render: (m) => (
        <Link
          href={`${convBasePath}/${m.convId}`}
          className={styles.convLink}
          title={m.convTitle}
        >
          <ExternalLink size={10} />
          <span>{m.convTitle}</span>
        </Link>
      ),
    },
    ...(isAdmin
      ? [
          {
            key: "project",
            label: "Project",
            render: (m) =>
              m.project ? (
                <span className={styles.projectTag}>{m.project}</span>
              ) : (
                <span className={styles.time}>—</span>
              ),
          },
        ]
      : []),
    {
      key: "model",
      label: "Model",
      render: (m) =>
        m.model ? (
          <span className={styles.modelTag}>{m.model.split("/").pop()}</span>
        ) : (
          <span className={styles.time}>—</span>
        ),
    },
    {
      key: "date",
      label: "Date",
      render: (m) => (
        <span className={styles.time}>
          {m.timestamp ? new Date(m.timestamp).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeaderComponent
        title="Media"
        subtitle={`${total} files across conversations`}
      />
      <div className={styles.content}>

        {/* Filters */}
        <FilterBarComponent>
          <FilterGroupComponent label="Favorites">
            <FilterPillsComponent
              options={[
                { key: "all", label: "All" },
                { key: "favorites", label: "★ Favorites" },
              ]}
              value={showFavoritesOnly ? "favorites" : "all"}
              onChange={(v) => setShowFavoritesOnly(v === "favorites")}
            />
          </FilterGroupComponent>

          <FilterGroupComponent label="Source">
            <FilterPillsComponent
              options={ORIGIN_FILTERS}
              value={origin}
              onChange={(v) => {
                setOrigin(v);
                setPage(1);
              }}
            />
          </FilterGroupComponent>

          <FilterGroupComponent label="Type">
            <FilterPillsComponent
              options={TYPE_FILTERS}
              value={type}
              onChange={(v) => {
                setType(v);
                setPage(1);
              }}
            />
          </FilterGroupComponent>

          {isAdmin && externalProject === undefined && (
            <FilterGroupComponent label="Project">
              <ComboboxFilter
                options={projects}
                value={project}
                onChange={(v) => {
                  setInternalProject(v);
                  setPage(1);
                }}
                placeholder="All Projects"
                allLabel="All Projects"
              />
            </FilterGroupComponent>
          )}

          {isAdmin && (
            <FilterGroupComponent label="User">
              <ComboboxFilter
                options={usernames}
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setPage(1);
                }}
                placeholder="All Users"
                allLabel="All Users"
              />
            </FilterGroupComponent>
          )}

          <FilterGroupComponent label="Provider">
            <ComboboxFilter
              options={providers}
              value={provider}
              onChange={(v) => {
                setProvider(v);
                setModel("");
                setPage(1);
              }}
              placeholder="All Providers"
              allLabel="All Providers"
            />
          </FilterGroupComponent>

          <FilterGroupComponent label="Model">
            <ComboboxFilter
              options={
                provider
                  ? models.filter((m) => m.startsWith(provider + "/"))
                  : models
              }
              value={model}
              onChange={(v) => {
                setModel(v);
                setPage(1);
              }}
              placeholder="All Models"
              allLabel="All Models"
            />
          </FilterGroupComponent>

          <FilterGroupComponent label="Date">
            <DatePickerComponent
              from={dateRange.from}
              to={dateRange.to}
              onChange={(v) => {
                setDateRange(v);
                setPage(1);
              }}
              storageKey={LS_DATE_RANGE}
            />
          </FilterGroupComponent>

          <SearchInputComponent
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={handleSearch}
            placeholder="Search by conversation..."
          />

          {/* View mode toggle */}
          <ViewModeToggleComponent
            mode={viewMode}
            onChange={setViewMode}
            modes={[
              { key: "grid", icon: Grid, title: "Grid view" },
              { key: "list", icon: List, title: "List view" },
            ]}
          />
        </FilterBarComponent>

        {loading && <LoadingMessage message="Loading media..." />}

        {/* ── Grid View ── */}
        {!loading && viewMode === "grid" && (
          <div className={styles.mediaGrid}>
            {displayMedia.map((m, i) => {
              const resolvedUrl = resolveUrl(m.url);
              const mediaKey = getMediaKey(m, i);
              const isFav = favoriteKeys.includes(mediaKey);
              return (
                <div key={`${m.convId}-${i}`} className={styles.mediaCard}>
                  <button
                    className={`${styles.favBtn} ${isFav ? styles.favBtnActive : ""}`}
                    onClick={() => toggleFavorite(mediaKey)}
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star size={12} fill={isFav ? "currentColor" : "none"} />
                  </button>
                  <div className={styles.mediaPreview}>
                    {m.mediaType === "image" && resolvedUrl ? (
                      <img
                        src={resolvedUrl}
                        alt={`${m.origin === "ai" ? "Generated" : "Uploaded"} image`}
                        className={styles.mediaImage}
                        style={{ cursor: "pointer" }}
                        loading="lazy"
                        onClick={() => setLightboxSrc(resolvedUrl)}
                      />
                    ) : m.mediaType === "video" && resolvedUrl ? (
                      <video
                        src={resolvedUrl}
                        className={styles.mediaVideo}
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
                        className={styles.mediaAudioPreview}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <AudioRecorderComponent src={resolvedUrl} square />
                      </div>
                    ) : m.mediaType === "pdf" && resolvedUrl ? (
                      <iframe
                        src={resolvedUrl}
                        className={styles.mediaPdfPreview}
                        title="PDF preview"
                      />
                    ) : (
                      <div className={styles.mediaPlaceholder}>
                        <MediaTypeIcon type={m.mediaType} />
                        <span>{m.mediaType}</span>
                      </div>
                    )}
                    <OriginBadge
                      origin={m.origin}
                      className={styles.originBadge}
                    />
                  </div>
                  <div className={styles.mediaInfo}>
                    <Link
                      href={`${convBasePath}/${m.convId}`}
                      className={styles.convLink}
                      title={m.convTitle}
                    >
                      <ExternalLink size={10} />
                      <span>{m.convTitle}</span>
                    </Link>
                    <div className={styles.mediaMeta}>
                      {m.model && (
                        <span className={styles.modelTag}>
                          {m.model.split("/").pop()}
                        </span>
                      )}
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
            <SortableTableComponent
              columns={listColumns}
              data={displayMedia}
              getRowKey={(m, i) => `${m.convId}-${i}`}
            />
          </div>
        )}

        {!loading && displayMedia.length === 0 && (
          <EmptyMessage message="No media found" />
        )}

        {/* Pagination */}
        <PaginationComponent
          page={page}
          totalPages={totalPages}
          totalItems={total}
          onPageChange={setPage}
        />
      </div>

      {lightboxSrc && (
        <ImagePreviewComponent
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
          readOnly
        />
      )}
    </>
  );
}
