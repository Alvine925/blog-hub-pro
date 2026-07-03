/**
 * AiAssistant — AI chatbot for the Lunar CMS admin dashboard.
 *
 * Features:
 *  • Chat with the Lunar CMS assistant
 *  • Quick-action chips with navigation support (task mode)
 *  • Markdown rendering (bold, code, lists, code blocks)
 *  • Inline navigate links parsed from AI responses
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles, Send, RotateCcw, Copy, CheckCheck,
  Code2, BookOpen, Zap, Key, MessageSquare, Globe,
  PenLine, BarChart2, ChevronDown, ChevronUp, ExternalLink, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { askAssistant } from "@/lib/ai-assistant.functions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role:      "user" | "assistant";
  content:   string;
  pending?:  boolean;
}

type ActionCategory = "create" | "go" | "learn";

interface QuickAction {
  icon:      React.ComponentType<{ className?: string }>;
  label:     string;
  prompt:    string;
  navigate?: string;
  category:  ActionCategory;
}

// ── Quick actions ─────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  {
    icon:     PenLine,
    label:    "Write a blog post",
    prompt:   "Help me write a compelling blog post. Suggest an engaging title and a full outline with section headers I can use as a starting point. Ask me about the topic if you need more context.",
    navigate: "/admin/blogs/new",
    category: "create",
  },
  {
    icon:     Zap,
    label:    "Vibe code my blog",
    prompt:   "Generate a detailed vibe coding prompt I can paste into Lovable, Cursor, or v0 to build a full blog frontend powered by Lunar CMS. Include the API base URL placeholder, all necessary endpoints, TypeScript types, error handling, and full UI requirements.",
    category: "create",
  },
  {
    icon:     BarChart2,
    label:    "Open Analytics",
    prompt:   "I'm opening my analytics dashboard. What are the most important content metrics I should track, and how should I interpret them to grow my blog traffic?",
    navigate: "/admin/analytics",
    category: "go",
  },
  {
    icon:     Key,
    label:    "Manage API Keys",
    prompt:   "I'm going to my API keys page. Explain the difference between publishable (pk_live_) and secret (sk_live_) keys in Lunar CMS, and how to use each one securely.",
    navigate: "/admin/api-keys",
    category: "go",
  },
  {
    icon:     MessageSquare,
    label:    "Review Comments",
    prompt:   "I'm heading to the comments moderation panel. What's the best strategy for moderating blog comments — what should I approve, reject, or mark as spam?",
    navigate: "/admin/comments",
    category: "go",
  },
  {
    icon:     Globe,
    label:    "Next.js guide",
    prompt:   "Generate a complete Next.js App Router integration guide for Lunar CMS. Include fetching blog posts, displaying them with TypeScript types, error handling, loading states, and ISR/SSG configuration. Use my publishable API key format.",
    category: "learn",
  },
  {
    icon:     Code2,
    label:    "Show API endpoints",
    prompt:   "List all available Lunar CMS REST API endpoints with example curl commands for each one. Include the blogs, engagement, content-router, and cache-invalidation endpoints.",
    category: "learn",
  },
  {
    icon:     BookOpen,
    label:    "Engagement API",
    prompt:   "Show me how to add likes, comments, and view tracking to my blog using the Lunar CMS engagement API. Include complete React components with TypeScript and error handling.",
    category: "learn",
  },
];

const CATEGORY_META: Record<ActionCategory, { label: string; color: string; dot: string }> = {
  create: { label: "Create",  color: "text-violet-700", dot: "bg-violet-500" },
  go:     { label: "Go to",   color: "text-blue-700",   dot: "bg-blue-500"   },
  learn:  { label: "Learn",   color: "text-amber-700",  dot: "bg-amber-500"  },
};

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderMarkdown(text: string, onNavigate?: (p: string) => void): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(<CodeBlock key={i} lang={lang} code={codeLines.join("\n")} />);
      i++;
      continue;
    }

    if (/^#{1,3}\s/.test(line)) {
      const level   = (line.match(/^#+/)![0] ?? "").length;
      const content = line.replace(/^#+\s/, "");
      const cls = level === 1
        ? "mt-4 text-base font-bold text-foreground"
        : level === 2 ? "mt-3 text-sm font-semibold text-foreground"
        : "mt-2 text-sm font-medium text-foreground";
      nodes.push(<p key={i} className={cls}>{inlineFormat(content)}</p>);
      i++;
      continue;
    }

    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s/, ""));
        i++;
      }
      nodes.push(
        <ul key={i} className="my-2 space-y-1 pl-4">
          {items.map((it, j) => <li key={j} className="text-sm list-disc">{inlineFormat(it)}</li>)}
        </ul>,
      );
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      nodes.push(
        <ol key={i} className="my-2 space-y-1 pl-4">
          {items.map((it, j) => <li key={j} className="text-sm list-decimal">{inlineFormat(it)}</li>)}
        </ol>,
      );
      continue;
    }

    // Navigate action tag: [→ Open: /path]
    const navMatch = line.match(/^\[→\s*Open:\s*([^\]]+)\]$/);
    if (navMatch && onNavigate) {
      const path = navMatch[1].trim();
      nodes.push(
        <button
          key={i}
          type="button"
          onClick={() => onNavigate(path)}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Open {path}
        </button>,
      );
      i++;
      continue;
    }

    if (!line.trim()) { i++; continue; }

    nodes.push(<p key={i} className="text-sm leading-relaxed">{inlineFormat(line)}</p>);
    i++;
  }

  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
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

function Bubble({ msg, onNavigate }: { msg: Message; onNavigate?: (p: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div className={cn(
        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
        isUser ? "bg-primary text-primary-foreground" : "bg-violet-100 text-violet-700",
      )}>
        {isUser ? "Y" : <Sparkles className="h-3 w-3" />}
      </div>

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
          <div className="space-y-1">{renderMarkdown(msg.content, onNavigate)}</div>
        )}
      </div>
    </div>
  );
}

// ── Quick actions panel ───────────────────────────────────────────────────────

function QuickActionsPanel({
  onAction, loading, collapsed, onToggle,
}: {
  onAction:  (qa: QuickAction) => void;
  loading:   boolean;
  collapsed: boolean;
  onToggle:  () => void;
}) {
  const categories: ActionCategory[] = ["create", "go", "learn"];

  return (
    <div className="shrink-0 border-t border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-violet-500" />
          Quick Actions
        </span>
        {collapsed
          ? <ChevronDown className="h-3 w-3" />
          : <ChevronUp className="h-3 w-3" />}
      </button>

      {!collapsed && (
        <div className="pb-3 space-y-3">
          {categories.map((cat) => {
            const meta    = CATEGORY_META[cat];
            const actions = QUICK_ACTIONS.filter((a) => a.category === cat);
            return (
              <div key={cat}>
                <p className={cn("mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest", meta.color)}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {actions.map((qa) => (
                    <button
                      key={qa.label}
                      type="button"
                      onClick={() => onAction(qa)}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground transition-all disabled:opacity-50"
                    >
                      <qa.icon className="h-3 w-3 shrink-0" />
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AiAssistantProps {
  workspaceContext?: string;
  onNavigate?:       (path: string) => void;
  onClose?:          () => void;
  compact?:          boolean;
}

export function AiAssistant({ workspaceContext, onNavigate, onClose, compact }: AiAssistantProps) {
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState("");
  const [loading,        setLoading]        = useState(false);
  const [chipsCollapsed, setChipsCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const doAsk     = useServerFn(askAssistant);

  useEffect(() => {
    setMessages([{
      role:    "assistant",
      content: "Hi! I'm the Lunar CMS Assistant. I can help you write content, navigate the dashboard, generate integration guides, and answer any questions about the platform.\n\nPick a quick action below or just ask me anything.",
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg:    Message = { role: "user",      content: trimmed };
    const pendingMsg: Message = { role: "assistant", content: "", pending: true };

    setMessages((prev) => [...prev, userMsg, pendingMsg]);
    setInput("");
    setLoading(true);
    setChipsCollapsed(true);

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

  const handleQuickAction = useCallback((qa: QuickAction) => {
    if (qa.navigate && onNavigate) onNavigate(qa.navigate);
    send(qa.prompt);
  }, [send, onNavigate]);

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  }

  function reset() {
    setMessages([{ role: "assistant", content: "Chat cleared. How can I help you?" }]);
    setInput("");
    setChipsCollapsed(false);
    inputRef.current?.focus();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-100">
            <Sparkles className="h-3.5 w-3.5 text-violet-600" />
          </div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI Assistant
          </h2>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 border border-violet-100">
            Beta
          </span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={reset}
              title="Clear chat"
              className="flex items-center gap-1 rounded p-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              {!compact && "Clear"}
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex items-center justify-center rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="mt-3 flex-1 overflow-y-auto space-y-4 min-h-0 pr-0.5">
        {messages.map((msg, i) => (
          <Bubble key={i} msg={msg} onNavigate={onNavigate} />
        ))}
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
            placeholder="Ask anything or describe a task…"
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
        <p className="mt-1 text-[10px] text-muted-foreground/50 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      {/* Quick actions — always present, collapsible */}
      <QuickActionsPanel
        onAction={handleQuickAction}
        loading={loading}
        collapsed={chipsCollapsed}
        onToggle={() => setChipsCollapsed((v) => !v)}
      />
    </div>
  );
}
