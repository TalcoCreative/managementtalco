import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Share2,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Link2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";

interface ClientSocialMediaSectionProps {
  clientId: string;
  client: {
    id: string;
    name: string;
    social_media_slug?: string;
  };
  canEdit: boolean;
}

export function ClientSocialMediaSection({
  clientId,
  client,
  canEdit,
}: ClientSocialMediaSectionProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  // Fetch posts for this client
  const { data: posts, isLoading } = useQuery({
    queryKey: ["client-social-media-posts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = {
    total: posts?.length || 0,
    scheduled: posts?.filter(p => p.status === "scheduled").length || 0,
    published: posts?.filter(p => p.status === "posted" || p.status === "published").length || 0,
    failed: posts?.filter(p => p.status === "failed").length || 0,
  };

  // Generate slug
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      + "-" + Math.random().toString(36).substring(2, 8);
  };

  // Generate/regenerate shareable link
  const handleGenerateLink = async () => {
    setIsGenerating(true);
    try {
      const newSlug = generateSlug(client.name);
      const { error } = await supabase
        .from("clients")
        .update({ social_media_slug: newSlug })
        .eq("id", clientId);

      if (error) throw error;
      
      toast.success("Link berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    } catch (error: any) {
      toast.error("Gagal membuat link: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const shareableUrl = client.social_media_slug
    ? `${window.location.origin}/social-media/client/${client.social_media_slug}`
    : null;

  const handleCopyLink = () => {
    if (shareableUrl) {
      navigator.clipboard.writeText(shareableUrl);
      toast.success("Link berhasil disalin");
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Posts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Published</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold text-yellow-600">{stats.scheduled}</p>
                <p className="text-xs text-muted-foreground">Scheduled</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Link */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Loading..." : `${stats.total} total posts untuk client ini`}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/social-media?client=${clientId}`}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Lihat Semua Posts
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Shareable Link */}
      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Shareable Link (Read-only untuk Client)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {shareableUrl ? (
              <div className="flex gap-2">
                <Input
                  value={shareableUrl}
                  readOnly
                  className="flex-1 text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleGenerateLink}
                  disabled={isGenerating}
                >
                  <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={shareableUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleGenerateLink}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Generate Shareable Link
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Link ini bisa dibagikan ke client untuk melihat aktivitas social media mereka (read-only, tanpa login).
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
