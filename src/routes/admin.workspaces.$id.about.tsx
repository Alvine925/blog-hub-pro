import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  Globe, Building2, Users, Mic2, Tag, BookOpen, Layers,
  ExternalLink, MapPin, BarChart2, Lightbulb, ChevronRight,
  Twitter, Linkedin, Instagram, Facebook, Package, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Server fn ─────────────────────────────────────────────────────────────────
const getAboutData = createServerFn({ method: "GET" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getAdminClient } = await import("@/lib/supabase.server");
    const db = getAdminClient() as any;

    const [wsRes, compRes, kwRes, oppRes] = await Promise.all([
      db.from("workspaces").select("*").eq("id", data.id).single(),
      db.from("workspace_competitors").select("*").eq("workspace_id", data.id),
      db.from("workspace_keywords").select("*").eq("workspace_id", data.id),
      db.from("workspace_content_opportunities")
        .select("*").eq("workspace_id", data.id).order("priority", { ascending: true }),
    ]);

    return {
      workspace:     wsRes.data    ?? null,
      competitors:   compRes.data  ?? [],
      keywords:      kwRes.data    ?? [],
      opportunities: oppRes.data   ?? [],
    };
  });

const aboutQuery = (id: string) =>
  queryOptions({
    queryKey: ["workspace-about", id],
    queryFn:  () => getAboutData({ data: { id } }),
  });

