"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, MessageSquare, GitBranch } from "lucide-react";
import { useRouter } from "next/navigation";
import HistoryItemComponent from "../../../components/HistoryItemComponent";
import IrisService from "../../../services/IrisService";
import {
  formatNumber,
  formatCost,
  formatLatency,
  formatTokensPerSec,
  buildDateRangeParams,
} from "../../../utils/utilities";

import SortableTableComponent from "../../../components/SortableTableComponent";
import PaginationComponent from "../../../components/PaginationComponent";
import DatePickerComponent from "../../../components/DatePickerComponent";

import SelectDropdown from "../../../components/SelectDropdown";
import { ErrorMessage } from "../../../components/StateMessageComponent";
import {
  FilterBarComponent,
  FilterGroupComponent,
  FilterInputComponent,
  FilterSelectComponent,
  FilterClearButton,
} from "../../../components/FilterBarComponent";
import BadgeComponent from "../../../components/BadgeComponent";
import ButtonComponent from "../../../components/ButtonComponent";
import DetailDrawerComponent from "../../../components/DetailDrawerComponent";
import { useAdminHeader } from "../../../components/AdminHeaderContext";
import useProjectFilter from "../../../hooks/useProjectFilter";
import styles from "./page.module.css";
import { LS_DATE_RANGE } from "../../../constants";
import { getRequestsColumns } from "../requestsColumns";

