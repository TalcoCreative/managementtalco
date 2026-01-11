import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Share2,
  Settings,
  Instagram,
  Facebook,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Filter,
  Building2,
  RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SocialMediaPostDetail } from "@/components/social-media/SocialMediaPostDetail";

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

export default function SocialMediaModule() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [bulkClientId, setBulkClientId] = useState<string>("");
  
  const clientFilter = searchParams.get("client") || "all";
  const platformFilter = searchParams.get("platform") || "all";
  const statusFilter = searchParams.get("status") || "all";

  // Fetch posts
  const { data: posts, isLoading, refetch } = useQuery({
    queryKey: ["social-media-posts", clientFilter, platformFilter, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("social_media_posts")
        .select("*, clients(name)")
        .order("created_at", { ascending: false });

      if (clientFilter && clientFilter !== "all") {
        query = query.eq("client_id", clientFilter);
      }
      if (platformFilter && platformFilter !== "all") {
        query = query.eq("platform", platformFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch clients for filter and assignment
  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
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
    unassigned: posts?.filter(p => !p.client_id).length || 0,
  };

  // Client breakdown
  const clientBreakdown = posts?.reduce((acc, post) => {
    const clientName = post.clients?.name || "Unassigned";
    acc[clientName] = (acc[clientName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Platform breakdown
  const platformBreakdown = posts?.reduce((acc, post) => {
    acc[post.platform] = (acc[post.platform] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    setSearchParams(params);
  };

  const handleBulkAssign = async () => {
    if (!bulkClientId || selectedPosts.length === 0) {
      toast.error("Pilih client dan posts terlebih dahulu");
      return;
    }

    const { error } = await supabase
      .from("social_media_posts")
      .update({ client_id: bulkClientId === "unassign" ? null : bulkClientId })
      .in("id", selectedPosts);

    if (error) {
      toast.error("Gagal mengupdate client");
      return;
    }

    toast.success("Client berhasil diupdate");
    setSelectedPosts([]);
    setBulkClientId("");
    refetch();
  };

  const toggleSelectAll = () => {
    if (selectedPosts.length === posts?.length) {
      setSelectedPosts([]);
    } else {
      setSelectedPosts(posts?.map(p => p.id) || []);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Share2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Social Media</h1>
              <p className="text-muted-foreground">
                Monitoring & reporting aktivitas social media
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => navigate("/social-media/settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4 text-orange-500" />
                Unassigned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.unassigned}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="posts" className="w-full">
          <TabsList>
            <TabsTrigger value="posts">Post List</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Filter:</span>
                  </div>
                  <Select value={clientFilter} onValueChange={(v) => handleFilterChange("client", v)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Clients" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={platformFilter} onValueChange={(v) => handleFilterChange("platform", v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Platforms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Platforms</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => handleFilterChange("status", v)}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="posted">Published</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Actions */}
            {selectedPosts.length > 0 && (
              <Card className="border-primary">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {selectedPosts.length} post dipilih
                    </span>
                    <Select value={bulkClientId} onValueChange={setBulkClientId}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Pilih Client" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassign">Unassign Client</SelectItem>
                        {clients?.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleBulkAssign} size="sm">
                      Assign Client
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedPosts([])}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Posts Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedPosts.length === posts?.length && posts?.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Platform</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead className="max-w-[300px]">Caption</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : posts?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          Belum ada post
                        </TableCell>
                      </TableRow>
                    ) : (
                      posts?.map((post) => (
                        <TableRow
                          key={post.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedPostId(post.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedPosts.includes(post.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedPosts([...selectedPosts, post.id]);
                                } else {
                                  setSelectedPosts(selectedPosts.filter(id => id !== post.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {platformIcons[post.platform] || <Share2 className="h-4 w-4" />}
                              <span className="capitalize">{post.platform}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {post.clients?.name ? (
                              <Badge variant="outline">{post.clients.name}</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-orange-600">
                                Unassigned
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[300px]">
                            <p className="truncate text-sm">
                              {post.caption || "-"}
                            </p>
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
                          <TableCell className="text-muted-foreground text-sm">
                            {format(new Date(post.updated_at), "dd MMM yyyy")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* Per Client */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Posts per Client
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(clientBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 10)
                      .map(([client, count]) => (
                        <div key={client} className="flex items-center justify-between">
                          <span className={client === "Unassigned" ? "text-orange-600" : ""}>
                            {client}
                          </span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    {Object.keys(clientBreakdown).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Belum ada data</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Per Platform */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Posts per Platform
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(platformBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([platform, count]) => (
                        <div key={platform} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {platformIcons[platform] || <Share2 className="h-4 w-4" />}
                            <span className="capitalize">{platform}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      ))}
                    {Object.keys(platformBreakdown).length === 0 && (
                      <p className="text-muted-foreground text-center py-4">Belum ada data</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Post Detail Dialog */}
      <SocialMediaPostDetail
        postId={selectedPostId}
        open={!!selectedPostId}
        onOpenChange={(open) => !open && setSelectedPostId(null)}
        clients={clients || []}
        onUpdate={refetch}
      />
    </AppLayout>
  );
}