export const Route = createFileRoute("/admin/workspaces/$id/about")({
  loader:         ({ context, params }) => context.queryClient.ensureQueryData(aboutQuery(params.id)),
  component:      WorkspaceAbout,
  errorComponent: ({ error }) => <p className="p-8 text-sm text-red-600">{error.message}</p>,
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRIORITY_CFG: Record<string, { label: string; class: string }> = {
  high:   { label: "High",   class: "text-red-600"   },
  medium: { label: "Medium", class: "text-amber-600" },
  low:    { label: "Low",    class: "text-gray-400"  },
};

function SectionHeading({ icon: Icon, title }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-border/60">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function WorkspaceAbout() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(aboutQuery(id));
  const { workspace, competitors, keywords, opportunities } = data as any;

  if (!workspace) return <p className="p-8 text-sm text-muted-foreground">Workspace not found.</p>;

  const ai = workspace.ai_context ?? {};
  const logoUrl: string | null = ai.logoUrl ?? null;
  const siteImages: string[] = ai.siteImages ?? [];
  const services: string[] = ai.services ?? [];
  const products: string[] = ai.products ?? [];
  const categories: string[] = ai.suggestedCategories ?? [];
  const tags: string[] = ai.suggestedTags ?? [];
  const primaryTopics: string[] = ai.primaryTopics ?? [];
  const contentPillars: string[] = workspace.content_pillars ?? [];
  const socialLinks: Record<string, string> = workspace.social_links ?? {};

  // Derive favicon from website_url as reliable fallback
  const faviconUrl = workspace.website_url
    ? `https://www.google.com/s2/favicons?domain=${new URL(workspace.website_url).hostname}&sz=128`
    : null;
  const iconSrc = logoUrl || faviconUrl;

  const allKeywords: string[] = keywords.map((k: any) => k.keyword);

  const socialIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    twitter: Twitter,
    linkedin: Linkedin,
    instagram: Instagram,
    facebook: Facebook,
  };

  return (
    <div className="min-h-full px-4 py-4 sm:px-8 sm:py-8 space-y-12 max-w-4xl">

      {/* ── Identity hero ── */}
      <div className="flex items-start gap-5">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={workspace.name}
            className="h-16 w-16 rounded-xl object-contain bg-muted p-1 shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{workspace.name}</h1>
          {workspace.website_url && (
            <a
              href={workspace.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              {workspace.website_url.replace(/^https?:\/\//, "")}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {workspace.description && (
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-2xl">
              {workspace.description}
            </p>
          )}
        </div>
      </div>

      {/* ── Site images ── */}
      {siteImages.length > 0 && (
        <div className="space-y-4">
          <SectionHeading icon={Globe} title="Site Images" />
          <div className="grid grid-cols-3 gap-3">
            {siteImages.map((src: string, i: number) => (
              <img
                key={i}
                src={src}
                alt={`Site image ${i + 1}`}
                className="aspect-video w-full rounded-lg object-cover bg-muted"
                onError={(e) => { (e.target as HTMLImageElement).closest("div")!.style.display = "none"; }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Brand details ── */}
      <div className="space-y-4">
        <SectionHeading icon={Building2} title="Brand Details" />
        <div className="grid grid-cols-2 gap-x-10 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
          <MetaItem label="Industry"        value={workspace.industry} />
          <MetaItem label="Business Model"  value={workspace.business_model} />
          <MetaItem label="Brand Voice"     value={workspace.brand_voice} />
          <MetaItem label="Target Audience" value={workspace.target_audience} />
          <MetaItem label="Location"        value={workspace.location} />
          <MetaItem label="Language"        value={workspace.language} />
        </div>
        {ai.brandSummary && (
          <div className="mt-4 pt-4 border-t border-border/60">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50 mb-2">Brand Summary</p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">{ai.brandSummary}</p>
          </div>
        )}
      </div>

      {/* ── Social links ── */}
      {Object.values(socialLinks).some(Boolean) && (
        <div className="space-y-4">
          <SectionHeading icon={Globe} title="Social Links" />
          <div className="flex flex-wrap gap-4">
            {Object.entries(socialLinks).map(([platform, url]) => {
              if (!url) return null;
              const Icon = socialIcons[platform];
              return (
                <a
                  key={platform}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="capitalize">{platform}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Services & Products ── */}
      {(services.length > 0 || products.length > 0) && (
        <div className="grid gap-10 sm:grid-cols-2">
          {services.length > 0 && (
            <div className="space-y-4">
              <SectionHeading icon={Wrench} title="Services" />
              <ul className="space-y-2">
                {services.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {products.length > 0 && (
            <div className="space-y-4">
              <SectionHeading icon={Package} title="Products" />
              <ul className="space-y-2">
                {products.map((p: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── Content strategy ── */}
      {(contentPillars.length > 0 || categories.length > 0 || primaryTopics.length > 0) && (
        <div className="space-y-8">
          {contentPillars.length > 0 && (
            <div className="space-y-4">
              <SectionHeading icon={BookOpen} title="Content Pillars" />
              <div className="flex flex-wrap gap-3">
                {contentPillars.map((p: string, i: number) => (
                  <span key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="font-medium">{p}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {(primaryTopics.length > 0 || categories.length > 0 || tags.length > 0) && (
            <div className="space-y-4">
              <SectionHeading icon={Tag} title="Topics & Categories" />
              <div className="space-y-4">
                {primaryTopics.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Primary Topics</p>
                    <div className="flex flex-wrap gap-1.5">
                      {primaryTopics.map((t: string, i: number) => (
                        <span key={i} className="text-[11px] font-medium text-primary bg-primary/8 rounded-full px-2.5 py-1">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {categories.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Categories</p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((c: string, i: number) => (
                        <span key={i} className="text-[11px] text-foreground bg-muted rounded-full px-2.5 py-1">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                {tags.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Suggested Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((t: string, i: number) => (
                        <span key={i} className="text-[11px] text-violet-700 bg-violet-50 rounded-full px-2.5 py-1">#{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {allKeywords.length > 0 && (
            <div className="space-y-4">
              <SectionHeading icon={Tag} title="Keywords" />
              <div className="flex flex-wrap gap-1.5">
                {allKeywords.map((kw: string, i: number) => (
                  <span key={i} className="text-[11px] text-foreground bg-muted rounded-full px-2.5 py-1">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Competitors ── */}
      {competitors.length > 0 && (
        <div className="space-y-4">
          <SectionHeading icon={BarChart2} title="Competitors" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {competitors.map((c: any) => (
              <div key={c.id}>
                <div className="flex items-start gap-2">
                  {c.website && (
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${c.website.replace(/^https?:\/\//, "").split("/")[0]}&sz=32`}
                      alt={c.name}
                      className="h-5 w-5 rounded mt-0.5 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{c.name}</p>
                    {c.website && (
                      <a
                        href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                      >
                        {c.website.replace(/^https?:\/\//, "")}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
                {c.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{c.description}</p>
                )}
                {(c.strengths?.length > 0 || c.weaknesses?.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.strengths?.slice(0, 2).map((s: string, i: number) => (
                      <span key={i} className="text-[11px] text-emerald-700 bg-emerald-50 rounded-full px-2 py-0.5">↑ {s}</span>
                    ))}
                    {c.weaknesses?.slice(0, 1).map((w: string, i: number) => (
                      <span key={i} className="text-[11px] text-red-600 bg-red-50 rounded-full px-2 py-0.5">↓ {w}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Content Opportunities ── */}
      {opportunities.length > 0 && (
        <div className="space-y-4">
          <SectionHeading icon={Lightbulb} title="Content Opportunities" />
          <div className="divide-y divide-border/60">
            {opportunities.map((opp: any) => {
              const pcfg = PRIORITY_CFG[opp.priority] ?? PRIORITY_CFG.medium;
              return (
                <div key={opp.id} className="py-3">
                  <div className="flex items-start gap-2">
                    <p className="text-sm font-semibold flex-1 leading-snug">{opp.title}</p>
                    <span className={cn("text-[11px] font-medium shrink-0", pcfg.class)}>{pcfg.label}</span>
                  </div>
                  {opp.topic && (
                    <p className="mt-0.5 text-[11px] text-primary font-medium">{opp.type} · {opp.topic}</p>
                  )}
                  {opp.reason && (
                    <p className="mt-1 text-[11px] text-muted-foreground">{opp.reason}</p>
                  )}
                  <Link
                    to="/admin/blogs/new"
                    className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    Write this post <ChevronRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Selected content types ── */}
      {(workspace.selected_collections ?? []).length > 0 && (
        <div className="space-y-4">
          <SectionHeading icon={Layers} title="Content Types" />
          <div className="flex flex-wrap gap-2">
            {workspace.selected_collections.map((c: string, i: number) => (
              <span key={i} className="capitalize text-sm text-foreground bg-muted rounded-full px-3 py-1">
                {c.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
