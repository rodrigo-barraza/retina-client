"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Check,
  XCircle,
  FileText,
  FolderTree,
  Terminal,
  Globe,
  Search,
  GitBranch,
  Trash2,
  ArrowRight,
  File,
  Folder,
  Monitor,
  Users,
  MessageSquare,
  StopCircle,
  Zap,
} from "lucide-react";
import MarkdownContent from "./MarkdownContent";
import RainbowCanvasComponent from "./RainbowCanvasComponent";
import PrismService from "../services/PrismService";
import { formatLatency } from "../utils/utilities";
import styles from "./ToolResultRenderers.module.css";
import mlStyles from "./MessageList.module.css";

// ─── Helpers ──────────────────────────────────────────────────────────

function basename(filePath) {
  if (!filePath) return "";
  return filePath.split("/").pop() || filePath;
}

function extensionOf(filePath) {
  const base = basename(filePath);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.substring(dot + 1).toLowerCase() : "";
}

function tryParse(result) {
  if (typeof result === "object" && result !== null) return result;
  if (typeof result === "string") {
    try { return JSON.parse(result); } catch { return null; }
  }
  return null;
}

/**
 * Language hint for syntax highlighting based on file extension.
 */
const EXT_LANG = {
  js: "javascript", jsx: "javascript", ts: "typescript", tsx: "typescript",
  py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
  css: "css", scss: "scss", html: "html", json: "json", yaml: "yaml",
  yml: "yaml", md: "markdown", sh: "bash", bash: "bash", sql: "sql",
  xml: "xml", toml: "toml", lua: "lua", c: "c", cpp: "cpp", h: "c",
};

// ─── Status Badge ─────────────────────────────────────────────────────

function StatusBadge({ success, label }) {
  return (
    <span className={`${styles.statusBadge} ${success ? styles.statusSuccess : styles.statusError}`}>
      {success ? <Check size={10} /> : <XCircle size={10} />}
      {label}
    </span>
  );
}

// ─── File Path Pill ───────────────────────────────────────────────────

function PathPill({ path, icon }) {
  const Icon = icon || FileText;
  return (
    <span className={styles.pathPill}>
      <Icon size={11} />
      <span className={styles.pathFull}>{path}</span>
    </span>
  );
}

// ─── Collapsible Raw Result ───────────────────────────────────────────

function RawResultToggle({ result }) {
  const [show, setShow] = useState(false);
  if (!result) return null;

  const formatted = typeof result === "string"
    ? (() => {
        try { return "```json\n" + JSON.stringify(JSON.parse(result), null, 2) + "\n```"; }
        catch { return "```\n" + result + "\n```"; }
      })()
    : "```json\n" + JSON.stringify(result, null, 2) + "\n```";

  return (
    <div className={styles.rawToggle}>
      <button className={styles.rawToggleBtn} onClick={() => setShow(v => !v)}>
        <ChevronRight size={11} className={show ? styles.chevronOpen : ""} />
        <span>Raw Response</span>
      </button>
      {show && (
        <div className={styles.rawContent}>
          <MarkdownContent content={formatted} />
        </div>
      )}
    </div>
  );
}


/**
 * Collapsible panel that shows all input arguments passed to a tool call.
 * Renders key-value pairs in a clean, readable format.
 */
