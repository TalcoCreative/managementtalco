// Scrape a public content URL using Firecrawl, parse metrics heuristically,
// persist a new snapshot row, and update the latest metrics on published_contents.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

interface ParsedMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  thumbnail?: string;
  caption?: string;
  title?: string;
}

function parseNumber(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const s = raw.replace(/,/g, "").trim().toLowerCase();
  const m = s.match(/^([\d.]+)\s*(k|m|b|rb|jt)?$/);
  if (!m) {
    const n = parseInt(s.replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : undefined;
  }
  const num = parseFloat(m[1]);
  const unit = m[2];
  const mult = unit === "k" || unit === "rb" ? 1_000 :
               unit === "m" || unit === "jt" ? 1_000_000 :
               unit === "b" ? 1_000_000_000 : 1;
  return Math.round(num * mult);
}

function extractMetrics(markdown: string, metadata: any, platform: string): ParsedMetrics {
  const out: ParsedMetrics = {};
  const md = markdown || "";

  // Description / OG fallbacks
  if (metadata?.ogImage) out.thumbnail = metadata.ogImage;
  if (metadata?.["og:image"]) out.thumbnail ||= metadata["og:image"];
  if (metadata?.title) out.title = String(metadata.title).slice(0, 200);
  if (metadata?.description) out.caption = String(metadata.description).slice(0, 500);

  // Pattern matchers (covers IG/TikTok/YT/FB/LinkedIn/X — best-effort)
  const patterns: Array<[keyof ParsedMetrics, RegExp[]]> = [
    ["likes", [
      /([\d.,]+\s*[kKmMbB]?)\s*(?:likes|like|suka|❤)/i,
      /"(?:likeCount|edge_liked_by)"\s*[:=]\s*"?([\d.,kKmMbB]+)/,
    ]],
    ["comments", [
      /([\d.,]+\s*[kKmMbB]?)\s*(?:comments|comment|komentar)/i,
      /"(?:commentCount|edge_media_to_comment)"\s*[:=]\s*"?([\d.,kKmMbB]+)/,
    ]],
    ["views", [
      /([\d.,]+\s*[kKmMbB]?)\s*(?:views|view|ditonton|plays|play)/i,
      /"(?:viewCount|playCount|video_view_count)"\s*[:=]\s*"?([\d.,kKmMbB]+)/,
    ]],
    ["shares", [
      /([\d.,]+\s*[kKmMbB]?)\s*(?:shares|share|bagikan)/i,
      /"shareCount"\s*[:=]\s*"?([\d.,kKmMbB]+)/,
    ]],
  ];

  for (const [key, regs] of patterns) {
    for (const r of regs) {
      const m = md.match(r);
      if (m?.[1]) {
        const n = parseNumber(m[1]);
        if (n !== undefined) {
          (out as any)[key] = n;
          break;
        }
      }
    }
  }
  return out;
}

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  if (u.includes("linkedin.com")) return "linkedin";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("threads.net")) return "threads";
  return "website";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const { content_id, url: rawUrl } = body || {};
    if (!content_id && !rawUrl) {
      return new Response(JSON.stringify({ error: "content_id or url required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load content row if id given
    let row: any = null;
    let targetUrl = rawUrl as string | undefined;
    if (content_id) {
      const { data, error } = await supabase
        .from("published_contents").select("*").eq("id", content_id).maybeSingle();
      if (error) throw error;
      row = data;
      targetUrl = row?.content_url;
    }
    if (!targetUrl) throw new Error("No URL to scrape");

    const platform = row?.platform || detectPlatform(targetUrl);

    // Call Firecrawl scrape
    const fcRes = await fetch(`${FIRECRAWL_V2}/scrape`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown"],
        onlyMainContent: false,
      }),
    });
    const fcJson = await fcRes.json();

    if (!fcRes.ok) {
      const errMsg = (fcJson?.error || `Firecrawl ${fcRes.status}`).toString().slice(0, 500);
      if (content_id) {
        await supabase.from("published_contents")
          .update({ scrape_status: "failed", scrape_error: errMsg, last_scraped_at: new Date().toISOString() })
          .eq("id", content_id);
      }
      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const doc = fcJson?.data ?? fcJson;
    const markdown: string = doc?.markdown || "";
    const metadata: any = doc?.metadata || {};

    const m = extractMetrics(markdown, metadata, platform);

    // Compute engagement
    const likes = m.likes ?? 0;
    const comments = m.comments ?? 0;
    const views = m.views ?? 0;
    const shares = m.shares ?? 0;
    const engagement = likes + comments;

    // Get followers for ER (if linked to KOL)
    let followers = 0;
    if (row?.kol_id) {
      const { data: kol } = await supabase
        .from("kol_database")
        .select("ig_followers,tiktok_followers,youtube_followers,twitter_followers,linkedin_followers,threads_followers")
        .eq("id", row.kol_id).maybeSingle();
      if (kol) {
        followers = Math.max(
          kol.ig_followers || 0, kol.tiktok_followers || 0, kol.youtube_followers || 0,
          kol.twitter_followers || 0, kol.linkedin_followers || 0, kol.threads_followers || 0,
        );
      }
    }
    const engagement_rate = followers > 0 ? +((engagement / followers) * 100).toFixed(2) : null;
    const view_engagement_rate = views > 0 ? +((engagement / views) * 100).toFixed(2) : null;
    const comment_rate = views > 0 ? +((comments / views) * 100).toFixed(2) : null;

    // Performance score
    const { data: settings } = await supabase.from("published_content_settings").select("*").limit(1).maybeSingle();
    const exc = Number(settings?.excellent_er ?? 6);
    const good = Number(settings?.good_er ?? 3);
    const avg = Number(settings?.average_er ?? 1);
    const erForScore = view_engagement_rate ?? engagement_rate ?? 0;
    let score: string = "Poor";
    if (erForScore >= exc) score = "Excellent";
    else if (erForScore >= good) score = "Good";
    else if (erForScore >= avg) score = "Average";

    // Update row
    if (content_id) {
      await supabase.from("published_contents").update({
        latest_views: views || null,
        latest_likes: likes || null,
        latest_comments: comments || null,
        latest_shares: shares || null,
        latest_engagement_rate: engagement_rate,
        performance_score: score,
        thumbnail_url: row?.thumbnail_url || m.thumbnail || null,
        caption_preview: row?.caption_preview || m.caption || null,
        title: row?.title || m.title || null,
        scrape_status: "ok",
        scrape_error: null,
        last_scraped_at: new Date().toISOString(),
      }).eq("id", content_id);

      await supabase.from("published_content_snapshots").insert({
        content_id,
        views: views || null,
        likes: likes || null,
        comments: comments || null,
        shares: shares || null,
        engagement,
        engagement_rate,
        view_engagement_rate,
        comment_rate,
        source: "firecrawl",
        raw_data: { metadata, parsed: m },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      metrics: { views, likes, comments, shares, engagement, engagement_rate, view_engagement_rate, comment_rate, performance_score: score },
      meta: { thumbnail: m.thumbnail, title: m.title, caption: m.caption, platform },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message || String(e) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
