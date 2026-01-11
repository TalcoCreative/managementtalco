import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

const platformIcons: Record<string, React.ReactNode> = {
  instagram: <Instagram className="h-4 w-4 text-pink-500" />,
  facebook: <Facebook className="h-4 w-4 text-blue-600" />,
  tiktok: <Share2 className="h-4 w-4" />,
};

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: <FileText className="h-3 w-3" /> },
  scheduled: { label: "Scheduled", color: "bg-yellow-100 text-yellow-800", icon: <Clock className="h-3 w-3" /> },
  posted: { label: "Published", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
  published: { label: "Published", color: "bg-green-100 text-green-800", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Failed", color: "bg-red-100 text-red-800", icon: <XCircle className="h-3 w-3" /> },
};

export default function SharedSocialMedia() {
  const { slug } = useParams<{ slug: string }>();

  // Fetch client by slug
  const { data: client, isLoading: loadingClient } = useQuery({
    queryKey: ["shared-social-media-client", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, social_media_slug")
        .eq("social_media_slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch posts for client
  const { data: posts, isLoading: loadingPosts } = useQuery({
    queryKey: ["shared-social-media-posts", client?.id],
    queryFn: async () => {
      if (!client?.id) return [];
      const { data, error } = await supabase
        .from("social_media_posts")
        .select("*")
        .eq("client_id", client.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!client?.id,
  });

  // Calculate stats
  const stats = {
    total: posts?.length || 0,
    scheduled: posts?.filter(p => p.status === "scheduled").length || 0,
    published: posts?.filter(p => p.status === "posted" || p.status === "published").length || 0,
    failed: posts?.filter(p => p.status === "failed").length || 0,
  };

  if (loadingClient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Link Tidak Valid</h2>
            <p className="text-muted-foreground">
              Link social media ini tidak ditemukan atau sudah tidak aktif.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{client.name}</h1>
            <p className="text-muted-foreground">Social Media Activity</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Posts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-500" />
                Scheduled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.scheduled}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                Published
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.published}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Posts Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5" />
              Posts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Platform</TableHead>
                  <TableHead className="max-w-[300px]">Caption</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPosts ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : posts?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Belum ada post
                    </TableCell>
                  </TableRow>
                ) : (
                  posts?.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {platformIcons[post.platform] || <Share2 className="h-4 w-4" />}
                          <span className="capitalize">{post.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate text-sm">{post.caption || "-"}</p>
                      </TableCell>
                      <TableCell>
                        {post.scheduled_at
                          ? format(new Date(post.scheduled_at), "dd MMM yyyy HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig[post.status]?.color || "bg-muted"}>
                          <span className="flex items-center gap-1">
                            {statusConfig[post.status]?.icon}
                            {statusConfig[post.status]?.label || post.status}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(post.post_url || post.live_post_url) && (
                          <Button variant="ghost" size="sm" asChild>
                            <a
                              href={post.post_url || post.live_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>This is a read-only view of social media activity.</p>
        </div>
      </div>
    </div>
  );
}