function InputArgsToggle({ args }) {
  const [show, setShow] = useState(false);

  const entries = useMemo(() => {
    if (!args || typeof args !== "object") return [];
    return Object.entries(args).filter(([, v]) => v !== undefined && v !== null);
  }, [args]);

  if (entries.length === 0) return null;

  return (
    <div className={styles.inputArgsToggle}>
      <button className={styles.rawToggleBtn} onClick={() => setShow(v => !v)}>
        <ChevronRight size={11} className={show ? styles.chevronOpen : ""} />
        <span>Input</span>
        <span className={styles.inputArgsCount}>{entries.length}</span>
      </button>
      {show && (
        <div className={styles.inputArgsContent}>
          {entries.map(([key, val]) => {
            const isLong = typeof val === "string" && val.length > 80;
            const display = typeof val === "string"
              ? val
              : JSON.stringify(val, null, 2);

            return (
              <div key={key} className={styles.inputArgRow}>
                <span className={styles.inputArgKey}>{key}</span>
                <span className={`${styles.inputArgValue} ${isLong ? styles.inputArgValueLong : ""}`}>
                  {display}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Output Result (what the model sees) ─────────────────

/**
 * Collapsible panel that shows the raw result returned to the model.
 * Helps users understand exactly what the agent receives back.
 */
function OutputResultToggle({ result }) {
  const [show, setShow] = useState(false);

  const display = useMemo(() => {
    if (result === undefined || result === null) return null;
    if (typeof result === "string") {
      try {
        const parsed = JSON.parse(result);
        return { type: "object", data: parsed, raw: JSON.stringify(parsed, null, 2) };
      } catch {
        return { type: "string", data: result, raw: result };
      }
    }
    if (typeof result === "object") {
      return { type: "object", data: result, raw: JSON.stringify(result, null, 2) };
    }
    return { type: "string", data: result, raw: String(result) };
  }, [result]);

  if (!display) return null;

  // Count meaningful entries for the badge
  const entryCount = display.type === "object" && !Array.isArray(display.data)
    ? Object.keys(display.data).length
    : null;

  return (
    <div className={styles.outputResultToggle}>
      <button className={styles.rawToggleBtn} onClick={() => setShow(v => !v)}>
        <ChevronRight size={11} className={show ? styles.chevronOpen : ""} />
        <span>Output</span>
        {entryCount != null && (
          <span className={styles.outputResultCount}>{entryCount}</span>
        )}
      </button>
      {show && (
        <div className={styles.outputResultContent}>
          {display.type === "object" && !Array.isArray(display.data) ? (
            Object.entries(display.data)
              .filter(([, v]) => v !== undefined && v !== null)
              .map(([key, val]) => {
                const isComplex = typeof val === "object";
                const valStr = isComplex
                  ? JSON.stringify(val, null, 2)
                  : String(val);
                const isLong = valStr.length > 80;

                return (
                  <div key={key} className={styles.outputArgRow}>
                    <span className={styles.outputArgKey}>{key}</span>
                    <span className={`${styles.outputArgValue} ${isLong ? styles.outputArgValueLong : ""}`}>
                      {valStr}
                    </span>
                  </div>
                );
              })
          ) : (
            <pre className={styles.outputRawPre}>{display.raw}</pre>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// RENDERERS
// ═══════════════════════════════════════════════════════════════════════

// ── 1. File Read ──────────────────────────────────────────────────────

function FileReadRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const filePath = parsed.path || args?.path || "";
  const content = parsed.content || "";
  const _lang = EXT_LANG[extensionOf(filePath)] || "";


  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <PathPill path={filePath} icon={FileText} />

      </div>
      {content && (
        <pre className={styles.codeBlock}>
          <code>{content.length > 3000 ? content.slice(0, 3000) + "\n…" : content}</code>
        </pre>
      )}
    </div>
  );
}

// ── 2. File Write ─────────────────────────────────────────────────────

function FileWriteRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const filePath = parsed.path || args?.path || "";
  const success = !parsed.error;

  const created = parsed.created;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <PathPill path={filePath} icon={FileText} />
        <StatusBadge success={success} label={created ? "Created" : "Written"} />

      </div>
      {parsed.error && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

// ── 3. String Replace ─────────────────────────────────────────────────

function StrReplaceRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const filePath = parsed.path || args?.path || "";
  const success = !parsed.error;
  const replacements = parsed.replacements || parsed.count || 1;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <PathPill path={filePath} icon={FileText} />
        <StatusBadge success={success} label={`${replacements} replacement${replacements !== 1 ? "s" : ""}`} />
      </div>
      {args?.oldStr && args?.newStr && (
        <pre className={styles.diffBlock}>
          <code>
            <span className={styles.diffRemoved}>- {args.oldStr.length > 200 ? args.oldStr.slice(0, 200) + "…" : args.oldStr}</span>
            {"\n"}
            <span className={styles.diffAdded}>+ {args.newStr.length > 200 ? args.newStr.slice(0, 200) + "…" : args.newStr}</span>
          </code>
        </pre>
      )}
      {parsed.error && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

// ── 4. Grep Search ────────────────────────────────────────────────────

function GrepSearchRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const matches = parsed.matches || parsed.results || [];
  const totalMatches = parsed.totalMatches ?? parsed.count ?? matches.length;
  const pattern = args?.pattern || "";

  // Group by file
  const grouped = {};
  for (const m of matches.slice(0, 30)) {
    const file = m.file || m.path || "unknown";
    if (!grouped[file]) grouped[file] = [];
    grouped[file].push(m);
  }

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Search size={13} />
        <span className={styles.rendererTitle}>
          {totalMatches} match{totalMatches !== 1 ? "es" : ""} for <code className={styles.inlineCode}>{pattern}</code>
        </span>
      </div>
      <div className={styles.grepList}>
        {Object.entries(grouped).map(([file, fileMatches]) => (
          <div key={file} className={styles.grepFile}>
            <span className={styles.grepFilePath}>{file}</span>
            {fileMatches.map((m, i) => (
              <div key={i} className={styles.grepLine}>
                {m.line != null && <span className={styles.grepLineNum}>{m.line}</span>}
                <span className={styles.grepLineContent}>{m.content || m.text || m.match || ""}</span>
              </div>
            ))}
          </div>
        ))}

      </div>
    </div>
  );
}

// ── 5. Directory List ─────────────────────────────────────────────────

function DirectoryListRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const rawEntries = parsed.entries || parsed.items || parsed.files || [];
  const entries = Array.isArray(rawEntries) ? rawEntries : Object.values(rawEntries);
  const dirPath = parsed.path || args?.path || "";

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <FolderTree size={13} />
        <span className={styles.rendererTitle}>{basename(dirPath) || "Directory"}</span>

      </div>
      <div className={styles.dirList}>
        {entries.slice(0, 40).map((entry, i) => {
          const name = typeof entry === "string" ? entry : (entry.name || entry.path || "");
          const isDir = typeof entry === "object" && (entry.type === "directory" || entry.isDirectory);
          return (
            <div key={i} className={styles.dirEntry}>
              {isDir ? <Folder size={11} className={styles.dirIcon} /> : <File size={11} className={styles.fileIcon} />}
              <span>{name}</span>
            </div>
          );
        })}

      </div>
    </div>
  );
}

// ── 6. Glob Files ─────────────────────────────────────────────────────

function GlobFilesRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const files = parsed.files || parsed.matches || [];
  const pattern = args?.pattern || "";

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Search size={13} />
        <span className={styles.rendererTitle}>
          {files.length} file{files.length !== 1 ? "s" : ""} matching <code className={styles.inlineCode}>{pattern}</code>
        </span>
      </div>
      <div className={styles.dirList}>
        {files.slice(0, 40).map((f, i) => {
          const path = typeof f === "string" ? f : f.path || f.name || "";
          return (
            <div key={i} className={styles.dirEntry}>
              <File size={11} className={styles.fileIcon} />
              <span>{path}</span>
            </div>
          );
        })}

      </div>
    </div>
  );
}

// ── 7. Web Search ─────────────────────────────────────────────────────

function WebSearchRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const results = parsed.results || parsed.items || [];
  const query = args?.query || "";

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Globe size={13} />
        <span className={styles.rendererTitle}>
          {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
        </span>
      </div>
      <div className={styles.searchResults}>
        {results.slice(0, 8).map((r, i) => (
          <div key={i} className={styles.searchResult}>
            <a href={r.url || r.link} target="_blank" rel="noopener noreferrer" className={styles.searchLink}>
              {r.title || r.name || r.url}
            </a>
            {r.snippet && <p className={styles.searchSnippet}>{r.snippet}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 8. Fetch URL ──────────────────────────────────────────────────────

function FetchUrlRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const url = parsed.url || args?.url || "";
  const title = parsed.title || "";
  const content = parsed.content || parsed.text || parsed.markdown || "";


  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Globe size={13} />
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.searchLink}>
          {title || url}
        </a>

      </div>
      {content && (
        <pre className={styles.codeBlock}>
          <code>{content.length > 2000 ? content.slice(0, 2000) + "\n…" : content}</code>
        </pre>
      )}
    </div>
  );
}

// ── 9. Terminal (Shell/Python/JS) ─────────────────────────────────────

const PROMPT_PREFIXES = { bash: "$ ", python: ">>> ", javascript: "> " };
const CONTINUATION_PREFIXES = { python: "... ", javascript: ".. " };
const DEFAULT_CWD = { bash: "/tmp", python: "python3", javascript: "node" };

function formatInputPrompt(input, language, cwd) {
  if (!input) return "";
  const prompt = PROMPT_PREFIXES[language] || "$ ";
  const contPrompt = CONTINUATION_PREFIXES[language] || "  ";
  const lines = input.split("\n");
  const resolvedCwd = cwd || DEFAULT_CWD[language] || "";
  const pathPrefix = resolvedCwd ? `${resolvedCwd} ` : "";
  return lines.map((line, i) => `${i === 0 ? pathPrefix + prompt : contPrompt}${line}`).join("\n");
}

function TerminalRenderer({ result, args, streamingOutput, language }) {
  const preRef = useRef(null);
  const input = args?.command || args?.code || null;
  const cwd = args?.cwd || null;
  const isStreaming = !result;
  const output = streamingOutput || "";

  useEffect(() => {
    if (preRef.current) preRef.current.scrollTop = preRef.current.scrollHeight;
  }, [output]);

  // Parse final result for exit code
  const parsed = tryParse(result);
  const exitCode = parsed?.exitCode ?? parsed?.exit_code;
  const success = parsed?.success;
  const stdout = parsed?.stdout || parsed?.output || "";
  const stderr = parsed?.stderr || "";
  const parsedError = parsed?.error || "";
  const displayOutput = isStreaming
    ? output
    : (stdout || stderr || parsedError || output);

  const formattedInput = formatInputPrompt(input, language, cwd);

  if (!displayOutput && !formattedInput) return <RawResultToggle result={result} />;

  return (
    <div className={styles.terminalBlock}>
      <div className={styles.terminalHeader}>
        <Terminal size={11} />
        <span>{language || "terminal"}</span>
        {isStreaming && <span className={styles.terminalLive}>● live</span>}
        {exitCode != null && (
          <StatusBadge success={exitCode === 0} label={`exit ${exitCode}`} />
        )}
        {exitCode == null && success === false && (
          <StatusBadge success={false} label="error" />
        )}
      </div>
      <pre ref={preRef} className={styles.terminalBody}>
        {formattedInput && (
          <span className={styles.terminalInput}>{formattedInput}{"\n"}</span>
        )}
        {!isStreaming && !stdout && !stderr && parsedError && (
          <span className={styles.terminalError}>{parsedError}</span>
        )}
        {(stdout || stderr || (isStreaming && output)) && displayOutput}
        {isStreaming && <span className={styles.terminalCursor}>▊</span>}
      </pre>
    </div>
  );
}

// ── 10. Git Operations ────────────────────────────────────────────────

function GitStatusRenderer({ result }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const files = parsed.files || parsed.status || [];
  const branch = parsed.branch || "";
  const clean = parsed.clean || files.length === 0;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <GitBranch size={13} />
        <span className={styles.rendererTitle}>{branch || "git status"}</span>
        <StatusBadge success={clean} label={clean ? "Clean" : `${files.length} changed`} />
      </div>
      {!clean && (
        <div className={styles.dirList}>
          {files.slice(0, 30).map((f, i) => {
            const name = typeof f === "string" ? f : f.path || f.file || "";
            const status = typeof f === "object" ? (f.status || f.state || "") : "";
            return (
              <div key={i} className={styles.dirEntry}>
                {status && <span className={styles.gitStatus}>{status}</span>}
                <span>{name}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GitDiffRenderer({ result }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const diff = parsed.diff || parsed.output || (typeof result === "string" ? result : "");

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <GitBranch size={13} />
        <span className={styles.rendererTitle}>git diff</span>
      </div>
      {diff && (
        <pre className={styles.diffBlock}>
          <code>
            {diff.split("\n").slice(0, 80).map((line, i) => {
              let cls = "";
              if (line.startsWith("+") && !line.startsWith("+++")) cls = styles.diffAdded;
              else if (line.startsWith("-") && !line.startsWith("---")) cls = styles.diffRemoved;
              else if (line.startsWith("@@")) cls = styles.diffHunk;
              return <span key={i} className={cls}>{line}{"\n"}</span>;
            })}
          </code>
        </pre>
      )}
    </div>
  );
}

function GitLogRenderer({ result }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const commits = parsed.commits || parsed.log || [];

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <GitBranch size={13} />
        <span className={styles.rendererTitle}>{commits.length} commit{commits.length !== 1 ? "s" : ""}</span>
      </div>
      <div className={styles.gitLog}>
        {commits.slice(0, 15).map((c, i) => (
          <div key={i} className={styles.gitCommit}>
            <span className={styles.gitHash}>{(c.hash || c.sha || "").slice(0, 7)}</span>
            <span className={styles.gitMsg}>{c.message || c.subject || ""}</span>
            {c.author && <span className={styles.gitAuthor}>{c.author}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 11. File Delete / Move ────────────────────────────────────────────

function FileDeleteRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;
  const filePath = parsed.path || args?.path || "";
  const success = !parsed.error;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Trash2 size={13} />
        <PathPill path={filePath} />
        <StatusBadge success={success} label={success ? "Deleted" : "Failed"} />
      </div>
      {parsed.error && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

function FileMoveRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;
  const source = parsed.source || args?.source || "";
  const destination = parsed.destination || args?.destination || "";
  const success = !parsed.error;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <ArrowRight size={13} />
        <PathPill path={source} />
        <ArrowRight size={10} className={styles.moveArrow} />
        <PathPill path={destination} />
        <StatusBadge success={success} label={success ? "Moved" : "Failed"} />
      </div>
      {parsed.error && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

// ── 12. Browser Action ──────────────────────────────────────────────────────

const BROWSER_ACTION_LABELS = {
  navigate: "Navigate",
  screenshot: "Screenshot",
  click: "Click",
  type: "Type",
  scroll: "Scroll",
  evaluate: "Evaluate JS",
  get_content: "Get Content",
  get_elements: "Get Elements",
  wait: "Wait",
  close: "Close",
};

function BrowserActionRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const action = parsed.action || args?.action || "";
  const label = BROWSER_ACTION_LABELS[action] || action;
  const hasError = !!parsed.error;

  // Resolve screenshot ref (minio:// or base64 fallback)
  let screenshotSrc = null;
  if (parsed.screenshotRef) {
    screenshotSrc = PrismService.getFileUrl(parsed.screenshotRef);
  } else if (parsed.screenshot) {
    screenshotSrc = `data:${parsed.mimeType || "image/png"};base64,${parsed.screenshot}`;
  }

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Monitor size={13} />
        <span className={styles.rendererTitle}>{label}</span>
        {parsed.url && (
          <a href={parsed.url} target="_blank" rel="noopener noreferrer" className={styles.searchLink}>
            {parsed.title || parsed.url}
          </a>
        )}

        {hasError && <StatusBadge success={false} label="Error" />}

      </div>

      {hasError && <div className={styles.errorText}>{parsed.error}</div>}

      {screenshotSrc && (
        <div className={styles.browserScreenshot}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotSrc}
            alt={`Screenshot of ${parsed.url || "page"}`}
            className={styles.browserScreenshotImg}
          />
        </div>
      )}

      {parsed.content && (
        <pre className={styles.codeBlock}>
          <code>{parsed.content.length > 3000 ? parsed.content.slice(0, 3000) + "\n\u2026" : parsed.content}</code>
        </pre>
      )}

      {parsed.result !== undefined && action === "evaluate" && (
        <pre className={styles.codeBlock}>
          <code>{String(parsed.result)}</code>
        </pre>
      )}




      {action === "get_elements" && parsed.elements && (
        <div className={styles.dirList}>
          {parsed.elements.slice(0, 30).map((el, i) => (
            <div key={i} className={styles.dirEntry}>
              <code className={styles.inlineCode}>{el.selector}</code>

              {el.text && <span>{el.text}</span>}

            </div>
          ))}

        </div>
      )}
    </div>
  );
}

// ── 13. Coordinator Tools ───────────────────────────────────────────────────

const PHASE_LABELS = { starting: "Starting…", loading: "Loading…", processing: "Processing…", generating: "Generating…", thinking: "Thinking…" };
const PHASE_ICONS  = { starting: "⚡", loading: "📦", processing: "⚙️", generating: "✨", thinking: "🧠" };

/**
 * Mini status bar for an individual spawned worker agent.
 * Mirrors the main AgentComponent statusBarOverlay exactly.
 */
function WorkerStatusBar({ activity }) {
  if (!activity) return null;
  const { currentTool, toolCount = 0, iteration = 0, maxIterations, phase } = activity;
  const isToolActive = !!currentTool;
  const hasPhase = !!phase;
  const isGenPhase = phase === "generating";
  const isActive = isToolActive || hasPhase;
  const toolLabel = currentTool
    ? currentTool.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const statusLabel = isToolActive ? toolLabel : (PHASE_LABELS[phase] || null);
  const statusIcon = isToolActive ? null : (PHASE_ICONS[phase] || null);

  return (
    <div className={`${mlStyles.workerStatusBar}${isActive ? ` ${mlStyles.workerStatusBarActive}` : ""}`}>
      <RainbowCanvasComponent
        turbo={isToolActive || hasPhase}
        animate={!isActive}
        greyscale={isActive ? !isGenPhase : true}
        className={mlStyles.workerStatusBarCanvas}
      />
      <div className={mlStyles.workerStatusBarOverlay}>
        {isActive ? (
          <>
            <span className={mlStyles.workerStatusBarEmoji}>{statusIcon || "🔧"}</span>
            <span className={mlStyles.workerStatusBarMessage}>
              {statusLabel}
              {iteration > 0 && (
                <span className={mlStyles.workerStatusBarIter}>
                  Iteration {iteration}{maxIterations ? `/${maxIterations}` : ""}
                </span>
              )}
            </span>
            <span className={mlStyles.workerStatusBarPulse} />
          </>
        ) : (
          <>
            <Users size={10} className={mlStyles.workerStatusBarIcon} />
            <span className={mlStyles.workerStatusBarMessage}>
              {toolCount > 0 ? `${toolCount} tools used` : "Worker idle"}
              {iteration > 0 && (
                <span className={mlStyles.workerStatusBarIter}>
                  Iteration {iteration}{maxIterations ? `/${maxIterations}` : ""}
                </span>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function SpawnAgentRenderer({ result, args, workerToolActivity }) {
  const [resultExpanded, setResultExpanded] = useState(false);
  const parsed = tryParse(result);
  const description = args?.description || parsed?.description || "";

  // Resolve live worker activity — by agentId if result available,
  // otherwise by description match (for the "calling" state before
  // the blocking tool returns a result with the agent_id).
  let workerActivity = null;
  if (workerToolActivity) {
    const agentId = parsed?.agent_id;
    if (agentId) {
      workerActivity = workerToolActivity[agentId] || null;
    } else if (description) {
      // Match by description during the calling state
      const match = Object.values(workerToolActivity).find((v) => v.description === description);
      if (match) workerActivity = match;
    }
  }

  // ── Calling state: no result yet, worker is running ──
  if (!parsed) {
    return (
      <div className={styles.rendererBlock}>
        <div className={styles.rendererHeader}>
          <Users size={13} />
          <span className={styles.rendererTitle}>
            Spawned worker: <strong>{description}</strong>
          </span>
          <StatusBadge success={true} label="running" />
        </div>
        {workerActivity && (
          <WorkerStatusBar activity={workerActivity} />
        )}
      </div>
    );
  }

  // ── Done state: result available ──
  const hasError = !!parsed.error;
  const displayStatus = parsed.status || "unknown";
  const isTerminal = displayStatus === "completed" || displayStatus === "failed" || displayStatus === "stopped";
  const isCompleted = displayStatus === "completed";
  const isFailed = displayStatus === "failed";
  const statusSuccess = isTerminal ? isCompleted : !hasError;

  const durationLabel = parsed.durationMs
    ? formatLatency(Number(parsed.durationMs) / 1000)
    : null;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <Users size={13} />
        <span className={styles.rendererTitle}>
          Spawned worker: <strong>{description}</strong>
        </span>
        <StatusBadge success={statusSuccess} label={displayStatus} />
      </div>

      {hasError && <div className={styles.errorText}>{parsed.error}</div>}

      {/* Live status bar — shown while the worker is running */}
      {workerActivity && !isTerminal && (
        <WorkerStatusBar activity={workerActivity} />
      )}

      {/* Inline completion card — shown when the worker has finished */}
      {isTerminal && (
        <div className={styles.workerResultCard}>
          <button
            className={styles.workerResultToggle}
            onClick={() => setResultExpanded((v) => !v)}
          >
            <Zap size={12} />
            <span className={styles.workerResultSummary}>
              {parsed.summary || (isCompleted ? "Worker completed" : isFailed ? "Worker failed" : "Worker finished")}
            </span>
            {durationLabel && (
              <span className={styles.workerResultMeta}>{durationLabel}</span>
            )}
            {parsed.toolUses > 0 && (
              <span className={styles.workerResultMeta}>{parsed.toolUses} tools</span>
            )}
            {parsed.iterations > 0 && (
              <span className={styles.workerResultMeta}>{parsed.iterations} iteration{parsed.iterations !== 1 ? 's' : ''}</span>
            )}
            {resultExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {resultExpanded && parsed.result && (
            <div className={styles.workerResultBody}>
              <MarkdownContent content={parsed.result} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SendMessageRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const agentId = args?.to || parsed.agent_id || "";
  const status = parsed.status || "unknown";
  const hasError = !!parsed.error;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <MessageSquare size={13} />
        <span className={styles.rendererTitle}>
          Message → <code className={styles.inlineCode}>{agentId}</code>
        </span>
        <StatusBadge success={!hasError} label={status} />
      </div>

      {hasError && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

function StopAgentRenderer({ result, args }) {
  const parsed = tryParse(result);
  if (!parsed) return <RawResultToggle result={result} />;

  const agentId = args?.agent_id || parsed.agent_id || "";
  const hasError = !!parsed.error;

  return (
    <div className={styles.rendererBlock}>
      <div className={styles.rendererHeader}>
        <StopCircle size={13} />
        <span className={styles.rendererTitle}>
          Stopped: <code className={styles.inlineCode}>{agentId}</code>
        </span>
        <StatusBadge success={!hasError} label={hasError ? "Failed" : "Stopped"} />
      </div>
      {hasError && <div className={styles.errorText}>{parsed.error}</div>}
    </div>
  );
}

// ── 14. Generic Fallback ────────────────────────────────────────────────────

function GenericRenderer({ result }) {
  return <RawResultToggle result={result} />;
}

// ═══════════════════════════════════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════════════════════════════════

const TOOL_RESULT_REGISTRY = {
  // File operations
  read_file:        { Renderer: FileReadRenderer },
  write_file:       { Renderer: FileWriteRenderer },
  str_replace_file: { Renderer: StrReplaceRenderer },
  patch_file:       { Renderer: FileWriteRenderer },
  read_multi_file:  { Renderer: GenericRenderer },
  file_info:        { Renderer: GenericRenderer },
  file_diff:        { Renderer: GitDiffRenderer },     // reuses diff renderer
  move_file:        { Renderer: FileMoveRenderer },
  delete_file:      { Renderer: FileDeleteRenderer },

  // Search
  grep_search:      { Renderer: GrepSearchRenderer },
  glob_files:       { Renderer: GlobFilesRenderer },
  list_directory:   { Renderer: DirectoryListRenderer },

  // Web
  web_search:       { Renderer: WebSearchRenderer },
  fetch_url:        { Renderer: FetchUrlRenderer },

  // Execution
  execute_shell:      { Renderer: TerminalRenderer, language: "bash" },
  execute_python:     { Renderer: TerminalRenderer, language: "python" },
  execute_javascript: { Renderer: TerminalRenderer, language: "javascript" },

  // Git
  git_status:       { Renderer: GitStatusRenderer },
  git_diff:         { Renderer: GitDiffRenderer },
  git_log:          { Renderer: GitLogRenderer },

  // Project
  project_summary:  { Renderer: GenericRenderer },

  // Browser
  browser_action:   { Renderer: BrowserActionRenderer },

  // Coordinator
  spawn_agent:      { Renderer: SpawnAgentRenderer },
  send_message:     { Renderer: SendMessageRenderer },
  stop_agent:       { Renderer: StopAgentRenderer },
};

/**
 * Resolve the appropriate result renderer for a tool call.
 *
 * @param {string} toolName - Raw tool function name
 * @returns {{ Renderer: React.Component, language?: string }}
 */
export function resolveToolResultRenderer(toolName) {
  return TOOL_RESULT_REGISTRY[toolName] || { Renderer: GenericRenderer };
}

/**
 * Render a tool call's result using the registry.
 *
 * @param {object} props
 * @param {object} props.toolCall - The tool call object { name, args, result, id }
 * @param {string} [props.streamingOutput] - Live streaming output for compute tools
 * @param {object} [props.workerToolActivity] - Live worker activity map for spawn_agent
 */
export function ToolResultView({ toolCall, streamingOutput, workerToolActivity }) {
  const { Renderer, language } = resolveToolResultRenderer(toolCall.name);

  return (
    <>
      <InputArgsToggle args={toolCall.args} />
      <Renderer
        result={toolCall.result}
        args={toolCall.args}
        streamingOutput={streamingOutput}
        language={language}
        workerToolActivity={workerToolActivity}
      />
      <OutputResultToggle result={toolCall.result} />
    </>
  );
}