export default function RequestsPage() {
  const router = useRouter();
  const { projectFilter, projectOptions, handleProjectChange } =
    useProjectFilter();
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
    provider: "",
    model: "",
    endpoint: "",
    success: "",
  });
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const LIMIT = 50;

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = { page, limit: LIMIT, sort, order };
      if (projectFilter) params.project = projectFilter;
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      Object.assign(params, buildDateRangeParams(dateRange));

      const data = await IrisService.getRequests(params);
      setRequests(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, sort, order, filters, dateRange, projectFilter]);

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
    return () => {
      cancelled = true;
    };
  }, [selectedRequest?.requestId]);

  function handleSort(key, dir) {
    setSort(key);
    setOrder(dir);
    setPage(1);
  }

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  function clearFilters() {
    setFilters({
      provider: "",
      model: "",
      endpoint: "",
      success: "",
    });
    setDateRange({ from: "", to: "" });
    setPage(1);
  }

  const columns = useMemo(() => getRequestsColumns(), []);

  const exportCSV = useCallback(() => {
    const headers = columns.map((c) => c.label).join(",");
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
        r.tokensPerSec ? formatTokensPerSec(r.tokensPerSec) : "",
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
  }, [columns, requests]);

  const totalPages = Math.ceil(total / LIMIT);

  const { setControls } = useAdminHeader();

  // Inject controls into AdminShell header
  useEffect(() => {
    setControls(
      <>
        {total > 0 && (
          <span className={styles.headerBadge}>
            {formatNumber(total)} total
          </span>
        )}
        <ErrorMessage message={error} />
        <SelectDropdown
          value={projectFilter || ""}
          options={projectOptions}
          onChange={handleProjectChange}
          placeholder="All Projects"
        />
      </>,
    );
  }, [
    setControls,
    total,
    error,
    projectFilter,
    projectOptions,
    handleProjectChange,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  return (
    <div className={styles.page}>
      {/* Filters */}
      <FilterBarComponent>
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
        <FilterClearButton onClick={clearFilters} />
        <ButtonComponent
          variant="secondary"
          icon={Download}
          onClick={exportCSV}
          size="small"
        >
          Export CSV
        </ButtonComponent>
      </FilterBarComponent>

      {/* Table */}
      <div className={styles.tableWrapper}>
        <SortableTableComponent
          columns={columns}
          data={requests}
          sortKey={sort}
          sortDir={order}
          onSort={handleSort}
          onRowClick={async (req) => {
            setSelectedRequest(req);
            // Fetch full detail (includes payloads)
            try {
              const full = await IrisService.getRequest(req.requestId);
              setSelectedRequest(full);
            } catch {
              /* keep partial data */
            }
          }}
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

      <DetailDrawerComponent
        open={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title="Request Detail"
        sections={
          selectedRequest
            ? [
                {
                  title: "General",
                  items: [
                    {
                      label: "Request ID",
                      value: selectedRequest.requestId || "-",
                      mono: true,
                    },
                    {
                      label: "Timestamp",
                      value: selectedRequest.timestamp
                        ? new Date(selectedRequest.timestamp).toLocaleString()
                        : "-",
                    },
                    { label: "Project", value: selectedRequest.project || "-" },
                    {
                      label: "Endpoint",
                      value: selectedRequest.endpoint || "-",
                    },
                    {
                      label: "Provider",
                      value: selectedRequest.provider || "-",
                    },
                    { label: "Model", value: selectedRequest.model || "-" },
                    {
                      label: "Status",
                      value: (
                        <BadgeComponent
                          variant={
                            selectedRequest.success ? "success" : "error"
                          }
                        >
                          {selectedRequest.success ? "Success" : "Error"}
                        </BadgeComponent>
                      ),
                    },
                    {
                      label: "Tools Used",
                      value: (
                        <BadgeComponent
                          variant={
                            selectedRequest.toolsUsed ? "endpoint" : "info"
                          }
                        >
                          {selectedRequest.toolsUsed ? "Yes" : "No"}
                        </BadgeComponent>
                      ),
                    },
                    ...(selectedRequest.errorMessage
                      ? [
                          {
                            label: "Error",
                            value: (
                              <span style={{ color: "var(--danger)" }}>
                                {selectedRequest.errorMessage}
                              </span>
                            ),
                          },
                        ]
                      : []),
                  ],
                },
                {
                  title: "Usage",
                  items: [
                    {
                      label: "Input Tokens",
                      value: formatNumber(selectedRequest.inputTokens),
                    },
                    {
                      label: "Output Tokens",
                      value: formatNumber(selectedRequest.outputTokens),
                    },
                    {
                      label: "Estimated Cost",
                      value: formatCost(selectedRequest.estimatedCost),
                    },
                    {
                      label: "Tokens/sec",
                      value: formatTokensPerSec(selectedRequest.tokensPerSec),
                    },
                    {
                      label: "Input Chars",
                      value: formatNumber(selectedRequest.inputCharacters),
                    },
                    {
                      label: "Output Chars",
                      value: formatNumber(selectedRequest.outputCharacters),
                    },
                    {
                      label: "Messages",
                      value: selectedRequest.messageCount || 0,
                    },
                  ],
                },
                {
                  title: "Timing",
                  items: [
                    {
                      label: "Time to Generation",
                      value: formatLatency(selectedRequest.timeToGeneration),
                    },
                    {
                      label: "Generation Time",
                      value: formatLatency(selectedRequest.generationTime),
                    },
                    {
                      label: "Total Time",
                      value: formatLatency(selectedRequest.totalTime),
                    },
                  ],
                },
                {
                  title: "Parameters",
                  items: [
                    {
                      label: "Temperature",
                      value: selectedRequest.temperature ?? "-",
                    },
                    {
                      label: "Max Tokens",
                      value: selectedRequest.maxTokens ?? "-",
                    },
                    { label: "Top P", value: selectedRequest.topP ?? "-" },
                    { label: "Top K", value: selectedRequest.topK ?? "-" },
                    {
                      label: "Frequency Penalty",
                      value: selectedRequest.frequencyPenalty ?? "-",
                    },
                    {
                      label: "Presence Penalty",
                      value: selectedRequest.presencePenalty ?? "-",
                    },
                  ],
                },
              ]
            : []
        }
      >
        {selectedRequest && (
          <>
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Associations</div>
              {loadingAssociations ? (
                <span style={{ color: "var(--text-muted)" }}>Loading…</span>
              ) : (
                <div className={styles.associationGrid}>
                  <div className={styles.associationGroup}>
                    <span className={styles.associationGroupLabel}>
                      <MessageSquare size={12} /> Conversations
                    </span>
                    {associations?.conversations?.length > 0 ? (
                      <div className={styles.associationList}>
                        {associations.conversations.map((c) => (
                          <HistoryItemComponent
                            key={c.id}
                            item={{
                              id: c.id,
                              title: c.title || "Untitled",
                              tags: c.project
                                ? [
                                    {
                                      label: c.project,
                                      style: {
                                        background: "var(--accent-subtle)",
                                        color: "var(--accent-color)",
                                      },
                                    },
                                  ]
                                : [],
                              updatedAt: c.updatedAt || c.createdAt,
                            }}
                            icon={MessageSquare}
                            onClick={() =>
                              router.push(`/admin/conversations/${c.id}`)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={styles.associationEmpty}>—</span>
                    )}
                  </div>
                  <div className={styles.associationGroup}>
                    <span className={styles.associationGroupLabel}>
                      <GitBranch size={12} /> Workflows
                    </span>
                    {associations?.workflows?.length > 0 ? (
                      <div className={styles.associationList}>
                        {associations.workflows.map((w) => (
                          <HistoryItemComponent
                            key={w.id}
                            item={{
                              id: w.id,
                              title: w.name || "Untitled",
                              tags: [
                                {
                                  label: `${w.nodeCount} nodes · ${w.edgeCount} edges`,
                                  style: {
                                    background: "var(--bg-tertiary)",
                                    color: "var(--text-muted)",
                                  },
                                },
                              ],
                              updatedAt: w.updatedAt || w.createdAt,
                            }}
                            icon={GitBranch}
                            onClick={() =>
                              router.push(`/admin/workflows/${w.id}`)
                            }
                          />
                        ))}
                      </div>
                    ) : (
                      <span className={styles.associationEmpty}>—</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {selectedRequest.requestPayload && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Request Payload</div>
                <pre className={styles.payloadBlock}>
                  {JSON.stringify(selectedRequest.requestPayload, null, 2)}
                </pre>
              </div>
            )}
            {selectedRequest.responsePayload && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>
                  Response Payload
                </div>
                <pre className={styles.payloadBlock}>
                  {JSON.stringify(selectedRequest.responsePayload, null, 2)}
                </pre>
              </div>
            )}
          </>
        )}
      </DetailDrawerComponent>
    </div>
  );
}
