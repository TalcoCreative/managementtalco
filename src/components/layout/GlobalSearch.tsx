import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Building2, Briefcase, CheckSquare, CalendarClock, Video, PartyPopper,
  Star, UserPlus, Compass, Loader2,
} from "lucide-react";
import { NAV_CATEGORIES } from "./nav-config";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  // Open via Cmd/Ctrl+K and via window event
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("open-tassa-search", onEvt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-tassa-search", onEvt as EventListener);
    };
  }, []);

  // Flatten nav items for "feature/page" search
  const navItems = useMemo(() => {
    const out: { title: string; url: string; group: string }[] = [];
    NAV_CATEGORIES.forEach((cat) => {
      cat.items.forEach((it) => out.push({ title: it.title, url: it.url, group: cat.label }));
    });
    return out;
  }, []);

  const enabled = open && query.trim().length >= 2;
  const q = query.trim();

  const { data: results, isFetching } = useQuery({
    queryKey: ["global-search", q],
    enabled,
    queryFn: async () => {
      const like = `%${q}%`;
      const [clients, projects, tasks, meetings, shootings, events, kols, prospects] =
        await Promise.all([
          supabase.from("clients").select("id,name,company").or(`name.ilike.${like},company.ilike.${like},email.ilike.${like}`).limit(6),
          supabase.from("projects").select("id,title,status").ilike("title", like).limit(6),
          supabase.from("tasks").select("id,title,status").ilike("title", like).limit(6),
          supabase.from("meetings").select("id,title,meeting_date").ilike("title", like).limit(6),
          supabase.from("shooting_schedules").select("id,title,scheduled_date").ilike("title", like).limit(6),
          supabase.from("events").select("id,name").ilike("name", like).limit(6),
          supabase.from("kol_database").select("id,name,platform").ilike("name", like).limit(6),
          supabase.from("prospects").select("id,contact_name,company").or(`contact_name.ilike.${like},company.ilike.${like}`).limit(6),
        ]);
      return {
        clients: clients.data || [],
        projects: projects.data || [],
        tasks: tasks.data || [],
        meetings: meetings.data || [],
        shootings: shootings.data || [],
        events: events.data || [],
        kols: kols.data || [],
        prospects: prospects.data || [],
      };
    },
  });

  const go = (url: string) => {
    setOpen(false);
    setQuery("");
    navigate(url);
  };

  const filteredNav = useMemo(
    () => navItems.filter((n) => !q || n.title.toLowerCase().includes(q.toLowerCase()) || n.group.toLowerCase().includes(q.toLowerCase())).slice(0, 12),
    [navItems, q]
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search clients, projects, tasks, pages…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[60vh]">
        {q.length < 2 ? (
          <CommandGroup heading="Pages">
            {navItems.slice(0, 14).map((n) => (
              <CommandItem key={`nav-${n.url}`} value={`${n.title} ${n.group}`} onSelect={() => go(n.url)}>
                <Compass className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{n.title}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">{n.group}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            {isFetching && (
              <div className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </div>
            )}
            <CommandEmpty>No results found.</CommandEmpty>

            {filteredNav.length > 0 && (
              <CommandGroup heading="Pages">
                {filteredNav.map((n) => (
                  <CommandItem key={`nav-${n.url}`} value={`page ${n.title} ${n.group}`} onSelect={() => go(n.url)}>
                    <Compass className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{n.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{n.group}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.clients.length && (
              <CommandGroup heading="Clients">
                {results.clients.map((c: any) => (
                  <CommandItem key={`c-${c.id}`} value={`client ${c.name} ${c.company || ""}`} onSelect={() => go(`/clients/${c.id}`)}>
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{c.name}</span>
                    {c.company && <span className="ml-auto text-[11px] text-muted-foreground">{c.company}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.projects.length && (
              <CommandGroup heading="Projects">
                {results.projects.map((p: any) => (
                  <CommandItem key={`p-${p.id}`} value={`project ${p.title}`} onSelect={() => go(`/projects`)}>
                    <Briefcase className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{p.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{p.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.tasks.length && (
              <CommandGroup heading="Tasks">
                {results.tasks.map((t: any) => (
                  <CommandItem key={`t-${t.id}`} value={`task ${t.title}`} onSelect={() => go(`/tasks`)}>
                    <CheckSquare className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{t.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{t.status}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.meetings.length && (
              <CommandGroup heading="Meetings">
                {results.meetings.map((m: any) => (
                  <CommandItem key={`m-${m.id}`} value={`meeting ${m.title}`} onSelect={() => go(`/meeting`)}>
                    <CalendarClock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{m.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{m.meeting_date}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.shootings.length && (
              <CommandGroup heading="Shootings">
                {results.shootings.map((s: any) => (
                  <CommandItem key={`s-${s.id}`} value={`shooting ${s.title}`} onSelect={() => go(`/shooting`)}>
                    <Video className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{s.title}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{s.scheduled_date}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.events.length && (
              <CommandGroup heading="Events">
                {results.events.map((e: any) => (
                  <CommandItem key={`e-${e.id}`} value={`event ${e.name}`} onSelect={() => go(`/event/${e.id}`)}>
                    <PartyPopper className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{e.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.kols.length && (
              <CommandGroup heading="KOLs">
                {results.kols.map((k: any) => (
                  <CommandItem key={`k-${k.id}`} value={`kol ${k.name}`} onSelect={() => go(`/kol-database`)}>
                    <Star className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{k.name}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">{k.platform}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {!!results?.prospects.length && (
              <CommandGroup heading="Prospects">
                {results.prospects.map((p: any) => (
                  <CommandItem key={`pr-${p.id}`} value={`prospect ${p.contact_name} ${p.company || ""}`} onSelect={() => go(`/prospects`)}>
                    <UserPlus className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{p.contact_name}</span>
                    {p.company && <span className="ml-auto text-[11px] text-muted-foreground">{p.company}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
