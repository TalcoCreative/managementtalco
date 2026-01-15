import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Phone, Mail, Building2, MapPin, ArrowUpDown, History, Flame, Snowflake, Thermometer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateProspectDialog } from "@/components/prospects/CreateProspectDialog";
import { ProspectDetailDialog } from "@/components/prospects/ProspectDetailDialog";
import { ExcelActions } from "@/components/shared/ExcelActions";
import { PROSPECT_COLUMNS } from "@/lib/excel-utils";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "meeting", label: "Meeting", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-orange-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-indigo-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" },
  { value: "cold_call", label: "Cold Call" },
  { value: "other", label: "Other" },
];

const TEMPERATURE_OPTIONS = [
  { value: "cold", label: "Cold", color: "bg-blue-400", icon: Snowflake },
  { value: "warm", label: "Warm", color: "bg-yellow-400", icon: Thermometer },
  { value: "hot", label: "Hot", color: "bg-red-500", icon: Flame },
];

type SortField = "contact_name" | "company" | "location" | "source" | "product_service" | "pic" | "status" | "temperature" | "created_at";
type SortDirection = "asc" | "desc";

export default function Prospects() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [temperatureFilter, setTemperatureFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Check user roles for access control
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-prospects"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
  });

  const canAccessSales = userRoles?.includes('super_admin') || userRoles?.includes('marketing');

  // Redirect if no access
  if (!rolesLoading && !canAccessSales) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to access this page.</p>
            <Button className="mt-4" onClick={() => navigate("/")}>Go to Dashboard</Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["prospects", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("prospects" as any)
        .select(`
          *,
          pic:profiles!prospects_pic_id_fkey(id, full_name),
          created_by_profile:profiles!prospects_created_by_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Update prospect status
      const { error: updateError } = await supabase
        .from("prospects" as any)
        .update({ status })
        .eq("id", id);

      if (updateError) throw updateError;

      // Log status change
      const { error: historyError } = await supabase
        .from("prospect_status_history" as any)
        .insert({
          prospect_id: id,
          old_status: oldStatus,
          new_status: status,
          changed_by: session.session.user.id,
        });

      if (historyError) throw historyError;

      // Log activity
      await supabase.from("prospect_activity_logs" as any).insert({
        prospect_id: id,
        action: "status_change",
        field_name: "status",
        old_value: oldStatus,
        new_value: status,
        description: `Status changed from ${oldStatus} to ${status}`,
        created_by: session.session.user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Status updated successfully");
    },
    onError: (error) => {
      toast.error("Failed to update status");
      console.error(error);
    },
  });

  const updateTemperatureMutation = useMutation({
    mutationFn: async ({ id, temperature, oldTemperature }: { id: string; temperature: string; oldTemperature: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("prospects" as any)
        .update({ temperature })
        .eq("id", id);

      if (error) throw error;

      // Log activity
      await supabase.from("prospect_activity_logs" as any).insert({
        prospect_id: id,
        action: "temperature_change",
        field_name: "temperature",
        old_value: oldTemperature,
        new_value: temperature,
        description: `Temperature changed from ${oldTemperature} to ${temperature}`,
        created_by: session.session.user.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Temperature updated");
    },
    onError: (error) => {
      toast.error("Failed to update temperature");
      console.error(error);
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortedProspects = () => {
    if (!prospects) return [];
    
    const filtered = prospects.filter((prospect) => {
      const matchesSearch = prospect.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.email?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTemperature = temperatureFilter === "all" || 
        (prospect.temperature || "warm") === temperatureFilter;
      
      return matchesSearch && matchesTemperature;
    });

    return filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "contact_name":
          aValue = a.contact_name?.toLowerCase() || "";
          bValue = b.contact_name?.toLowerCase() || "";
          break;
        case "company":
          aValue = a.company?.toLowerCase() || "";
          bValue = b.company?.toLowerCase() || "";
          break;
        case "location":
          aValue = a.location?.toLowerCase() || "";
          bValue = b.location?.toLowerCase() || "";
          break;
        case "source":
          aValue = a.source?.toLowerCase() || "";
          bValue = b.source?.toLowerCase() || "";
          break;
        case "product_service":
          aValue = a.product_service?.toLowerCase() || "";
          bValue = b.product_service?.toLowerCase() || "";
          break;
        case "pic":
          aValue = a.pic?.full_name?.toLowerCase() || "";
          bValue = b.pic?.full_name?.toLowerCase() || "";
          break;
        case "status":
          aValue = a.status?.toLowerCase() || "";
          bValue = b.status?.toLowerCase() || "";
          break;
        case "temperature":
          aValue = a.temperature?.toLowerCase() || "warm";
          bValue = b.temperature?.toLowerCase() || "warm";
          break;
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  };

  const sortedProspects = getSortedProspects();

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const getTemperatureBadge = (temperature: string) => {
    const tempOption = TEMPERATURE_OPTIONS.find((t) => t.value === temperature) || TEMPERATURE_OPTIONS[1];
    const Icon = tempOption.icon;
    return (
      <Badge className={`${tempOption.color} text-white flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {tempOption.label}
      </Badge>
    );
  };

  const getSourceLabel = (source: string) => {
    return SOURCE_OPTIONS.find((s) => s.value === source)?.label || source;
  };

  const statusCounts = prospects?.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const temperatureCounts = prospects?.reduce((acc, p) => {
    const temp = p.temperature || "warm";
    acc[temp] = (acc[temp] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  // Export data for Excel
  const exportData = prospects?.map(p => ({
    contact_name: p.contact_name,
    company: p.company || '',
    email: p.email || '',
    phone: p.phone || '',
    location: p.location || '',
    source: p.source,
    product_service: p.product_service || '',
    needs: p.needs || '',
    status: p.status,
    temperature: p.temperature || 'warm',
  })) || [];

  const handleImportProspects = async (data: any[]) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Tidak terautentikasi");
      return;
    }

    for (const row of data) {
      if (!row.contact_name || !row.source) continue;
      
      await supabase.from("prospects").insert({
        contact_name: row.contact_name,
        company: row.company || null,
        email: row.email || null,
        phone: row.phone || null,
        location: row.location || null,
        source: row.source,
        product_service: row.product_service || null,
        needs: row.needs || null,
        status: row.status || 'new',
        temperature: row.temperature || 'warm',
        created_by: session.session.user.id,
      });
    }
    
    queryClient.invalidateQueries({ queryKey: ["prospects"] });
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 select-none"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
    </TableHead>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prospects</h1>
            <p className="text-muted-foreground">Manage your sales leads and prospects</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/prospects/history")}>
              <History className="h-4 w-4 mr-2" />
              History Log
            </Button>
            <ExcelActions
              data={exportData}
              columns={PROSPECT_COLUMNS}
              filename="prospects"
              onImport={handleImportProspects}
            />
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Prospect
            </Button>
          </div>
        </div>

        {/* Status Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {STATUS_OPTIONS.map((status) => (
            <Card 
              key={status.value} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                statusFilter === status.value ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setStatusFilter(statusFilter === status.value ? "all" : status.value)}
            >
              <CardContent className="p-4 text-center">
                <div className={`w-3 h-3 rounded-full ${status.color} mx-auto mb-2`} />
                <p className="text-sm font-medium">{status.label}</p>
                <p className="text-2xl font-bold">{statusCounts[status.value] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Temperature Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          {TEMPERATURE_OPTIONS.map((temp) => {
            const Icon = temp.icon;
            return (
              <Card 
                key={temp.value} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  temperatureFilter === temp.value ? 'ring-2 ring-primary' : ''
                }`}
                onClick={() => setTemperatureFilter(temperatureFilter === temp.value ? "all" : temp.value)}
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full ${temp.color} flex items-center justify-center`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{temp.label}</p>
                      <p className="text-2xl font-bold">{temperatureCounts[temp.value] || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="contact_name">Contact</SortableHeader>
                  <SortableHeader field="company">Company</SortableHeader>
                  <SortableHeader field="location">Location</SortableHeader>
                  <SortableHeader field="source">Source</SortableHeader>
                  <SortableHeader field="product_service">Product/Service</SortableHeader>
                  <SortableHeader field="pic">PIC</SortableHeader>
                  <SortableHeader field="temperature">Temp</SortableHeader>
                  <SortableHeader field="status">Status</SortableHeader>
                  <SortableHeader field="created_at">Created</SortableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : sortedProspects?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No prospects found
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedProspects?.map((prospect) => (
                    <TableRow 
                      key={prospect.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedProspect(prospect)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{prospect.contact_name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {prospect.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {prospect.email}
                              </span>
                            )}
                            {prospect.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {prospect.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {prospect.company && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {prospect.company}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {prospect.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            {prospect.location}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{getSourceLabel(prospect.source)}</TableCell>
                      <TableCell>{prospect.product_service}</TableCell>
                      <TableCell>{prospect.pic?.full_name || "-"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={prospect.temperature || "warm"}
                          onValueChange={(value) =>
                            updateTemperatureMutation.mutate({
                              id: prospect.id,
                              temperature: value,
                              oldTemperature: prospect.temperature || "warm",
                            })
                          }
                        >
                          <SelectTrigger className="w-[100px]">
                            {getTemperatureBadge(prospect.temperature || "warm")}
                          </SelectTrigger>
                          <SelectContent>
                            {TEMPERATURE_OPTIONS.map((temp) => (
                              <SelectItem key={temp.value} value={temp.value}>
                                <div className="flex items-center gap-1">
                                  <temp.icon className="h-3 w-3" />
                                  {temp.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={prospect.status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({
                              id: prospect.id,
                              status: value,
                              oldStatus: prospect.status,
                            })
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            {getStatusBadge(prospect.status)}
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {format(new Date(prospect.created_at), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <CreateProspectDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />

        {selectedProspect && (
          <ProspectDetailDialog
            prospect={selectedProspect}
            open={!!selectedProspect}
            onOpenChange={(open) => !open && setSelectedProspect(null)}
          />
        )}
      </div>
    </AppLayout>
  );
}
