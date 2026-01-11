import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Share2,
  Instagram,
  Facebook,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ExternalLink,
  Building2,
  Calendar,
  Image,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SocialMediaPostDetailProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: { id: string; name: string }[];
  onUpdate: () => void;
}

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-5 w-5 text-pink-500" />,
  facebook: <Facebook className="h-5 w-5 text-blue-600" />,
  tiktok: <Share2 className="h-5 w-5" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: <FileText className="h-4 w-4" /> },
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-4 w-4" /> },
  posted: { label: "Published", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-4 w-4" /> },
  published: { label: "Published", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-4 w-4" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: <XCircle className="h-4 w-4" /> },
};

export function SocialMediaPostDetail({
  postId,
  open,
  onOpenChange,
  clients,
  onUpdate,
}: SocialMediaPostDetailProps) {
  const queryClient = useQueryClient();

  // Fetch post details
  const { data: post, isLoading } = useQuery({
    queryKey: ["social-media-post", postId],
    queryFn: async () => {
      if (!postId) return null;
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("*, clients(name)")
        .eq("id", postId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!postId,
  });

  // Update client mutation
  const updateClientMutation = useMutation({
    mutationFn: async (clientId: string | null) => {
      const { error } = await supabase
        .from("social_media_posts")
        .update({ client_id: clientId })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client berhasil diupdate");
      queryClient.invalidateQueries({ queryKey: ["social-media-post", postId] });
      onUpdate();
    },
    onError: (error) => {
      toast.error("Gagal update client: " + error.message);
    },
  });

  if (!post && !isLoading) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {post?.platform && platformIcons[post.platform]}
            Post Detail
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : post ? (
          <div className="space-y-6">
            {/* Status & Platform */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {platformIcons[post.platform] || <Share2 className="h-5 w-5" />}
                <span className="font-medium capitalize">{post.platform}</span>
              </div>
              <Badge className={statusConfig[post.status]?.color || "bg-muted"}>
                <span className="flex items-center gap-1">
                  {statusConfig[post.status]?.icon}
                  {statusConfig[post.status]?.label || post.status}
                </span>
              </Badge>
              {post.content_type && (
                <Badge variant="outline" className="capitalize">
                  {post.content_type}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Client Assignment */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Client
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={post.client_id || "unassigned"}
                  onValueChange={(value) => {
                    updateClientMutation.mutate(value === "unassigned" ? null : value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Caption */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Caption
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">
                  {post.caption || "-"}
                </p>
              </CardContent>
            </Card>

            {/* Hashtags */}
            {post.hashtags && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Hashtags
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-blue-600">{post.hashtags}</p>
                </CardContent>
              </Card>
            )}

            {/* Media */}
            {post.media_urls && post.media_urls.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Image className="h-4 w-4" />
                    Media ({post.media_urls.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {post.media_urls.slice(0, 6).map((url: string, index: number) => (
                      <div
                        key={index}
                        className="aspect-square bg-muted rounded-lg overflow-hidden"
                      >
                        <img
                          src={url}
                          alt={`Media ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Schedule Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Scheduled Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {post.scheduled_at
                      ? format(new Date(post.scheduled_at), "dd MMM yyyy HH:mm")
                      : "-"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Published Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">
                    {post.posted_at
                      ? format(new Date(post.posted_at), "dd MMM yyyy HH:mm")
                      : "-"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Live Post Link */}
            {(post.post_url || post.live_post_url) && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Live Post
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={post.post_url || post.live_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Lihat Post
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Error Message */}
            {post.error_message && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-800">
                    <XCircle className="h-4 w-4" />
                    Error
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-700">{post.error_message}</p>
                </CardContent>
              </Card>
            )}

            {/* Metadata */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created: {format(new Date(post.created_at), "dd MMM yyyy HH:mm")}</p>
              <p>Updated: {format(new Date(post.updated_at), "dd MMM yyyy HH:mm")}</p>
              {post.external_id && <p>External ID: {post.external_id}</p>}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
