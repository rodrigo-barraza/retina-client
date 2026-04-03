"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FlaskConical,
  Play,
  Square,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  MessageSquare,
  User,
  Bot,
  Split,
} from "lucide-react";
import PrismService from "../services/PrismService.js";
import NavigationSidebarComponent from "./NavigationSidebarComponent.js";
import SettingsPanel from "./SettingsPanel.js";
import ModelPickerPopoverComponent from "./ModelPickerPopoverComponent.js";
import SelectDropdown from "./SelectDropdown.js";
import SliderComponent from "./SliderComponent.js";
import TabBarComponent from "./TabBarComponent.js";
import EmptyStateComponent from "./EmptyStateComponent.js";
import CopyButtonComponent from "./CopyButtonComponent.js";
import { SETTINGS_DEFAULTS } from "../constants.js";
import styles from "./SynthesisComponent.module.css";

const DEFAULT_TURNS = 4;
const MIN_TURNS = 1;
const MAX_TURNS = 20;

const SAMPLE_SEEDS = [
  {
    label: "Chatbot with personality",
    system: "Bunny is a chatbot that stutters, and acts timid and unsure of its answers.",
    messages: [
      { role: "user", content: "When was the Library of Alexandria burned down?" },
      { role: "assistant", content: "Umm, I-I think that was in 48 BC, b-but I'm not sure, I'm sorry." },
    ],
    category: "Chat",
  },
  {
    label: "Coding assistant",
    system: "You are a senior software engineer who explains concepts clearly and provides production-quality code.",
    messages: [
      { role: "user", content: "How do I implement a debounce function in JavaScript?" },
    ],
    category: "Coding",
  },
  {
    label: "Creative writing",
    system: "You are a creative writing assistant with a poetic, evocative style. You help users craft vivid prose and poetry.",
    messages: [
      { role: "user", content: "Write a haiku about the first rain of spring." },
      { role: "assistant", content: "Petrichor rising,\nearth exhales its longest sigh—\nblossoms drink the sky." },
      { role: "user", content: "Now turn that into a short paragraph of prose." },
    ],
    category: "Creative Writing",
  },
  {
    label: "Brainstorming",
    system: "You are an enthusiastic brainstorming partner. You generate creative, diverse ideas and build on the user's suggestions.",
    messages: [
      { role: "user", content: "I need ideas for a mobile app that helps people learn languages through music." },
    ],
    category: "Brainstorm",
  },
  {
    label: "Roleplay - medieval guide",
    system: "You are a medieval town guide named Aldric. You speak in an old English dialect and are eager to show travelers around your village.",
    messages: [
      { role: "user", content: "What can I do in this town?" },
      { role: "assistant", content: "Ah, a weary traveler! Welcome, welcome to Thornhollow! Pray, follow me — I shall show thee the finest tavern this side of the King's Road, and mayhaps the blacksmith if thou needst thy blade sharpened." },
      { role: "user", content: "Take me to the tavern." },
    ],
    category: "Chat",
  },
];

const CATEGORY_OPTIONS = [
  { value: "Chat", label: "Chat" },
  { value: "Coding", label: "Coding" },
  { value: "Creative Writing", label: "Creative Writing" },
  { value: "Brainstorm", label: "Brainstorm" },
  { value: "Rewrite", label: "Rewrite" },
  { value: "Summarize", label: "Summarize" },
  { value: "Classify", label: "Classify" },
  { value: "Extract", label: "Extract" },
  { value: "QA", label: "Q&A" },
  { value: "Other", label: "Other" },
];

