"use client";

import {
    MessageSquare,
    Plus,
    Trash2,
    Search,
    X as XIcon,
    Type,
    Image,
    Volume2,
    FileText as DocIcon,
} from "lucide-react";
import ProviderLogo from "./ProviderLogos";
import styles from "./HistoryPanel.module.css";
import { DateTime } from "luxon";
import { useState, useMemo } from "react";

function getModalities(messages) {
    const modalities = {
        textIn: false,
        textOut: false,
        imageIn: false,
        imageOut: false,
        audioIn: false,
        audioOut: false,
        docIn: false,
    };
    for (const m of messages || []) {
        const isUser = m.role === "user";
        const isAssistant = m.role === "assistant";
        if (m.content && (isUser || isAssistant)) {
            if (isUser) modalities.textIn = true;
            if (isAssistant) modalities.textOut = true;
        }
        if (m.images?.length > 0 || m.image) {
            if (isUser) modalities.imageIn = true;
            if (isAssistant) modalities.imageOut = true;
        }
        if (m.audio) {
            if (isUser) modalities.audioIn = true;
            if (isAssistant) modalities.audioOut = true;
        }
        if (
            m.documents?.length > 0 ||
            m.images?.some(
                (ref) =>
                    typeof ref === "string" &&
                    (ref.endsWith(".pdf") || ref.endsWith(".txt")),
            )
        ) {
            modalities.docIn = true;
        }
    }
    return modalities;
}

const MODALITY_FILTERS = [
    { key: "text", icon: Type, title: "Text" },
    { key: "image", icon: Image, title: "Image" },
    { key: "audio", icon: Volume2, title: "Audio" },
    { key: "doc", icon: DocIcon, title: "Document" },
];

