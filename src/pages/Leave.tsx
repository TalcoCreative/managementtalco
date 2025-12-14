import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CreateLeaveRequestDialog } from "@/components/leave/CreateLeaveRequestDialog";
import { LeaveApprovalDialog } from "@/components/leave/LeaveApprovalDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Leave() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  const { data: userRole } = useQuery({
    queryKey: ["user-role"],
    queryFn: async () => {
      if (!session) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();
      return data?.role;
    },
    enabled: !!session,
  });

  const isHRorAdmin = userRole === "hr" || userRole === "super_admin";

  // Fetch my leave requests
  const { data: myRequests, isLoading: myLoading } = useQuery({
    queryKey: ["my-leave-requests"],
    queryFn: async () => {
      if (!session) return [];
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!session,
  });

  // Fetch all pending requests for HR/Admin
  const { data: pendingRequests, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url)
        `)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isHRorAdmin,
  });

  // Fetch all leave requests for HR/Admin
  const { data: allRequests, isLoading: allLoading } = useQuery({
    queryKey: ["all-leave-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(`
          *,
          profiles:user_id (full_name, avatar_url),
          approver:approved_by (full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isHRorAdmin,
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

  const getLeaveTypeBadge = (type: string) => {
    switch (type) {
      case "sakit":
        return <Badge className="bg-red-500">Sakit</Badge>;
      case "cuti":
        return <Badge className="bg-blue-500">Cuti</Badge>;
      case "izin":
        return <Badge className="bg-yellow-500">Izin</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  const handleApprovalClick = (request: any) => {
    setSelectedRequest(request);
    setApprovalDialogOpen(true);
  };

  const LeaveRequestCard = ({ request, showUser = false, showApproval = false }: { request: any; showUser?: boolean; showApproval?: boolean }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            {showUser && request.profiles && (
              <p className="font-medium">{request.profiles.full_name}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {getLeaveTypeBadge(request.leave_type)}
              {getStatusBadge(request.status)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(request.start_date), "dd MMM yyyy", { locale: idLocale })}
                {request.start_date !== request.end_date && (
                  <> - {format(new Date(request.end_date), "dd MMM yyyy", { locale: idLocale })}</>
                )}
              </span>
            </div>
            {request.reason && (
              <p className="text-sm text-muted-foreground">{request.reason}</p>
            )}
            {request.rejection_reason && (
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <span>Alasan ditolak: {request.rejection_reason}</span>
              </div>
            )}
            {request.approver && (
              <p className="text-xs text-muted-foreground">
                Diproses oleh: {request.approver.full_name}
              </p>
            )}
          </div>
          {showApproval && request.status === "pending" && (
            <Button size="sm" onClick={() => handleApprovalClick(request)}>
              Review
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Leave Requests</h1>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request Leave
          </Button>
        </div>

        {isHRorAdmin ? (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList>
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingRequests && pendingRequests.length > 0 && (
                  <span className="ml-2 bg-destructive text-destructive-foreground text-xs rounded-full px-2">
                    {pendingRequests.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="all">All Requests</TabsTrigger>
              <TabsTrigger value="my">My Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-32 bg-muted" />
                    </Card>
                  ))}
                </div>
              ) : pendingRequests && pendingRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {pendingRequests.map((request: any) => (
                    <LeaveRequestCard key={request.id} request={request} showUser showApproval />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                    <p className="text-muted-foreground">No pending requests</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="all" className="space-y-4">
              {allLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-32 bg-muted" />
                    </Card>
                  ))}
                </div>
              ) : allRequests && allRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {allRequests.map((request: any) => (
                    <LeaveRequestCard key={request.id} request={request} showUser />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No leave requests</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="my" className="space-y-4">
              {myLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="h-32 bg-muted" />
                    </Card>
                  ))}
                </div>
              ) : myRequests && myRequests.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {myRequests.map((request: any) => (
                    <LeaveRequestCard key={request.id} request={request} />
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">You haven't requested any leave yet</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          <>
            <h2 className="text-xl font-semibold">My Leave Requests</h2>
            {myLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="h-32 bg-muted" />
                  </Card>
                ))}
              </div>
            ) : myRequests && myRequests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {myRequests.map((request: any) => (
                  <LeaveRequestCard key={request.id} request={request} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">You haven't requested any leave yet</p>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <CreateLeaveRequestDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />

      {selectedRequest && (
        <LeaveApprovalDialog
          open={approvalDialogOpen}
          onOpenChange={setApprovalDialogOpen}
          request={selectedRequest}
        />
      )}
    </AppLayout>
  );
}
