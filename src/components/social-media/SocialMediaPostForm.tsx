import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, Instagram, Facebook, Send, Clock, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

const platforms = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "facebook", label: "Facebook", icon: Facebook },
  { value: "tiktok", label: "TikTok", icon: null },
  { value: "twitter", label: "X (Twitter)", icon: null },
  { value: "linkedin", label: "LinkedIn", icon: null },
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
  tiktok: [{ value: "tiktok_video", label: "TikTok Video" }],
  twitter: [{ value: "tweet", label: "Tweet" }],
  linkedin: [{ value: "post", label: "Post" }],
};

export function SocialMediaPostForm() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    clientId: "",
    projectId: "",
    caption: "",
    hashtags: "",
    scheduledAt: "",
    scheduledTime: "",
  });
  const [selectedAccounts, setSelectedAccounts] = useState<number[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");

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

  // Fetch SocialBu settings
  const { data: settings } = useQuery({
    queryKey: ["social-media-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as (typeof data & { auth_token?: string }) | null;
    },
  });

  // Fetch SocialBu connected accounts
  const { data: socialbuAccounts } = useQuery({
    queryKey: ["socialbu-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("socialbu_accounts")
        .select("*")
        .eq("is_active", true)
        .order("platform");
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

  const toggleAccount = (accountId: number) => {
    setSelectedAccounts(prev => 
      prev.includes(accountId) 
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const uploadMediaToSocialBu = async (file: File): Promise<string | null> => {
    try {
      setUploadProgress(`Uploading ${file.name}...`);
      
      // Step 1: Initiate upload
      const { data: initiateData, error: initiateError } = await supabase.functions.invoke("socialbu-media", {
        body: { action: "initiate-upload", fileName: file.name, mimeType: file.type },
      });

      if (initiateError || initiateData.error) {
        throw new Error(initiateData?.error || "Failed to initiate upload");
      }

      // Step 2: Upload file to signed URL
      const uploadResponse = await fetch(initiateData.signed_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file");
      }

      // Step 3: Check status and get upload token
      const { data: statusData, error: statusError } = await supabase.functions.invoke("socialbu-media", {
        body: { action: "check-status", mediaKey: initiateData.key },
      });

      if (statusError || statusData.error) {
        throw new Error(statusData?.error || "Failed to check upload status");
      }

      return statusData.upload_token;
    } catch (error) {
      console.error("Media upload error:", error);
      return null;
    }
  };

  const handleSubmit = async (action: "draft" | "schedule" | "post") => {
    if (!currentUser?.auth_id) {
      toast.error("User tidak terdeteksi");
      return;
    }

    if (selectedAccounts.length === 0 && action !== "draft") {
      toast.error("Pilih minimal 1 akun untuk posting");
      return;
    }

    if (!formData.caption.trim() && action !== "draft") {
      toast.error("Caption tidak boleh kosong");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload media files to SocialBu if any
      let uploadTokens: string[] = [];
      if (mediaFiles.length > 0 && settings?.is_connected) {
        for (const file of mediaFiles) {
          const token = await uploadMediaToSocialBu(file);
          if (token) {
            uploadTokens.push(token);
          }
        }
      }

      // Also upload to our storage for backup
      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        setUploadProgress("Saving backup...");
        for (const file of mediaFiles) {
          const fileName = `${Date.now()}-${file.name}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("company-assets")
            .upload(`social-media/${fileName}`, file);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from("company-assets")
              .getPublicUrl(`social-media/${fileName}`);
            mediaUrls.push(publicUrl);
          }
        }
      }

      // Prepare scheduled_at
      let scheduledAt: string | null = null;
      let publishAt: string | null = null;
      if (action === "schedule" && formData.scheduledAt && formData.scheduledTime) {
        scheduledAt = `${formData.scheduledAt}T${formData.scheduledTime}:00`;
        publishAt = format(new Date(scheduledAt), "yyyy-MM-dd HH:mm:ss");
      }

      // Create post record in our database
      const fullCaption = formData.hashtags 
        ? `${formData.caption}\n\n${formData.hashtags}` 
        : formData.caption;

      const postRecord = {
        client_id: formData.clientId || null,
        project_id: formData.projectId || null,
        staff_id: currentUser.auth_id,
        platform: socialbuAccounts?.find(a => selectedAccounts.includes(a.socialbu_account_id))?.platform || "instagram",
        content_type: "feed",
        media_urls: mediaUrls,
        caption: fullCaption,
        hashtags: formData.hashtags,
        scheduled_at: scheduledAt,
        status: action === "draft" ? "draft" : action === "schedule" ? "scheduled" : "posting",
      };

      const { data: insertedPost, error: insertError } = await supabase
        .from("social_media_posts")
        .insert(postRecord)
        .select()
        .single();

      if (insertError) throw insertError;

      // If connected to SocialBu and not just a draft, create post there too
      if (settings?.is_connected && action !== "draft") {
        setUploadProgress("Creating post in SocialBu...");
        
        const { data: socialbuResult, error: socialbuError } = await supabase.functions.invoke("socialbu-post", {
          body: {
            action: "create",
            postId: insertedPost.id,
            postData: {
              accounts: selectedAccounts,
              content: fullCaption,
              publish_at: publishAt || format(new Date(), "yyyy-MM-dd HH:mm:ss"),
              draft: false,
              existing_attachments: uploadTokens.map(token => ({ upload_token: token })),
            },
          },
        });

        if (socialbuError) {
          console.error("SocialBu error:", socialbuError);
          toast.warning("Post disimpan lokal, tapi gagal dikirim ke SocialBu");
        } else if (socialbuResult?.error) {
          console.error("SocialBu error:", socialbuResult.error);
          toast.warning("Post disimpan lokal, tapi gagal dikirim ke SocialBu: " + socialbuResult.error);
        } else {
          toast.success(
            action === "post" 
              ? "Post berhasil dikirim ke SocialBu!" 
              : "Post berhasil dijadwalkan di SocialBu!"
          );
        }
      } else {
        toast.success(
          action === "draft" 
            ? "Draft tersimpan" 
            : action === "schedule" 
              ? "Post telah dijadwalkan" 
              : "Post sedang diproses..."
        );
      }

      // Reset form
      setFormData({
        clientId: "",
        projectId: "",
        caption: "",
        hashtags: "",
        scheduledAt: "",
        scheduledTime: "",
      });
      setSelectedAccounts([]);
      setMediaFiles([]);
      setUploadProgress("");
      queryClient.invalidateQueries({ queryKey: ["social-media-posts"] });

    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Gagal membuat post");
    } finally {
      setIsSubmitting(false);
      setUploadProgress("");
    }
  };

  const isConnected = settings?.is_connected;

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {!isConnected && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-amber-700 dark:text-amber-400">SocialBu Belum Terhubung</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Hubungkan akun SocialBu di Settings untuk mengaktifkan fitur posting otomatis ke social media.
                  Post akan disimpan sebagai draft lokal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isConnected && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h3 className="font-medium text-green-700 dark:text-green-400">SocialBu Terhubung</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Post akan dikirim langsung ke akun social media yang dipilih melalui SocialBu.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Buat Post Baru</CardTitle>
          <CardDescription>Buat dan jadwalkan konten untuk social media</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Selection */}
          {isConnected && socialbuAccounts && socialbuAccounts.length > 0 && (
            <div className="space-y-3">
              <Label>Pilih Akun untuk Posting *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {socialbuAccounts.map((account) => {
                  const isSelected = selectedAccounts.includes(account.socialbu_account_id);
                  const Icon = platforms.find(p => p.value === account.platform)?.icon;

                  return (
                    <div
                      key={account.id}
                      onClick={() => toggleAccount(account.socialbu_account_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-muted-foreground"
                      }`}
                    >
                      <Checkbox checked={isSelected} />
                      <div className="flex items-center gap-2">
                        {Icon ? <Icon className="h-4 w-4" /> : <span className="text-sm font-bold">T</span>}
                        <div>
                          <p className="text-sm font-medium">{account.account_name || account.platform}</p>
                          <p className="text-xs text-muted-foreground capitalize">{account.platform}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                    <Badge key={index} variant="secondary">
                      {file.name}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <Label>Caption *</Label>
            <Textarea
              value={formData.caption}
              onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              placeholder="Tulis caption untuk post..."
              rows={4}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formData.caption.length} karakter
            </p>
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

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {uploadProgress}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => handleSubmit("draft")}
              disabled={isSubmitting}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FileText className="h-4 w-4 mr-2" />
              Simpan Draft
            </Button>
            <Button
              variant="secondary"
              onClick={() => handleSubmit("schedule")}
              disabled={isSubmitting || !formData.scheduledAt || (!isConnected && selectedAccounts.length === 0)}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Clock className="h-4 w-4 mr-2" />
              Jadwalkan Post
            </Button>
            <Button
              onClick={() => handleSubmit("post")}
              disabled={isSubmitting || (!isConnected && selectedAccounts.length === 0)}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Send className="h-4 w-4 mr-2" />
              Post Sekarang
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
