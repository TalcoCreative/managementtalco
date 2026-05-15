import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2, Users, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Profile { id: string; full_name: string }

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentUserId: string;
  onCreated: (conversationId: string) => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["chat-user-search", search],
    queryFn: async () => {
      const q = supabase.from("profiles").select("id,full_name").neq("id", currentUserId).order("full_name").limit(40);
      if (search.trim()) q.ilike("full_name", `%${search.trim()}%`);
      const { data } = await q;
      return (data ?? []) as Profile[];
    },
    enabled: open,
  });

  const reset = () => { setSearch(""); setGroupName(""); setSelected(new Set()); };

  const createDM = async (otherId: string) => {
    setBusy(true);
    try {
      // Check if DM already exists
      const { data: mine } = await supabase
        .from("chat_participants")
        .select("conversation_id, chat_conversations!inner(type)")
        .eq("user_id", currentUserId);
      const myConvIds = (mine ?? []).filter((r: any) => r.chat_conversations?.type === "dm").map((r: any) => r.conversation_id);
      if (myConvIds.length > 0) {
        const { data: theirs } = await supabase
          .from("chat_participants")
          .select("conversation_id")
          .eq("user_id", otherId)
          .in("conversation_id", myConvIds);
        if (theirs && theirs.length > 0) {
          onCreated(theirs[0].conversation_id);
          onOpenChange(false);
          reset();
          return;
        }
      }

      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert({ type: "dm", created_by: currentUserId })
        .select("id")
        .single();
      if (error || !conv) throw error;
      const { error: pErr } = await supabase.from("chat_participants").insert([
        { conversation_id: conv.id, user_id: currentUserId, role: "admin" },
        { conversation_id: conv.id, user_id: otherId, role: "member" },
      ]);
      if (pErr) throw pErr;
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      onCreated(conv.id);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Failed to start chat");
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selected.size === 0) {
      toast.error("Group name and at least one member required");
      return;
    }
    setBusy(true);
    try {
      const { data: conv, error } = await supabase
        .from("chat_conversations")
        .insert({ type: "group", name: groupName.trim(), created_by: currentUserId })
        .select("id")
        .single();
      if (error || !conv) throw error;
      const rows = [
        { conversation_id: conv.id, user_id: currentUserId, role: "admin" as const },
        ...Array.from(selected).map((u) => ({ conversation_id: conv.id, user_id: u, role: "member" as const })),
      ];
      const { error: pErr } = await supabase.from("chat_participants").insert(rows);
      if (pErr) throw pErr;
      qc.invalidateQueries({ queryKey: ["chat-conversations"] });
      onCreated(conv.id);
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message || "Failed to create group");
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dm" className="w-full">
          <TabsList className="mx-5 grid grid-cols-2">
            <TabsTrigger value="dm"><User className="h-3.5 w-3.5 mr-1.5" />Direct</TabsTrigger>
            <TabsTrigger value="group"><Users className="h-3.5 w-3.5 mr-1.5" />Group</TabsTrigger>
          </TabsList>

          <TabsContent value="dm" className="px-5 pb-5 pt-3 space-y-3">
            <Input placeholder="Search people…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-72 overflow-y-auto -mx-2">
              {(users ?? []).map((u) => (
                <button
                  key={u.id}
                  disabled={busy}
                  onClick={() => createDM(u.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/60 text-left transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                    {u.full_name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <span className="flex-1 text-sm">{u.full_name}</span>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="group" className="px-5 pb-5 pt-3 space-y-3">
            <Input placeholder="Group name" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
            <Input placeholder="Search to add…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-56 overflow-y-auto -mx-2">
              {(users ?? []).map((u) => {
                const sel = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                      sel ? "bg-primary/10" : "hover:bg-muted/60"
                    )}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary">
                      {u.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <span className="flex-1 text-sm">{u.full_name}</span>
                    {sel && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
            <Button onClick={createGroup} disabled={busy || !groupName.trim() || selected.size === 0} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create group ({selected.size})
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
