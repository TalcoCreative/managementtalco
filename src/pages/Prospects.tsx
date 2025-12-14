import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Phone, Mail, Building2, MapPin, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreateProspectDialog } from "@/components/prospects/CreateProspectDialog";
import { ProspectDetailDialog } from "@/components/prospects/ProspectDetailDialog";

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

export default function Prospects() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);

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

  const filteredProspects = prospects?.filter((prospect) =>
    prospect.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prospect.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    prospect.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prospects</h1>
            <p className="text-muted-foreground">Manage your sales leads and prospects</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Prospect
          </Button>
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
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Product/Service</TableHead>
                  <TableHead>PIC</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredProspects?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No prospects found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProspects?.map((prospect) => (
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
