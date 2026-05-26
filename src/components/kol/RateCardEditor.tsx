import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export interface RateCardItem {
  platform: string;
  content_type: string;
  label?: string;
  rate: number | null;
}

export const RATE_PLATFORMS: { value: string; label: string; contentTypes: string[] }[] = [
  { value: "instagram", label: "Instagram", contentTypes: ["Story", "Feed", "Reels", "Carousel", "Live", "Collab"] },
  { value: "tiktok", label: "TikTok", contentTypes: ["Video", "Live", "Photo Post", "Collab"] },
  { value: "youtube", label: "YouTube", contentTypes: ["Video", "Shorts", "Integration", "Dedicated Video", "Live"] },
  { value: "twitter", label: "Twitter (X)", contentTypes: ["Tweet", "Thread", "Video", "Space"] },
  { value: "threads", label: "Threads", contentTypes: ["Post", "Thread", "Reply"] },
  { value: "linkedin", label: "LinkedIn", contentTypes: ["Post", "Article", "Video"] },
  { value: "facebook", label: "Facebook", contentTypes: ["Post", "Reels", "Story", "Video"] },
  { value: "other", label: "Other", contentTypes: ["Custom"] },
];

const formatRp = (n: number | null) =>
  n == null || isNaN(n) ? "" : new Intl.NumberFormat("id-ID").format(n);

export function defaultRateLabel(platform: string, contentType: string) {
  const p = RATE_PLATFORMS.find((x) => x.value === platform);
  return `${p?.label ?? platform} ${contentType}`.trim();
}

interface Props {
  value: RateCardItem[];
  onChange: (next: RateCardItem[]) => void;
}

export function RateCardEditor({ value, onChange }: Props) {
  const items = Array.isArray(value) ? value : [];

  const update = (idx: number, patch: Partial<RateCardItem>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const add = () =>
    onChange([
      ...items,
      { platform: "instagram", content_type: "Story", label: "", rate: null },
    ]);

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Belum ada rate card. Klik "Add Rate" untuk menambahkan.
        </p>
      )}

      {items.map((item, idx) => {
        const platform = RATE_PLATFORMS.find((p) => p.value === item.platform) ?? RATE_PLATFORMS[0];
        return (
          <div
            key={idx}
            className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end rounded-xl border border-border bg-card/40 p-3"
          >
            <div className="space-y-1">
              <Label className="text-xs">Platform</Label>
              <Select
                value={item.platform}
                onValueChange={(v) => {
                  const p = RATE_PLATFORMS.find((x) => x.value === v)!;
                  update(idx, {
                    platform: v,
                    content_type: p.contentTypes[0],
                  });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RATE_PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Content Type</Label>
              <Select
                value={item.content_type}
                onValueChange={(v) => update(idx, { content_type: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platform.contentTypes.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Rate (Rp)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={item.rate ?? ""}
                onChange={(e) =>
                  update(idx, { rate: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder="1000000"
              />
              {item.rate != null && item.rate > 0 && (
                <p className="text-[10px] text-muted-foreground">Rp {formatRp(item.rate)}</p>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(idx)}
              className="text-destructive"
              aria-label="Remove rate"
            >
              <X className="h-4 w-4" />
            </Button>

            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Custom Label (optional)</Label>
              <Input
                value={item.label ?? ""}
                onChange={(e) => update(idx, { label: e.target.value })}
                placeholder={defaultRateLabel(item.platform, item.content_type)}
              />
            </div>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={add} className="gap-2">
        <Plus className="h-4 w-4" /> Add Rate
      </Button>
    </div>
  );
}

export function normalizeRateCards(input: unknown): RateCardItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((x: any) => x && typeof x === "object")
    .map((x: any) => ({
      platform: String(x.platform ?? "other"),
      content_type: String(x.content_type ?? "Custom"),
      label: x.label ? String(x.label) : undefined,
      rate: x.rate == null || x.rate === "" ? null : Number(x.rate),
    }));
}

export function rateCardDisplayLabel(item: RateCardItem) {
  return item.label && item.label.trim().length > 0
    ? item.label
    : defaultRateLabel(item.platform, item.content_type);
}
