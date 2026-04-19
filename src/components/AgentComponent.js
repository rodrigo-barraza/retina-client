"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { BotMessageSquare, Paperclip, X, ClipboardList, Zap, Settings, Wrench, Brain, Plug, GitBranch, Repeat, ListChecks, BookOpen, Info, Activity, CornerDownLeft, Send, Square } from "lucide-react";
import PrismService from "../services/PrismService.js";
import ToolsApiService from "../services/ToolsApiService.js";
import ThreePanelLayout, { layoutStyles } from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
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
import SessionRequestsListComponent from "./SessionRequestsListComponent.js";
import MessageList, { prepareDisplayMessages } from "./MessageList.js";
import ImagePreviewComponent from "./ImagePreviewComponent.js";
import TabBarComponent from "./TabBarComponent.js";
import EmptyStateComponent from "./EmptyStateComponent.js";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent.js";
import ApprovalCardComponent from "./ApprovalCardComponent.js";
import PlanCardComponent from "./PlanCardComponent.js";

import StatusBarComponent from "./StatusBarComponent.js";
import PixelTransitionComponent from "./PixelTransitionComponent.js";

import {
  buildToolSchemas,
} from "../utils/FunctionCallingUtilities.js";

import useSessionStats from "../hooks/useSessionStats.js";
import { PROJECT_AGENT, SETTINGS_DEFAULTS, SK_MODEL_MEMORY_AGENT, SK_MODEL_MEMORY_AGENT_PREFIX, SK_TOOL_MEMORY_AGENT, SK_TOOL_MEMORY_AGENT_PREFIX, MAX_TOOL_ITERATIONS } from "../constants.js";
import chatStyles from "./ChatArea.module.css";
import ChatInputButton from "./ChatInputButton.js";
import ButtonComponent from "./ButtonComponent.js";
import useToolToggles from "../hooks/useToolToggles.js";
import useModelMemory from "../hooks/useModelMemory.js";
import AgentPickerComponent from "./AgentPickerComponent.js";
import AgentBadgeComponent from "./AgentBadgeComponent.js";


// ── Per-agent empty state config ─────────────────────────────────
const AGENT_EMPTY_STATE = {
  CODING: {
    title: "Coding Agent",
    subtitle: "Read, edit, search, and browse your codebase with AI-powered tools.",
    placeholder: "Ask me to read, edit, search, or explore your codebase...",
  },
  LUPOS: {
    title: "Lupos",
    subtitle: "The insane wolf king. Web search, image generation, trends, and more.",
    placeholder: "Talk to the wolf king...",
  },
  STICKERS: {
    title: "Clankerbox",
    subtitle: "Sticker-designing vending machine. Image generation and web search.",
    placeholder: "Ask Clankerbox to create something...",
  },
  DIGEST: {
    title: "Digest",
    subtitle: "Evidence-based nutrition & exercise coach. USDA data, meal planning, calorie tracking, and workout search.",
    placeholder: "Ask about nutrition, exercises, meal plans, or calorie targets...",
  },
};

const DEFAULT_EMPTY_STATE = {
  title: "Agent",
  subtitle: "AI-powered agent with tool access.",
  placeholder: "Send a message...",
};

// Tools that are always on and non-toggleable in the agent view
const AGENT_LOCKED_TOOLS = new Set(["Tool Calling"]);


