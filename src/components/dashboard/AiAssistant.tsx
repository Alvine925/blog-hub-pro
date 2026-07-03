/**
 * AiAssistant — AI chatbot for the Lunar CMS admin dashboard.
 *
 * Features:
 *  • Chat with the Lunar CMS assistant
 *  • Quick-action buttons that pre-fill or auto-submit prompts
 *  • Markdown rendering (bold, code, lists, code blocks)
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles, Send, RotateCcw, Copy, CheckCheck,
  Code2, BookOpen, Zap, Key, MessageSquare, Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { askAssistant } from "@/lib/ai-assistant.functions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role:      "user" | "assistant";
  content:   string;
  pending?:  boolean;
}

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    icon: Globe,
    label: "Next.js integration",
    prompt: "Generate a complete Next.js App Router integration guide for Lunar CMS. Include fetching blog posts, displaying them with TypeScript types, error handling, and loading states. Use my publishable API key.",
  },
  {
    icon: Zap,
    label: "Vibe coding prompt",
    prompt: "Generate a detailed vibe coding prompt I can paste into Lovable, Cursor, or v0 to build a full blog frontend powered by Lunar CMS. Include the API base URL placeholder, auth setup, all necessary endpoints, and full UI requirements.",
  },
  {
    icon: Code2,
    label: "Show API endpoints",
    prompt: "List all available Lunar CMS API endpoints with example curl commands for each one. Include the blogs, engagement, and content endpoints.",
  },
  {
    icon: Key,
    label: "API key setup",
    prompt: "Explain how API keys work in Lunar CMS. What's the difference between publishable and secret keys? How do I create them and use them securely in my frontend and backend?",
  },
  {
    icon: MessageSquare,
    label: "Add likes & comments",
    prompt: "Show me how to add likes, comments, and view tracking to my blog using the Lunar CMS engagement API. Include React components with TypeScript.",
  },
  {
    icon: BookOpen,
    label: "Content types guide",
    prompt: "What content types does Lunar CMS support? Show me how to fetch and display Blog Posts, Articles, News, Products, and FAQs using the REST API.",
  },
];

// ── Simple markdown renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <CodeBlock key={i} lang={lang} code={codeLines.join("\n")} />,
      );
      i++;
      continue;
    }

    // Heading
    if (/^#{1,3}\s/.test(line)) {
      const level  = (line.match(/^#+/)![0] || "").length;
      const content = line.replace(/^#+\s/, "");
      const cls = level === 1
        ? "mt-4 text-base font-bold text-foreground"
        : level === 2
        ? "mt-3 text-sm font-semibold text-foreground"
        : "mt-2 text-sm font-medium text-foreground";
      nodes.push(<p key={i} className={cls}>{inlineFormat(content)}</p>);
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 space-y-1 pl-4">
          {items.map((it, j) => (
            <li key={j} className="text-sm list-disc">{inlineFormat(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2 space-y-1 pl-4">
          {items.map((it, j) => (
            <li key={j} className="text-sm list-decimal">{inlineFormat(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Normal paragraph
    nodes.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  // Bold **text** and inline `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^`[^`]+`$/.test(part))
      return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between bg-muted px-3 py-1.5">
        <span className="font-mono text-[10px] text-muted-foreground">{lang || "code"}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCheck className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-zinc-950 px-4 py-3 text-[11px] font-mono leading-5 text-zinc-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        isUser ? "bg-primary text-primary-foreground" : "bg-violet-100 text-violet-700",
      )}>
        {isUser ? "Y" : <Sparkles className="h-3 w-3" />}
      </div>

      {/* Content */}
      <div className={cn(
        "max-w-[85%] rounded-2xl px-3.5 py-2.5",
        isUser
          ? "rounded-tr-sm bg-primary text-primary-foreground"
          : "rounded-tl-sm bg-muted text-foreground",
      )}>
        {msg.pending ? (
          <div className="flex gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60"
                style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        ) : isUser ? (
          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
        ) : (
          <div className="space-y-1">{renderMarkdown(msg.content)}</div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AiAssistantProps {
  /** Optional workspace context passed to the AI */
  workspaceContext?: string;
}

export function AiAssistant({ workspaceContext }: AiAssistantProps) {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const doAsk     = useServerFn(askAssistant);

  // Welcome message
  useEffect(() => {
    setMessages([{
      role:    "assistant",
      content: "Hi! I'm the Lunar CMS Assistant. I can help you integrate the CMS into your site, generate guides, write vibe-coding prompts for AI tools like Lovable or Cursor, and answer any questions about the platform.\n\nTry one of the quick actions below, or just ask me anything.",
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const pendingMsg: Message = { role: "assistant", content: "", pending: true };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setLoading(true);

    try {
      const history = [...messages, userMsg].filter((m) => !m.pending).map((m) => ({
        role:    m.role,
        content: m.content,
      }));
      const { reply } = await doAsk({
        data: { messages: history, context: workspaceContext },
      });
      setMessages((prev) => [
        ...prev.filter((m) => !m.pending),
        { role: "assistant", content: reply },
      ]);
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !m.pending));
      toast.error(err instanceof Error ? err.message : "AI assistant unavailable");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [messages, loading, doAsk, workspaceContext]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  function reset() {
    setMessages([{
      role:    "assistant",
      content: "Chat cleared. How can I help you?",
    }]);
    setInput("");
    inputRef.current?.focus();
  }

  const hasOnlyWelcome = messages.length === 1;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 mb-0 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI Assistant
          </h2>
          <span className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700">
            Beta
          </span>
        </div>
        {!hasOnlyWelcome && (
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors p-1"
            title="Clear chat"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        )}
      </div>

      {/* Quick actions */}
      {hasOnlyWelcome && (
        <div className="mt-3 grid grid-cols-2 gap-1.5 shrink-0">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa.label}
              type="button"
              onClick={() => send(qa.prompt)}
              disabled={loading}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
            >
              <qa.icon className="h-3.5 w-3.5 shrink-0 text-violet-500" />
              <span className="leading-tight">{qa.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-4 min-h-0 pr-0.5">
        {messages.map((msg, i) => <Bubble key={i} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background focus-within:ring-2 focus-within:ring-ring px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about Lunar CMS…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none disabled:opacity-50"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className={cn(
              "mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all",
              input.trim() && !loading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground/60 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
