import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

interface CreateAnnouncementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateAnnouncementDialog({
  open,
  onOpenChange,
}: CreateAnnouncementDialogProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState("normal");
  const [expiresAt, setExpiresAt] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      toast.error("Judul dan konten harus diisi");
      return;
    }

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Anda harus login");
        return;
      }

      // Create announcement
      const { data: announcement, error: announcementError } = await supabase
        .from("announcements")
        .insert({
          title: title.trim(),
          content: content.trim(),
          priority,
          created_by: session.session.user.id,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        })
        .select()
        .single();

      if (announcementError) throw announcementError;

      // Get all profiles with email
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .not("user_id", "is", null);

      // Send email to all users
      if (profiles && profiles.length > 0) {
        for (const profile of profiles) {
          if (profile.user_id) {
            try {
              await supabase.functions.invoke("send-notification-email", {
                body: {
                  type: "notification",
                  recipientEmail: profile.user_id,
                  recipientName: profile.full_name || "Team Member",
                  notificationType: "announcement",
                  data: {
                    title: title.trim(),
                    content: content.trim(),
                    priority,
                    createdAt: new Date().toISOString(),
                  },
                },
              });
            } catch (emailError) {
              console.error("Failed to send email to", profile.user_id, emailError);
            }
          }
        }
      }

      toast.success("Pengumuman berhasil dibuat dan dikirim ke semua anggota tim");
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error("Error creating announcement:", error);
      toast.error("Gagal membuat pengumuman: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setPriority("normal");
    setExpiresAt("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Pengumuman Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Judul</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul pengumuman"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Konten</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Isi pengumuman..."
              rows={5}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioritas</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Rendah</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Tinggi</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Kadaluarsa (Opsional)</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Mengirim..." : "Kirim Pengumuman"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
