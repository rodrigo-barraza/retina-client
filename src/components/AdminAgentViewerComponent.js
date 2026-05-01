"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Bot, Settings, Wrench, Brain, Plug, GitBranch, ListChecks,
  BookOpen, Users, Info, Layers, PanelLeftClose, PanelLeft,
  PanelRightClose, PanelRight,
} from "lucide-react";
import IrisService from "../services/IrisService.js";
import PrismService from "../services/PrismService.js";
import ToolsApiService from "../services/ToolsApiService.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import ModelInfoPanel from "./ModelInfoPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import SkillsPanel from "./SkillsPanel.js";
import MemoriesPanel from "./MemoriesPanel.js";
import TasksPanel from "./TasksPanel.js";
import MCPServersPanel from "./MCPServersPanel.js";
import CoordinatorPanel from "./CoordinatorPanel.js";
import WorkersPanel from "./WorkersPanel.js";
import MessageList, { prepareDisplayMessages } from "./MessageList.js";

import ModelBadgeComponent from "./ModelBadgeComponent.js";
import { useAdminHeader } from "./AdminHeaderContext.js";

import { formatNumber } from "../utils/utilities.js";
import useSessionStats from "../hooks/useSessionStats.js";
import { PROJECT_AGENT } from "../constants.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./AdminAgentViewerComponent.module.css";
import { EmptyStateComponent, TabBarComponent } from "@rodrigo-barraza/components";

/**
 * AdminAgentViewerComponent — read-only admin viewer for agent sessions.
 * Designed to work WITHIN AdminShell's main area (not ThreePanelLayout).
 * Reuses all agent sub-components: TabBarComponent, SettingsPanel,
 * MessageList, HistoryPanel, MemoriesPanel, TasksPanel, WorkersPanel, etc.
 */
