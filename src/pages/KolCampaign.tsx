import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
import { Plus, Search, Eye, MapPin, Check, X } from "lucide-react";
import { format } from "date-fns";
import { CreateCampaignDialog } from "@/components/kol/CreateCampaignDialog";
import { CampaignDetailDialog } from "@/components/kol/CampaignDetailDialog";

const statusColors: Record<string, string> = {
  contacted: "bg-gray-500",
  negotiation: "bg-yellow-500",
  deal: "bg-blue-500",
  production: "bg-purple-500",
  visit: "bg-cyan-500",
  ready_to_post: "bg-orange-500",
  posted: "bg-green-500",
  completed: "bg-emerald-600",
};

const statusLabels: Record<string, string> = {
  contacted: "Baru Dikontak",
  negotiation: "Nego",
  deal: "Deal",
  production: "Produksi",
  visit: "Visit",
  ready_to_post: "Siap Posting",
  posted: "Posted",
  completed: "Selesai",
};

const platformLabels: Record<string, string> = {
  ig_story: "IG Story",
  ig_feed: "IG Feed",
  ig_reels: "IG Reels",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export default function KolCampaign() {
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [postedFilter, setPostedFilter] = useState<string>("all");
  const [paidFilter, setPaidFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["kol-campaigns", searchQuery, clientFilter, statusFilter, postedFilter, paidFilter],
    queryFn: async () => {
      let query = supabase
        .from("kol_campaigns")
        .select(`
          *,
          kol:kol_database(id, name, username),
          client:clients(id, name),
          project:projects(id, title),
          pic:profiles!kol_campaigns_pic_id_fkey(id, full_name)
        `)
        .order("updated_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (clientFilter && clientFilter !== "all") {
        query = query.eq("client_id", clientFilter);
      }

      if (postedFilter === "yes") {
        query = query.eq("is_posted", true);
      } else if (postedFilter === "no") {
        query = query.eq("is_posted", false);
      }

      if (paidFilter === "yes") {
        query = query.eq("is_paid", true);
      } else if (paidFilter === "no") {
        query = query.eq("is_paid", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Apply search filter in memory
      let filteredData = data || [];
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredData = filteredData.filter(
          (c: any) =>
            c.kol?.name?.toLowerCase().includes(lowerQuery) ||
            c.campaign_name?.toLowerCase().includes(lowerQuery)
        );
      }

      return filteredData;
    },
  });

  useEffect(() => {
    if (!detailDialogOpen || !selectedCampaign || !campaigns) return;
    const latest = campaigns.find((c: any) => c.id === selectedCampaign.id);
    if (latest && latest.updated_at !== selectedCampaign.updated_at) {
      setSelectedCampaign(latest);
    }
  }, [campaigns, detailDialogOpen, selectedCampaign]);

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

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleViewDetail = (campaign: any) => {
    setSelectedCampaign(campaign);
    setDetailDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">KOL Campaign</h1>
            <p className="text-muted-foreground">
              Track and manage KOL campaigns and activations
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Assign KOL ke Campaign
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by KOL name or campaign..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={postedFilter} onValueChange={setPostedFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Posted" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Posted</SelectItem>
                  <SelectItem value="no">Belum Post</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paidFilter} onValueChange={setPaidFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="yes">Paid</SelectItem>
                  <SelectItem value="no">Unpaid</SelectItem>
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
                  <TableHead>KOL</TableHead>
                  <TableHead>Client / Campaign</TableHead>
                  <TableHead>Platform</TableHead>
                  <TableHead>Visit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Last Update</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : campaigns?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      No campaigns found
                    </TableCell>
                  </TableRow>
                ) : (
                  campaigns?.map((campaign: any) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.kol?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            @{campaign.kol?.username}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{campaign.client?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {campaign.campaign_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {platformLabels[campaign.platform] || campaign.platform}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {campaign.is_visit ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <MapPin className="h-4 w-4" />
                            <span className="text-sm">{campaign.visit_location || "Yes"}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[campaign.status]} text-white`}>
                          {statusLabels[campaign.status] || campaign.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{formatCurrency(campaign.fee)}</p>
                          {campaign.is_paid ? (
                            <Badge variant="outline" className="text-green-600 border-green-600">
                              <Check className="h-3 w-3 mr-1" /> Paid
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-600">
                              <X className="h-3 w-3 mr-1" /> Unpaid
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {campaign.is_posted ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="h-4 w-4" />
                            {campaign.post_link && (
                              <a
                                href={campaign.post_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline"
                              >
                                View
                              </a>
                            )}
                          </div>
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{campaign.pic?.full_name || "-"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {format(new Date(campaign.updated_at), "dd MMM yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetail(campaign)}
                        >
                          <Eye className="h-4 w-4" />
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

      <CreateCampaignDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {selectedCampaign && (
        <CampaignDetailDialog
          open={detailDialogOpen}
          onOpenChange={setDetailDialogOpen}
          campaign={selectedCampaign}
        />
      )}
    </AppLayout>
  );
}
