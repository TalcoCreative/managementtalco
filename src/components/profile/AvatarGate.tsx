import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, UserCircle } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface AvatarGateProps {
  userId: string | undefined;
}

export function AvatarGate({ userId }: AvatarGateProps) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["avatar-gate-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, status")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });

  const needsAvatar =
    !!profile && profile.status !== "non_active" && !profile.avatar_url;

  const handleFile = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Maksimal ukuran file 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("File harus berupa gambar");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("company-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("company-assets").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("id", userId);
      if (updErr) throw updErr;
      toast.success("Avatar berhasil diunggah");
      queryClient.invalidateQueries({ queryKey: ["avatar-gate-profile", userId] });
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      queryClient.invalidateQueries({ queryKey: ["team-moods-today"] });
    } catch (e: any) {
      toast.error(e.message || "Gagal mengunggah avatar");
    } finally {
      setUploading(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPreview(URL.createObjectURL(f));
    handleFile(f);
  };

  return (
    <Dialog open={needsAvatar}>
      <DialogContent
        className="max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-primary" /> Unggah Foto Profil
          </DialogTitle>
          <DialogDescription>
            Semua karyawan wajib memiliki foto profil agar dapat tampil di Team Mood Bar dan modul lainnya. Silakan unggah foto Anda untuk melanjutkan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <Avatar className="h-28 w-28 ring-2 ring-primary/30">
            <AvatarImage src={preview || profile?.avatar_url || undefined} />
            <AvatarFallback className="text-3xl bg-gradient-to-br from-primary/20 to-primary/5">
              {profile?.full_name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPick}
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Mengunggah..." : "Pilih Foto"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            JPG / PNG, maksimal 5MB
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
