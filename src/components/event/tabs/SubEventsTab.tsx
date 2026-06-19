import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Plus,
  Trash2,
  Clock,
  MapPin,
  User,
  Building2,
  ListChecks,
  CalendarClock,
  Users,
  Pencil,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface SubEventsTabProps {
  eventId: string;
  canManage: boolean;
}

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning", color: "bg-blue-100 text-blue-800" },
  { value: "prepare", label: "Prepare", color: "bg-yellow-100 text-yellow-800" },
  { value: "ready", label: "Ready", color: "bg-purple-100 text-purple-800" },
  { value: "done", label: "Done", color: "bg-green-100 text-green-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

export function SubEventsTab({ eventId, canManage }: SubEventsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: subEvents = [], refetch } = useQuery({
    queryKey: ["sub-events", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_events")
        .select(`
          *,
          pic:profiles!sub_events_pic_id_fkey(id, full_name),
          client:clients(id, name)
        `)
        .eq("event_id", eventId)
        .order("sort_order")
        .order("start_time", { nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["profiles-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      return data || [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, name").order("name");
      return data || [];
    },
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus sub event ini? Semua rundown, checklist & crew akan ikut terhapus.")) return;
    const { error } = await supabase.from("sub_events").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Sub event dihapus");
      refetch();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const { error } = await supabase.from("sub_events").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-5 w-5" />
          <h3 className="font-medium">Sub Events</h3>
          <Badge variant="outline">{subEvents.length}</Badge>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Sub Event
          </Button>
        )}
      </div>

      {subEvents.length === 0 ? (
        <p className="text-center py-8 text-muted-foreground text-sm">
          Belum ada sub event. Buat sub event untuk mengatur rundown, checklist, crew per sesi.
        </p>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {subEvents.map((se: any) => {
            const statusOpt = STATUS_OPTIONS.find((s) => s.value === se.status) || STATUS_OPTIONS[0];
            return (
              <AccordionItem
                key={se.id}
                value={se.id}
                className="border rounded-lg bg-card px-3"
              >
                <div className="flex items-center gap-2">
                  <AccordionTrigger className="flex-1 hover:no-underline py-3">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{se.name}</span>
                        <Badge className={statusOpt.color}>{statusOpt.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        {se.start_time && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(se.start_time), "d MMM HH:mm")}
                            {se.end_time && ` - ${format(new Date(se.end_time), "HH:mm")}`}
                          </span>
                        )}
                        {se.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {se.location}
                          </span>
                        )}
                        {se.pic && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" /> {se.pic.full_name}
                          </span>
                        )}
                        {se.client && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" /> {se.client.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Select
                        value={se.status}
                        onValueChange={(v) => handleStatusChange(se.id, v)}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => setEditingId(se.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => handleDelete(se.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <AccordionContent className="pb-4 space-y-4">
                  {se.description && (
                    <p className="text-sm text-muted-foreground">{se.description}</p>
                  )}
                  <RundownSection subEventId={se.id} users={users} canManage={canManage} />
                  <ChecklistSection subEventId={se.id} canManage={canManage} />
                  <CrewSection subEventId={se.id} users={users} canManage={canManage} />
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <SubEventDialog
        open={createOpen || !!editingId}
        editingId={editingId}
        onClose={() => {
          setCreateOpen(false);
          setEditingId(null);
        }}
        eventId={eventId}
        users={users}
        clients={clients}
        onSaved={() => {
          refetch();
          setCreateOpen(false);
          setEditingId(null);
        }}
      />
    </div>
  );
}

// ============ Dialog ============
function SubEventDialog({
  open,
  editingId,
  onClose,
  eventId,
  users,
  clients,
  onSaved,
}: {
  open: boolean;
  editingId: string | null;
  onClose: () => void;
  eventId: string;
  users: any[];
  clients: any[];
  onSaved: () => void;
}) {
  const [form, setForm] = useState<any>({
    name: "",
    description: "",
    status: "planning",
    start_time: "",
    end_time: "",
    location: "",
    pic_id: "",
    client_id: "",
  });
  const [saving, setSaving] = useState(false);

  useQuery({
    queryKey: ["sub-event-edit", editingId],
    queryFn: async () => {
      if (!editingId) return null;
      const { data } = await supabase
        .from("sub_events")
        .select("*")
        .eq("id", editingId)
        .single();
      if (data) {
        setForm({
          name: data.name || "",
          description: data.description || "",
          status: data.status || "planning",
          start_time: data.start_time ? data.start_time.slice(0, 16) : "",
          end_time: data.end_time ? data.end_time.slice(0, 16) : "",
          location: data.location || "",
          pic_id: data.pic_id || "",
          client_id: data.client_id || "",
        });
      }
      return data;
    },
    enabled: !!editingId && open,
  });

  // reset on open without editing
  useEffect(() => {
    if (open && !editingId) {
      setForm({
        name: "",
        description: "",
        status: "planning",
        start_time: "",
        end_time: "",
        location: "",
        pic_id: "",
        client_id: "",
      });
    }
  }, [open, editingId]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        event_id: eventId,
        name: form.name,
        description: form.description || null,
        status: form.status,
        start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
        end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
        location: form.location || null,
        pic_id: form.pic_id || null,
        client_id: form.client_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from("sub_events").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Sub event diperbarui");
      } else {
        const { error } = await supabase.from("sub_events").insert(payload);
        if (error) throw error;
        toast.success("Sub event dibuat");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Edit Sub Event" : "Buat Sub Event"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nama *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Deskripsi</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Mulai</Label>
              <Input
                type="datetime-local"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              />
            </div>
            <div>
              <Label>Selesai</Label>
              <Input
                type="datetime-local"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Lokasi</Label>
            <Input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>PIC</Label>
              <Select
                value={form.pic_id || "none"}
                onValueChange={(v) => setForm({ ...form, pic_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PIC" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">- Tidak ada -</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select
                value={form.client_id || "none"}
                onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">- Tidak ada -</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Rundown ============
function RundownSection({
  subEventId,
  users,
  canManage,
}: {
  subEventId: string;
  users: any[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    activity: "",
    start_time: "",
    end_time: "",
    location: "",
    pic_id: "",
    notes: "",
  });

  const { data: items = [] } = useQuery({
    queryKey: ["rundown", subEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_event_rundown")
        .select("*, pic:profiles!sub_event_rundown_pic_id_fkey(full_name)")
        .eq("sub_event_id", subEventId)
        .order("start_time", { nullsFirst: false })
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rundown", subEventId] });

  const handleAdd = async () => {
    if (!form.activity.trim()) {
      toast.error("Activity wajib diisi");
      return;
    }
    const { error } = await supabase.from("sub_event_rundown").insert({
      sub_event_id: subEventId,
      activity: form.activity,
      start_time: form.start_time ? new Date(form.start_time).toISOString() : null,
      end_time: form.end_time ? new Date(form.end_time).toISOString() : null,
      location: form.location || null,
      pic_id: form.pic_id || null,
      notes: form.notes || null,
      sort_order: items.length,
    });
    if (error) toast.error(error.message);
    else {
      setForm({ activity: "", start_time: "", end_time: "", location: "", pic_id: "", notes: "" });
      setAdding(false);
      invalidate();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sub_event_rundown").delete().eq("id", id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" /> Rundown ({items.length})
        </div>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Tambah
          </Button>
        )}
      </div>

      {items.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Belum ada rundown.</p>
      )}

      <div className="space-y-1">
        {items.map((it: any) => (
          <div
            key={it.id}
            className="flex items-start gap-2 p-2 rounded-md bg-muted/30 text-sm group"
          >
            <div className="text-xs font-medium w-20 shrink-0">
              {it.start_time ? format(new Date(it.start_time), "HH:mm") : "--:--"}
              {it.end_time && ` - ${format(new Date(it.end_time), "HH:mm")}`}
            </div>
            <div className="flex-1">
              <p className="font-medium">{it.activity}</p>
              <div className="flex gap-3 text-xs text-muted-foreground flex-wrap mt-0.5">
                {it.location && <span><MapPin className="inline h-3 w-3" /> {it.location}</span>}
                {it.pic && <span><User className="inline h-3 w-3" /> {it.pic.full_name}</span>}
              </div>
              {it.notes && <p className="text-xs text-muted-foreground mt-0.5">{it.notes}</p>}
            </div>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => handleDelete(it.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="space-y-2 p-2 border rounded-md">
          <Input
            placeholder="Activity *"
            value={form.activity}
            onChange={(e) => setForm({ ...form, activity: e.target.value })}
            className="h-8 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="datetime-local"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className="h-8 text-sm"
            />
            <Input
              type="datetime-local"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className="h-8 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Lokasi"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="h-8 text-sm"
            />
            <Select
              value={form.pic_id || "none"}
              onValueChange={(v) => setForm({ ...form, pic_id: v === "none" ? "" : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="PIC" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- PIC -</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Catatan"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="h-8 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Simpan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Checklist ============
function ChecklistSection({ subEventId, canManage }: { subEventId: string; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [newItem, setNewItem] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["sub-checklist", subEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_event_checklists")
        .select("*")
        .eq("sub_event_id", subEventId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["sub-checklist", subEventId] });

  const completed = items.filter((i: any) => i.is_completed).length;

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    const { error } = await supabase.from("sub_event_checklists").insert({
      sub_event_id: subEventId,
      item: newItem.trim(),
      sort_order: items.length,
    });
    if (error) toast.error(error.message);
    else {
      setNewItem("");
      invalidate();
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from("sub_event_checklists")
      .update({
        is_completed: !current,
        completed_at: !current ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sub_event_checklists").delete().eq("id", id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <ListChecks className="h-4 w-4" /> Checklist Prepare ({completed}/{items.length})
      </div>
      <div className="space-y-1">
        {items.map((it: any) => (
          <div key={it.id} className="flex items-center gap-2 group text-sm">
            <Checkbox
              checked={it.is_completed}
              onCheckedChange={() => handleToggle(it.id, it.is_completed)}
              disabled={!canManage}
            />
            <span className={`flex-1 ${it.is_completed ? "line-through text-muted-foreground" : ""}`}>
              {it.item}
            </span>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => handleDelete(it.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Input
            placeholder="Tambah item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="h-8 text-sm"
          />
          <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newItem.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ============ Crew ============
function CrewSection({
  subEventId,
  users,
  canManage,
}: {
  subEventId: string;
  users: any[];
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ user_id: "", freelancer_name: "", role: "", notes: "" });

  const { data: items = [] } = useQuery({
    queryKey: ["sub-crew", subEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_event_crew")
        .select("*, user:profiles(full_name)")
        .eq("sub_event_id", subEventId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sub-crew", subEventId] });

  const handleAdd = async () => {
    if (!form.role.trim()) {
      toast.error("Role wajib diisi");
      return;
    }
    const { error } = await supabase.from("sub_event_crew").insert({
      sub_event_id: subEventId,
      user_id: form.user_id || null,
      freelancer_name: form.freelancer_name || null,
      role: form.role,
      notes: form.notes || null,
    });
    if (error) toast.error(error.message);
    else {
      setForm({ user_id: "", freelancer_name: "", role: "", notes: "" });
      setAdding(false);
      invalidate();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("sub_event_crew").delete().eq("id", id);
    if (error) toast.error(error.message);
    else invalidate();
  };

  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Users className="h-4 w-4" /> Crew ({items.length})
        </div>
        {canManage && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Crew
          </Button>
        )}
      </div>
      <div className="space-y-1">
        {items.map((c: any) => (
          <div
            key={c.id}
            className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded-md group"
          >
            <div className="flex-1">
              <p className="font-medium">{c.user?.full_name || c.freelancer_name || "—"}</p>
              <p className="text-xs text-muted-foreground">
                {c.role}
                {c.notes && ` · ${c.notes}`}
              </p>
            </div>
            {canManage && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => handleDelete(c.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>
      {adding && (
        <div className="space-y-2 p-2 border rounded-md">
          <Select
            value={form.user_id || "none"}
            onValueChange={(v) => setForm({ ...form, user_id: v === "none" ? "" : v })}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Internal user" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">- Freelancer / Manual -</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!form.user_id && (
            <Input
              placeholder="Nama freelancer"
              value={form.freelancer_name}
              onChange={(e) => setForm({ ...form, freelancer_name: e.target.value })}
              className="h-8 text-sm"
            />
          )}
          <Input
            placeholder="Role *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="h-8 text-sm"
          />
          <Input
            placeholder="Catatan"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="h-8 text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Simpan
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
