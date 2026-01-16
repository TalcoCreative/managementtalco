import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  FileText, 
  Search, 
  Calendar, 
  ExternalLink,
  MoreVertical,
  Trash2,
  Copy
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreateEditorialPlanDialog } from "@/components/editorial-plan/CreateEditorialPlanDialog";

interface EditorialPlan {
  id: string;
  title: string;
  slug: string;
  period: string | null;
  client_id: string;
  created_at: string;
  created_by: string;
  clients?: {
    id: string;
    name: string;
  };
  profiles?: {
    full_name: string;
  };
  _count?: {
    slides: number;
  };
}

export default function EditorialPlan() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [clientFilter, setClientFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Fetch clients
  const { data: clients } = useQuery({
    queryKey: ["clients-for-ep"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch editorial plans
  const { data: plans, isLoading, refetch } = useQuery({
    queryKey: ["editorial-plans", searchQuery, clientFilter],
    queryFn: async () => {
      let query = supabase
        .from("editorial_plans")
        .select(`
          *,
          clients(id, name),
          profiles(full_name)
        `)
        .order("created_at", { ascending: false });

      if (clientFilter && clientFilter !== "all") {
        query = query.eq("client_id", clientFilter);
      }

      if (searchQuery) {
        query = query.or(`title.ilike.%${searchQuery}%,slug.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get slide counts for each plan
      const plansWithCounts = await Promise.all(
        (data || []).map(async (plan) => {
          const { count } = await supabase
            .from("editorial_slides")
            .select("*", { count: "exact", head: true })
            .eq("ep_id", plan.id);
          return { ...plan, _count: { slides: count || 0 } };
        })
      );

      return plansWithCounts as EditorialPlan[];
    },
  });

  const handleDelete = async (planId: string) => {
    if (!confirm("Hapus Editorial Plan ini? Semua slides akan ikut terhapus.")) return;

    const { error } = await supabase
      .from("editorial_plans")
      .delete()
      .eq("id", planId);

    if (error) {
      toast.error("Gagal menghapus EP");
      return;
    }

    toast.success("EP berhasil dihapus");
    refetch();
  };

  const handleCopyLink = async (plan: EditorialPlan) => {
    const clientSlug = plan.clients?.name.toLowerCase().replace(/\s+/g, "-") || "client";
    const url = `${window.location.origin}/ep/${clientSlug}/${plan.slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  const getClientSlug = (plan: EditorialPlan) => {
    return plan.clients?.name.toLowerCase().replace(/\s+/g, "-") || "client";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold">Editorial Plan</h1>
              <p className="text-muted-foreground">
                Buat dan kelola content plan untuk setiap client
              </p>
            </div>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Buat EP Baru
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari editorial plan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Client</SelectItem>
              {clients?.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Plans Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="space-y-2">
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                </CardHeader>
                <CardContent>
                  <div className="h-4 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : plans?.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Belum ada Editorial Plan</h3>
            <p className="text-muted-foreground mb-4">
              Buat editorial plan pertama untuk mulai merencanakan konten
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Buat EP Baru
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {plans?.map((plan) => (
              <Card 
                key={plan.id} 
                className="group hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => navigate(`/ep/${getClientSlug(plan)}/${plan.slug}/edit`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <CardTitle className="text-lg line-clamp-1">
                        {plan.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {plan.clients?.name}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleCopyLink(plan);
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/ep/${getClientSlug(plan)}/${plan.slug}`, "_blank");
                        }}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Lihat Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(plan.id);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {plan.period && (
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{plan.period}</span>
                      </div>
                    )}
                    <Badge variant="secondary">
                      {plan._count?.slides || 0} slides
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Dibuat {format(new Date(plan.created_at), "dd MMM yyyy")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateEditorialPlanDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => {
          refetch();
          setCreateDialogOpen(false);
        }}
      />
    </AppLayout>
  );
}
