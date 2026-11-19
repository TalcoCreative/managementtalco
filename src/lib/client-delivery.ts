export type Targets = Record<string, number>;
export const DELIVERY_METRICS = [
  { key: 'graphics', label: 'Graphics', source: 'Published EP: single post, feed and carousel (one slide = one content).' },
  { key: 'feeds', label: 'Feeds', source: 'Published EP: single post and feed. Included in Graphics.' },
  { key: 'carousel', label: 'Carousels', source: 'Published EP carousel slides. Included in Graphics.' },
  { key: 'shorts', label: 'Shorts / Reels', source: 'Published EP: shorts and reels.' },
  { key: 'story', label: 'Stories', source: 'Published EP stories.' },
  { key: 'long_video', label: 'Long videos', source: 'Published EP long videos.' },
  { key: 'other_content', label: 'Other content', source: 'Other published EP formats.' },
  { key: 'shooting', label: 'Shootings', source: 'Completed shootings by scheduled date.' },
  { key: 'meeting', label: 'Meetings', source: 'Completed meetings by meeting date.' },
  { key: 'report', label: 'Reports', source: 'Organic and ads reports whose entire reporting range is inside this period.' },
  { key: 'ads_spend', label: 'Ads spend', source: 'Ads Budget ads_spend transactions by transaction date, excluding top-ups and tax.', currency: true },
  { key: 'leads', label: 'Leads', source: 'Results from ads reports with objective leads and reporting range fully inside this period.' },
] as const;

const dateString = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
function boundary(year: number, month: number, day: number) {
  const normalized = new Date(Date.UTC(year, month, 1));
  const last = new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth()+1, 0)).getUTCDate();
  return new Date(Date.UTC(normalized.getUTCFullYear(), normalized.getUTCMonth(), Math.min(day,last)));
}
export function cyclePeriod(day: number, today: string, offset = 0) {
  const now = new Date(`${today}T00:00:00Z`);
  const anchor = boundary(now.getUTCFullYear(),now.getUTCMonth(),day);
  const month = now.getUTCMonth() + (now < anchor ? -1 : 0) + offset;
  const start = boundary(now.getUTCFullYear(),month,day);
  const next = boundary(now.getUTCFullYear(),month+1,day);
  next.setUTCDate(next.getUTCDate()-1);
  return { start: dateString(start), end: dateString(next) };
}
export function jakartaToday() {
  return new Intl.DateTimeFormat('en-CA',{ timeZone:'Asia/Jakarta', year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
}
export function resolvedTargets(defaults: Targets, override?: Targets | null) { return override ?? defaults; }
export function achievement(target: number, actual: number) {
  return { remaining: Math.max(0,target-actual), percentage: target > 0 ? Math.min(100,actual/target*100) : 0 };
}