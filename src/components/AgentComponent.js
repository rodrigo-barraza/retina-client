"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, Paperclip, X, ClipboardList, Zap, Sparkles, Settings, Wrench, Brain, Plug, GitBranch, Scissors, Repeat, ListChecks, BookOpen, Users, Cpu } from "lucide-react";
import PrismService from "../services/PrismService.js";
import ToolsApiService from "../services/ToolsApiService.js";
import ThreePanelLayout from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import SkillsPanel from "./SkillsPanel.js";
import MemoriesPanel from "./MemoriesPanel.js";
import TasksPanel from "./TasksPanel.js";
import MCPServersPanel from "./MCPServersPanel.js";
import CoordinatorPanel from "./CoordinatorPanel.js";
import WorkersPanel from "./WorkersPanel.js";
import MessageList, { prepareDisplayMessages } from "./MessageList.js";
import ImagePreviewComponent from "./ImagePreviewComponent.js";
import TabBarComponent from "./TabBarComponent.js";
import EmptyStateComponent from "./EmptyStateComponent.js";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent.js";
import ApprovalCardComponent from "./ApprovalCardComponent.js";
import PlanCardComponent from "./PlanCardComponent.js";

import {
  buildToolSchemas,
} from "../utils/FunctionCallingUtilities.js";
import {
  getUniqueModels,
  getSessionCost,
  getSessionTokenStats,
  getUsedTools,
  getSessionElapsedTime,
  shuffleArray,
} from "../utils/utilities.js";
import { getModalities } from "../utils/utilities.js";
import { PROJECT_AGENT, SETTINGS_DEFAULTS, SK_MODEL_MEMORY_AGENT, SK_TOOL_MEMORY_AGENT, MAX_TOOL_ITERATIONS } from "../constants.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./AgentComponent.module.css";
import ChatInputButton from "./ChatInputButton.js";
import useToolToggles from "../hooks/useToolToggles.js";
import useModelMemory from "../hooks/useModelMemory.js";


// ── Coding-focused quick prompts (reflect the full toolset)
const AGENT_PROMPTS = [
  "Scan this project with project_summary and explain the architecture",
  "Search for all TODO and FIXME comments across the codebase",
  "Show me the git status and a diff of uncommitted changes",
  "Find all files that import PrismService and summarize usage",
  "Grep for console.log statements and suggest cleanups",
  "Run npm test and report any failures with context",
  "Read the last 5 git commits and summarize what changed",
  "Compare two files side-by-side with file_diff",
  "Find all .env and secrets files and check they're gitignored",
  "List the directory tree and identify the largest files",
];

// Tools that are always on and non-toggleable in the agent view
const AGENT_LOCKED_TOOLS = new Set(["Function Calling"]);


