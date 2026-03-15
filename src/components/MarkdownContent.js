"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import styles from "./MarkdownContent.module.css";

function FencedCodeBlock({ language, children }) {
  const codeString = String(children).replace(/\n$/, "");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let displayLabel = language;
  let syntaxLang = language;
  if (language.startsWith("exec-")) {
    syntaxLang = language.replace("exec-", "");
    displayLabel = `${syntaxLang.toUpperCase()} — EXECUTABLE CODE`;
  } else if (language.startsWith("execresult-")) {
    syntaxLang = language.replace("execresult-", "") || "text";
    displayLabel = `${(syntaxLang || "PYTHON").toUpperCase()} — CODE EXECUTION RESULT`;
  }

  return (
    <div className={styles.codeBlockWrapper}>
      <div className={styles.codeBlockHeader}>
        <span className={styles.codeBlockLang}>{displayLabel}</span>
        <button className={styles.codeBlockCopy} onClick={handleCopy}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={syntaxLang}
        PreTag="div"
        customStyle={{
          margin: 0,
          borderRadius: "0 0 8px 8px",
          fontSize: "13px",
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
}

function CodeBlock({ children, className, ...rest }) {
  const match = /language-(\w+)/.exec(className || "");
  if (!match) {
    return (
      <code className={`${styles.inlineCode} ${className || ""}`} {...rest}>
        {children}
      </code>
    );
  }
  return <FencedCodeBlock language={match[1]}>{children}</FencedCodeBlock>;
}

export default function MarkdownContent({ content, className }) {
  if (!content) return null;
  return (
    <div className={`${styles.text} ${className || ""}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ code: CodeBlock }}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
