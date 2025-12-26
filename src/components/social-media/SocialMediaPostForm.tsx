import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Instagram, Facebook } from "lucide-react";
import { format } from "date-fns";

const platforms = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "tiktok", label: "TikTok", icon: null },
];

const contentTypes = {
  instagram: [
    { value: "feed", label: "Feed Post" },
    { value: "reels", label: "Reels" },
    { value: "story", label: "Story" },
    { value: "carousel", label: "Carousel" },
  ],
  facebook: [
    { value: "feed", label: "Feed Post" },
    { value: "reels", label: "Reels" },
    { value: "story", label: "Story" },
  ],
  tiktok: [
    { value: "tiktok_video", label: "TikTok Video" },
  ],
};

export function SocialMediaPostForm() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    clientId: "",
    projectId: "",
    platform: "",
    contentType: "",
    caption: "",
    hashtags: "",
    scheduledAt: "",
    scheduledTime: "",
  });
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      return { ...data, auth_id: session.user.id };
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

  // Fetch projects based on selected client
  const { data: projects } = useQuery({
    queryKey: ["projects", formData.clientId],
    queryFn: async () => {
      if (!formData.clientId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", formData.clientId)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!formData.clientId,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setMediaFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (action: "draft" | "schedule" | "post") => {
    if (!currentUser?.auth_id) {
      toast.error("User tidak terdeteksi");
      return;
    }

    if (!formData.platform || !formData.contentType) {
      toast.error("Pilih platform dan jenis konten");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload media files if any
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        for (const file of mediaFiles) {
          const fileName = `${Date.now()}-${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("company-assets")
            .upload(`social-media/${fileName}`, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("company-assets")
            .getPublicUrl(`social-media/${fileName}`);
          
          mediaUrls.push(publicUrl);
        }
      }

      // Prepare scheduled_at
      let scheduledAt: string | null = null;
      if (action === "schedule" && formData.scheduledAt && formData.scheduledTime) {
        scheduledAt = `${formData.scheduledAt}T${formData.scheduledTime}:00`;
      }

      // Create post record
      const { error } = await supabase
        .from("social_media_posts")
        .insert({
          client_id: formData.clientId || null,
          project_id: formData.projectId || null,
          staff_id: currentUser.auth_id,
          platform: formData.platform,
          content_type: formData.contentType,
          media_urls: mediaUrls,
          caption: formData.caption,
          hashtags: formData.hashtags,
          scheduled_at: scheduledAt,
          status: action === "post" ? "posting" : action === "schedule" ? "scheduled" : "draft",
        });

      if (error) throw error;

      toast.success(
        action === "post" 
          ? "Post sedang diproses..." 
          : action === "schedule" 
            ? "Post telah dijadwalkan" 
            : "Draft tersimpan"
      );

      // Reset form
      setFormData({
        clientId: "",
        projectId: "",
        platform: "",
        contentType: "",
        caption: "",
        hashtags: "",
        scheduledAt: "",
        scheduledTime: "",
      });
      setMediaFiles([]);
      queryClient.invalidateQueries({ queryKey: ["social-media-posts"] });

    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Gagal membuat post");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableContentTypes = formData.platform 
    ? contentTypes[formData.platform as keyof typeof contentTypes] || []
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buat Post Baru</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label>Klien</Label>
            <Select
              value={formData.clientId}
              onValueChange={(value) => setFormData({ ...formData, clientId: value, projectId: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih klien" />
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

          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={formData.projectId}
              onValueChange={(value) => setFormData({ ...formData, projectId: value })}
              disabled={!formData.clientId}
            >
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

          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Platform *</Label>
            <Select
              value={formData.platform}
              onValueChange={(value) => setFormData({ ...formData, platform: value, contentType: "" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih platform" />
              </SelectTrigger>
              <SelectContent>
                {platforms.map((platform) => (
                  <SelectItem key={platform.value} value={platform.value}>
                    <div className="flex items-center gap-2">
                      {platform.icon && <platform.icon className="h-4 w-4" />}
                      {platform.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Content Type Selection */}
          <div className="space-y-2">
            <Label>Jenis Konten *</Label>
            <Select
              value={formData.contentType}
              onValueChange={(value) => setFormData({ ...formData, contentType: value })}
              disabled={!formData.platform}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih jenis konten" />
              </SelectTrigger>
              <SelectContent>
                {availableContentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Media Upload */}
        <div className="space-y-2">
          <Label>Upload Media</Label>
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
              id="media-upload"
            />
            <label 
              htmlFor="media-upload" 
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click untuk upload gambar/video
              </span>
            </label>
            {mediaFiles.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {mediaFiles.map((file, index) => (
                  <div key={index} className="text-sm bg-muted px-2 py-1 rounded">
                    {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Caption */}
        <div className="space-y-2">
          <Label>Caption</Label>
          <Textarea
            value={formData.caption}
            onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
            placeholder="Tulis caption untuk post..."
            rows={4}
          />
        </div>

        {/* Hashtags */}
        <div className="space-y-2">
          <Label>Hashtags</Label>
          <Input
            value={formData.hashtags}
            onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
            placeholder="#branding #marketing #socialmedia"
          />
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tanggal Jadwal (opsional)</Label>
            <Input
              type="date"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <div className="space-y-2">
            <Label>Waktu Jadwal</Label>
            <Input
              type="time"
              value={formData.scheduledTime}
              onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
            />
          </div>
        </div>

        {/* Staff Info */}
        <div className="bg-muted/50 p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">
            Staff: <span className="font-medium text-foreground">{currentUser?.full_name || "-"}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => handleSubmit("draft")}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Simpan Draft
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleSubmit("schedule")}
            disabled={isSubmitting || !formData.scheduledAt}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Jadwalkan Post
          </Button>
          <Button
            onClick={() => handleSubmit("post")}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Post Sekarang
          </Button>
        </div>

        {/* Note about API */}
        <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            ⚠️ Untuk mengaktifkan posting otomatis, hubungkan akun social media di tab "Akun Terhubung" 
            dan pastikan API credentials sudah dikonfigurasi.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
