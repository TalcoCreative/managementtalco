import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { 
  Instagram, 
  Facebook, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Send,
  FileText,
  TrendingUp,
  Users,
  Calendar,
  Plus,
  CalendarPlus
} from "lucide-react";

interface SocialMediaDashboardProps {
  onCreatePost?: () => void;
}

const platformIcons = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: null,
};

const statusConfig = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: FileText },
  scheduled: { label: "Terjadwal", color: "bg-blue-500/10 text-blue-600", icon: Clock },
  posting: { label: "Posting...", color: "bg-amber-500/10 text-amber-600", icon: Send },
  posted: { label: "Berhasil", color: "bg-green-500/10 text-green-600", icon: CheckCircle2 },
  failed: { label: "Gagal", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const contentTypeLabels = {
  feed: "Feed",
  reels: "Reels",
  story: "Story",
  carousel: "Carousel",
  tiktok_video: "TikTok Video",
};

export function SocialMediaDashboard({ onCreatePost }: SocialMediaDashboardProps) {
  // Fetch posts with related data
  const { data: posts, isLoading } = useQuery({
    queryKey: ["social-media-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_media_posts")
        .select(`
          *,
          client:clients(id, name),
          project:projects(id, title)
        `)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch staff profiles for display
  const { data: profiles } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const getStaffName = (staffId: string) => {
    const profile = profiles?.find(p => p.id === staffId);
    return profile?.full_name || "Unknown";
  };

  // Calculate stats
  const stats = {
    total: posts?.length || 0,
    posted: posts?.filter(p => p.status === "posted").length || 0,
    scheduled: posts?.filter(p => p.status === "scheduled").length || 0,
    failed: posts?.filter(p => p.status === "failed").length || 0,
  };

  // Posts by client
  const postsByClient = posts?.reduce((acc, post) => {
    const clientName = post.client?.name || "Tanpa Klien";
    acc[clientName] = (acc[clientName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Posts by staff
  const postsByStaff = posts?.reduce((acc, post) => {
    const staffName = getStaffName(post.staff_id);
    acc[staffName] = (acc[staffName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={onCreatePost} className="gap-2">
          <Plus className="h-4 w-4" />
          Buat Post Baru
        </Button>
        <Button variant="outline" onClick={onCreatePost} className="gap-2">
          <CalendarPlus className="h-4 w-4" />
          Jadwalkan Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Post</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Berhasil</p>
                <p className="text-2xl font-bold">{stats.posted}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Terjadwal</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gagal</p>
                <p className="text-2xl font-bold">{stats.failed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats by Client and Staff */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post per Klien</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(postsByClient)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([client, count]) => (
                  <div key={client} className="flex items-center justify-between">
                    <span className="text-sm">{client}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              {Object.keys(postsByClient).length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada data</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Post per Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(postsByStaff)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([staff, count]) => (
                  <div key={staff} className="flex items-center justify-between">
                    <span className="text-sm">{staff}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              {Object.keys(postsByStaff).length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Posts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat Posting</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Platform</TableHead>
                <TableHead>Klien / Project</TableHead>
                <TableHead>Jenis</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tanggal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : posts?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada post
                  </TableCell>
                </TableRow>
              ) : (
                posts?.map((post) => {
                  const PlatformIcon = platformIcons[post.platform as keyof typeof platformIcons];
                  const statusInfo = statusConfig[post.status as keyof typeof statusConfig];
                  const StatusIcon = statusInfo?.icon;

                  return (
                    <TableRow key={post.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {PlatformIcon && <PlatformIcon className="h-4 w-4" />}
                          <span className="capitalize">{post.platform}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{post.client?.name || "-"}</p>
                          <p className="text-sm text-muted-foreground">{post.project?.title || "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contentTypeLabels[post.content_type as keyof typeof contentTypeLabels] || post.content_type}
                      </TableCell>
                      <TableCell>{getStaffName(post.staff_id)}</TableCell>
                      <TableCell>
                        <Badge className={statusInfo?.color}>
                          {StatusIcon && <StatusIcon className="h-3 w-3 mr-1" />}
                          {statusInfo?.label || post.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(post.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