export default function AgentComponent() {
  // ── State ────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [toolActivity, setToolActivity] = useState([]);
  const [streamingOutputs, setStreamingOutputs] = useState(new Map());
  const [agentSessionId, setAgentSessionId] = useState(() =>
    crypto.randomUUID(),
  );
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [config, setConfig] = useState(null);
  const [title, setTitle] = useState("Agent");
  const [leftTab, setLeftTab] = useState("settings"); // "settings" | "tools"
  const [customTools, setCustomTools] = useState([]);
  const [builtInTools, setBuiltInTools] = useState([]);
  const [skills, setSkills] = useState([]);
  const [injectedSkills, setInjectedSkills] = useState([]);
  const [mcpServers, setMcpServers] = useState([]);
  const [memoriesRefreshKey, setMemoriesRefreshKey] = useState(0);
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);
  const [totalMemoriesCount, setTotalMemoriesCount] = useState(0);
  const [workersCount, setWorkersCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [memoryConfigured, setMemoryConfigured] = useState(false);
  const { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn } =
    useToolToggles(builtInTools, SK_TOOL_MEMORY_AGENT);

  // ── Model memory (persist last-used model per page) ──────────
  const { saveModel, restoreModel } = useModelMemory(SK_MODEL_MEMORY_AGENT);
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
  const [planFirst, setPlanFirst] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [planProposal, setPlanProposal] = useState(null); // { plan, steps, status }
  const [agenticProgress, setAgenticProgress] = useState(null); // { iteration, maxIterations }
  const [contextTruncated, setContextTruncated] = useState(null); // { strategy, estimatedTokens }
  const [currentTurnStart, setCurrentTurnStart] = useState(null); // Date.now() when user sends

  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const abortRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleStop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current();
      abortRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  // ── Filtered config: only function-calling models ────────────
  const filteredConfig = useMemo(() => {
    if (!config) return null;
    const textModelsMap = config.textToText?.models || {};
    const filteredTextModels = {};

    for (const [provider, models] of Object.entries(textModelsMap)) {
      const fcModels = models.filter((m) =>
        m.tools?.includes("Function Calling"),
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, toolActivity]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    }
  }, [inputValue]);

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
          m.tools?.includes("Function Calling"),
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
        await PrismService.getAgentSessions(PROJECT_AGENT);
      setSessions(list);
    } catch (err) {
      console.error("Failed to load agent sessions:", err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load custom tools
  const loadCustomTools = useCallback(async () => {
    try {
      const tools = await PrismService.getCustomTools(PROJECT_AGENT);
      setCustomTools(tools);
    } catch (err) {
      console.error("Failed to load custom tools:", err);
    }
  }, []);

  useEffect(() => {
    loadCustomTools();
  }, [loadCustomTools]);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      const s = await PrismService.getSkills(PROJECT_AGENT);
      setSkills(s);
    } catch (err) {
      console.error("Failed to load skills:", err);
    }
  }, []);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Load MCP servers
  const loadMCPServers = useCallback(async () => {
    try {
      const s = await PrismService.getMCPServers(PROJECT_AGENT);
      setMcpServers(s);
    } catch (err) {
      console.error("Failed to load MCP servers:", err);
    }
  }, []);

  useEffect(() => {
    loadMCPServers();
  }, [loadMCPServers]);

  // Fetch built-in tools for the CODING agent (filtered server-side by persona)
  useEffect(() => {
    async function loadAgenticTools() {
      // Trigger Prism to re-fetch from tools-api (picks up newly added tools)
      try {
        await PrismService.refreshBuiltInToolSchemas();
      } catch {
        // Non-fatal — Prism may still have a stale cache
      }

      const tools = await PrismService.getBuiltInToolSchemas("CODING");
      setBuiltInTools(tools);
    }
    loadAgenticTools().catch(console.error);
  }, []);

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
    PrismService.getAgentMemories(PROJECT_AGENT, 1)
      .then((r) => setTotalMemoriesCount(r.total || 0))
      .catch(() => {});
  }, []);

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
  const uniqueModels = useMemo(() => getUniqueModels(messages), [messages]);
  const totalCost = useMemo(() => getSessionCost(messages), [messages]);
  const { totalTokens, requestCount } = useMemo(
    () => getSessionTokenStats(messages),
    [messages],
  );
  const usedTools = useMemo(() => getUsedTools(messages), [messages]);
  const modalities = useMemo(() => getModalities(messages), [messages]);
  const completedElapsedTime = useMemo(() => getSessionElapsedTime(messages), [messages]);

  // Build final tool schemas
  const allToolSchemas = useMemo(
    () => buildToolSchemas(builtInTools, disabledBuiltIns, customTools),
    [customTools, builtInTools, disabledBuiltIns],
  );

  // Pick random prompt suggestions
  const [randomPrompts, setRandomPrompts] = useState([]);

  useEffect(() => {
    const pool = shuffleArray(AGENT_PROMPTS);
    setRandomPrompts(pool.slice(0, 5));
  }, [agentSessionId]);

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

      setMessages((prev) =>
        prev.filter((m) => !(m.role === "assistant" && !m.content?.trim())),
      );

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
          project: PROJECT_AGENT,
          agentSessionId,
          conversationMeta: {
            title: resolvedTitle,
          },
          // Session tracking — generated client-side
          sessionId,
          // Phase 1: Agentic controls
          autoApprove,
          planFirst,
          maxIterations: Number.isFinite(maxIterations) ? maxIterations : 0,
        };

        let streamedText = "";
        let streamedThinking = "";
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
              } else {
                updated.push({
                  role: "assistant",
                  content: cleanText,
                  contentSegments: snapshotSegments(),
                  textFragments: [...textFragments],
                  thinkingFragments: [...thinkingFragments],
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
            } else if (statusData?.message === "workers_updated") {
              // Auto-expand workers panel when agent spawns/stops workers
              setLeftTab("workers");
              setTasksRefreshKey((k) => k + 1);
            } else if (statusData?.message === "memories_updated") {
              // Auto-expand memories panel when agent saves a memory
              setLeftTab("memories");
              setMemoriesRefreshKey((k) => k + 1);
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
                };
              }
              return updated;
            });
            setCurrentTurnStart(null);
            // SessionSummarizer runs async after SSE stream closes —
            // poll every 2s for up to 20s until new memories are detected
            (async () => {
              const baselineCount = await PrismService.getAgentMemories(PROJECT_AGENT, 1)
                .then((r) => r.total || 0)
                .catch(() => 0);
              let pollAttempts = 0;
              const pollInterval = setInterval(async () => {
                pollAttempts++;
                try {
                  const { total } = await PrismService.getAgentMemories(PROJECT_AGENT, 1);
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
      sessionId,
      allToolSchemas,
      autoApprove,
      planFirst,
      maxIterations,
    ],
  );

  // ── Send handler ─────────────────────────────────────────────
  const handleSend = useCallback(
    async (e) => {
      if (e) e.preventDefault();
      if (isGenerating) {
        handleStop();
        return;
      }
      const text = inputValue.trim();
      if (!text && pendingImages.length === 0) return;

      const currentImages = [...pendingImages];
      setInputValue("");
      setPendingImages([]);
      setIsGenerating(true);
      setToolActivity([]);
      setStreamingOutputs(new Map());
      setPendingApprovals([]);
      setPlanProposal(null);
      setAgenticProgress(null);
      setInjectedSkills([]);
      setContextTruncated(null);

      let resolvedTitle = title;
      if (messages.length === 0) {
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
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);

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
      inputValue,
      pendingImages,
      isGenerating,
      messages,
      title,
      runOrchestrationLoop,
      loadSessions,
    ],
  );

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  // ── Session management ──────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    setMessages([]);
    setToolActivity([]);
    setPendingImages([]);
    setAgentSessionId(crypto.randomUUID());
    setSessionId(null);
    setActiveId(null);
    setTitle("Agent");
    textareaRef.current?.focus();
  }, [isGenerating]);

  const handleSelectSession = useCallback(
    async (conv) => {
      if (isGenerating) return;
      try {
        const full = await PrismService.getAgentSession(
          conv.id,
          PROJECT_AGENT,
        );
        const displayMessages = prepareDisplayMessages(full.messages || []);
        setMessages(displayMessages);
        setAgentSessionId(conv.id);
        setSessionId(full.sessionId || null);
        setActiveId(conv.id);
        setTitle(full.title || "Agent");
        setToolActivity([]);

        // Restore settings from the last assistant message (source of truth)
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
      } catch (err) {
        console.error("Failed to load session:", err);
      }
    },
    [isGenerating],
  );

  const handleDeleteSession = useCallback(
    async (convId) => {
      try {
        await PrismService.deleteAgentSession(convId, PROJECT_AGENT);
        setSessions((prev) => prev.filter((c) => c.id !== convId));
        if (activeId === convId) {
          handleNewChat();
        }
      } catch (err) {
        console.error("Failed to delete session:", err);
      }
    },
    [activeId, handleNewChat],
  );

  // ── Left sidebar: tab bar + content ──────────────────────────
  // Badge helper — 0 = greyed-out, >0 = lit
  const badgeProps = (count) => ({ badge: count, badgeDisabled: count === 0 });

  const leftPanel = (
    <>
      <TabBarComponent
        tabs={[
          { key: "settings", icon: <Settings size={14} />, tooltip: "Settings" },
          {
            key: "tools",
            icon: <Wrench size={14} />,
            ...badgeProps(allToolSchemas.length),
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
        onChange={(tab) => {
          setLeftTab(tab);
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
          sessionStats={
            messages.length > 0
              ? {
                  messageCount: messages.length,
                  deletedCount: 0,
                  requestCount,
                  uniqueModels,
                  totalTokens,
                  totalCost,
                  originalTotalCost: 0,
                  usedTools,
                  modalities,
                  completedElapsedTime,
                  currentTurnStart,
                }
              : null
          }
        />
      )}

      {leftTab === "tools" && (
        <CustomToolsPanel
          tools={customTools}
          onToolsChange={loadCustomTools}
          project={PROJECT_AGENT}
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
          project={PROJECT_AGENT}
        />
      )}

      {leftTab === "memories" && (
        <MemoriesPanel project={PROJECT_AGENT} refreshKey={memoriesRefreshKey} onCountChange={setTotalMemoriesCount} memoryConfigured={memoryConfigured} />
      )}

      {leftTab === "tasks" && (
        <TasksPanel project={PROJECT_AGENT} refreshKey={tasksRefreshKey} agentSessionId={agentSessionId} onCountChange={setTasksCount} />
      )}

      {leftTab === "mcp" && (
        <MCPServersPanel
          servers={mcpServers}
          onServersChange={loadMCPServers}
          project={PROJECT_AGENT}
        />
      )}

      {leftTab === "workers" && (
        <WorkersPanel sessionId={agentSessionId} refreshKey={tasksRefreshKey} onCountChange={setWorkersCount} />
      )}

      {leftTab === "coordinator" && (
        <CoordinatorPanel project={PROJECT_AGENT} />
      )}
    </>
  );

  // ── Center: chat area ───────────────────────────────────────
  const chatContent = (
    <div className={chatStyles.container}>
      {/* Messages */}
      <div className={chatStyles.messagesList}>
        {messages.length === 0 && (
          <EmptyStateComponent
            icon={<Bot size={40} />}
            title="Coding Agent"
            subtitle="Read, edit, search, and browse your codebase with AI-powered tools."
          >
            {randomPrompts.map((prompt) => (
              <button
                key={prompt}
                className={styles.quickPrompt}
                onClick={() => {
                  setInputValue(prompt);
                  textareaRef.current?.focus();
                }}
              >
                {prompt}
              </button>
            ))}
          </EmptyStateComponent>
        )}

        <MessageList
          messages={messages.filter(
            (m) => m.role === "user" || m.role === "assistant",
          )}
          isGenerating={isGenerating}
          streamingOutputs={streamingOutputs}
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

      {/* Input area */}
      {agenticProgress && isGenerating && (
        <div className={styles.iterationBar}>
          <span className={styles.iterationLabel}>
            <Zap size={11} />
            Iteration {agenticProgress.iteration}/{Number.isFinite(maxIterations) ? maxIterations : "∞"}
          </span>
          {injectedSkills.length > 0 && (
            <span className={styles.skillsBadge}>
              <Sparkles size={9} />
              {injectedSkills.length} skill{injectedSkills.length !== 1 ? "s" : ""}
            </span>
          )}
          {contextTruncated && (
            <span className={styles.contextBadge} title={`Strategy: ${contextTruncated.strategy} — ~${Math.round(contextTruncated.estimatedTokens / 1000)}k tokens`}>
              <Scissors size={9} />
              ctx trimmed
            </span>
          )}
          <div className={styles.iterationDots}>
            {Array.from({ length: Math.min(maxIterations, 50) }, (_, i) => {
              const step = i + 1;
              const isDone = step < agenticProgress.iteration;
              const isActive = step === agenticProgress.iteration;
              return (
                <div
                  key={step}
                  className={`${styles.iterationDot}${isDone ? ` ${styles.iterationDotDone}` : ""}${isActive ? ` ${styles.iterationDotActive}` : ""}`}
                />
              );
            })}
          </div>
        </div>
      )}
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
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to read, edit, search, or explore your codebase..."
              rows={1}
            />
            <ChatInputButton
              variant="submit"
              isGenerating={isGenerating}
              disabled={
                isGenerating
                  ? false
                  : !inputValue.trim() && pendingImages.length === 0
              }
              label={isGenerating ? "Stop" : "Send"}
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
        <NavigationSidebarComponent mode="user" isGenerating={isGenerating} />
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
        />
      }
      rightTitle={`${sessions.length} Sessions`}
      sessionType="agent"
      headerTitle={title}
      headerCenter={
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
      }
      headerMeta={
        messages.length > 0 ? (
          <div className={styles.headerMeta}>
            <span>
              {
                messages.filter(
                  (m) => m.role === "user" || m.role === "assistant",
                ).length
              }{" "}
              messages
            </span>
          </div>
        ) : null
      }
      headerControls={
        <div className={styles.headerControls}>
          <button
            className={`${styles.headerToggle} ${planFirst ? styles.headerToggleActive : ""}`}
            onClick={() => setPlanFirst((v) => !v)}
            title="Plan First: Generate a plan for approval before executing"
          >
            <ClipboardList size={10} />
            Plan
          </button>
          <button
            className={`${styles.headerToggle} ${autoApprove ? styles.headerToggleActive : ""}`}
            onClick={() => setAutoApprove((v) => !v)}
            title="Auto Mode: Skip approval prompts for all tool calls"
          >
            <Zap size={10} />
            Auto
          </button>
          <button
            className={`${styles.headerToggle} ${maxIterations !== MAX_TOOL_ITERATIONS ? styles.headerToggleActive : ""}`}
            onClick={() => {
              const steps = [10, 25, 50, 100, Infinity];
              const idx = steps.indexOf(maxIterations);
              setMaxIterations(steps[(idx + 1) % steps.length]);
            }}
            title={`Max agentic iterations: ${Number.isFinite(maxIterations) ? maxIterations : "∞ (unlimited)"} (click to cycle)`}
          >
            <Repeat size={10} />
            {Number.isFinite(maxIterations) ? maxIterations : "∞"}
          </button>
          {(() => {
            const totalSlots = (config?.localProviders || []).reduce((sum, lp) => sum + (lp.concurrency || 1), 0);
            return totalSlots > 1 ? (
              <span
                className={`${styles.headerToggle} ${styles.headerToggleInfo}`}
                title={`Local GPU concurrency: ${totalSlots} slots — ${totalSlots - 1} available for workers`}
              >
                <Cpu size={10} />
                ×{totalSlots - 1}
              </span>
            ) : null;
          })()}

        </div>
      }
    >
      {chatContent}
    </ThreePanelLayout>
  );
}
