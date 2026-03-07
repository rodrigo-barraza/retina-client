"use client";

import { MessageSquare, Plus, Trash2, Search, X as XIcon } from "lucide-react";
import styles from "./HistoryPanel.module.css";
import { DateTime } from "luxon";
import { useState } from "react";

export default function HistoryPanel({
    conversations,
    activeId,
    onSelect,
    onNew,
    onDelete,
}) {
    const [searchQuery, setSearchQuery] = useState("");

    const filtered = searchQuery.trim()
        ? conversations.filter((conv) => {
            const q = searchQuery.trim().toLowerCase();
            if ((conv.title || "").toLowerCase().includes(q)) return true;
            return (conv.messages || []).some((m) =>
                (m.content || "").toLowerCase().includes(q),
            );
        })
        : conversations;

    return (
        <div className={styles.container}>
            <button className={styles.newBtn} onClick={onNew}>
                <Plus size={16} /> New Chat
            </button>

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

            <div className={styles.list}>
                {filtered.map((conv) => {
                    const isActive = conv.id === activeId;
                    const dt = DateTime.fromISO(
                        conv.updatedAt || conv.createdAt,
                    ).toRelative();
                    const totalCost = (conv.messages || []).reduce(
                        (sum, m) => sum + (m.estimatedCost || 0),
                        0,
                    );

                    return (
                        <div
                            key={conv.id}
                            className={`${styles.item} ${isActive ? styles.active : ""}`}
                            onClick={() => onSelect(conv)}
                        >
                            <MessageSquare size={14} className={styles.icon} />
                            <div className={styles.content}>
                                <div className={styles.title}>
                                    {conv.title || "Untitled Chat"}
                                </div>
                                <div className={styles.date}>
                                    {dt}
                                    {totalCost > 0 ? ` • $${totalCost.toFixed(5)}` : ""}
                                </div>
                            </div>
                            <button
                                className={styles.deleteBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete(conv.id);
                                }}
                            >
                                <Trash2 size={14} />
                            </button>
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
