"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Bot, Paperclip, X, Code2, ClipboardList, Zap, Sparkles, Settings, Wrench, Brain, Plug } from "lucide-react";
import PrismService from "../services/PrismService.js";
import ThreePanelLayout from "./ThreePanelLayout.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import HistoryPanel from "./HistoryPanel.js";
import SettingsPanel from "./SettingsPanel.js";
import CustomToolsPanel from "./CustomToolsPanel.js";
import SkillsPanel from "./SkillsPanel.js";
import MemoriesPanel from "./MemoriesPanel.js";
import MCPServersPanel from "./MCPServersPanel.js";
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
  getConversationCost,
  getConversationTokenStats,
  getUsedTools,
} from "../utils/utilities.js";
import { getModalities } from "./HistoryPanel.js";
import { PROJECT_AGENT, SETTINGS_DEFAULTS, SK_MODEL_MEMORY_AGENT, SK_TOOL_MEMORY_AGENT } from "../constants.js";
import chatStyles from "./ChatArea.module.css";
import styles from "./AgentComponent.module.css";
import ChatInputButton from "./ChatInputButton.js";
import useToolToggles from "../hooks/useToolToggles.js";
import useModelMemory from "../hooks/useModelMemory.js";

// ── Agentic tool names — these are the 9 tools we built in tools-api
const AGENTIC_TOOL_NAMES = new Set([
  // File operations (original)
  "read_file",
  "write_file",
  "str_replace_file",
  "patch_file",
  "list_directory",
  "grep_search",
  "glob_files",
  // File operations (extended)
  "multi_file_read",
  "file_info",
  "file_diff",
  "move_file",
  "delete_file",
  // Web
  "fetch_url",
  "web_search",
  // Command execution
  "run_command",
  // Git operations
  "git_status",
  "git_diff",
  "git_log",
  // Project intelligence
  "project_summary",
]);

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
  const [conversationId, setConversationId] = useState(() =>
    crypto.randomUUID(),
  );
  const [conversations, setConversations] = useState([]);
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
  const [newMemoriesCount, setNewMemoriesCount] = useState(0);
  const { disabledBuiltIns, handleToggleBuiltIn, handleToggleAllBuiltIn } =
    useToolToggles(builtInTools, SK_TOOL_MEMORY_AGENT);

  // ── Model memory (persist last-used model per page) ──────────
  const { saveModel, restoreModel } = useModelMemory(SK_MODEL_MEMORY_AGENT);
  const [settings, setSettings] = useState({
    ...SETTINGS_DEFAULTS,
    maxTokens: 16384,
    functionCallingEnabled: true,
  });

  const [favoriteKeys, setFavoriteKeys] = useState([]);

  const [pendingImages, setPendingImages] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Phase 1: Agentic controls
  const [autoApprove, setAutoApprove] = useState(false);
  const [planFirst, setPlanFirst] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [planProposal, setPlanProposal] = useState(null); // { plan, steps, status }
  const [agenticProgress, setAgenticProgress] = useState(null); // { iteration, maxIterations }

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

  // Load conversation history
  const loadConversations = useCallback(async () => {
    try {
      const convs =
        await PrismService.getConversationsByProject(PROJECT_AGENT);
      setConversations(convs);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

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

  // Fetch built-in tools — refresh Prism cache first, then filter to agentic tools
  useEffect(() => {
    async function loadAgenticTools() {
      // Trigger Prism to re-fetch from tools-api (picks up newly added tools)
      try {
        await PrismService.refreshBuiltInToolSchemas();
      } catch {
        // Non-fatal — Prism may still have a stale cache
      }

      const allTools = await PrismService.getBuiltInToolSchemas();
      const agenticTools = allTools.filter((t) => AGENTIC_TOOL_NAMES.has(t.name));
      setBuiltInTools(agenticTools);
    }
    loadAgenticTools().catch(console.error);
  }, []);

  // System prompt is fully assembled server-side by SystemPromptAssembler.
  // The client sends a placeholder system message that gets replaced.

  // ── Conversation stats for SettingsPanel ──────────────────
  const uniqueModels = useMemo(() => getUniqueModels(messages), [messages]);
  const totalCost = useMemo(() => getConversationCost(messages), [messages]);
  const { totalTokens, requestCount } = useMemo(
    () => getConversationTokenStats(messages),
    [messages],
  );
  const usedTools = useMemo(() => getUsedTools(messages), [messages]);
  const modalities = useMemo(() => getModalities(messages), [messages]);

  // Build final tool schemas
  const allToolSchemas = useMemo(
    () => buildToolSchemas(builtInTools, disabledBuiltIns, customTools),
    [customTools, builtInTools, disabledBuiltIns],
  );

  // Pick random prompt suggestions
  const [randomPrompts, setRandomPrompts] = useState([]);

  useEffect(() => {
    const pool = [...AGENT_PROMPTS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    setRandomPrompts(pool.slice(0, 5));
  }, [conversationId]);

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
    async (conversationMessages, resolvedTitle) => {
      const currentMessages = [...conversationMessages];

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
          // Local models need enough context for MCP tool schemas + conversation
          minContextLength: 20000,
          project: PROJECT_AGENT,
          conversationId,
          conversationMeta: {
            title: resolvedTitle,
          },
          // Phase 1: Agentic controls
          autoApprove,
          planFirst,
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

        abortRef.current = PrismService.streamText(payload, {
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
                    return { ...activity, status: data.status, result: tc.result };
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
                    return { ...activity, status: tc.status, result: tc.result };
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
                };
              }
              return updated;
            });
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
                    setNewMemoriesCount((c) => c + (total - baselineCount));
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
      conversationId,
      allToolSchemas,
      autoApprove,
      planFirst,
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

      let resolvedTitle = title;
      if (messages.length === 0) {
        const titleText = text || "Agent conversation";
        resolvedTitle =
          titleText.length > 60 ? titleText.slice(0, 57) + "..." : titleText;
        setTitle(resolvedTitle);
      }

      const userMessage = {
        role: "user",
        content: text,
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
        loadConversations();
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
      loadConversations,
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

  // ── Conversation management ──────────────────────────────────
  const handleNewChat = useCallback(() => {
    if (isGenerating) return;
    setMessages([]);
    setToolActivity([]);
    setPendingImages([]);
    setConversationId(crypto.randomUUID());
    setActiveId(null);
    setTitle("Agent");
    textareaRef.current?.focus();
  }, [isGenerating]);

  const handleSelectConversation = useCallback(
    async (conv) => {
      if (isGenerating) return;
      try {
        const full = await PrismService.getConversationByProject(
          conv.id,
          PROJECT_AGENT,
        );
        const displayMessages = prepareDisplayMessages(full.messages || []);
        setMessages(displayMessages);
        setConversationId(conv.id);
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
        console.error("Failed to load conversation:", err);
      }
    },
    [isGenerating],
  );

  const handleDeleteConversation = useCallback(
    async (convId) => {
      try {
        await PrismService.deleteConversationByProject(convId, PROJECT_AGENT);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (activeId === convId) {
          handleNewChat();
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [activeId, handleNewChat],
  );

  // ── Left sidebar: tab bar + content ──────────────────────────
  const leftPanel = (
    <>
      <TabBarComponent
        tabs={[
          { key: "settings", icon: <Settings size={14} /> },
          {
            key: "tools",
            icon: <Wrench size={14} />,
            badge: allToolSchemas.length,
          },
          {
            key: "skills",
            icon: <Sparkles size={14} />,
            badge: skills.filter((s) => s.enabled).length || undefined,
          },
          {
            key: "memories",
            icon: <Brain size={14} />,
            badge: newMemoriesCount || undefined,
          },
          {
            key: "mcp",
            icon: <Plug size={14} />,
            badge: mcpServers.filter((s) => s.connected).length || undefined,
          },
        ]}
        activeTab={leftTab}
        onChange={(tab) => {
          setLeftTab(tab);
          if (tab === "memories") setNewMemoriesCount(0);
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
          conversationStats={
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
        <MemoriesPanel project={PROJECT_AGENT} refreshKey={memoriesRefreshKey} />
      )}

      {leftTab === "mcp" && (
        <MCPServersPanel
          servers={mcpServers}
          onServersChange={loadMCPServers}
          project={PROJECT_AGENT}
        />
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
              PrismService.sendApprovalResponse(conversationId, true).catch(console.error);
            }}
            onReject={() => {
              setPlanProposal((p) => p ? { ...p, status: "rejected" } : null);
              PrismService.sendApprovalResponse(conversationId, false).catch(console.error);
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
              PrismService.sendApprovalResponse(conversationId, true).catch(console.error);
            }}
            onReject={() => {
              setPendingApprovals((prev) =>
                prev.map((a) => a.id === approval.id ? { ...a, status: "rejected" } : a),
              );
              PrismService.sendApprovalResponse(conversationId, false).catch(console.error);
            }}
            onApproveAll={() => {
              setPendingApprovals((prev) =>
                prev.map((a) => a.status === "pending" ? { ...a, status: "approved" } : a),
              );
              PrismService.sendApprovalResponse(conversationId, true).catch(console.error);
            }}
          />
        ))}

        <div ref={endRef} />
      </div>

      {/* Input area */}
      {agenticProgress && isGenerating && (
        <div className={styles.iterationBar}>
          <span className={styles.iterationLabel}>
            <Zap size={11} />
            Iteration {agenticProgress.iteration}/{agenticProgress.maxIterations}
          </span>
          {injectedSkills.length > 0 && (
            <span className={styles.skillsBadge}>
              <Sparkles size={9} />
              {injectedSkills.length} skill{injectedSkills.length !== 1 ? "s" : ""}
            </span>
          )}
          <div className={styles.iterationDots}>
            {Array.from({ length: agenticProgress.maxIterations }, (_, i) => {
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
          conversations={conversations}
          activeId={activeId}
          onSelect={handleSelectConversation}
          onNew={handleNewChat}
          onDelete={handleDeleteConversation}
          disableNew={messages.length === 0 && !activeId}
        />
      }
      rightTitle={`${conversations.length} Conversations`}
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
          <span className={styles.headerBadge}>
            <Code2 size={10} />
            Agentic
          </span>
        </div>
      }
    >
      {chatContent}
    </ThreePanelLayout>
  );
}