export default function AgentComponent({ agentId: propAgentId = "CODING", agents = [] }) {
  const agentId = propAgentId;
  const activeAgentData = agents.find((a) => a.id === agentId);
  const agentProject = activeAgentData?.project || PROJECT_AGENT;
  const agentBackgroundImage = activeAgentData?.backgroundImage || "";
  const rawEmptyState = AGENT_EMPTY_STATE[agentId] || (activeAgentData?.name
    ? { title: activeAgentData.name, subtitle: activeAgentData.description || "AI-powered agent with tool access.", placeholder: `Talk to ${activeAgentData.name}...` }
    : DEFAULT_EMPTY_STATE);
  const emptyState = {
    ...rawEmptyState,
    subtitle: activeAgentData?.description || rawEmptyState.subtitle,
  };

  // ── State ────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [queuedNextTurn, setQueuedNextTurn] = useState(null);
  const inputValueRef = useRef("");
  const [hasInput, setHasInput] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolActivity, setToolActivity] = useState([]);
  const [streamingOutputs, setStreamingOutputs] = useState(new Map());
  const [agentSessionId, setAgentSessionId] = useState(() =>
    crypto.randomUUID(),
  );
  const [traceId, setTraceId] = useState(() => crypto.randomUUID());
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("Agent");
  const [leftTab, setLeftTab] = useState("settings"); // "settings" | "tools"
  const [customTools, setCustomTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const [skills, setSkills] = useState([]);
  const [_injectedSkills, setInjectedSkills] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [memoriesRefreshKey, setMemoriesRefreshKey] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [totalMemoriesCount, setTotalMemoriesCount] = useState(0);
  const [workersCount, setWorkersCount] = useState(0);
  const [workerToolActivity, setWorkerToolActivity] = useState({});

  // Track which tabs have received new data the user hasn't viewed yet
  const [newDataTabs, setNewDataTabs] = useState(new Set());
  const leftTabRef = useRef(leftTab);
  leftTabRef.current = leftTab;

  /** Mark a tab as having new unseen data (only if user isn't already viewing it). */
  const markTabNew = useCallback((tabKey) => {
    if (leftTabRef.current === tabKey) return;
    setNewDataTabs((prev) => {
      if (prev.has(tabKey)) return prev;
      const next = new Set(prev);
      next.add(tabKey);
      return next;
    });
  }, []);

  // Count concurrent API calls: main generation + active worker agents
  const activeApiCount = useMemo(() => {
    const activeWorkers = Object.values(workerToolActivity).filter(
      (w) => w.currentTool || w.phase === "generating" || w.phase === "thinking"
    ).length;
    return (isGenerating ? 1 : 0) + activeWorkers;
  }, [isGenerating, workerToolActivity]);
  const [tasksCount, setTasksCount] = useState(0);
  const [memoryConfigured, setMemoryConfigured] = useState(false);
  // ── Agent-scoped storage keys ─────────────────────────────────
  const toolMemoryKey = agentId === "CODING" ? SK_TOOL_MEMORY_AGENT : SK_TOOL_MEMORY_AGENT_PREFIX + agentId;
  const modelMemoryKey = agentId === "CODING" ? SK_MODEL_MEMORY_AGENT : SK_MODEL_MEMORY_AGENT_PREFIX + agentId;

  const { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn } =
    useToolToggles(builtInTools, toolMemoryKey);

  // ── Model memory (persist last-used model per agent) ──────────
  const { saveModel, restoreModel } = useModelMemory(modelMemoryKey);
  const [settings, setSettings] = useState({
    ...SETTINGS_DEFAULTS,
    maxTokens: 64000,
    functionCallingEnabled: true,
  });

  const [favoriteKeys, setFavoriteKeys] = useState([]);

  const [pendingImages, setPendingImages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Phase 1: Agentic controls
  const [autoApprove, setAutoApprove] = useState(false);
  const [maxIterations, setMaxIterations] = useState(MAX_TOOL_ITERATIONS);
  const [maxWorkerIterations, setMaxWorkerIterations] = useState(MAX_TOOL_ITERATIONS);

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    const parseStored = (key) => {
      const stored = localStorage.getItem(key);
      if (stored === "Infinity") return Infinity;
      const parsed = Number(stored);
      return [10, 25, 50, 100].includes(parsed) ? parsed : null;
    };
    const iter = parseStored("agent:maxIterations");
    if (iter != null) setMaxIterations(iter);
    const workerIter = parseStored("agent:maxWorkerIterations");
    if (workerIter != null) setMaxWorkerIterations(workerIter);
  }, []);
  const [planFirst, setPlanFirst] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [planProposal, setPlanProposal] = useState(null); // { plan, steps, status }
  const [agenticProgress, setAgenticProgress] = useState(null); // { iteration, maxIterations }
  const [_contextTruncated, setContextTruncated] = useState(null); // { strategy, estimatedTokens }
  const [currentTurnStart, setCurrentTurnStart] = useState(null); // Date.now() when user sends
  const [backendSessionStats, setBackendSessionStats] = useState(null); // aggregate from /admin/sessions/:id/stats
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0);

  // ── Pixelation transition state ────────────────────────────
  const [pixelTransition, setPixelTransition] = useState(null); // 'out' | 'in' | null
  const [pixelOutDone, setPixelOutDone] = useState(false);
  const [pendingSessionReady, setPendingSessionReady] = useState(false);
  const pendingSessionRef = useRef(null);
  const pendingNewSessionRef = useRef(false);

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const scrollBehaviorRef = useRef("smooth"); // "smooth" for streaming, "instant" for history loads
  const fileInputRef = useRef(null);
  const messagesListRef = useRef(null);

  const agentSessionIdRef = useRef(agentSessionId);
  agentSessionIdRef.current = agentSessionId;

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsGenerating(false);

    // Explicitly abort any running workers for this session — belt-and-suspenders
    // alongside the backend SSE disconnect handler
    PrismService.stopCoordinatorWorkers(agentSessionIdRef.current).catch(() => {});
  }, []);

  // ── Filtered config: only tool-calling models ────────────
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

  // ── Model capability detection ──────────────────────────────
  const supportsImageInput = useMemo(() => {
    if (!filteredConfig) return false;
    const models = filteredConfig.textToText?.models?.[settings.provider] || [];
    const modelDef = models.find((m) => m.name === settings.model);
    return modelDef?.inputTypes?.includes("image") ?? false;
  }, [filteredConfig, settings.provider, settings.model]);

  // ── Effects ──────────────────────────────────────────────────

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: scrollBehaviorRef.current });
    // Reset to smooth after each scroll so streaming remains animated
    scrollBehaviorRef.current = "smooth";
  }, [messages, toolActivity]);

  // Auto-resize is handled inline in handleInputChange (no effect needed)

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Load favorite models
  useEffect(() => {
    PrismService.getFavorites("model")
      .then((favs) => setFavoriteKeys(favs.map((f) => f.key)))
      .catch(() => {});
  }, []);

  // Fetch Prism config and restore remembered model (or auto-select first FC-capable)
  useEffect(() => {
    const fcFallback = (cfg) => {
      const textModels = cfg.textToText?.models || {};
      for (const provider of cfg.providerList || []) {
        const models = textModels[provider] || [];
        const fcModel = models.find((m) =>
          m.tools?.includes("Tool Calling"),
        );
        if (fcModel) {
          setSettings((s) => ({
            ...s,
            provider,
            model: fcModel.name,
            temperature: fcModel.defaultTemperature ?? 1.0,
          }));
          break;
        }
      }
    };

    PrismService.getConfigWithLocalModels({
      onConfig: (cfg) => {
        setConfig(cfg);
        restoreModel(cfg, setSettings, { fcOnly: true, fallback: fcFallback });
      },
      onLocalMerge: (merged) => {
        setConfig(merged);
        restoreModel(merged, setSettings, { fcOnly: true, fallback: fcFallback });
      },
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load agent session history
  const loadSessions = useCallback(async () => {
    try {
      const list =
        await PrismService.getAgentSessions(agentProject);
      setSessions(list);
    } catch (err) {
      console.error("Failed to load agent sessions:", err);
    }
  }, [agentProject]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load custom tools
  const loadCustomTools = useCallback(async () => {
    try {
      const tools = await PrismService.getCustomTools(agentProject);
      setCustomTools(tools);
    } catch (err) {
      console.error("Failed to load custom tools:", err);
    }
  }, [agentProject]);

  useEffect(() => {
    loadCustomTools();
  }, [loadCustomTools]);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      const s = await PrismService.getSkills(agentProject);
      setSkills(s);
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  }, [agentProject]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load MCP servers
  const loadMCPServers = useCallback(async () => {
    try {
      const s = await PrismService.getMCPServers(agentProject);
      setMcpServers(s);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
    }
  }, [agentProject]);

  useEffect(() => {
    loadMCPServers();
  }, [loadMCPServers]);

  // Fetch built-in tools for the active agent (filtered server-side by persona)
  useEffect(() => {
    async function loadAgenticTools() {
      // Trigger Prism to re-fetch from tools-api (picks up newly added tools)
      try {
        await PrismService.refreshBuiltInToolSchemas();
      } catch {
        // Non-fatal — Prism may still have a stale cache
      }

      const tools = await PrismService.getBuiltInToolSchemas(agentId);
      setBuiltInTools(tools);
    }
    loadAgenticTools().catch(console.error);
  }, [agentId]);

  // ── Fetch memory settings to determine if memories are configured ──
  useEffect(() => {
    PrismService.getSettings()
      .then((s) => {
        const mem = s?.memory || {};
        setMemoryConfigured(
          Boolean(mem.extractionProvider && mem.extractionModel &&
                  mem.consolidationProvider && mem.consolidationModel &&
                  mem.embeddingProvider && mem.embeddingModel),
        );
      })
      .catch(() => setMemoryConfigured(false));
  }, []);

  // Tools that are force-disabled because a prerequisite isn't met
  const lockedOffTools = useMemo(() => {
    const set = new Set();
    if (!memoryConfigured) set.add("upsert_memory");
    return set;
  }, [memoryConfigured]);

  // ── Eager-fetch tab badge counts (fires on mount / session change) ──

  useEffect(() => {
    PrismService.getAgentMemories(agentProject, 1, agentId)
      .then((r) => setTotalMemoriesCount(r.total || 0))
      .catch(() => {});
  }, [agentProject, agentId]);

  useEffect(() => {
    ToolsApiService.getAllAgenticTasks({ agentSessionId })
      .then((r) => setTasksCount(r.summary?.total || (r.tasks || []).length))
      .catch(() => {});
  }, [agentSessionId, tasksRefreshKey]);

  useEffect(() => {
    PrismService.getCoordinatorWorkers(agentSessionId)
      .then((r) => setWorkersCount((r.workers || []).length))
      .catch(() => {});
  }, [agentSessionId, tasksRefreshKey]);

  // System prompt is fully assembled server-side by SystemPromptAssembler.
  // The client sends a placeholder system message that gets replaced.

  // ── Session stats for SettingsPanel ──────────────────
  const {
    uniqueModels, uniqueProviders, totalCost, totalTokens, requestCount,
    usedTools, modalities, elapsedTime: completedElapsedTime,
    liveStreamingTokens, liveStreamingStartTime, liveStreamingLastChunkTime, workerGenerationProgress,
  } = useSessionStats(messages);

  // ── Fetch backend-aggregate session stats ────────────────
  const fetchSessionStats = useCallback((sessionId) => {
    if (!sessionId) return;
    // Two-phase fetch: first at 2s catches iteration requests,
    // second at 8s catches background requests (memory extraction,
    // embedding) that take longer to flush to the DB.
    const refetch = () =>
      PrismService.getAgentSession(sessionId, agentProject)
        .then((session) => {
          if (session?.stats) {
            setBackendSessionStats(session.stats);
            setRequestsRefreshKey((k) => k + 1);
          }
        })
        .catch(() => {}); // silently ignore if no requests yet
    const t1 = setTimeout(refetch, 2000);
    const t2 = setTimeout(refetch, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [agentProject]);

  // Build final tool schemas
  const allToolSchemas = useMemo(
    () => buildToolSchemas(builtInTools, disabledBuiltIns, customTools),
    [customTools, builtInTools, disabledBuiltIns],
  );



  // ── Memoize filtered messages for MessageList to prevent ref churn ──
  const filteredMessages = useMemo(
    () => messages.filter((m) => m.role === "user" || m.role === "assistant"),
    [messages],
  );

  // ── Stable input change handler ─────────────────────────────
  // Uncontrolled textarea: only flip hasInput on empty↔non-empty
  // transitions to avoid re-rendering the entire component tree.
  const handleInputChange = useCallback((e) => {
    const val = e.target.value;
    inputValueRef.current = val;
    const nowHasInput = val.trim().length > 0;
    setHasInput((prev) => (prev !== nowHasInput ? nowHasInput : prev));
    // Auto-resize inline (no state/effect needed)
    const el = e.target;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, []);

  // Helper to programmatically set the textarea value (quick prompts, queue cancel)
  const setTextareaValue = useCallback((text) => {
    inputValueRef.current = text;
    setHasInput(text.trim().length > 0);
    if (textareaRef.current) {
      textareaRef.current.value = text;
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  }, []);

  // ── Image handlers ──────────────────────────────────────────
  const handleImageSelect = useCallback((e) => {
    const files = Array.from(e.target.files);
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPendingImages((prev) => [...prev, ev.target.result]);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const removeImage = useCallback((index) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragEnter = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (supportsImageInput && e.dataTransfer?.items?.length > 0) {
        setIsDragging(true);
      }
    },
    [supportsImageInput],
  );

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;
      if (!supportsImageInput) return;
      const files = Array.from(e.dataTransfer?.files || []);
      const images = files.filter((f) => f.type.startsWith("image/"));
      for (const file of images) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPendingImages((prev) => [...prev, ev.target.result]);
        };
        reader.readAsDataURL(file);
      }
    },
    [supportsImageInput],
  );

  const handlePaste = useCallback(
    (e) => {
      if (!supportsImageInput) return;
      const items = Array.from(e.clipboardData?.items || []);
      const files = items
        .filter(
          (item) => item.kind === "file" && item.type.startsWith("image/"),
        )
        .map((item) => item.getAsFile())
        .filter(Boolean);
      if (files.length === 0) return;
      e.preventDefault();
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPendingImages((prev) => [...prev, ev.target.result]);
        };
        reader.readAsDataURL(file);
      }
    },
    [supportsImageInput],
  );

  // ── Orchestration loop ───────────────────────────────────────
  const runOrchestrationLoop = useCallback(
    async (sessionMessages, resolvedTitle) => {
      const currentMessages = [...sessionMessages];



      await new Promise((resolve, reject) => {
        // System prompt placeholder — replaced server-side by SystemPromptAssembler
        const payload = {
          provider: settings.provider,
          model: settings.model,
          messages: [
            { role: "system", content: "" },
            ...currentMessages,
          ],
          functionCallingEnabled: true,
          enabledTools: allToolSchemas.map(t => t.name),
          maxTokens: settings.maxTokens,
          temperature: settings.temperature,
          thinkingEnabled: settings.thinkingEnabled ?? false,
          ...(settings.reasoningEffort && { reasoningEffort: settings.reasoningEffort }),
          ...(settings.thinkingBudget && { thinkingBudget: settings.thinkingBudget }),
          // Local models need enough context for MCP tool schemas + session
          minContextLength: 150000,
          project: agentProject,
          agentSessionId,
          conversationMeta: {
            title: resolvedTitle,
          },
          // Trace tracking — generated client-side
          traceId,
          // Agent persona — dynamic per-agent
          agent: agentId,
          // Phase 1: Agentic controls
          autoApprove,
          planFirst,
          maxIterations: Number.isFinite(maxIterations) ? maxIterations : 0,
          maxWorkerIterations: Number.isFinite(maxWorkerIterations) ? maxWorkerIterations : 0,
        };

        let streamedText = "";
        let streamedThinking = "";
        let outputTokenEstimate = 0;
        let firstChunkTime = null;
        // ── Interleaved content tracking ──
        // contentSegments: ordered list of { type: "thinking", fragmentIndex } | { type: "text", fragmentIndex } | { type: "tools", toolIds: [...] }
        // textFragments: array of strings, one per text segment — the text delta between tool groups
        // thinkingFragments: array of strings, one per thinking segment — the thinking delta between tool groups
        const contentSegments = [];
        const textFragments = [];
        const thinkingFragments = [];
        let lastSegmentType = null; // "thinking" | "text" | "tools"
        let prevCleanLen = 0; // length of cleanTextRaw at last onChunk — used for computing deltas
        let prevThinkingLen = 0; // length of thinking text at last onThinking — used for computing deltas

        // Deep-copy segments for React state (objects are shared refs otherwise)
        const snapshotSegments = () =>
          contentSegments.map((s) => ({
            ...s,
            ...(s.toolIds ? { toolIds: [...s.toolIds] } : {}),
          }));

        abortRef.current = PrismService.streamAgentText(payload, {
          onChunk: (content) => {
            streamedText += content;
            // Client-side token metering: each SSE chunk ≈ 1 output token
            outputTokenEstimate++;
            if (!firstChunkTime) firstChunkTime = performance.now();
            const lastChunkTime = performance.now();

            // Track segment ordering: start a new text fragment when text resumes after tools
            if (lastSegmentType !== "text") {
              contentSegments.push({ type: "text", fragmentIndex: textFragments.length });
              textFragments.push("");
              lastSegmentType = "text";
            }

            // Strip tool call XML markup that some models (Gemma 4) emit in text.
            // Use cleanTextRaw (no trim) for stable delta computation.
            const cleanTextRaw = streamedText
              .replace(/<\|?tool_call\|?>[\s\S]*?<\/?\|?tool_call\|?>/gi, "")
              .replace(/<\|?tool_response\|?>[\s\S]*?<\/?\|?tool_response\|?>/gi, "")
              .replace(/<\|?result\|?>[\s\S]*?<\/?\|?result\|?>/gi, "")
              .replace(/\[END_TOOL_REQUEST\]/gi, "")
              // Incomplete tags at end of stream (closing tag hasn't arrived yet)
              .replace(/<\|?tool_call\|?>[\s\S]*$/gi, "")
              .replace(/<\|?tool_response\|?>[\s\S]*$/gi, "")
              .replace(/<\|?result\|?>[\s\S]*$/gi, "");

            // Compute text delta since last update and append to current fragment
            const delta = cleanTextRaw.slice(prevCleanLen);
            if (delta) {
              textFragments[textFragments.length - 1] += delta;
            }
            prevCleanLen = cleanTextRaw.length;

            const cleanText = cleanTextRaw.trim();
            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg?.role === "assistant") {
                lastMsg.content = cleanText;
                lastMsg.contentSegments = snapshotSegments();
                lastMsg.textFragments = [...textFragments];
                lastMsg.thinkingFragments = [...thinkingFragments];
                lastMsg._streamingOutputTokens = outputTokenEstimate;
                lastMsg._streamingStartTime = firstChunkTime;
                lastMsg._streamingLastChunkTime = lastChunkTime;
              } else {
                updated.push({
                  role: "assistant",
                  content: cleanText,
                  contentSegments: snapshotSegments(),
                  textFragments: [...textFragments],
                  thinkingFragments: [...thinkingFragments],
                  _streamingOutputTokens: outputTokenEstimate,
                  _streamingStartTime: firstChunkTime,
                  _streamingLastChunkTime: lastChunkTime,
                });
              }
              return updated;
            });
          },
          onThinking: (content) => {
            streamedThinking += content;

            // Track segment ordering: start a new thinking fragment when thinking resumes after tools
            if (lastSegmentType !== "thinking") {
              contentSegments.push({ type: "thinking", fragmentIndex: thinkingFragments.length });
              thinkingFragments.push("");
              lastSegmentType = "thinking";
            }

            // Compute thinking delta and append to current fragment
            const delta = streamedThinking.slice(prevThinkingLen);
            if (delta) {
              thinkingFragments[thinkingFragments.length - 1] += delta;
            }
            prevThinkingLen = streamedThinking.length;

            setMessages((prev) => {
              const updated = [...prev];
              const lastMsg = updated[updated.length - 1];
              if (lastMsg?.role === "assistant") {
                lastMsg.thinking = streamedThinking;
                lastMsg.contentSegments = snapshotSegments();
                lastMsg.thinkingFragments = [...thinkingFragments];
              } else {
                updated.push({
                  role: "assistant",
                  content: "",
                  thinking: streamedThinking,
                  contentSegments: snapshotSegments(),
                  thinkingFragments: [...thinkingFragments],
                });
              }
              return updated;
            });
          },
          onToolExecution: (data) => {
            const tc = data.tool;
            setToolActivity((prev) => {
              let updated = [];
              const resolvedId = tc.id || `tc-${Date.now()}-${Math.random()}`;
              if (data.status === "calling") {
                updated = [
                  ...prev,
                  {
                    id: resolvedId,
                    name: tc.name,
                    args: tc.args,
                    status: "calling",
                    timestamp: Date.now(),
                  },
                ];
                // Track segment ordering: group consecutive tool events
                if (lastSegmentType === "tools") {
                  // Append to current tools segment
                  contentSegments[contentSegments.length - 1].toolIds.push(resolvedId);
                } else {
                  contentSegments.push({ type: "tools", toolIds: [resolvedId] });
                  lastSegmentType = "tools";
                }
              } else {
                updated = prev.map((activity) => {
                  if (
                    (tc.id && activity.id === tc.id) ||
                    (!tc.id && activity.name === tc.name && activity.status === "calling")
                  ) {
                    return { ...activity, status: data.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) };
                  }
                  return activity;
                });
              }
              setMessages((msgPrev) => {
                const arr = [...msgPrev];
                const last = arr[arr.length - 1];
                if (last?.role === "assistant") {
                  arr[arr.length - 1] = { ...last, toolCalls: updated, contentSegments: snapshotSegments(), textFragments: [...textFragments], thinkingFragments: [...thinkingFragments] };
                } else {
                  // Tool events can arrive before any text chunks — create placeholder
                  arr.push({ role: "assistant", content: "", toolCalls: updated, contentSegments: snapshotSegments(), textFragments: [...textFragments], thinkingFragments: [...thinkingFragments] });
                }
                return arr;
              });
              return updated;
            });

            // Auto-refresh tasks panel when any task tool completes
            if (data.status !== "calling" && tc.name?.startsWith("task_")) {
              setTasksRefreshKey((k) => k + 1);
            }

            // Auto-refresh memories panel when upsert_memory completes
            if (data.status !== "calling" && tc.name === "upsert_memory") {
              setLeftTab("memories");
              setMemoriesRefreshKey((k) => k + 1);
              PrismService.getAgentMemories(agentProject, 1, agentId)
                .then((r) => setTotalMemoriesCount(r.total || 0))
                .catch(() => {});
            }
          },
          // LM Studio native MCP tool calls (toolCall events)
          onToolCall: (tc) => {
            setToolActivity((prev) => {
              let updated;
              const resolvedId = tc.id || `tc-${Date.now()}-${Math.random()}`;
              if (tc.status === "calling") {
                updated = [
                  ...prev,
                  {
                    id: resolvedId,
                    name: tc.name,
                    args: tc.args,
                    status: "calling",
                    timestamp: Date.now(),
                  },
                ];
                // Track segment ordering: group consecutive tool events
                if (lastSegmentType === "tools") {
                  contentSegments[contentSegments.length - 1].toolIds.push(resolvedId);
                } else {
                  contentSegments.push({ type: "tools", toolIds: [resolvedId] });
                  lastSegmentType = "tools";
                }
              } else {
                // done or error — update existing entry
                updated = prev.map((activity) => {
                  if (
                    (tc.id && activity.id === tc.id) ||
                    (!tc.id && activity.name === tc.name && activity.status === "calling")
                  ) {
                    return { ...activity, status: tc.status, result: tc.result, ...(tc.args && Object.keys(tc.args).length > 0 ? { args: tc.args } : {}) };
                  }
                  return activity;
                });
              }
              setMessages((msgPrev) => {
                const arr = [...msgPrev];
                const last = arr[arr.length - 1];
                if (last?.role === "assistant") {
                  arr[arr.length - 1] = { ...last, toolCalls: updated, contentSegments: snapshotSegments(), textFragments: [...textFragments], thinkingFragments: [...thinkingFragments] };
                } else {
                  arr.push({ role: "assistant", content: "", toolCalls: updated, contentSegments: snapshotSegments(), textFragments: [...textFragments], thinkingFragments: [...thinkingFragments] });
                }
                return arr;
              });
              return updated;
            });

            // Auto-refresh tasks panel when any task tool completes (MCP path)
            if (tc.status !== "calling" && tc.name?.startsWith("task_")) {
              setTasksRefreshKey((k) => k + 1);
            }

            // Auto-refresh memories panel when upsert_memory completes (MCP path)
            if (tc.status !== "calling" && tc.name === "upsert_memory") {
              setLeftTab("memories");
              setMemoriesRefreshKey((k) => k + 1);
              PrismService.getAgentMemories(agentProject, 1, agentId)
                .then((r) => setTotalMemoriesCount(r.total || 0))
                .catch(() => {});
            }
          },
          onToolOutput: (data) => {
            if (data.event === "stdout" || data.event === "stderr") {
              setStreamingOutputs((prev) => {
                const updated = new Map(prev);
                const key = data.toolCallId || data.name;
                const existing = updated.get(key) || "";
                updated.set(key, existing + (data.data || ""));
                return updated;
              });
            }
          },
          onApprovalRequired: (data) => {
            setPendingApprovals((prev) => [
              ...prev,
              {
                id: data.toolCall.id || `ap-${Date.now()}`,
                toolName: data.toolCall.name,
                toolArgs: data.toolCall.args,
                tier: data.tier,
                status: "pending",
              },
            ]);
          },
          onPlanProposal: (data) => {
            setPlanProposal({
              plan: data.plan,
              steps: data.steps || [],
              status: "pending",
            });
          },
          onStatus: (statusData) => {
            // statusData is now the full SSE data object { type, message, iteration?, maxIterations? }
            if (statusData?.message === "iteration_progress") {
              setAgenticProgress({
                iteration: statusData.iteration,
                maxIterations: statusData.maxIterations,
              });
            } else if (statusData?.message === "skills_injected") {
              setInjectedSkills(statusData.skills || []);
            } else if (statusData?.message === "context_truncated") {
              setContextTruncated({
                strategy: statusData.strategy,
                estimatedTokens: statusData.estimatedTokens,
              });
            } else if (statusData?.message === "tasks_updated") {
              // Auto-expand tasks panel when agent creates/updates tasks
              setLeftTab("tasks");
              setTasksRefreshKey((k) => k + 1);
              markTabNew("tasks");
            } else if (statusData?.message === "workers_updated") {
              // Refresh workers data without switching the active tab
              setTasksRefreshKey((k) => k + 1);
              markTabNew("workers");
            } else if (statusData?.message === "memories_updated") {
              // Auto-expand memories panel when agent saves a memory
              setLeftTab("memories");
              setMemoriesRefreshKey((k) => k + 1);
              markTabNew("memories");
              // Re-fetch count for the tab badge (MemoriesPanel may not be mounted yet)
              PrismService.getAgentMemories(agentProject, 1, agentId)
                .then((r) => setTotalMemoriesCount(r.total || 0))
                .catch(() => {});
            } else if (statusData?.phase) {
              // LM Studio lifecycle status (loading, processing, generating)
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = {
                    ...last,
                    status: statusData.message,
                    statusPhase: statusData.phase,
                  };
                }
                return updated;
              });
            }
          },
          // ── Worker agent live events ─────────────────────────────
          onWorkerToolExecution: (data) => {
            setWorkerToolActivity((prev) => {
              const raw = prev[data.workerId];
              const entry = { toolCount: 0, currentTool: null, iteration: 0, toolNames: {}, ...raw };
              if (data.status === "calling") {
                const toolName = data.tool?.name || "unknown";
                const updatedToolNames = { ...entry.toolNames, [toolName]: (entry.toolNames[toolName] || 0) + 1 };
                return {
                  ...prev,
                  [data.workerId]: {
                    ...entry,
                    currentTool: toolName,
                    toolCount: entry.toolCount + 1,
                    toolNames: updatedToolNames,
                    phase: null, // Clear phase — tool is now active
                  },
                };
              }
              // done/error — clear currentTool, phase will be set by next chunk event
              return {
                ...prev,
                [data.workerId]: { ...entry, currentTool: null, phase: null },
              };
            });
          },
          onWorkerStatus: (data) => {
            if (data.message === "spawned") {
              // Early mapping: store workerId indexed by description
              // so SpawnAgentRenderer can look up activity before tool result arrives
              setWorkerToolActivity((prev) => ({
                ...prev,
                [data.workerId]: {
                  ...(prev[data.workerId] || { toolCount: 0, currentTool: null, iteration: 0, toolNames: {} }),
                  description: data.description,
                  phase: "spawned",
                },
              }));
            } else if (data.message === "iteration_progress") {
              setWorkerToolActivity((prev) => ({
                ...prev,
                [data.workerId]: {
                  ...(prev[data.workerId] || { toolCount: 0, currentTool: null }),
                  iteration: data.iteration,
                  maxIterations: data.maxIterations,
                },
              }));
            } else if (data.message === "phase") {
              // Worker LLM phase updates (generating, thinking)
              setWorkerToolActivity((prev) => ({
                ...prev,
                [data.workerId]: {
                  ...(prev[data.workerId] || { toolCount: 0, currentTool: null, iteration: 0 }),
                  phase: data.phase,
                },
              }));
            } else if (data.message === "generation_progress") {
              // Worker live generation progress — store on message for tok/s
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  const wp = last._workerGenerationProgress || {};
                  updated[updated.length - 1] = {
                    ...last,
                    _workerGenerationProgress: {
                      ...wp,
                      [data.workerId]: {
                        outputTokens: data.outputTokens,
                        firstChunkTime: data.firstChunkTime,
                        lastChunkTime: data.lastChunkTime,
                      },
                    },
                  };
                }
                return updated;
              });
            } else if (data.message === "complete") {
              // Worker finished — clear phase so StatusBar stops showing "Generating..."
              setWorkerToolActivity((prev) => ({
                ...prev,
                [data.workerId]: {
                  ...(prev[data.workerId] || {}),
                  phase: "complete",
                  currentTool: null,
                  durationMs: data.durationMs,
                  toolCount: data.toolCount ?? prev[data.workerId]?.toolCount,
                },
              }));
              // Accumulate worker usage into the streaming assistant message
              // so stats badges update in real-time per worker completion
              if (data.usage) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === "assistant") {
                    const wt = last._workerTokens || { input: 0, output: 0 };
                    // Remove completed worker from live progress so stale tok/s doesn't linger
                    const wp = { ...(last._workerGenerationProgress || {}) };
                    delete wp[data.workerId];
                    updated[updated.length - 1] = {
                      ...last,
                      _workerTokens: {
                        input: wt.input + (data.usage.inputTokens || 0),
                        output: wt.output + (data.usage.outputTokens || 0),
                      },
                      _workerGenerationProgress: Object.keys(wp).length > 0 ? wp : undefined,
                    };
                  }
                  return updated;
                });
              }
            } else if (data.message === "failed") {
              // Worker errored — mark as failed
              setWorkerToolActivity((prev) => ({
                ...prev,
                [data.workerId]: {
                  ...(prev[data.workerId] || {}),
                  phase: "failed",
                  currentTool: null,
                  error: data.error,
                },
              }));
            }
          },
          onDone: (data) => {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") {
                updated[updated.length - 1] = {
                  ...last,
                  provider: settings.provider,
                  model: settings.model,
                  usage: data.usage,
                  totalTime: data.totalTime,
                  tokensPerSec: data.tokensPerSec,
                  estimatedCost: data.estimatedCost,
                  completedAt: new Date().toISOString(),
                  status: undefined,
                  statusPhase: undefined,
                };
              }
              return updated;
            });
            setCurrentTurnStart(null);
            fetchSessionStats(agentSessionId);
            // SessionSummarizer runs async after SSE stream closes —
            // poll every 2s for up to 20s until new memories are detected
            (async () => {
              const baselineCount = await PrismService.getAgentMemories(agentProject, 1, agentId)
                .then((r) => r.total || 0)
                .catch(() => 0);
              let pollAttempts = 0;
              const pollInterval = setInterval(async () => {
                pollAttempts++;
                try {
                  const { total } = await PrismService.getAgentMemories(agentProject, 1, agentId);
                  if (total > baselineCount) {
                    clearInterval(pollInterval);
                    setMemoriesRefreshKey((k) => k + 1);
                  }
                } catch { /* ignore */ }
                if (pollAttempts >= 10) clearInterval(pollInterval);
              }, 2000);
            })();
            resolve();
          },
          onError: (err) => reject(err),
        });
      });

      return [];
    },
    [
      settings.provider,
      settings.model,
      settings.maxTokens,
      settings.temperature,
      settings.thinkingEnabled,
      settings.reasoningEffort,
      settings.thinkingBudget,
      agentSessionId,
      traceId,
      allToolSchemas,
      autoApprove,
      planFirst,
      maxIterations,
      maxWorkerIterations,
      agentId,
      agentProject,
      fetchSessionStats,
      markTabNew,
    ],
  );

  // ── Send handler ─────────────────────────────────────────────
  // Read inputValue from ref at send-time to avoid re-creating
  // handleSend on every keystroke (the main cause of input lag).
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const titleRef = useRef(title);
  titleRef.current = title;

  const handleSend = useCallback(
    async (e, opts = {}) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      
      const { isQueueing = false, overridePayload = null } = opts;

      if (isGenerating && !isQueueing && !overridePayload) {
        handleStop();
        return;
      }
      
      const text = overridePayload ? overridePayload.text : inputValueRef.current.trim();
      const currentImages = overridePayload ? overridePayload.images : [...pendingImagesRef.current];
      
      if (!text && currentImages.length === 0) return;

      if (isQueueing) {
        setQueuedNextTurn({ text, images: currentImages });
        setTextareaValue("");
        setPendingImages([]);
        return;
      }

      if (!overridePayload) {
        setTextareaValue("");
        setPendingImages([]);
      }

      setIsGenerating(true);
      setToolActivity([]);
      setWorkerToolActivity({});
      setStreamingOutputs(new Map());
      setPendingApprovals([]);
      setPlanProposal(null);
      setAgenticProgress(null);
      setInjectedSkills([]);
      setContextTruncated(null);

      const currentMessages = messagesRef.current;
      let resolvedTitle = titleRef.current;
      if (currentMessages.length === 0) {
        const titleText = text || "Agent session";
        resolvedTitle =
          titleText.length > 60 ? titleText.slice(0, 57) + "..." : titleText;
        setTitle(resolvedTitle);
      }

      setCurrentTurnStart(Date.now());
      const userMessage = {
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        ...(currentImages.length > 0 ? { images: currentImages } : {}),
      };
      const updatedMessages = [...currentMessages, userMessage];
      // Insert placeholder assistant message so the aiNode
      // (with blinking cursor) appears immediately — matches /conversations
      setMessages([
        ...updatedMessages,
        {
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          provider: settings.provider,
          model: settings.model,
        },
      ]);

      try {
        await runOrchestrationLoop(
          updatedMessages,
          resolvedTitle,
        );
        // Messages are already updated by the streaming callbacks — just reload history
        loadSessions();
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `⚠️ Error: ${err.message}`,
            isError: true,
          },
        ]);
      } finally {
        setIsGenerating(false);
        abortRef.current = null;
        // Ensure timer stops even on abort/error — stamp completedAt if missing
        setCurrentTurnStart(null);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant" && !last.completedAt) {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, completedAt: new Date().toISOString() };
            return updated;
          }
          return prev;
        });
      }
    },
    [
      handleStop,
      isGenerating,
      setTextareaValue,
      runOrchestrationLoop,
      loadSessions,
    ],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (isGenerating) {
          handleSend(null, { isQueueing: true });
        } else {
          handleSend();
        }
      }
    },
    [handleSend, isGenerating],
  );

  // Auto-send queued message when generation completes
  useEffect(() => {
    if (!isGenerating && queuedNextTurn) {
      const payload = queuedNextTurn;
      setQueuedNextTurn(null);
      setTimeout(() => {
        handleSend(null, { overridePayload: payload });
      }, 50);
    }
  }, [isGenerating, queuedNextTurn, handleSend]);

  // ── Session management ──────────────────────────────────
  const resetSessionState = useCallback(() => {
    setMessages([]);
    setToolActivity([]);
    setWorkerToolActivity({});
    setPendingImages([]);
    setAgentSessionId(crypto.randomUUID());
    setTraceId(null);
    setActiveId(null);
    setTitle("Agent");
    setBackendSessionStats(null);
    textareaRef.current?.focus();
  }, []);

  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    // If already on a blank session, just reset directly (no pixelation needed)
    if (messages.length === 0 && !activeId) {
      resetSessionState();
      return;
    }
    // Trigger pixelation out → reset → pixelation in
    pendingNewSessionRef.current = true;
    setPixelOutDone(false);
    setPendingSessionReady(false);
    pendingSessionRef.current = null;
    setPixelTransition("out");
  }, [isGenerating, messages.length, activeId, resetSessionState]);

  const handleSelectSession = useCallback(
    async (conv) => {
      if (isGenerating) return;
      // Already viewing this session — just scroll to bottom instantly
      if (conv.id === activeId) {
        endRef.current?.scrollIntoView({ behavior: "instant" });
        return;
      }

      // Phase 1: pixelate OUT + fetch in parallel
      setPixelOutDone(false);
      setPendingSessionReady(false);
      pendingSessionRef.current = null;
      setPixelTransition("out");

      try {
        const full = await PrismService.getAgentSession(
          conv.id,
          agentProject,
        );
        pendingSessionRef.current = full;
        setPendingSessionReady(true);
      } catch (err) {
        console.error("Failed to load session:", err);
        setPixelTransition(null);
        setPixelOutDone(false);
        setPendingSessionReady(false);
        pendingSessionRef.current = null;
      }
    },
    [isGenerating, activeId, agentProject],
  );

  // When 'out' animation completes: handle new-session reset or session-load swap
  useEffect(() => {
    if (!pixelOutDone) return;

    // ── New session path (no fetch needed) ──
    if (pendingNewSessionRef.current) {
      pendingNewSessionRef.current = false;
      resetSessionState();
      setPixelOutDone(false);
      setPendingSessionReady(false);
      setPixelTransition("in");
      return;
    }

    // ── Load existing session path (wait for fetch) ──
    if (!pendingSessionReady) return;

    const full = pendingSessionRef.current;
    if (full) {
      const displayMessages = prepareDisplayMessages(full.messages || []);
      scrollBehaviorRef.current = "instant";
      setMessages(displayMessages);
      setAgentSessionId(full.id || crypto.randomUUID());
      setTraceId(full.traceId || null);
      setActiveId(full.id);
      setTitle(full.title || "Agent");
      setToolActivity([]);
      setWorkerToolActivity({});

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
      setBackendSessionStats(full.stats || null);
      pendingSessionRef.current = null;
    }

    setPixelOutDone(false);
    setPendingSessionReady(false);
    setPixelTransition("in");
  }, [pixelOutDone, pendingSessionReady, resetSessionState]);

  const handleDeleteSession = useCallback(
    async (convId) => {
      try {
        await PrismService.deleteAgentSession(convId, agentProject);
        setSessions((prev) => prev.filter((c) => c.id !== convId));
        if (activeId === convId) {
          handleNewChat();
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [activeId, handleNewChat, agentProject],
  );

  // ── Left sidebar: tab bar + content ──────────────────────────
  // Badge helper — 0 = greyed-out, >0 = lit, "new" if tab has unseen data
  const badgeProps = (count, tabKey) => ({
    badge: count,
    badgeDisabled: count === 0,
    badgeState: newDataTabs.has(tabKey) ? "new" : "default",
  });

  const leftPanel = (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1, overflow: "hidden" }}>
      <TabBarComponent
        tabs={[
          { key: "settings", icon: <Settings size={14} />, tooltip: "Settings" },
          {
            key: "info",
            icon: <Info size={14} />,
            tooltip: "Info",
          },
          {
            key: "tools",
            icon: <Wrench size={14} />,
            ...badgeProps(allToolSchemas.length, "tools"),
            tooltip: "Tools",
          },
          {
            key: "skills",
            icon: <BookOpen size={14} />,
            ...badgeProps(skills.filter((s) => s.enabled).length, "skills"),
            tooltip: "Skills",
          },
          {
            key: "memories",
            icon: <Brain size={14} />,
            ...badgeProps(totalMemoriesCount, "memories"),
            tooltip: "Memories",
          },
          {
            key: "tasks",
            icon: <ListChecks size={14} />,
            ...badgeProps(tasksCount, "tasks"),
            tooltip: "Tasks",
          },
          {
            key: "mcp",
            icon: <Plug size={14} />,
            ...badgeProps(mcpServers.filter((s) => s.connected).length, "mcp"),
            tooltip: "MCP Servers",
          },
          {
            key: "workers",
            icon: <BotMessageSquare size={14} />,
            ...badgeProps(workersCount, "workers"),
            badgeRainbow: Object.values(workerToolActivity).some((w) => w.currentTool || w.phase === "generating" || w.phase === "thinking"),
            tooltip: "Workers",
          },
          {
            key: "requests",
            icon: <Activity size={14} />,
            ...badgeProps(backendSessionStats?.requestCount || 0, "requests"),
            tooltip: "Requests",
          },
          {
            key: "coordinator",
            icon: <GitBranch size={14} />,
            tooltip: "Coordinator",
          },
        ]}
        activeTab={leftTab}
        onChange={(tab) => {
          setLeftTab(tab);
          // Clear "new data" flag — user is now viewing this tab
          setNewDataTabs((prev) => {
            if (!prev.has(tab)) return prev;
            const next = new Set(prev);
            next.delete(tab);
            return next;
          });
        }}
      />

      {leftTab === "settings" && (
        <SettingsPanel
          config={filteredConfig}
          settings={settings}
          onChange={(updates) => setSettings((s) => ({ ...s, ...updates, functionCallingEnabled: true }))}
          hasAssistantImages={false}
          lockedTools={AGENT_LOCKED_TOOLS}
          hideSystemPrompt
          sessionType="agent"
          canSpawnWorkers={activeAgentData?.canSpawnWorkers || false}
          agentToggles={[
            {
              key: "plan",
              icon: <ClipboardList size={12} />,
              label: "Plan First",
              checked: planFirst,
              onChange: () => setPlanFirst((v) => !v),
            },
            {
              key: "auto",
              icon: <Zap size={12} />,
              label: "Auto Approve Tool Use",
              checked: autoApprove,
              onChange: () => setAutoApprove((v) => !v),
            },
            {
              key: "iterations",
              type: "cycle",
              icon: <Repeat size={12} />,
              label: "Max Tool Iterations",
              value: maxIterations,
              isActive: true,
              title: "Click to cycle: 10 → 25 → 50 → 100 → ∞",
              onChange: () => {
                const steps = [10, 25, 50, 100, Infinity];
                const idx = steps.indexOf(maxIterations);
                const next = steps[(idx + 1) % steps.length];
                setMaxIterations(next);
                localStorage.setItem("agent:maxIterations", String(next));
              },
            },
            {
              key: "workerIterations",
              type: "cycle",
              icon: <Repeat size={12} />,
              label: "Max Worker Tool Iterations",
              value: maxWorkerIterations,
              isActive: true,
              title: "Click to cycle: 10 → 25 → 50 → 100 → ∞",
              onChange: () => {
                const steps = [10, 25, 50, 100, Infinity];
                const idx = steps.indexOf(maxWorkerIterations);
                const next = steps[(idx + 1) % steps.length];
                setMaxWorkerIterations(next);
                localStorage.setItem("agent:maxWorkerIterations", String(next));
              },
            },
          ]}
          sessionStats={
            messages.length > 0
              ? backendSessionStats
                ? (() => {
                    // Map a backend sub-stats object to the display shape
                    const mapSubStats = (sub) => {
                      if (!sub) return null;
                      return {
                        requestCount: sub.requestCount,
                        uniqueModels: sub.models || [],
                        uniqueProviders: sub.providers || [],
                        totalTokens: {
                          input: sub.totalInputTokens,
                          output: sub.totalOutputTokens,
                          total: sub.totalTokens,
                          cacheRead: sub.totalCacheReadInputTokens || 0,
                          cacheWrite: sub.totalCacheCreationInputTokens || 0,
                          reasoning: sub.totalReasoningOutputTokens || 0,
                        },
                        totalCost: sub.totalCost,
                        originalTotalCost: 0,
                        modalities: sub.modalities || {},
                        completedElapsedTime: sub.totalElapsedTime || 0,
                      };
                    };
                    // Merge live streaming deltas from the current in-progress
                    // assistant message on top of the backend totals so stats
                    // badges update during the current turn
                    const lastMsg = messages[messages.length - 1];
                    const liveOutput = (lastMsg?.role === "assistant" && !lastMsg.usage)
                      ? (lastMsg._streamingOutputTokens || 0) + (lastMsg._workerTokens?.output || 0)
                      : 0;
                    const liveInput = (lastMsg?.role === "assistant" && !lastMsg.usage)
                      ? (lastMsg._workerTokens?.input || 0)
                      : 0;
                    return {
                      // ── Backend is source of truth (all requests incl. background) ──
                      messageCount: messages.length,
                      deletedCount: 0,
                      requestCount: backendSessionStats.requestCount,
                      uniqueModels: backendSessionStats.models,
                      uniqueProviders,
                      totalTokens: {
                        input: backendSessionStats.totalInputTokens + liveInput,
                        output: backendSessionStats.totalOutputTokens + liveOutput,
                        total: backendSessionStats.totalTokens + liveInput + liveOutput,
                        cacheRead: backendSessionStats.totalCacheReadInputTokens || 0,
                        cacheWrite: backendSessionStats.totalCacheCreationInputTokens || 0,
                        reasoning: backendSessionStats.totalReasoningOutputTokens || 0,
                      },
                      totalCost: backendSessionStats.totalCost,
                      originalTotalCost: 0,
                      usedTools,
                      modalities: backendSessionStats.modalities || modalities,
                      completedElapsedTime: backendSessionStats.totalElapsedTime || completedElapsedTime,
                      currentTurnStart,
                      liveStreamingTokens,
                      liveStreamingStartTime,
                      liveStreamingLastChunkTime,
                      workerGenerationProgress,
                      orchestrator: mapSubStats(backendSessionStats.orchestrator),
                      workers: mapSubStats(backendSessionStats.workers),
                    };
                  })()
                : {
                    // ── Client-side fallback (live generation, no backend data yet) ──
                    messageCount: messages.length,
                    deletedCount: 0,
                    requestCount,
                    uniqueModels,
                    uniqueProviders,
                    totalTokens,
                    totalCost,
                    originalTotalCost: 0,
                    usedTools,
                    modalities,
                    completedElapsedTime,
                    currentTurnStart,
                    liveStreamingTokens,
                    liveStreamingStartTime,
                    liveStreamingLastChunkTime,
                    workerGenerationProgress,
                  }
              : null
          }
        />
      )}

      {leftTab === "info" && (
        <ModelInfoPanel
          config={filteredConfig}
          settings={settings}
          onChange={(updates) => setSettings((s) => ({ ...s, ...updates, functionCallingEnabled: true }))}
          lockedTools={AGENT_LOCKED_TOOLS}
        />
      )}

      {leftTab === "tools" && (
        <CustomToolsPanel
          tools={customTools}
          onToolsChange={loadCustomTools}
          project={agentProject}
          builtInTools={builtInTools}
          disabledBuiltIns={disabledBuiltIns}
          onToggleBuiltIn={handleToggleBuiltIn}
          onToggleAllBuiltIn={handleToggleAllBuiltIn}
          lockedOffTools={lockedOffTools}
        />
      )}

      {leftTab === "skills" && (
        <SkillsPanel
          skills={skills}
          onSkillsChange={loadSkills}
          project={agentProject}
        />
      )}

      {leftTab === "memories" && (
        <MemoriesPanel project={agentProject} agent={agentId} refreshKey={memoriesRefreshKey} onCountChange={setTotalMemoriesCount} memoryConfigured={memoryConfigured} />
      )}

      {leftTab === "tasks" && (
        <TasksPanel project={agentProject} refreshKey={tasksRefreshKey} agentSessionId={agentSessionId} onCountChange={setTasksCount} />
      )}

      {leftTab === "mcp" && (
        <MCPServersPanel
          servers={mcpServers}
          onServersChange={loadMCPServers}
          project={agentProject}
        />
      )}

      {leftTab === "workers" && (
        <WorkersPanel agentSessionId={agentSessionId} refreshKey={tasksRefreshKey} onCountChange={setWorkersCount} workerToolActivity={workerToolActivity} />
      )}

      {leftTab === "requests" && (
        <SessionRequestsListComponent
          agentSessionId={agentSessionId}
          refreshKey={requestsRefreshKey}
        />
      )}

      {leftTab === "coordinator" && (
        <CoordinatorPanel project={agentProject} />
      )}
    </div>
  );

  // ── Center: chat area ───────────────────────────────────────
  const chatContent = (
    <div className={chatStyles.container}>
      <PixelTransitionComponent
        phase={pixelTransition}
        duration={1000}
        maxBlockSize={24}
        onComplete={() => {
          if (pixelTransition === "out") {
            setPixelOutDone(true);
          } else if (pixelTransition === "in") {
            setPixelTransition(null);
          }
        }}
        targetRef={messagesListRef}
      />
      {/* Messages */}
      <div
        className={`${chatStyles.messagesList} ${agentBackgroundImage ? chatStyles.hasBackground : ""}`}
        ref={messagesListRef}
        style={agentBackgroundImage ? { "--agent-bg-image": `url(${agentBackgroundImage})` } : undefined}
      >
        {messages.length === 0 && activeAgentData && (
          <EmptyStateComponent
            icon={<AgentBadgeComponent agent={activeAgentData} size={80} iconSize={40} animation />}
            title={emptyState.title}
            subtitle={emptyState.subtitle}
          />
        )}

        <MessageList
          messages={filteredMessages}
          isGenerating={isGenerating}
          streamingOutputs={streamingOutputs}
          workerToolActivity={workerToolActivity}
        />

        {/* Plan proposal card */}
        {planProposal && (
          <PlanCardComponent
            planText={planProposal.plan}
            steps={planProposal.steps}
            status={planProposal.status}
            onApprove={() => {
              setPlanProposal((p) => p ? { ...p, status: "approved" } : null);
              PrismService.sendApprovalResponse(agentSessionId, true).catch(console.error);
            }}
            onReject={() => {
              setPlanProposal((p) => p ? { ...p, status: "rejected" } : null);
              PrismService.sendApprovalResponse(agentSessionId, false).catch(console.error);
            }}
          />
        )}

        {/* Pending approval cards */}
        {pendingApprovals.filter((a) => a.status === "pending").map((approval) => (
          <ApprovalCardComponent
            key={approval.id}
            toolName={approval.toolName}
            toolArgs={approval.toolArgs}
            tier={approval.tier}
            onApprove={() => {
              setPendingApprovals((prev) =>
                prev.map((a) => a.id === approval.id ? { ...a, status: "approved" } : a),
              );
              PrismService.sendApprovalResponse(agentSessionId, true).catch(console.error);
            }}
            onReject={() => {
              setPendingApprovals((prev) =>
                prev.map((a) => a.id === approval.id ? { ...a, status: "rejected" } : a),
              );
              PrismService.sendApprovalResponse(agentSessionId, false).catch(console.error);
            }}
            onApproveAll={() => {
              setPendingApprovals((prev) =>
                prev.map((a) => a.status === "pending" ? { ...a, status: "approved" } : a),
              );
              setAutoApprove(true);
              PrismService.sendApprovalResponse(agentSessionId, true, { approveAll: true }).catch(console.error);
            }}
          />
        ))}

        <div ref={endRef} style={{ minHeight: 24 }} />
      </div>

      {/* ── Status indicator bar (rainbow canvas above input) ── */}
      {(() => {
        const lastMsg = messages[messages.length - 1];
        const rawPhase = isGenerating ? (lastMsg?.statusPhase || "starting") : null;
        const hasActiveTools = toolActivity.some((t) => t.status === "calling");
        const phase = isGenerating ? (hasActiveTools ? "thinking" : rawPhase) : null;
        const label = isGenerating ? (hasActiveTools ? "Thinking..." : (lastMsg?.status || undefined)) : undefined;
        return (
          <StatusBarComponent
            active={isGenerating}
            phase={phase}
            label={label}
            iteration={agenticProgress?.iteration || 0}
            maxIterations={Number.isFinite(maxIterations) ? maxIterations : undefined}
          />
        );
      })()}

      <div className={chatStyles.inputWrapper}>
        <form
          onSubmit={handleSend}
          className={`${chatStyles.inputBox} ${isDragging ? chatStyles.inputBoxDragActive : ""} ${isGenerating ? chatStyles.inputBoxGenerating : ""}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onPaste={handlePaste}
        >
          {queuedNextTurn && (
            <div className={chatStyles.queuedMessage}>
              <div className={chatStyles.queuedHeader}>
                <div className={chatStyles.queuedHeaderLeft}>
                  <CornerDownLeft size={14} />
                  <span>Queued for next turn</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTextareaValue(queuedNextTurn.text);
                    setPendingImages(queuedNextTurn.images);
                    setQueuedNextTurn(null);
                  }}
                  className={chatStyles.removeAttachment}
                  title="Edit queue"
                >
                  <X size={14} />
                </button>
              </div>
              {queuedNextTurn.text && (
                <div className={chatStyles.queuedText}>
                  {queuedNextTurn.text}
                </div>
              )}
              {queuedNextTurn.images?.length > 0 && (
                <div className={chatStyles.queuedImagesCount}>
                  <Paperclip size={12} /> {queuedNextTurn.images.length} image(s)
                </div>
              )}
            </div>
          )}
          {isDragging && (
            <div className={chatStyles.dragOverlay}>
              <Paperclip size={20} />
              <span>Drop images here</span>
            </div>
          )}
          {pendingImages.length > 0 && (
            <div className={chatStyles.pendingImages}>
              {pendingImages.map((dataUrl, i) => (
                <div key={i} className={chatStyles.pendingAttachmentWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dataUrl}
                    alt="Attached"
                    className={chatStyles.pendingImg}
                    onClick={() => setLightboxSrc(dataUrl)}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className={chatStyles.removeAttachment}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className={chatStyles.inputRow}>
            {supportsImageInput && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={handleImageSelect}
                />
                <ChatInputButton
                  onClick={() => fileInputRef.current?.click()}
                  label="Attach image"
                  icon="paperclip"
                />
              </>
            )}
            <textarea
              ref={textareaRef}
              defaultValue=""
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={emptyState.placeholder}
              rows={1}
            />
            {isGenerating && (
              <ChatInputButton
                variant="button"
                onClick={() => handleSend(null, { isQueueing: true })}
                disabled={!hasInput && pendingImages.length === 0}
                label="Queue message for next turn"
                icon={<CornerDownLeft size={18} />}
              />
            )}
            <ButtonComponent
              variant="submit"
              icon={isGenerating ? Square : Send}
              isGenerating={isGenerating}
              disabled={
                isGenerating
                  ? false
                  : !hasInput && pendingImages.length === 0
              }
              aria-label={isGenerating ? "Stop" : "Send"}
            />
          </div>
        </form>
        <div className={chatStyles.hint}>
          Press <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd>{" "}
          for new line
        </div>
      </div>
      {lightboxSrc && (
        <ImagePreviewComponent
          src={lightboxSrc}
          onClose={() => setLightboxSrc(null)}
          onUseAnnotated={(dataUrl) => {
            setPendingImages((prev) => [...prev, dataUrl]);
            setLightboxSrc(null);
          }}
        />
      )}
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────
  return (
    <ThreePanelLayout
      navSidebar={
        <NavigationSidebarComponent mode="user" isGenerating={isGenerating} activeApiCount={activeApiCount} />
      }
      leftPanel={leftPanel}
      leftTitle={null}
      rightPanel={
        <HistoryPanel
          sessions={sessions}
          activeId={activeId}
          onSelect={handleSelectSession}
          onNew={handleNewChat}
          onDelete={handleDeleteSession}
          disableNew={messages.length === 0 && !activeId}
          newLabel="New Session"
          emptyText="No recent sessions"
          searchText="Search sessions..."
          countLabel="sessions"
        />
      }
      rightTitle={`${sessions.length} Sessions`}
      sessionType="agent"
      headerTitle={title}
      headerCenter={
        <div className={layoutStyles.headerCenterGroup}>
          {agents.length > 1 && (
            <AgentPickerComponent
              agents={agents}
              activeAgentId={agentId}
              onSelect={(id) => {
                // Agent switching is handled by the parent page via URL/state
                // Emit a custom event or call a callback
                window.dispatchEvent(new CustomEvent("agent:switch", { detail: { agentId: id } }));
              }}
              disabled={isGenerating}
            />
          )}
          <ModelPickerPopoverComponent
            config={filteredConfig}
            settings={settings}
            onSelectModel={(provider, modelName) => {
              const modelDef =
                (filteredConfig?.textToText?.models?.[provider] || []).find(
                  (m) => m.name === modelName,
                );
              const temp = modelDef?.defaultTemperature ?? 1.0;
              setSettings((s) => ({
                ...s,
                provider,
                model: modelName,
                temperature: temp,
              }));
              saveModel(provider, modelName);
            }}
            favorites={favoriteKeys}
            onToggleFavorite={async (key) => {
              if (favoriteKeys.includes(key)) {
                setFavoriteKeys((prev) => prev.filter((k) => k !== key));
                PrismService.removeFavorite("model", key).catch(() => {});
              } else {
                setFavoriteKeys((prev) => [...prev, key]);
                const [provider, ...rest] = key.split(":");
                PrismService.addFavorite("model", key, {
                  provider,
                  name: rest.join(":"),
                }).catch(() => {});
              }
            }}
          />
        </div>
      }
      headerMeta={null}
      headerControls={null}
    >
      {chatContent}
    </ThreePanelLayout>
  );
}
