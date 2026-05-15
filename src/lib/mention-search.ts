import { supabase } from "@/integrations/supabase/client";

export type MentionType =
  | "user"
  | "task"
  | "project"
  | "shooting"
  | "meeting"
  | "event"
  | "client"
  | "prospect"
  | "kol"
  | "editorial_plan";

export interface MentionResult {
  type: MentionType;
  id: string;
  label: string;
  secondary?: string;
}

const TYPE_PRIORITY: MentionType[] = [
  "user", "task", "project", "shooting", "meeting", "event",
  "client", "prospect", "kol", "editorial_plan",
];

export async function searchMentions(query: string, limit = 6): Promise<MentionResult[]> {
  const q = query.trim();
  if (!q) {
    // default: return recent users
    const { data } = await supabase
      .from("profiles")
      .select("id,full_name")
      .order("full_name")
      .limit(limit);
    return (data ?? []).map((u) => ({ type: "user", id: u.id, label: u.full_name ?? "Unknown" }));
  }
  const like = `%${q}%`;
  const [users, tasks, projects, shootings, meetings, events, clients, prospects, kols, eps] = await Promise.all([
    supabase.from("profiles").select("id,full_name").ilike("full_name", like).limit(limit),
    supabase.from("tasks").select("id,title").ilike("title", like).limit(limit),
    supabase.from("projects").select("id,title").ilike("title", like).limit(limit),
    supabase.from("shooting_schedules").select("id,title").ilike("title", like).limit(limit),
    supabase.from("meetings").select("id,title").ilike("title", like).limit(limit),
    supabase.from("events").select("id,name").ilike("name", like).limit(limit),
    supabase.from("clients").select("id,name,company").or(`name.ilike.${like},company.ilike.${like}`).limit(limit),
    supabase.from("prospects").select("id,contact_name,company").or(`contact_name.ilike.${like},company.ilike.${like}`).limit(limit),
    supabase.from("kol_database").select("id,name,platform").ilike("name", like).limit(limit),
    supabase.from("editorial_plan").select("id,title").ilike("title", like).limit(limit),
  ]);

  const out: MentionResult[] = [];
  (users.data ?? []).forEach((r: any) => out.push({ type: "user", id: r.id, label: r.full_name ?? "Unknown" }));
  (tasks.data ?? []).forEach((r: any) => out.push({ type: "task", id: r.id, label: r.title }));
  (projects.data ?? []).forEach((r: any) => out.push({ type: "project", id: r.id, label: r.title }));
  (shootings.data ?? []).forEach((r: any) => out.push({ type: "shooting", id: r.id, label: r.title }));
  (meetings.data ?? []).forEach((r: any) => out.push({ type: "meeting", id: r.id, label: r.title }));
  (events.data ?? []).forEach((r: any) => out.push({ type: "event", id: r.id, label: r.name }));
  (clients.data ?? []).forEach((r: any) => out.push({ type: "client", id: r.id, label: r.name, secondary: r.company ?? undefined }));
  (prospects.data ?? []).forEach((r: any) => out.push({ type: "prospect", id: r.id, label: r.contact_name, secondary: r.company ?? undefined }));
  (kols.data ?? []).forEach((r: any) => out.push({ type: "kol", id: r.id, label: r.name, secondary: r.platform ?? undefined }));
  (eps.data ?? []).forEach((r: any) => out.push({ type: "editorial_plan", id: r.id, label: r.title }));

  // sort by type priority then label
  return out.sort((a, b) => {
    const pa = TYPE_PRIORITY.indexOf(a.type);
    const pb = TYPE_PRIORITY.indexOf(b.type);
    if (pa !== pb) return pa - pb;
    return a.label.localeCompare(b.label);
  });
}

export const MENTION_TYPE_ROUTE: Record<MentionType, (id: string) => string> = {
  user: () => `/profile-settings`,
  task: () => `/tasks`,
  project: () => `/projects`,
  shooting: () => `/shooting`,
  meeting: () => `/meeting`,
  event: (id) => `/event/${id}`,
  client: (id) => `/clients/${id}`,
  prospect: () => `/prospects`,
  kol: () => `/kol-database`,
  editorial_plan: () => `/editorial-plan`,
};

export const MENTION_TYPE_LABEL: Record<MentionType, string> = {
  user: "User",
  task: "Task",
  project: "Project",
  shooting: "Shooting",
  meeting: "Meeting",
  event: "Event",
  client: "Client",
  prospect: "Prospect",
  kol: "KOL",
  editorial_plan: "Editorial Plan",
};

// Mention encoding: @[Type:Label](type:uuid)
const MENTION_RE = /@\[([^:]+):([^\]]+)\]\(([a-z_]+):([0-9a-f-]{36})\)/g;

export function extractMentionsFromContent(content: string): { type: MentionType; id: string; label: string }[] {
  const out: { type: MentionType; id: string; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    out.push({ type: m[3] as MentionType, id: m[4], label: m[2] });
  }
  return out;
}

export function renderContentTokens(content: string): Array<{ kind: "text"; text: string } | { kind: "mention"; type: MentionType; id: string; label: string }> {
  const tokens: Array<any> = [];
  let last = 0;
  const re = new RegExp(MENTION_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: content.slice(last, m.index) });
    tokens.push({ kind: "mention", type: m[3] as MentionType, id: m[4], label: m[2] });
    last = m.index + m[0].length;
  }
  if (last < content.length) tokens.push({ kind: "text", text: content.slice(last) });
  return tokens;
}

export function buildMentionToken(r: MentionResult): string {
  const typeLabel = MENTION_TYPE_LABEL[r.type];
  return `@[${typeLabel}:${r.label}](${r.type}:${r.id})`;
}
