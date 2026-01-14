import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Search, History, MessageSquare, RefreshCw, Edit, Trash2, Plus } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const ACTION_ICONS: Record<string, React.ElementType> = {
  status_change: RefreshCw,
  temperature_change: RefreshCw,
  edit: Edit,
  create: Plus,
  delete: Trash2,
  comment: MessageSquare,
};

const ACTION_LABELS: Record<string, string> = {
  status_change: "Status Changed",
  temperature_change: "Temperature Changed",
  edit: "Edited",
  create: "Created",
  delete: "Deleted",
  comment: "Comment Added",
};

export default function ProspectHistory() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("activity");

  // Fetch all activity logs
  const { data: activityLogs, isLoading: activityLoading } = useQuery({
    queryKey: ["prospect-activity-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_activity_logs" as any)
        .select(`
          *,
          prospect:prospects!prospect_activity_logs_prospect_id_fkey(id, contact_name, company),
          created_by_profile:profiles!prospect_activity_logs_created_by_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch all status history
  const { data: statusHistory, isLoading: statusLoading } = useQuery({
    queryKey: ["all-prospect-status-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_status_history" as any)
        .select(`
          *,
          prospect:prospects!prospect_status_history_prospect_id_fkey(id, contact_name, company),
          changed_by_profile:profiles!prospect_status_history_changed_by_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  // Fetch all comments
  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["all-prospect-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_comments" as any)
        .select(`
          *,
          prospect:prospects!prospect_comments_prospect_id_fkey(id, contact_name, company),
          author:profiles!prospect_comments_author_id_fkey(id, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const filteredActivityLogs = activityLogs?.filter((log) => {
    const matchesSearch =
      log.prospect?.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.prospect?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = actionFilter === "all" || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  const filteredStatusHistory = statusHistory?.filter((history) =>
    history.prospect?.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    history.prospect?.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredComments = comments?.filter((comment) =>
    comment.prospect?.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.prospect?.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comment.content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      status_change: "bg-purple-500",
      temperature_change: "bg-orange-500",
      edit: "bg-blue-500",
      create: "bg-green-500",
      delete: "bg-red-500",
      comment: "bg-cyan-500",
    };
    return (
      <Badge className={`${colors[action] || "bg-gray-500"} text-white`}>
        {ACTION_LABELS[action] || action}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/prospects")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <History className="h-8 w-8" />
                Prospect History Log
              </h1>
              <p className="text-muted-foreground">
                View all changes, comments, and activities across prospects
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by prospect name, company, or content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {activeTab === "activity" && (
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="status_change">Status Changes</SelectItem>
                <SelectItem value="temperature_change">Temperature Changes</SelectItem>
                <SelectItem value="edit">Edits</SelectItem>
                <SelectItem value="create">Creates</SelectItem>
                <SelectItem value="comment">Comments</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="activity">All Activity</TabsTrigger>
            <TabsTrigger value="status">Status History</TabsTrigger>
            <TabsTrigger value="comments">All Comments</TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Activity Log ({filteredActivityLogs?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Prospect</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Changed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLoading ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : filteredActivityLogs?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredActivityLogs?.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{log.prospect?.contact_name}</p>
                                {log.prospect?.company && (
                                  <p className="text-sm text-muted-foreground">{log.prospect.company}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{getActionBadge(log.action)}</TableCell>
                            <TableCell className="max-w-md">
                              <p className="truncate">{log.description}</p>
                              {log.old_value && log.new_value && (
                                <p className="text-sm text-muted-foreground">
                                  {log.old_value} → {log.new_value}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>{log.created_by_profile?.full_name}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="status" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Status Change History ({filteredStatusHistory?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Prospect</TableHead>
                        <TableHead>Old Status</TableHead>
                        <TableHead>New Status</TableHead>
                        <TableHead>Changed By</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statusLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : filteredStatusHistory?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No status history found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredStatusHistory?.map((history) => (
                          <TableRow key={history.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(history.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{history.prospect?.contact_name}</p>
                                {history.prospect?.company && (
                                  <p className="text-sm text-muted-foreground">{history.prospect.company}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{history.old_status}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge>{history.new_status}</Badge>
                            </TableCell>
                            <TableCell>{history.changed_by_profile?.full_name}</TableCell>
                            <TableCell>{history.notes || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="comments" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Comments ({filteredComments?.length || 0})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Prospect</TableHead>
                        <TableHead>Comment</TableHead>
                        <TableHead>By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commentsLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : filteredComments?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            No comments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredComments?.map((comment) => (
                          <TableRow key={comment.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(comment.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{comment.prospect?.contact_name}</p>
                                {comment.prospect?.company && (
                                  <p className="text-sm text-muted-foreground">{comment.prospect.company}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="max-w-md">
                              <p className="whitespace-pre-wrap">{comment.content}</p>
                            </TableCell>
                            <TableCell>{comment.author?.full_name}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
