import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Instagram, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateKolDialog } from "@/components/kol/CreateKolDialog";
import { EditKolDialog } from "@/components/kol/EditKolDialog";
import { ExcelActions } from "@/components/shared/ExcelActions";
import { KOL_COLUMNS } from "@/lib/excel-utils";

const categoryColors: Record<string, string> = {
  nano: "bg-gray-500",
  micro: "bg-blue-500",
  macro: "bg-purple-500",
  mega: "bg-yellow-500",
};

const industries = [
  "Fashion & Beauty",
  "Food & Beverage",
  "Travel & Lifestyle",
  "Technology",
  "Health & Fitness",
  "Entertainment",
  "Education",
  "Business & Finance",
  "Parenting",
  "Gaming",
  "Automotive",
  "Other",
];

export default function KolDatabase() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [followersFilter, setFollowersFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedKol, setSelectedKol] = useState<any>(null);

  const { data: kols, isLoading } = useQuery({
    queryKey: ["kol-database", searchQuery, categoryFilter, industryFilter, followersFilter],
    queryFn: async () => {
      let query = supabase
        .from("kol_database")
        .select("*")
        .order("updated_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`);
      }

      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      if (industryFilter && industryFilter !== "all") {
        query = query.eq("industry", industryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Apply followers filter in memory
      let filteredData = data || [];
      if (followersFilter && followersFilter !== "all") {
        filteredData = filteredData.filter((kol: any) => {
          const maxFollowers = Math.max(
            kol.ig_followers || 0,
            kol.tiktok_followers || 0,
            kol.twitter_followers || 0,
            kol.linkedin_followers || 0,
            kol.youtube_followers || 0,
            kol.threads_followers || 0
          );

          switch (followersFilter) {
            case "0-10k":
              return maxFollowers < 10000;
            case "10k-100k":
              return maxFollowers >= 10000 && maxFollowers < 100000;
            case "100k-1m":
              return maxFollowers >= 100000 && maxFollowers < 1000000;
            case "1m+":
              return maxFollowers >= 1000000;
            default:
              return true;
          }
        });
      }

      return filteredData;
    },
  });

  const formatFollowers = (count: number | null) => {
    if (!count) return "-";
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleEdit = (kol: any) => {
    setSelectedKol(kol);
    setEditDialogOpen(true);
  };

  // Export data for Excel
  const exportData = kols?.map(k => ({
    name: k.name,
    username: k.username,
    category: k.category,
    industry: k.industry || '',
    instagram_url: k.instagram_url || '',
    ig_followers: k.ig_followers || '',
    tiktok_url: k.tiktok_url || '',
    tiktok_followers: k.tiktok_followers || '',
    youtube_url: k.youtube_url || '',
    youtube_followers: k.youtube_followers || '',
    rate_ig_story: k.rate_ig_story || '',
    rate_ig_feed: k.rate_ig_feed || '',
    rate_ig_reels: k.rate_ig_reels || '',
    rate_tiktok_video: k.rate_tiktok_video || '',
    rate_youtube_video: k.rate_youtube_video || '',
    notes: k.notes || '',
  })) || [];

  const handleImportKol = async (data: any[]) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Tidak terautentikasi");
      return;
    }

    for (const row of data) {
      if (!row.name || !row.username) continue;
      
      // Check if KOL exists
      const { data: existing } = await supabase
        .from("kol_database")
        .select("id")
        .eq("username", row.username)
        .single();

      const kolData = {
        name: row.name,
        username: row.username,
        category: row.category || 'micro',
        industry: row.industry || null,
        instagram_url: row.instagram_url || null,
        ig_followers: row.ig_followers ? Number(row.ig_followers) : null,
        tiktok_url: row.tiktok_url || null,
        tiktok_followers: row.tiktok_followers ? Number(row.tiktok_followers) : null,
        youtube_url: row.youtube_url || null,
        youtube_followers: row.youtube_followers ? Number(row.youtube_followers) : null,
        rate_ig_story: row.rate_ig_story ? Number(row.rate_ig_story) : null,
        rate_ig_feed: row.rate_ig_feed ? Number(row.rate_ig_feed) : null,
        rate_ig_reels: row.rate_ig_reels ? Number(row.rate_ig_reels) : null,
        rate_tiktok_video: row.rate_tiktok_video ? Number(row.rate_tiktok_video) : null,
        rate_youtube_video: row.rate_youtube_video ? Number(row.rate_youtube_video) : null,
        notes: row.notes || null,
        updated_by: session.session.user.id,
      };

      if (existing) {
        await supabase
          .from("kol_database")
          .update(kolData)
          .eq("id", existing.id);
      } else {
        await supabase.from("kol_database").insert({
          ...kolData,
          created_by: session.session.user.id,
        });
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["kol-database"] });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KOL Database</h1>
            <p className="text-muted-foreground">
              Manage your Key Opinion Leaders database
            </p>
          </div>
          <div className="flex gap-2">
            <ExcelActions
              data={exportData}
              columns={KOL_COLUMNS}
              filename="kol_database"
              onImport={handleImportKol}
            />
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah KOL
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or username..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="nano">Nano</SelectItem>
                  <SelectItem value="micro">Micro</SelectItem>
                  <SelectItem value="macro">Macro</SelectItem>
                  <SelectItem value="mega">Mega</SelectItem>
                </SelectContent>
              </Select>
              <Select value={industryFilter} onValueChange={setIndustryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Industries</SelectItem>
                  {industries.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={followersFilter} onValueChange={setFollowersFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Followers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Followers</SelectItem>
                  <SelectItem value="0-10k">0 - 10K</SelectItem>
                  <SelectItem value="10k-100k">10K - 100K</SelectItem>
                  <SelectItem value="100k-1m">100K - 1M</SelectItem>
                  <SelectItem value="1m+">1M+</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama / Username</TableHead>
                  <TableHead>Social Media</TableHead>
                  <TableHead>Followers</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Industry</TableHead>
                  <TableHead>Ratecard</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : kols?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No KOL found
                    </TableCell>
                  </TableRow>
                ) : (
                  kols?.map((kol: any) => (
                    <TableRow key={kol.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{kol.name}</p>
                          <p className="text-sm text-muted-foreground">@{kol.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {kol.instagram_url && (
                            <a href={kol.instagram_url} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-600">
                              <Instagram className="h-4 w-4" />
                            </a>
                          )}
                          {kol.tiktok_url && (
                            <a href={kol.tiktok_url} target="_blank" rel="noopener noreferrer" className="hover:text-primary">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {kol.ig_followers && (
                            <p>IG: {formatFollowers(kol.ig_followers)}</p>
                          )}
                          {kol.tiktok_followers && (
                            <p>TikTok: {formatFollowers(kol.tiktok_followers)}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${categoryColors[kol.category]} text-white`}>
                          {kol.category.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{kol.industry || "-"}</TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          {kol.rate_ig_story && (
                            <p>Story: {formatCurrency(kol.rate_ig_story)}</p>
                          )}
                          {kol.rate_ig_feed && (
                            <p>Feed: {formatCurrency(kol.rate_ig_feed)}</p>
                          )}
                          {kol.rate_ig_reels && (
                            <p>Reels: {formatCurrency(kol.rate_ig_reels)}</p>
                          )}
                          {kol.rate_tiktok_video && (
                            <p>TikTok: {formatCurrency(kol.rate_tiktok_video)}</p>
                          )}
                          {kol.rate_youtube_video && (
                            <p>YouTube: {formatCurrency(kol.rate_youtube_video)}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{format(new Date(kol.updated_at), "dd MMM yyyy")}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(kol)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateKolDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        industries={industries}
      />

      {selectedKol && (
        <EditKolDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          kol={selectedKol}
          industries={industries}
        />
      )}
    </AppLayout>
  );
}
