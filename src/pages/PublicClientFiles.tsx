import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, AlertCircle, ExternalLink, ArrowLeft, Table2,
  FileText, Presentation, FileSpreadsheet, File as FileIcon, Link2,
  ChevronDown, ChevronUp, Maximize2,
} from "lucide-react";

interface EmbedItem {
  id: string;
  title: string;
  description: string | null;
  url: string;
  embed_type: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType }> = {
  sheet: { label: "Sheets", icon: FileSpreadsheet },
  doc: { label: "Docs", icon: FileText },
  slide: { label: "Slides", icon: Presentation },
  form: { label: "Form", icon: FileText },
  pdf: { label: "PDF", icon: FileIcon },
  link: { label: "Link", icon: Link2 },
  other: { label: "File", icon: FileIcon },
};

/** Convert common share URLs into embeddable preview URLs. Returns null when not embeddable. */
export function toEmbedUrl(raw: string): string | null {
  const url = (raw || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;

  // Google Docs family: /d/{id}/... -> /preview (docs/slides) or /pubhtml-ish preview for sheets
  const gdocs = url.match(
    /^https?:\/\/docs\.google\.com\/(spreadsheets|document|presentation|forms)\/d\/(?:e\/)?([^/?#]+)/i
  );
  if (gdocs) {
    const [, kind] = gdocs;
    const base = url.split(/\/(edit|view|preview|pubhtml|viewform)/i)[0];
    if (kind === "forms") return `${base}/viewform?embedded=true`;
    if (kind === "spreadsheets") return `${base}/preview?widget=true&headers=false`;
    return `${base}/preview`;
  }

  // Google Drive files
  const gdrive = url.match(/^https?:\/\/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  if (gdrive) return `https://drive.google.com/file/d/${gdrive[1]}/preview`;

  // Already-published Google links
  if (/docs\.google\.com\/.+\/pub/i.test(url)) return url;

  // Direct PDFs
  if (/\.pdf($|\?)/i.test(url)) return url;

  // Airtable / Notion / Canva / Figma embeds
  if (/airtable\.com\/(embed|shr)/i.test(url)) return url;
  if (/canva\.com\/design\/.+\/(view|watch)/i.test(url)) return url.replace(/\?.*$/, "") + "?embed";

  return null;
}

export default function PublicClientFiles() {
  const params = useParams();
  const navigate = useNavigate();
  const slug = params.clientSlug || params.slug || "";
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-client-files", slug],
    queryFn: async () => {
      const { data: client, error: cErr } = await supabase
        .from("clients")
        .select("id, name, company, dashboard_slug, client_logo")
        .eq("dashboard_slug", slug)
        .eq("status", "active")
        .maybeSingle();
      if (cErr) throw cErr;
      if (!client) throw new Error("Client tidak ditemukan");

      const { data: embeds, error: eErr } = await supabase
        .from("client_embeds")
        .select("id, title, description, url, embed_type")
        .eq("client_id", client.id)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (eErr) throw eErr;

      return { client, embeds: (embeds || []) as EmbedItem[] };
    },
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <p className="text-muted-foreground text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[100dvh] hub-gradient flex items-center justify-center px-4">
        <div className="text-center hub-card p-8 rounded-3xl max-w-sm w-full">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-7 w-7 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Tidak Ditemukan</h1>
          <p className="text-sm text-muted-foreground">Link tidak valid atau client sudah tidak aktif.</p>
        </div>
      </div>
    );
  }

  const { client, embeds } = data;

  return (
    <div className="min-h-[100dvh] hub-gradient">
      <header className="container mx-auto px-4 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/hub/${client.dashboard_slug}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="w-11 h-11 rounded-2xl overflow-hidden hub-logo-container flex items-center justify-center shrink-0">
            {client.client_logo ? (
              <img src={client.client_logo} alt={`${client.name} logo`} className="w-full h-full object-contain p-1" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
                <span className="text-lg font-bold text-primary-foreground">
                  {client.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold truncate">File / Sheets</h1>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{client.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 pb-10 space-y-4">
        {embeds.length === 0 ? (
          <div className="hub-card rounded-2xl border border-dashed border-border/50 p-10 text-center">
            <Table2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-base font-medium text-muted-foreground">Belum ada file atau sheets</p>
          </div>
        ) : (
          embeds.map((item) => {
            const meta = TYPE_META[item.embed_type] || TYPE_META.other;
            const Icon = meta.icon;
            const embedUrl = toEmbedUrl(item.url);
            const isOpen = expanded[item.id] ?? true;

            return (
              <section key={item.id} className="hub-card rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-sm sm:text-base truncate">{item.title}</h2>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">{meta.label}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Buka Link
                    </a>
                  </Button>
                  {embedUrl && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded((p) => ({ ...p, [item.id]: !isOpen }))}
                      >
                        {isOpen ? (
                          <><ChevronUp className="h-3.5 w-3.5 mr-1.5" /> Sembunyikan</>
                        ) : (
                          <><ChevronDown className="h-3.5 w-3.5 mr-1.5" /> Baca di sini</>
                        )}
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <a href={embedUrl} target="_blank" rel="noreferrer">
                          <Maximize2 className="h-3.5 w-3.5 mr-1.5" /> Layar Penuh
                        </a>
                      </Button>
                    </>
                  )}
                </div>

                {embedUrl && isOpen && (
                  <div className="rounded-xl overflow-hidden border border-border/60 bg-background">
                    <iframe
                      src={embedUrl}
                      title={item.title}
                      loading="lazy"
                      className="w-full h-[60vh] min-h-[420px]"
                      allow="fullscreen"
                    />
                  </div>
                )}
              </section>
            );
          })
        )}

        <div className="pt-4 pb-2 text-center">
          <p className="text-[11px] text-muted-foreground/50 font-medium tracking-wide">
            Powered by Talco Management System
          </p>
        </div>
      </main>
    </div>
  );
}
