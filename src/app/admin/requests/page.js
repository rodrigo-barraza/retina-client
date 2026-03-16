"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, X, MessageSquare, GitBranch } from "lucide-react";
import Link from "next/link";
import { IrisService } from "../../../services/IrisService";
import { formatNumber, formatCost, formatLatency } from "../../../utils/utilities";
import SortableTableComponent from "../../../components/SortableTableComponent";
import PaginationComponent from "../../../components/PaginationComponent";
import PageHeaderComponent from "../../../components/PageHeaderComponent";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import { FilterBarComponent, FilterGroupComponent, FilterInputComponent, FilterSelectComponent, FilterClearButton } from "../../../components/FilterBarComponent";
import styles from "./page.module.css";



export default function RequestsPage() {
    const [requests, setRequests] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sort, setSort] = useState("timestamp");
    const [order, setOrder] = useState("desc");
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [associations, setAssociations] = useState(null);
    const [loadingAssociations, setLoadingAssociations] = useState(false);
    const [filters, setFilters] = useState({
        project: "",
        provider: "",
        model: "",
        endpoint: "",
        success: "",
    });

    const LIMIT = 50;

    const loadRequests = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const params = { page, limit: LIMIT, sort, order };
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params[k] = v;
            });

            const data = await IrisService.getRequests(params);
            setRequests(data.data || []);
            setTotal(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, sort, order, filters]);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    // Fetch associations when a request is selected
    useEffect(() => {
        if (!selectedRequest?.requestId) {
            setAssociations(null);
            return;
        }
        let cancelled = false;
        setLoadingAssociations(true);
        IrisService.getRequestAssociations(selectedRequest.requestId)
            .then((data) => {
                if (!cancelled) setAssociations(data);
            })
            .catch(() => {
                if (!cancelled) setAssociations({ conversations: [], workflows: [] });
            })
            .finally(() => {
                if (!cancelled) setLoadingAssociations(false);
            });
        return () => { cancelled = true; };
    }, [selectedRequest?.requestId]);

    function handleSort(key, dir) {
        setSort(key);
        setOrder(dir);
        setPage(1);
    }

    function handleFilterChange(key, value) {
        setFilters((prev) => ({ ...prev, [key]: value }));
        setPage(1);
    }

    function clearFilters() {
        setFilters({
            project: "",
            provider: "",
            model: "",
            endpoint: "",
            success: "",
        });
        setPage(1);
    }

    function exportCSV() {
        const headers = COLUMNS.map((c) => c.label).join(",");
        const rows = requests.map((r) =>
            [
                r.timestamp || "",
                r.project || "",
                r.endpoint || "",
                r.provider || "",
                r.model || "",
                r.inputTokens || 0,
                r.outputTokens || 0,
                r.estimatedCost || 0,
                r.tokensPerSec ? Number(r.tokensPerSec).toFixed(1) : "",
                r.totalTime || 0,
                r.success ? "OK" : "ERR",
            ].join(","),
        );
        const csv = [headers, ...rows].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `iris-requests-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const columns = useMemo(() => [
        { key: "timestamp", label: "Time", render: (r) => r.timestamp ? new Date(r.timestamp).toLocaleString() : "-" },
        { key: "project", label: "Project" },
        {
            key: "endpoint", label: "Endpoint", render: (r) => (
                <span className={`${styles.badge} ${styles.badgeEndpoint}`}>{r.endpoint || "-"}</span>
            )
        },
        {
            key: "provider", label: "Provider", render: (r) => (
                <span className={`${styles.badge} ${styles.badgeProvider}`}>{r.provider || "-"}</span>
            )
        },
        { key: "model", label: "Model" },
        { key: "inputTokens", label: "In Tokens", render: (r) => formatNumber(r.inputTokens), align: "right" },
        { key: "outputTokens", label: "Out Tokens", render: (r) => formatNumber(r.outputTokens), align: "right" },
        { key: "estimatedCost", label: "Cost", render: (r) => formatCost(r.estimatedCost), align: "right" },
        { key: "tokensPerSec", label: "Tok/s", render: (r) => r.tokensPerSec != null ? Number(r.tokensPerSec).toFixed(1) : "—", align: "right" },
        { key: "totalTime", label: "Latency", render: (r) => formatLatency(r.totalTime), align: "right" },
        {
            key: "success", label: "Status", render: (r) => (
                <span className={`${styles.badge} ${r.success ? styles.badgeSuccess : styles.badgeError}`}>
                    {r.success ? "OK" : "ERR"}
                </span>
            )
        },
    ], []);

    const totalPages = Math.ceil(total / LIMIT);

    return (
        <div className={styles.page}>
            <PageHeaderComponent title="Requests">
                <button className={styles.exportBtn} onClick={exportCSV}>
                    <Download size={14} /> Export CSV
                </button>
            </PageHeaderComponent>

            <ErrorMessage message={error} />

            {/* Filters */}
            <FilterBarComponent>
                <FilterGroupComponent label="Project">
                    <FilterInputComponent
                        placeholder="Filter by project..."
                        value={filters.project}
                        onChange={(val) => handleFilterChange("project", val)}
                    />
                </FilterGroupComponent>
                <FilterGroupComponent label="Provider">
                    <FilterSelectComponent
                        value={filters.provider}
                        onChange={(val) => handleFilterChange("provider", val)}
                        options={[
                            { value: "", label: "All" },
                            { value: "openai", label: "OpenAI" },
                            { value: "anthropic", label: "Anthropic" },
                            { value: "google", label: "Google" },
                            { value: "elevenlabs", label: "ElevenLabs" },
                        ]}
                    />
                </FilterGroupComponent>
                <FilterGroupComponent label="Model">
                    <FilterInputComponent
                        placeholder="Filter by model..."
                        value={filters.model}
                        onChange={(val) => handleFilterChange("model", val)}
                    />
                </FilterGroupComponent>
                <FilterGroupComponent label="Endpoint">
                    <FilterSelectComponent
                        value={filters.endpoint}
                        onChange={(val) => handleFilterChange("endpoint", val)}
                        options={[
                            { value: "", label: "All" },
                            { value: "/chat", label: "/chat" },
                            { value: "/audio", label: "/audio" },
                            { value: "/embed", label: "/embed" },
                        ]}
                    />
                </FilterGroupComponent>
                <FilterGroupComponent label="Status">
                    <FilterSelectComponent
                        value={filters.success}
                        onChange={(val) => handleFilterChange("success", val)}
                        options={[
                            { value: "", label: "All" },
                            { value: "true", label: "Success" },
                            { value: "false", label: "Error" },
                        ]}
                    />
                </FilterGroupComponent>
                <FilterClearButton onClick={clearFilters} />
            </FilterBarComponent>

            {/* Table */}
            <div className={styles.tableWrapper}>
                <SortableTableComponent
                    columns={columns}
                    data={requests}
                    sortKey={sort}
                    sortDir={order}
                    onSort={handleSort}
                    onRowClick={(req) => setSelectedRequest(req)}
                    getRowKey={(req, i) => req.requestId || i}
                    emptyText={loading ? "Loading..." : "No requests found"}
                />

                {/* Pagination */}
                <PaginationComponent
                    page={page}
                    totalPages={totalPages}
                    totalItems={total}
                    onPageChange={setPage}
                    limit={LIMIT}
                />
            </div>

            {/* Detail Drawer */}
            {selectedRequest && (
                <>
                    <div
                        className={styles.drawerOverlay}
                        onClick={() => setSelectedRequest(null)}
                    />
                    <div className={styles.drawer}>
                        <div className={styles.drawerHeader}>
                            <span className={styles.drawerTitle}>Request Detail</span>
                            <button
                                className={styles.closeBtn}
                                onClick={() => setSelectedRequest(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className={styles.drawerBody}>
                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>General</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Request ID</span>
                                        <span className={`${styles.detailValue} ${styles.mono}`}>
                                            {selectedRequest.requestId || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Timestamp</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.timestamp
                                                ? new Date(selectedRequest.timestamp).toLocaleString()
                                                : "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Project</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.project || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Endpoint</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.endpoint || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Provider</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.provider || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Model</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.model || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Status</span>
                                        <span
                                            className={`${styles.badge} ${selectedRequest.success ? styles.badgeSuccess : styles.badgeError}`}
                                        >
                                            {selectedRequest.success ? "Success" : "Error"}
                                        </span>
                                    </div>
                                    {selectedRequest.errorMessage && (
                                        <div className={styles.detailItem}>
                                            <span className={styles.detailLabel}>Error</span>
                                            <span
                                                className={styles.detailValue}
                                                style={{ color: "var(--danger)" }}
                                            >
                                                {selectedRequest.errorMessage}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Usage</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Input Tokens</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.inputTokens)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Output Tokens</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.outputTokens)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Estimated Cost</span>
                                        <span className={styles.detailValue}>
                                            {formatCost(selectedRequest.estimatedCost)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Tokens/sec</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.tokensPerSec?.toFixed(1) || "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Input Chars</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.inputCharacters)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Output Chars</span>
                                        <span className={styles.detailValue}>
                                            {formatNumber(selectedRequest.outputCharacters)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Messages</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.messageCount || 0}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Timing</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>
                                            Time to Generation
                                        </span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.timeToGeneration)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Generation Time</span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.generationTime)}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Total Time</span>
                                        <span className={styles.detailValue}>
                                            {formatLatency(selectedRequest.totalTime)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Parameters</div>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Temperature</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.temperature ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Max Tokens</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.maxTokens ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Top P</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.topP ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Top K</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.topK ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>
                                            Frequency Penalty
                                        </span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.frequencyPenalty ?? "-"}
                                        </span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>Presence Penalty</span>
                                        <span className={styles.detailValue}>
                                            {selectedRequest.presencePenalty ?? "-"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <div className={styles.detailSectionTitle}>Associations</div>
                                {loadingAssociations ? (
                                    <span className={styles.detailValue} style={{ color: "var(--text-muted)" }}>Loading…</span>
                                ) : (
                                    <div className={styles.associationGrid}>
                                        <div className={styles.associationGroup}>
                                            <span className={styles.associationGroupLabel}>
                                                <MessageSquare size={12} /> Conversations
                                            </span>
                                            {associations?.conversations?.length > 0 ? (
                                                <ul className={styles.associationList}>
                                                    {associations.conversations.map((c) => (
                                                        <li key={c.id} className={styles.associationItem}>
                                                            <Link
                                                                href={`/admin/conversations/${c.id}`}
                                                                className={styles.associationLink}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <span className={styles.associationTitle}>{c.title || "Untitled"}</span>
                                                                <span className={styles.associationMeta}>{c.project}</span>
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className={styles.associationEmpty}>—</span>
                                            )}
                                        </div>
                                        <div className={styles.associationGroup}>
                                            <span className={styles.associationGroupLabel}>
                                                <GitBranch size={12} /> Workflows
                                            </span>
                                            {associations?.workflows?.length > 0 ? (
                                                <ul className={styles.associationList}>
                                                    {associations.workflows.map((w) => (
                                                        <li key={w.id} className={styles.associationItem}>
                                                            <Link
                                                                href={`/admin/workflows/${w.id}`}
                                                                className={styles.associationLink}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                <span className={styles.associationTitle}>{w.name}</span>
                                                                <span className={styles.associationMeta}>{w.nodeCount} nodes · {w.edgeCount} edges</span>
                                                            </Link>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className={styles.associationEmpty}>—</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