export default function AdminAgentViewerComponent() {
  const { setTitleBadge, setControls } = useAdminHeader();

  // -- State ----------------------------------------------------
  const [messages, setMessages] = useState([]);
  const [agentSessionId, setAgentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, _setPage] = useState(1);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("");
  const [leftTab, setLeftTab] = useState("settings");
  const [customTools, setCustomTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const [skills, setSkills] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [memoriesRefreshKey] = useState(0);
  const [totalMemoriesCount, setTotalMemoriesCount] = useState(0);
  const [workersCount, setWorkersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [backendSessionStats, setBackendSessionStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [settings, setSettings] = useState({
    provider: "",
    model: "",
    temperature: 1.0,
    maxTokens: 64000,
    functionCallingEnabled: true,
  });

  const endRef = useRef(null);

  // -- Effects --------------------------------------------------

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Set admin header badge
  useEffect(() => {
    setTitleBadge(total > 0 ? formatNumber(total) : null);
    return () => setTitleBadge(null);
  }, [total, setTitleBadge]);

  // Cleanup admin controls on unmount
  useEffect(() => {
    return () => setControls(null);
  }, [setControls]);

  // Fetch Prism config (for model info panels, provider logos, etc.)
  useEffect(() => {
    PrismService.getConfigWithLocalModels({
      onConfig: (cfg) => setConfig(cfg),
      onLocalMerge: (merged) => setConfig(merged),
    }).catch(console.error);
  }, []);

  // Load agent sessions list (admin — cross-user)
  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await IrisService.getAgentSessions({
        page,
        limit: 50,
        sort: "updatedAt",
        order: "desc",
      });
      setSessions(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Failed to load admin agent sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load custom tools (read-only display)
  useEffect(() => {
    PrismService.getCustomTools(PROJECT_AGENT)
      .then((tools) => setCustomTools(tools))
      .catch(() => {});
  }, []);

  // Load skills (read-only display)
  useEffect(() => {
    PrismService.getSkills(PROJECT_AGENT)
      .then((s) => setSkills(s))
      .catch(() => {});
  }, []);

  // Load MCP servers (read-only display)
  useEffect(() => {
    PrismService.getMCPServers(PROJECT_AGENT)
      .then((s) => setMcpServers(s))
      .catch(() => {});
  }, []);

  // Load built-in tools
  useEffect(() => {
    PrismService.getBuiltInToolSchemas("CODING")
      .then((tools) => setBuiltInTools(tools))
      .catch(() => {});
  }, []);

  // Fetch memory count
  useEffect(() => {
    PrismService.getAgentMemories(PROJECT_AGENT, 1)
      .then((r) => setTotalMemoriesCount(r.total || 0))
      .catch(() => {});
  }, []);

  // -- Filtered config: only function-calling models ------------
  const filteredConfig = useMemo(() => {
    if (!config) return null;
    const textModelsMap = config.textToText?.models || {};
    const filteredTextModels = {};

    for (const [provider, models] of Object.entries(textModelsMap)) {
      const fcModels = models.filter((m) =>
        m.tools?.includes("Tool Calling"),
      );
      if (fcModels.length > 0) filteredTextModels[provider] = fcModels;
    }

    const filteredProviderList = (config.providerList || []).filter(
      (p) => filteredTextModels[p],
    );

    return {
      ...config,
      providerList: filteredProviderList,
      textToText: {
        ...config.textToText,
        models: filteredTextModels,
      },
      textToImage: { models: {} },
      textToSpeech: { models: {}, voices: {}, defaultVoices: {} },
      audioToText: { models: {} },
    };
  }, [config]);

  // -- Session stats -------------------------------------------
  const {
    uniqueModels, uniqueProviders, totalCost, totalTokens, requestCount,
    usedTools, modalities, elapsedTime: completedElapsedTime,
  } = useSessionStats(messages);

  // Fetch backend stats when session changes
  const fetchSessionStats = useCallback((sessionId) => {
    if (!sessionId) return;
    IrisService.getSessionStats(sessionId)
      .then((stats) => setBackendSessionStats(stats))
      .catch(() => {});
  }, []);

  // -- Session selection ----------------------------------------
  const handleSelectSession = useCallback(
    async (conv) => {
      try {
        const full = await IrisService.getAgentSession(conv.id);
        const displayMessages = prepareDisplayMessages(full.messages || []);
        setMessages(displayMessages);
        setAgentSessionId(conv.id);
        setActiveId(conv.id);
        setTitle(full.title || "Agent Session");

        // Restore settings from the last assistant message
        const lastAssistant = [...(full.messages || [])]
          .reverse()
          .find((m) => m.role === "assistant" && m.provider);
        if (lastAssistant) {
          const gs = lastAssistant.generationSettings || {};
          setSettings((prev) => ({
            ...prev,
            ...(lastAssistant.provider && { provider: lastAssistant.provider }),
            ...(lastAssistant.model && { model: lastAssistant.model }),
            ...(gs.temperature !== undefined && { temperature: gs.temperature }),
            ...(gs.maxTokens !== undefined && { maxTokens: gs.maxTokens }),
            ...(gs.thinkingEnabled !== undefined && { thinkingEnabled: gs.thinkingEnabled }),
            ...(gs.reasoningEffort && { reasoningEffort: gs.reasoningEffort }),
            ...(gs.thinkingBudget && { thinkingBudget: gs.thinkingBudget }),
          }));
        }

        // Fetch backend aggregate stats
        fetchSessionStats(conv.id);

        // Fetch tasks count for this session
        ToolsApiService.getAllAgenticTasks({ agentSessionId: conv.id })
          .then((r) => setTasksCount(r.summary?.total || (r.tasks || []).length))
          .catch(() => {});

        // Fetch workers count
        PrismService.getCoordinatorWorkers(conv.id)
          .then((r) => setWorkersCount((r.workers || []).length))
          .catch(() => {});
      } catch (err) {
        console.error("Failed to load agent session:", err);
      }
    },
    [fetchSessionStats],
  );

  // Tool count for badge
  const allToolCount = builtInTools.length + customTools.length;

  // -- Badge helper ---------------------------------------------
  const badgeProps = (count) => ({ badge: count, badgeDisabled: count === 0 });

  // -- Left sidebar: tab bar + content --------------------------
  const leftPanel = (
    <>
      <TabBarComponent
        tabs={[
          { key: "settings", icon: <Settings size={14} />, tooltip: "Settings" },
          { key: "info", icon: <Info size={14} />, tooltip: "Info" },
          {
            key: "tools",
            icon: <Wrench size={14} />,
            ...badgeProps(allToolCount),
            tooltip: "Tools",
          },
          {
            key: "skills",
            icon: <BookOpen size={14} />,
            ...badgeProps(skills.filter((s) => s.enabled).length),
            tooltip: "Skills",
          },
          {
            key: "memories",
            icon: <Brain size={14} />,
            ...badgeProps(totalMemoriesCount),
            tooltip: "Memories",
          },
          {
            key: "tasks",
            icon: <ListChecks size={14} />,
            ...badgeProps(tasksCount),
            tooltip: "Tasks",
          },
          {
            key: "mcp",
            icon: <Plug size={14} />,
            ...badgeProps(mcpServers.filter((s) => s.connected).length),
            tooltip: "MCP Servers",
          },
          {
            key: "workers",
            icon: <Users size={14} />,
            ...badgeProps(workersCount),
            tooltip: "Workers",
          },
          {
            key: "coordinator",
            icon: <GitBranch size={14} />,
            tooltip: "Coordinator",
          },
        ]}
        activeTab={leftTab}
        onChange={setLeftTab}
      />

      {leftTab === "settings" && (
        <SettingsPanel
          config={filteredConfig}
          settings={settings}
          onChange={() => {}}
          readOnly
          hideSystemPrompt
          sessionType="agent"
          sessionStats={
            messages.length > 0
              ? {
                  messageCount: messages.length,
                  deletedCount: 0,
                  requestCount: backendSessionStats?.requestCount || requestCount,
                  uniqueModels: backendSessionStats?.models?.length > uniqueModels.length
                    ? backendSessionStats.models
                    : uniqueModels,
                  uniqueProviders,
                  totalTokens: backendSessionStats
                    ? {
                        input: backendSessionStats.totalInputTokens,
                        output: backendSessionStats.totalOutputTokens,
                        total: backendSessionStats.totalTokens,
                      }
                    : totalTokens,
                  totalCost: backendSessionStats?.totalCost ?? totalCost,
                  originalTotalCost: 0,
                  usedTools,
                  modalities: backendSessionStats?.modalities || modalities,
                  completedElapsedTime: backendSessionStats?.totalElapsedTime || completedElapsedTime,
                }
              : null
          }
        />
      )}

      {leftTab === "info" && (
        <ModelInfoPanel
          config={filteredConfig}
          settings={settings}
          onChange={() => {}}
          lockedTools={new Set(["Tool Calling"])}
        />
      )}

      {leftTab === "tools" && (
        <CustomToolsPanel
          tools={customTools}
          onToolsChange={() => {}}
          project={PROJECT_AGENT}
          builtInTools={builtInTools}
          disabledBuiltIns={new Set()}
          onToggleBuiltIn={() => {}}
          onToggleAllBuiltIn={() => {}}
          readOnly
        />
      )}

      {leftTab === "skills" && (
        <SkillsPanel
          skills={skills}
          onSkillsChange={() => {}}
          project={PROJECT_AGENT}
          readOnly
        />
      )}

      {leftTab === "memories" && (
        <MemoriesPanel
          project={PROJECT_AGENT}
          refreshKey={memoriesRefreshKey}
          onCountChange={setTotalMemoriesCount}
          memoryConfigured
        />
      )}

      {leftTab === "tasks" && agentSessionId && (
        <TasksPanel
          project={PROJECT_AGENT}
          refreshKey={0}
          agentSessionId={agentSessionId}
          onCountChange={setTasksCount}
        />
      )}

      {leftTab === "mcp" && (
        <MCPServersPanel
          servers={mcpServers}
          onServersChange={() => {}}
          project={PROJECT_AGENT}
          readOnly
        />
      )}

      {leftTab === "workers" && agentSessionId && (
        <WorkersPanel
          agentSessionId={agentSessionId}
          refreshKey={0}
          onCountChange={setWorkersCount}
          workerToolActivity={{}}
        />
      )}

      {leftTab === "coordinator" && (
        <CoordinatorPanel project={PROJECT_AGENT} />
      )}
    </>
  );

  // -- Center: chat area (read-only) ---------------------------
  const chatContent = (
    <div className={chatStyles.container}>
      <div className={chatStyles.messagesList}>
        {!activeId && (
          <EmptyStateComponent
            icon={<Bot size={40} />}
            title="Agent Sessions"
            subtitle="Select a session from the right panel to view its messages and tool activity."
          />
        )}

        <MessageList
          messages={messages.filter(
            (m) => m.role === "user" || m.role === "assistant",
          )}
          isGenerating={false}
          streamingOutputs={new Map()}
        />

        <div ref={endRef} style={{ minHeight: 24 }} />
      </div>

      {/* Read-only banner instead of input area */}
      {activeId && (
        <div className={styles.readOnlyBanner}>
          <Layers size={13} />
          Read-only admin view — {messages.length} messages
        </div>
      )}
    </div>
  );

  // -- Layout (within AdminShell's main area) ------------------
  return (
    <div className={styles.viewer}>
      {/* Mini header: session title + model badge + panel toggles */}
      <header className={styles.viewerHeader}>
        <button
          className={`${styles.panelToggle} ${!showLeft ? styles.panelToggleHidden : ""}`}
          onClick={() => setShowLeft((v) => !v)}
          title={showLeft ? "Hide settings" : "Show settings"}
        >
          {showLeft ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
        </button>

        <span className={styles.viewerTitle}>
          {title || "Select a session"}
        </span>

        {activeId && settings.model && (
          <ModelBadgeComponent models={[settings.model]} provider={settings.provider} />
        )}

        <div style={{ flex: 1 }} />

        <button
          className={`${styles.panelToggle} ${!showRight ? styles.panelToggleHidden : ""}`}
          onClick={() => setShowRight((v) => !v)}
          title={showRight ? "Hide sessions" : "Show sessions"}
        >
          {showRight ? <PanelRightClose size={15} /> : <PanelRight size={15} />}
        </button>
      </header>

      {/* 3-column body */}
      <div className={styles.viewerBody}>
        {/* Left panel - settings/tools/info tabs */}
        <aside className={`${styles.leftPanel} ${!showLeft ? styles.panelHidden : ""}`}>
          {leftPanel}
        </aside>

        {/* Center - messages */}
        <section className={styles.centerPanel}>
          {chatContent}
        </section>

        {/* Right panel - sessions list */}
        <aside className={`${styles.rightPanel} ${!showRight ? styles.panelHidden : ""}`}>
          <HistoryPanel
            sessions={sessions}
            activeId={activeId}
            onSelect={handleSelectSession}
            readOnly
            showProject
            showUsername
            emptyText={loading ? "Loading..." : "No agent sessions"}
            searchText="Search sessions..."
            itemIcon={Bot}
            countLabel="sessions"
          />
        </aside>
      </div>
    </div>
  );
}
