import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateKolDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  industries: string[];
}

export function CreateKolDialog({ open, onOpenChange, industries }: CreateKolDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    link_account: "",
    instagram_url: "",
    tiktok_url: "",
    twitter_url: "",
    linkedin_url: "",
    youtube_url: "",
    threads_url: "",
    ig_followers: "",
    tiktok_followers: "",
    twitter_followers: "",
    linkedin_followers: "",
    youtube_followers: "",
    threads_followers: "",
    rate_ig_story: "",
    rate_ig_feed: "",
    rate_ig_reels: "",
    rate_tiktok_video: "",
    rate_youtube_video: "",
    industry: "",
    notes: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const userId = session.session.user.id;

      const { error } = await supabase.from("kol_database").insert({
        name: data.name,
        username: data.username,
        link_account: data.link_account || null,
        instagram_url: data.instagram_url || null,
        tiktok_url: data.tiktok_url || null,
        twitter_url: data.twitter_url || null,
        linkedin_url: data.linkedin_url || null,
        youtube_url: data.youtube_url || null,
        threads_url: data.threads_url || null,
        ig_followers: data.ig_followers ? parseInt(data.ig_followers) : null,
        tiktok_followers: data.tiktok_followers ? parseInt(data.tiktok_followers) : null,
        twitter_followers: data.twitter_followers ? parseInt(data.twitter_followers) : null,
        linkedin_followers: data.linkedin_followers ? parseInt(data.linkedin_followers) : null,
        youtube_followers: data.youtube_followers ? parseInt(data.youtube_followers) : null,
        threads_followers: data.threads_followers ? parseInt(data.threads_followers) : null,
        rate_ig_story: data.rate_ig_story ? parseFloat(data.rate_ig_story) : null,
        rate_ig_feed: data.rate_ig_feed ? parseFloat(data.rate_ig_feed) : null,
        rate_ig_reels: data.rate_ig_reels ? parseFloat(data.rate_ig_reels) : null,
        rate_tiktok_video: data.rate_tiktok_video ? parseFloat(data.rate_tiktok_video) : null,
        rate_youtube_video: data.rate_youtube_video ? parseFloat(data.rate_youtube_video) : null,
        industry: data.industry || null,
        notes: data.notes || null,
        created_by: userId,
        updated_by: userId,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-database"] });
      toast.success("KOL berhasil ditambahkan");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal menambahkan KOL: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      username: "",
      link_account: "",
      instagram_url: "",
      tiktok_url: "",
      twitter_url: "",
      linkedin_url: "",
      youtube_url: "",
      threads_url: "",
      ig_followers: "",
      tiktok_followers: "",
      twitter_followers: "",
      linkedin_followers: "",
      youtube_followers: "",
      threads_followers: "",
      rate_ig_story: "",
      rate_ig_feed: "",
      rate_ig_reels: "",
      rate_tiktok_video: "",
      rate_youtube_video: "",
      industry: "",
      notes: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.username) {
      toast.error("Nama dan Username wajib diisi");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Tambah KOL Baru</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="font-semibold">Informasi Dasar</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nama lengkap KOL"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username *</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    placeholder="Username utama"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="link_account">Link Account Utama</Label>
                <Input
                  id="link_account"
                  value={formData.link_account}
                  onChange={(e) => setFormData({ ...formData, link_account: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            {/* Social Media Links */}
            <div className="space-y-4">
              <h3 className="font-semibold">Social Media</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram_url">Instagram URL</Label>
                  <Input
                    id="instagram_url"
                    value={formData.instagram_url}
                    onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                    placeholder="https://instagram.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ig_followers">IG Followers</Label>
                  <Input
                    id="ig_followers"
                    type="number"
                    value={formData.ig_followers}
                    onChange={(e) => setFormData({ ...formData, ig_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok_url">TikTok URL</Label>
                  <Input
                    id="tiktok_url"
                    value={formData.tiktok_url}
                    onChange={(e) => setFormData({ ...formData, tiktok_url: e.target.value })}
                    placeholder="https://tiktok.com/@..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok_followers">TikTok Followers</Label>
                  <Input
                    id="tiktok_followers"
                    type="number"
                    value={formData.tiktok_followers}
                    onChange={(e) => setFormData({ ...formData, tiktok_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter_url">Twitter (X) URL</Label>
                  <Input
                    id="twitter_url"
                    value={formData.twitter_url}
                    onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                    placeholder="https://twitter.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter_followers">Twitter Followers</Label>
                  <Input
                    id="twitter_followers"
                    type="number"
                    value={formData.twitter_followers}
                    onChange={(e) => setFormData({ ...formData, twitter_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube_url">YouTube URL</Label>
                  <Input
                    id="youtube_url"
                    value={formData.youtube_url}
                    onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                    placeholder="https://youtube.com/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube_followers">YouTube Subscribers</Label>
                  <Input
                    id="youtube_followers"
                    type="number"
                    value={formData.youtube_followers}
                    onChange={(e) => setFormData({ ...formData, youtube_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="linkedin_url"
                    value={formData.linkedin_url}
                    onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin_followers">LinkedIn Followers</Label>
                  <Input
                    id="linkedin_followers"
                    type="number"
                    value={formData.linkedin_followers}
                    onChange={(e) => setFormData({ ...formData, linkedin_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threads_url">Threads URL</Label>
                  <Input
                    id="threads_url"
                    value={formData.threads_url}
                    onChange={(e) => setFormData({ ...formData, threads_url: e.target.value })}
                    placeholder="https://threads.net/@..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="threads_followers">Threads Followers</Label>
                  <Input
                    id="threads_followers"
                    type="number"
                    value={formData.threads_followers}
                    onChange={(e) => setFormData({ ...formData, threads_followers: e.target.value })}
                    placeholder="100000"
                  />
                </div>
              </div>
            </div>

            {/* Ratecard */}
            <div className="space-y-4">
              <h3 className="font-semibold">Ratecard</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate_ig_story">IG Story (Rp)</Label>
                  <Input
                    id="rate_ig_story"
                    type="number"
                    value={formData.rate_ig_story}
                    onChange={(e) => setFormData({ ...formData, rate_ig_story: e.target.value })}
                    placeholder="500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_ig_feed">IG Feed (Rp)</Label>
                  <Input
                    id="rate_ig_feed"
                    type="number"
                    value={formData.rate_ig_feed}
                    onChange={(e) => setFormData({ ...formData, rate_ig_feed: e.target.value })}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_ig_reels">IG Reels (Rp)</Label>
                  <Input
                    id="rate_ig_reels"
                    type="number"
                    value={formData.rate_ig_reels}
                    onChange={(e) => setFormData({ ...formData, rate_ig_reels: e.target.value })}
                    placeholder="1500000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_tiktok_video">TikTok Video (Rp)</Label>
                  <Input
                    id="rate_tiktok_video"
                    type="number"
                    value={formData.rate_tiktok_video}
                    onChange={(e) => setFormData({ ...formData, rate_tiktok_video: e.target.value })}
                    placeholder="2000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rate_youtube_video">YouTube Video (Rp)</Label>
                  <Input
                    id="rate_youtube_video"
                    type="number"
                    value={formData.rate_youtube_video}
                    onChange={(e) => setFormData({ ...formData, rate_youtube_video: e.target.value })}
                    placeholder="5000000"
                  />
                </div>
              </div>
            </div>

            {/* Industry & Notes */}
            <div className="space-y-4">
              <h3 className="font-semibold">Lainnya</h3>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry / Niche</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => setFormData({ ...formData, industry: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {industries.map((industry) => (
                      <SelectItem key={industry} value={industry}>
                        {industry}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Remarks</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Catatan tambahan..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
