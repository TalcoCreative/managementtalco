import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { format } from "date-fns";

interface EditEventDialogProps {
  event: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const eventTypes = [
  { value: "launching", label: "Launching" },
  { value: "activation", label: "Activation" },
  { value: "performance", label: "Performance" },
  { value: "seminar", label: "Seminar" },
  { value: "campaign", label: "Campaign" },
  { value: "other", label: "Lainnya" },
];

export function EditEventDialog({ event, open, onOpenChange, onSuccess }: EditEventDialogProps) {
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [picId, setPicId] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (event) {
      setName(event.name || "");
      setEventType(event.event_type || "");
      setClientId(event.client_id || "");
      setProjectId(event.project_id || "");
      setLocation(event.location || "");
      setIsOnline(event.is_online || false);
      setStartDate(format(new Date(event.start_date), "yyyy-MM-dd"));
      setStartTime(format(new Date(event.start_date), "HH:mm"));
      setEndDate(format(new Date(event.end_date), "yyyy-MM-dd"));
      setEndTime(format(new Date(event.end_date), "HH:mm"));
      setPicId(event.pic_id || "");
      setNotes(event.notes || "");
    }
  }, [event]);

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.session.user.email)
        .single();

      if (!profile) throw new Error("Profile not found");

      const startDateTime = `${startDate}T${startTime || "00:00"}:00`;
      const endDateTime = `${endDate}T${endTime || "23:59"}:00`;

      const { error } = await supabase
        .from("events")
        .update({
          name,
          event_type: eventType,
          client_id: clientId || null,
          project_id: projectId || null,
          location: isOnline ? null : location,
          is_online: isOnline,
          start_date: startDateTime,
          end_date: endDateTime,
          pic_id: picId || null,
          notes,
        })
        .eq("id", event.id);

      if (error) throw error;

      // Log history
      await supabase.from("event_history").insert({
        event_id: event.id,
        action: "updated",
        new_value: name,
        changed_by: profile.id,
      });
    },
    onSuccess: () => {
      toast.success("Event berhasil diperbarui");
      onSuccess();
    },
    onError: (error) => {
      console.error("Error updating event:", error);
      toast.error("Gagal memperbarui event");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !eventType || !startDate || !endDate) {
      toast.error("Mohon lengkapi data yang diperlukan");
      return;
    }
    updateMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nama Event *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masukkan nama event"
                required
              />
            </div>

            <div>
              <Label htmlFor="eventType">Jenis Event *</Label>
              <Select value={eventType} onValueChange={setEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis event" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="client">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih client" />
                </SelectTrigger>
                <SelectContent>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih project" />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pic">PIC Event</Label>
              <Select value={picId} onValueChange={setPicId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih PIC" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <div className="flex items-center space-x-2">
                <Switch
                  id="isOnline"
                  checked={isOnline}
                  onCheckedChange={setIsOnline}
                />
                <Label htmlFor="isOnline">Event Online</Label>
              </div>
            </div>

            {!isOnline && (
              <div className="col-span-2">
                <Label htmlFor="location">Lokasi Event</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Masukkan lokasi event"
                />
              </div>
            )}

            <div>
              <Label htmlFor="startDate">Tanggal Mulai *</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="startTime">Waktu Mulai</Label>
              <Input
                id="startTime"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="endDate">Tanggal Selesai *</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            <div>
              <Label htmlFor="endTime">Waktu Selesai</Label>
              <Input
                id="endTime"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Catatan</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