export default function SynthesisComponent() {
  // ── Config & model state ──────────────────────────────────────
  const [config, setConfig] = useState(null);
  const [settings, setSettings] = useState({
    ...SETTINGS_DEFAULTS,
    systemPrompt: "You are a helpful AI assistant.",
    maxTokens: 4096,
  });
  const [leftTab, setLeftTab] = useState("config"); // "config" | "output"

  // ── Synthesis state ───────────────────────────────────────────
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful AI assistant.",
  );
  const [userPersona, setUserPersona] = useState("");
  const [useUserSimModel, setUseUserSimModel] = useState(false);
  const [userSimSettings, setUserSimSettings] = useState({
    provider: "",
    model: "",
    temperature: 0.9,
  });
  const [targetTurns, setTargetTurns] = useState(DEFAULT_TURNS);
  const [category, setCategory] = useState("Chat");
  const [seedMessages, setSeedMessages] = useState([]);
  const [generatedMessages, setGeneratedMessages] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState("");
  const [copied, setCopied] = useState(false);
  const [seedsExpanded, setSeedsExpanded] = useState(true);
  const [templateExpanded, setTemplateExpanded] = useState(false);

  const abortRef = useRef(null);
  const abortedRef = useRef(false);
  const messagesEndRef = useRef(null);
  const [conversationId, setConversationId] = useState(null);

  // ── Load config ───────────────────────────────────────────────
  useEffect(() => {
    PrismService.getConfigWithLocalModels({
      onConfig: (cfg) => {
        setConfig(cfg);
        // Auto-select first text-to-text provider/model if none set
        if (!settings.provider || !settings.model) {
          const textModels = cfg?.textToText?.models || {};
          const firstProvider = Object.keys(textModels)[0];
          if (firstProvider && textModels[firstProvider]?.length > 0) {
            setSettings((s) => ({
              ...s,
              provider: s.provider || firstProvider,
              model: s.model || textModels[firstProvider][0].name,
            }));
          }
        }
      },
      onLocalMerge: setConfig,
    }).catch(console.error);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered config: text-to-text models only ─────────────────
  const filteredConfig = useMemo(() => {
    if (!config) return null;
    return {
      ...config,
      textToImage: { models: {} },
      textToSpeech: { models: {}, voices: {}, defaultVoices: {} },
      audioToText: { models: {} },
    };
  }, [config]);

  // ── Model selection handler ───────────────────────────────────
  const handleSelectModel = useCallback((provider, model) => {
    setSettings((s) => ({ ...s, provider, model }));
  }, []);

  const handleSelectUserSimModel = useCallback((provider, model) => {
    setUserSimSettings((s) => ({ ...s, provider, model }));
  }, []);

  // ── Compute final messages array (SFT format) ─────────────────
  const sftOutput = useMemo(() => {
    const msgs = [];
    if (systemPrompt.trim()) {
      msgs.push({ role: "system", content: systemPrompt.trim() });
    }
    // Filter out any internal _streaming flag
    for (const m of generatedMessages) {
      msgs.push({ role: m.role, content: m.content });
    }
    return msgs;
  }, [systemPrompt, generatedMessages]);

  const sftJsonString = useMemo(() => {
    const dataset = {
      prompt: systemPrompt.trim(),
      prompt_id: crypto.randomUUID().replace(/-/g, ""),
      messages: sftOutput,
      category,
    };
    return JSON.stringify(dataset, null, 2);
  }, [sftOutput, category, systemPrompt]);

  // ── Auto-scroll messages ──────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [generatedMessages, generationProgress]);

  // ── Seed message management ───────────────────────────────────
  const addSeedMessage = useCallback((role = "user") => {
    setSeedMessages((prev) => [...prev, { role, content: "" }]);
  }, []);

  const updateSeedMessage = useCallback((index, field, value) => {
    setSeedMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );
  }, []);

  const removeSeedMessage = useCallback((index) => {
    setSeedMessages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const loadSeedTemplate = useCallback((seed) => {
    setSystemPrompt(seed.system);
    setSeedMessages(seed.messages.map((m) => ({ ...m })));
    setCategory(seed.category);
    setGeneratedMessages([]);
    setTemplateExpanded(false);
    setSeedsExpanded(true);
  }, []);

  // ── Generation logic (real back-and-forth /chat calls) ─────────
  const handleGenerate = useCallback(async () => {
    if (!settings.provider || !settings.model) return;

    setIsGenerating(true);
    setGenerationProgress("");
    abortedRef.current = false;

    // Create a new conversation for this synthesis run
    const convId = crypto.randomUUID();
    setConversationId(convId);

    // Start with seed messages as the conversation so far
    const conversation = seedMessages
      .filter((m) => m.content.trim())
      .map((m) => ({ role: m.role, content: m.content }));

    setGeneratedMessages([...conversation]);

    // If we have seed messages, append them to the conversation first
    if (conversation.length > 0) {
      try {
        await PrismService.appendMessages(convId, conversation, undefined, {
          title: `Synthesis: ${systemPrompt.slice(0, 60)}`,
          systemPrompt,
          settings: {
            provider: settings.provider,
            model: settings.model,
            temperature: settings.temperature,
          },
        });
      } catch {
        // Non-critical — conversation just won't have seed messages persisted
      }
    }

    // Conversation metadata for Prism persistence — only used the FIRST
    // time we need to create the conversation record in the backend.
    const convMeta = {
      title: `Synthesis: ${systemPrompt.slice(0, 60)}`,
      systemPrompt,
      settings: {
        provider: settings.provider,
        model: settings.model,
        temperature: settings.temperature,
      },
    };

    // Track whether the conversation record has been created in the backend.
    // If seed messages were appended above, it's already created.
    let conversationCreated = conversation.length > 0;

    // targetTurns = total user/assistant pairs; each turn = 2 messages
    const totalMessages = targetTurns * 2;
    const remaining = totalMessages - conversation.length;

    // Figure out what role the next message should be
    let nextRole =
      conversation.length === 0
        ? "user"
        : conversation[conversation.length - 1].role === "user"
          ? "assistant"
          : "user";

    try {
      for (let i = 0; i < remaining; i++) {
        if (abortedRef.current) break;

        if (nextRole === "assistant") {
          // ─── ASSISTANT TURN: genuine model response ───────────
          // Only pass conversationMeta if the conversation hasn't been
          // created yet (first assistant call with no seeds). When meta
          // is present, the /chat route also persists the last user
          // message — which would duplicate it if we already appended
          // it explicitly during a user-simulation turn.
          const turnMeta = conversationCreated ? undefined : convMeta;

          const assistantContent = await streamTurn(
            settings,
            systemPrompt,
            conversation,
            (partial) => {
              setGeneratedMessages([
                ...conversation,
                { role: "assistant", content: partial, _streaming: true },
              ]);
              setGenerationProgress(partial);
            },
            abortRef,
            convId,
            turnMeta,
          );
          conversationCreated = true;

          if (abortedRef.current) break;

          conversation.push({ role: "assistant", content: assistantContent });
          setGeneratedMessages([...conversation]);
          setGenerationProgress("");
          nextRole = "user";
        } else {
          // ─── USER TURN: simulated user message ───────────────
          const userSystemPrompt = buildUserSimulationPrompt(
            systemPrompt,
            userPersona,
          );

          // Role-swap the conversation so the user-simulator model sees the
          // assistant's messages as "user" prompts and vice versa.
          // IMPORTANT: Many local models (Gemma, Llama, etc.) have strict
          // Jinja chat templates that require messages to alternate
          // user → assistant → user, with the first non-system message being
          // "user".  After role-swapping, the history may start with
          // "assistant" (when the real conversation started with a user msg).
          // We fix this by ensuring the first message is always role "user".
          let simulatorHistory;
          if (conversation.length > 0) {
            const swapped = conversation.map((m) => ({
              role: m.role === "user" ? "assistant" : "user",
              content: m.content,
            }));
            // If the swapped history starts with "assistant", prepend a
            // contextual user message so the template stays happy.
            if (swapped[0].role === "assistant") {
              swapped.unshift({
                role: "user",
                content: "Continue the conversation. Generate the next natural user message.",
              });
            }
            simulatorHistory = swapped;
          } else {
            simulatorHistory = [{ role: "user", content: "Start the conversation. Send the first message as the user." }];
          }

          // Use separate model for user simulation when enabled
          const userTurnSettings = useUserSimModel && userSimSettings.provider && userSimSettings.model
            ? { ...settings, provider: userSimSettings.provider, model: userSimSettings.model, temperature: userSimSettings.temperature }
            : settings;

          const userContent = await streamTurn(
            userTurnSettings,
            userSystemPrompt,
            simulatorHistory,
            (partial) => {
              setGeneratedMessages([
                ...conversation,
                { role: "user", content: partial, _streaming: true },
              ]);
              setGenerationProgress(partial);
            },
            abortRef,
            undefined,
            undefined,
            { skipConversation: true },
          );

          if (abortedRef.current) break;

          // Append the generated user message to the conversation in Prism
          const userMsg = { role: "user", content: userContent };
          conversation.push(userMsg);
          try {
            // Pass meta on the first call to create the conversation record
            const appendMeta = conversationCreated ? undefined : convMeta;
            await PrismService.appendMessages(convId, [userMsg], undefined, appendMeta);
            conversationCreated = true;
          } catch {
            // Non-critical
          }
          setGeneratedMessages([...conversation]);
          setGenerationProgress("");
          nextRole = "assistant";
        }
      }

      // Ensure conversation ends with assistant
      if (
        !abortedRef.current &&
        conversation.length > 0 &&
        conversation[conversation.length - 1].role !== "assistant"
      ) {
        const assistantContent = await streamTurn(
          settings,
          systemPrompt,
          conversation,
          (partial) => {
            setGeneratedMessages([
              ...conversation,
              { role: "assistant", content: partial, _streaming: true },
            ]);
            setGenerationProgress(partial);
          },
          abortRef,
          convId,
        );

        if (!abortedRef.current) {
          conversation.push({ role: "assistant", content: assistantContent });
          setGeneratedMessages([...conversation]);
        }
      }

      if (!abortedRef.current) {
        setLeftTab("output");
      }
    } catch (err) {
      if (err.name !== "AbortError" && !abortedRef.current) {
        setGeneratedMessages((prev) => [
          ...prev.filter((m) => !m._streaming),
          {
            role: "assistant",
            content: `⚠️ Generation error: ${err.message}`,
          },
        ]);
      }
    } finally {
      setIsGenerating(false);
      setGenerationProgress("");
      abortRef.current = null;
    }
  }, [
    settings,
    systemPrompt,
    userPersona,
    targetTurns,
    seedMessages,
    useUserSimModel,
    userSimSettings,
  ]);

  const handleStop = useCallback(() => {
    abortedRef.current = true;
    if (abortRef.current && typeof abortRef.current === "function") {
      abortRef.current();
    }
    abortRef.current = null;
    setIsGenerating(false);
    // Clean up any in-flight streaming messages
    setGeneratedMessages((prev) => prev.filter((m) => !m._streaming));
  }, []);

  const handleReset = useCallback(() => {
    setSeedMessages([]);
    setGeneratedMessages([]);
    setSystemPrompt("You are a helpful AI assistant.");
    setUserPersona("");
    setUseUserSimModel(false);
    setUserSimSettings({ provider: "", model: "", temperature: 0.9 });
    setTargetTurns(DEFAULT_TURNS);
    setCategory("Chat");
    setGenerationProgress("");
    setConversationId(null);
    setLeftTab("config");
  }, []);

  const handleCopyOutput = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(sftJsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [sftJsonString]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([sftJsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sft-conversation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [sftJsonString]);

  // ── Edit generated message ────────────────────────────────────
  const updateGeneratedMessage = useCallback((index, content) => {
    setGeneratedMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, content } : m)),
    );
  }, []);

  const removeGeneratedMessage = useCallback((index) => {
    setGeneratedMessages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // ── Render ────────────────────────────────────────────────────

  const leftPanel = (
    <>
      <TabBarComponent
        tabs={[
          { key: "config", label: "Configure" },
          {
            key: "output",
            label: "Output",
            badge: generatedMessages.length > 0 ? generatedMessages.length : undefined,
          },
        ]}
        activeTab={leftTab}
        onChange={setLeftTab}
      />

      {leftTab === "config" && (
        <div className={styles.configPanel}>
          {/* Model selection */}
          <SettingsPanel
            config={filteredConfig}
            settings={settings}
            onChange={(updates) => setSettings((s) => ({ ...s, ...updates }))}
            hasAssistantImages={false}
            hideProviderModel={false}
          />


        </div>
      )}

      {leftTab === "output" && (
        <div className={styles.outputPanel}>
          {generatedMessages.length > 0 ? (
            <>
              <div className={styles.outputActions}>
                <button
                  className={styles.outputActionBtn}
                  onClick={handleCopyOutput}
                  title="Copy SFT JSON"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copied!" : "Copy JSON"}
                </button>
                <button
                  className={styles.outputActionBtn}
                  onClick={handleDownload}
                  title="Download JSON"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
              <div className={styles.outputPreview}>
                <pre className={styles.jsonOutput}>{sftJsonString}</pre>
              </div>
            </>
          ) : (
            <div className={styles.outputEmpty}>
              <FlaskConical size={24} />
              <p>Generate a conversation to see the SFT output here.</p>
            </div>
          )}
        </div>
      )}
    </>
  );

  return (
    <div className={styles.pageLayout}>
      <NavigationSidebarComponent mode="user" isGenerating={isGenerating} />
      <div className={styles.sidePanel}>{leftPanel}</div>

      <div className={styles.mainContent}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <FlaskConical size={18} />
            <h1 className={styles.headerTitle}>Synthesis</h1>
            <ModelPickerPopoverComponent
              config={filteredConfig}
              settings={settings}
              onSelectModel={handleSelectModel}
            />
            <button
              className={`${styles.splitModelToggle} ${useUserSimModel ? styles.splitModelToggleActive : ""}`}
              onClick={() => setUseUserSimModel((v) => !v)}
              title={useUserSimModel ? "Using separate model for user simulation" : "Use same model for both roles"}
            >
              <Split size={14} />
            </button>
            {useUserSimModel && (
              <>
                <span className={styles.userSimLabel}>
                  <User size={12} />
                </span>
                <ModelPickerPopoverComponent
                  config={filteredConfig}
                  settings={userSimSettings}
                  onSelectModel={handleSelectUserSimModel}
                />
              </>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.resetBtn}
              onClick={handleReset}
              disabled={isGenerating}
              title="Reset all"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            {isGenerating ? (
              <button className={styles.stopBtn} onClick={handleStop}>
                <Square size={14} />
                Stop
              </button>
            ) : (
              <button
                className={styles.generateBtn}
                onClick={handleGenerate}
                disabled={!settings.provider || !settings.model}
              >
                <Play size={14} />
                Generate
              </button>
            )}
          </div>
        </div>

        {/* Main area */}
        <div className={styles.workspace}>
          {/* Conversation Length & Category bar */}
          <div className={styles.configBar}>
            <div className={styles.configBarItem}>
              <div className={styles.configBarLabel}>
                <MessageSquare size={13} />
                Length
              </div>
              <div className={styles.configBarControl}>
                <SliderComponent
                  value={targetTurns}
                  min={MIN_TURNS}
                  max={MAX_TURNS}
                  step={1}
                  onChange={(v) => setTargetTurns(v)}
                />
                <span className={styles.turnsValue}>{targetTurns} turns</span>
              </div>
            </div>
            <div className={styles.configBarItem}>
              <div className={styles.configBarLabel}>
                <Sparkles size={13} />
                Category
              </div>
              <SelectDropdown
                value={category}
                options={CATEGORY_OPTIONS}
                onChange={setCategory}
                placeholder="Select category"
              />
            </div>
          </div>

          {/* Personas side-by-side */}
          <div className={styles.personaRow}>
            {/* Assistant Persona */}
            <div className={styles.promptSection}>
              <div className={styles.promptHeader}>
                <Bot size={14} />
                <span>Assistant Persona</span>
              </div>
              <textarea
                className={styles.promptTextarea}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Define the assistant's personality and behavior..."
                rows={3}
              />
            </div>

            {/* User Persona */}
            <div className={styles.promptSection}>
              <div className={styles.promptHeader}>
                <User size={14} />
                <span>User Persona</span>
                <span className={styles.optionalTag}>Optional</span>
              </div>
              <textarea
                className={styles.promptTextarea}
                value={userPersona}
                onChange={(e) => setUserPersona(e.target.value)}
                placeholder="Describe the user's personality, tone, and conversation style..."
                rows={3}
              />
            </div>
          </div>

          {/* Seed Templates */}
          <div className={styles.collapsibleSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setTemplateExpanded((v) => !v)}
            >
              <Sparkles size={14} />
              <span>Seed Templates</span>
              {templateExpanded ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            {templateExpanded && (
              <div className={styles.templateGrid}>
                {SAMPLE_SEEDS.map((seed) => (
                  <button
                    key={seed.label}
                    className={styles.templateCard}
                    onClick={() => loadSeedTemplate(seed)}
                  >
                    <span className={styles.templateLabel}>{seed.label}</span>
                    <span className={styles.templateCategory}>
                      {seed.category}
                    </span>
                    <span className={styles.templateMsgCount}>
                      {seed.messages.length} messages
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Seed Messages */}
          <div className={styles.collapsibleSection}>
            <button
              className={styles.collapsibleHeader}
              onClick={() => setSeedsExpanded((v) => !v)}
            >
              <MessageSquare size={14} />
              <span>
                Prefilled Messages
                {seedMessages.length > 0 && (
                  <span className={styles.msgCount}>
                    {seedMessages.length}
                  </span>
                )}
              </span>
              {seedsExpanded ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
            {seedsExpanded && (
              <div className={styles.seedMessages}>
                {seedMessages.map((msg, i) => (
                  <div key={i} className={styles.seedMessage}>
                    <div className={styles.seedMessageHeader}>
                      <button
                        className={`${styles.roleToggle} ${styles[`role_${msg.role}`]}`}
                        onClick={() =>
                          updateSeedMessage(
                            i,
                            "role",
                            msg.role === "user" ? "assistant" : "user",
                          )
                        }
                        title="Toggle role"
                      >
                        {msg.role === "user" ? (
                          <User size={12} />
                        ) : (
                          <Bot size={12} />
                        )}
                        {msg.role}
                      </button>
                      <button
                        className={styles.removeSeedBtn}
                        onClick={() => removeSeedMessage(i)}
                        title="Remove message"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <textarea
                      className={styles.seedTextarea}
                      value={msg.content}
                      onChange={(e) =>
                        updateSeedMessage(i, "content", e.target.value)
                      }
                      placeholder={`${msg.role === "user" ? "User" : "Assistant"} message...`}
                      rows={2}
                    />
                  </div>
                ))}
                <div className={styles.addSeedRow}>
                  <button
                    className={styles.addSeedBtn}
                    onClick={() => addSeedMessage("user")}
                  >
                    <Plus size={12} />
                    User
                  </button>
                  <button
                    className={styles.addSeedBtn}
                    onClick={() => addSeedMessage("assistant")}
                  >
                    <Plus size={12} />
                    Assistant
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Generated Preview — live message bubbles */}
          {(generatedMessages.length > 0 || isGenerating) && (
            <div className={styles.generatedSection}>
              <div className={styles.generatedHeader}>
                <FlaskConical size={14} />
                <span>Generated Conversation</span>
                {generatedMessages.length > 0 && (
                  <span className={styles.msgCount}>
                    {generatedMessages.length} messages
                  </span>
                )}
                {conversationId && !isGenerating && (
                  <a
                    href={`/conversations/${conversationId}`}
                    className={styles.convLink}
                    title="View persisted conversation"
                  >
                    View
                  </a>
                )}
                {isGenerating && (
                  <span className={styles.streamingBadge}>
                    <span className={styles.streamingDot} />
                    Streaming
                  </span>
                )}
              </div>

              {generatedMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`${styles.generatedMessage} ${styles[`generated_${msg.role}`]}${msg._streaming ? ` ${styles.generatedMessageStreaming}` : ""}`}
                >
                  <div className={styles.generatedMsgHeader}>
                    <span
                      className={`${styles.roleBadge} ${styles[`role_${msg.role}`]}`}
                    >
                      {msg.role === "user" ? (
                        <User size={11} />
                      ) : (
                        <Bot size={11} />
                      )}
                      {msg.role}
                    </span>
                    {!msg._streaming && !isGenerating && (
                      <div className={styles.generatedMsgActions}>
                        <CopyButtonComponent text={msg.content} size={12} />
                        <button
                          className={styles.removeSeedBtn}
                          onClick={() => removeGeneratedMessage(i)}
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  {msg._streaming ? (
                    <div className={styles.generatedContent}>
                      {msg.content}
                      <span className={styles.streamCursor} />
                    </div>
                  ) : isGenerating ? (
                    <div className={styles.generatedContent}>
                      {msg.content}
                    </div>
                  ) : (
                    <textarea
                      className={styles.generatedTextarea}
                      value={msg.content}
                      onChange={(e) =>
                        updateGeneratedMessage(i, e.target.value)
                      }
                      rows={Math.max(
                        2,
                        Math.ceil(msg.content.length / 80),
                      )}
                    />
                  )}
                </div>
              ))}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Empty state */}
          {generatedMessages.length === 0 && !isGenerating && (
            <div className={styles.emptyCenter}>
              <EmptyStateComponent
                icon={<FlaskConical size={40} />}
                title="SFT Data Synthesis"
                subtitle="Configure your system prompt and user persona, optionally prefill messages, then generate synthetic conversations via real turn-by-turn model distillation."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────

/**
 * Stream a single chat turn and return the collected text.
 * Each turn is a real /chat call — the model genuinely responds to the context.
 * When conversationId is provided, the messages are persisted to that conversation.
 */
function streamTurn(settings, turnSystemPrompt, history, onPartial, abortRef, conversationId, conversationMeta, { skipConversation = false } = {}) {
  return new Promise((resolve, reject) => {
    let collected = "";

    const payload = {
      provider: settings.provider,
      model: settings.model,
      messages: [
        { role: "system", content: turnSystemPrompt },
        ...history,
      ],
      temperature: settings.temperature,
      maxTokens: settings.maxTokens,
    };

    // Skip conversation persistence entirely (used for user-simulation turns)
    if (skipConversation) {
      payload.skipConversation = true;
    } else if (conversationId) {
      // Attach conversation ID for persistence when available
      payload.conversationId = conversationId;
      if (conversationMeta) payload.conversationMeta = conversationMeta;
    }

    const cancel = PrismService.streamText(
      payload,
      {
        onChunk: (content) => {
          collected += content;
          onPartial(collected);
        },
        onDone: () => resolve(collected),
        onError: (err) => reject(err),
      },
    );

    // Store cancellation so the parent can abort mid-turn
    abortRef.current = cancel;
  });
}

/**
 * Build the system prompt for the user-simulator model call.
 * Instructs the model to role-play as the user persona and
 * generate a single natural follow-up user message.
 */
function buildUserSimulationPrompt(assistantSystemPrompt, userPersona) {
  let prompt = `You are simulating a human user in a conversation with an AI assistant. Your job is to generate the NEXT single message that this user would naturally say.

## Context
The user is talking to an AI assistant that has the following personality:
"""
${assistantSystemPrompt}
"""

`;

  if (userPersona.trim()) {
    prompt += `## Your Personality (as the user)
"""
${userPersona}
"""

`;
  } else {
    prompt += `## Your Personality (as the user)
You are a casual, curious human chatting naturally. Ask follow-up questions, share reactions, and keep the conversation flowing organically.

`;
  }

  prompt += `## Rules
- Generate ONLY the next user message — nothing else.
- Do NOT include quotes, labels, prefixes like "User:", or any meta-commentary.
- Be natural and conversational — react to what the assistant said, ask follow-ups, or steer the topic.
- Keep messages concise and human-like (1-3 sentences typically).
- Do NOT repeat or rephrase previous messages.`;

  return prompt;
}
