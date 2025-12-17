import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Trash2, Video, MapPin } from "lucide-react";

interface CreateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ExternalParticipant {
  name: string;
  email: string;
  company: string;
}

const CreateMeetingDialog = ({ open, onOpenChange, onSuccess }: CreateMeetingDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    type: "internal",
    meeting_date: "",
    start_time: "",
    end_time: "",
    mode: "online",
    meeting_link: "",
    location: "",
    client_id: "",
    project_id: "",
    notes: "",
  });
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [externalParticipants, setExternalParticipants] = useState<ExternalParticipant[]>([]);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch profiles for internal participants
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch projects
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

  const handleParticipantToggle = (profileId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const addExternalParticipant = () => {
    setExternalParticipants(prev => [...prev, { name: "", email: "", company: "" }]);
  };

  const updateExternalParticipant = (index: number, field: keyof ExternalParticipant, value: string) => {
    setExternalParticipants(prev => 
      prev.map((p, i) => i === index ? { ...p, [field]: value } : p)
    );
  };

  const removeExternalParticipant = (index: number) => {
    setExternalParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentUser?.id) {
      toast.error("User tidak ditemukan");
      return;
    }

    if (!formData.title || !formData.meeting_date || !formData.start_time || !formData.end_time) {
      toast.error("Mohon lengkapi data meeting");
      return;
    }

    if (formData.mode === "online" && !formData.meeting_link) {
      toast.error("Link meeting harus diisi untuk meeting online");
      return;
    }

    if (formData.mode === "offline" && !formData.location) {
      toast.error("Lokasi harus diisi untuk meeting offline");
      return;
    }

    setIsSubmitting(true);

    try {
      // Create meeting
      const { data: meeting, error: meetingError } = await supabase
        .from("meetings")
        .insert({
          title: formData.title,
          type: formData.type,
          meeting_date: formData.meeting_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          mode: formData.mode,
          meeting_link: formData.mode === "online" ? formData.meeting_link : null,
          location: formData.mode === "offline" ? formData.location : null,
          client_id: formData.client_id || null,
          project_id: formData.project_id || null,
          notes: formData.notes || null,
          created_by: currentUser.id,
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // Add internal participants
      if (selectedParticipants.length > 0) {
        const participantRecords = selectedParticipants.map(userId => ({
          meeting_id: meeting.id,
          user_id: userId,
          status: "pending",
        }));

        const { error: participantsError } = await supabase
          .from("meeting_participants")
          .insert(participantRecords);

        if (participantsError) throw participantsError;

        // Create notifications for participants
        const notificationRecords = selectedParticipants.map(userId => ({
          meeting_id: meeting.id,
          user_id: userId,
        }));

        await supabase
          .from("meeting_notifications")
          .insert(notificationRecords);
      }

      // Add external participants
      if (externalParticipants.length > 0) {
        const validExternal = externalParticipants.filter(p => p.name.trim());
        if (validExternal.length > 0) {
          const externalRecords = validExternal.map(p => ({
            meeting_id: meeting.id,
            name: p.name,
            email: p.email || null,
            company: p.company || null,
          }));

          const { error: externalError } = await supabase
            .from("meeting_external_participants")
            .insert(externalRecords);

          if (externalError) throw externalError;
        }
      }

      toast.success("Meeting berhasil dibuat");
      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error("Error creating meeting:", error);
      toast.error(error.message || "Gagal membuat meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      type: "internal",
      meeting_date: "",
      start_time: "",
      end_time: "",
      mode: "online",
      meeting_link: "",
      location: "",
      client_id: "",
      project_id: "",
      notes: "",
    });
    setSelectedParticipants([]);
    setExternalParticipants([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Buat Meeting Baru</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="flex-1 pr-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <Label>Judul Meeting *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Masukkan judul meeting"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipe Meeting</Label>
                  <Select 
                    value={formData.type} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mode Meeting</Label>
                  <Select 
                    value={formData.mode} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, mode: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="online">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4" />
                          Online
                        </div>
                      </SelectItem>
                      <SelectItem value="offline">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          Offline
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Tanggal *</Label>
                  <Input
                    type="date"
                    value={formData.meeting_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Jam Mulai *</Label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Jam Selesai *</Label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {formData.mode === "online" ? (
                <div>
                  <Label>Link Meeting *</Label>
                  <Input
                    value={formData.meeting_link}
                    onChange={(e) => setFormData(prev => ({ ...prev, meeting_link: e.target.value }))}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              ) : (
                <div>
                  <Label>Lokasi Meeting *</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Masukkan lokasi meeting"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Client (Opsional)</Label>
                  <Select 
                    value={formData.client_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, client_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tidak ada</SelectItem>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Project (Opsional)</Label>
                  <Select 
                    value={formData.project_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, project_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Tidak ada</SelectItem>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Internal Participants */}
            <div className="space-y-2">
              <Label>Partisipan Internal</Label>
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                {profiles?.filter(p => p.id !== currentUser?.id).map((profile) => (
                  <div key={profile.id} className="flex items-center gap-2">
                    <Checkbox
                      id={profile.id}
                      checked={selectedParticipants.includes(profile.id)}
                      onCheckedChange={() => handleParticipantToggle(profile.id)}
                    />
                    <label htmlFor={profile.id} className="text-sm cursor-pointer flex-1">
                      {profile.full_name}
                    </label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedParticipants.length} partisipan dipilih
              </p>
            </div>

            {/* External Participants */}
            {formData.type === "external" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Partisipan External</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExternalParticipant}>
                    <Plus className="w-4 h-4 mr-1" />
                    Tambah
                  </Button>
                </div>
                <div className="space-y-3">
                  {externalParticipants.map((participant, index) => (
                    <div key={index} className="border rounded-lg p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Partisipan {index + 1}</span>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm"
                          onClick={() => removeExternalParticipant(index)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          placeholder="Nama"
                          value={participant.name}
                          onChange={(e) => updateExternalParticipant(index, "name", e.target.value)}
                        />
                        <Input
                          placeholder="Email"
                          type="email"
                          value={participant.email}
                          onChange={(e) => updateExternalParticipant(index, "email", e.target.value)}
                        />
                        <Input
                          placeholder="Perusahaan"
                          value={participant.company}
                          onChange={(e) => updateExternalParticipant(index, "company", e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <Label>Catatan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Catatan tambahan..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Buat Meeting"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default CreateMeetingDialog;