export default function HistoryPanel({
    conversations,
    activeId,
    onSelect,
    onNew,
    onDelete,
    readOnly = false,
    showProject = false,
    showUsername = false,
}) {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeModality, setActiveModality] = useState(null);
    const [activeProvider, setActiveProvider] = useState(null);

    // Discover all modalities across conversations
    const allModalities = useMemo(() => {
        const set = new Set();
        for (const conv of conversations) {
            const mod = conv.modalities || getModalities(conv.messages);
            for (const { key } of MODALITY_FILTERS) {
                if (mod[`${key}In`] || mod[`${key}Out`]) set.add(key);
            }
        }
        return MODALITY_FILTERS.filter(({ key }) => set.has(key));
    }, [conversations]);

    // Discover all providers across conversations
    const allProviders = useMemo(() => {
        const set = new Set();
        for (const conv of conversations) {
            for (const p of conv.providers || []) set.add(p);
        }
        return [...set].sort();
    }, [conversations]);

    const filtered = useMemo(() => {
        return conversations.filter((conv) => {
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.trim().toLowerCase();
                const matchesSearch =
                    (conv.title || "").toLowerCase().includes(q) ||
                    (showProject && (conv.project || "").toLowerCase().includes(q)) ||
                    (showUsername && (conv.username || "").toLowerCase().includes(q)) ||
                    (conv.messages || []).some((m) =>
                        (m.content || "").toLowerCase().includes(q),
                    );
                if (!matchesSearch) return false;
            }
            // Modality filter
            if (activeModality) {
                const mod = conv.modalities || getModalities(conv.messages);
                if (!mod) return false;
                const hasModality =
                    mod[`${activeModality}In`] || mod[`${activeModality}Out`];
                if (!hasModality) return false;
            }
            // Provider filter
            if (activeProvider) {
                const providers = conv.providers || [];
                if (!providers.includes(activeProvider)) return false;
            }
            return true;
        });
    }, [
        conversations,
        searchQuery,
        activeModality,
        activeProvider,
        showProject,
        showUsername,
    ]);

    return (
        <div className={styles.container}>
            {!readOnly && (
                <button className={styles.newBtn} onClick={onNew} data-panel-close>
                    <Plus size={16} /> New Chat
                </button>
            )}

            <div className={styles.searchWrapper}>
                <Search size={14} className={styles.searchIcon} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search conversations..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button
                        className={styles.searchClear}
                        onClick={() => setSearchQuery("")}
                        title="Clear search"
                    >
                        <XIcon size={14} />
                    </button>
                )}
            </div>

            {/* Filter toggles */}
            {(allModalities.length >= 2 || allProviders.length >= 2) && (
                <div className={styles.filterSection}>
                    {allModalities.length >= 2 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Modality</span>
                            <div className={styles.filterBar}>
                                {allModalities.map(({ key, icon: Icon, title }) => (
                                    <button
                                        key={key}
                                        className={`${styles.filterBtn} ${activeModality === key ? styles.filterBtnActive : ""}`}
                                        onClick={() =>
                                            setActiveModality(activeModality === key ? null : key)
                                        }
                                        title={title}
                                    >
                                        <Icon size={13} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {allProviders.length >= 2 && (
                        <div className={styles.filterRow}>
                            <span className={styles.filterLabel}>Provider</span>
                            <div className={styles.filterBar}>
                                {allProviders.map((p) => (
                                    <button
                                        key={p}
                                        className={`${styles.filterBtn} ${activeProvider === p ? styles.filterBtnActive : ""}`}
                                        onClick={() =>
                                            setActiveProvider(activeProvider === p ? null : p)
                                        }
                                        title={p}
                                    >
                                        <ProviderLogo provider={p} size={13} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className={styles.list}>
                {filtered.map((conv) => {
                    const isActive = conv.id === activeId;
                    const dt = DateTime.fromISO(
                        conv.updatedAt || conv.createdAt,
                    ).toRelative();
                    const totalCost =
                        conv.totalCost ||
                        (conv.messages || []).reduce(
                            (sum, m) => sum + (m.estimatedCost || 0),
                            0,
                        );
                    const mod = conv.modalities || getModalities(conv.messages);

                    return (
                        <div
                            key={conv.id}
                            className={`${styles.item} ${isActive ? styles.active : ""}`}
                            onClick={() => onSelect(conv)}
                            data-panel-close
                        >
                            <MessageSquare size={14} className={styles.icon} />
                            <div className={styles.content}>
                                <div className={styles.title}>
                                    {conv.title || "Untitled Chat"}
                                </div>
                                <div className={styles.date}>
                                    {showProject && conv.project && (
                                        <span className={styles.projectTag}>{conv.project}</span>
                                    )}
                                    {showUsername &&
                                        conv.username &&
                                        conv.username !== "unknown" && (
                                            <span className={styles.usernameTag}>
                                                {conv.username}
                                            </span>
                                        )}
                                    {dt}
                                    {totalCost > 0 ? ` • $${totalCost.toFixed(5)}` : ""}
                                </div>
                                <div className={styles.modalities}>
                                    {mod.textIn && (
                                        <span className={styles.modalityIcon} title="Text input">
                                            <Type size={11} />
                                        </span>
                                    )}
                                    {mod.imageIn && (
                                        <span className={styles.modalityIcon} title="Image input">
                                            <Image size={11} />
                                        </span>
                                    )}
                                    {mod.audioIn && (
                                        <span className={styles.modalityIcon} title="Audio input">
                                            <Volume2 size={11} />
                                        </span>
                                    )}
                                    {mod.docIn && (
                                        <span
                                            className={styles.modalityIcon}
                                            title="Document input"
                                        >
                                            <DocIcon size={11} />
                                        </span>
                                    )}
                                    {(mod.textIn || mod.imageIn || mod.audioIn || mod.docIn) &&
                                        (mod.textOut || mod.imageOut || mod.audioOut) && (
                                            <span className={styles.modalityArrow}>→</span>
                                        )}
                                    {mod.textOut && (
                                        <span className={styles.modalityIcon} title="Text output">
                                            <Type size={11} />
                                        </span>
                                    )}
                                    {mod.imageOut && (
                                        <span className={styles.modalityIcon} title="Image output">
                                            <Image size={11} />
                                        </span>
                                    )}
                                    {mod.audioOut && (
                                        <span className={styles.modalityIcon} title="Audio output">
                                            <Volume2 size={11} />
                                        </span>
                                    )}
                                </div>
                            </div>
                            {!readOnly && onDelete && (
                                <button
                                    className={styles.deleteBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDelete(conv.id);
                                    }}
                                >
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
                {filtered.length === 0 && (
                    <div className={styles.empty}>
                        {searchQuery.trim() ? "No matching chats" : "No recent chats"}
                    </div>
                )}
            </div>
        </div>
    );
}
