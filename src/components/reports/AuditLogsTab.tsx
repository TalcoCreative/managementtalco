import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, FileEdit, Trash2, Lock, Unlock, Plus } from "lucide-react";

const ACTION_ICONS: Record<string, React.ReactNode> = {
  create: <Plus className="h-4 w-4 text-green-500" />,
  update: <FileEdit className="h-4 w-4 text-blue-500" />,
  delete: <Trash2 className="h-4 w-4 text-red-500" />,
  lock: <Lock className="h-4 w-4 text-orange-500" />,
  unlock: <Unlock className="h-4 w-4 text-purple-500" />,
};

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  lock: "Locked",
  unlock: "Unlocked",
};

interface AuditLog {
  id: string;
  report_type: "organic" | "ads";
  report_id: string;
  action: string;
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  performed_by: string;
  performed_at: string;
}

export function AuditLogsTab() {
  const [filterType, setFilterType] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["report-audit-logs", filterType, filterAction],
    queryFn: async () => {
      let query = (supabase
        .from("report_audit_logs") as any)
        .select("*")
        .order("performed_at", { ascending: false })
        .limit(100);

      if (filterType) {
        query = query.eq("report_type", filterType);
      }
      if (filterAction) {
        query = query.eq("action", filterAction);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-audit"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  const getProfileName = (id: string) => {
    return profiles.find((p) => p.id === id)?.full_name || "Unknown";
  };

  const handleViewDetail = (log: AuditLog) => {
    setSelectedLog(log);
    setDetailOpen(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Audit Logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Semua Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Type</SelectItem>
              <SelectItem value="organic">Organic</SelectItem>
              <SelectItem value="ads">Ads</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Semua Action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Action</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
              <SelectItem value="lock">Lock</SelectItem>
              <SelectItem value="unlock">Unlock</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Belum ada audit log
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.performed_at), "dd MMM yyyy HH:mm", {
                        locale: idLocale,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {log.report_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ACTION_ICONS[log.action]}
                        <span className="capitalize">
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{getProfileName(log.performed_by)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetail(log)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Detail Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="sm:max-w-lg max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Audit Log Detail</DialogTitle>
            </DialogHeader>
            {selectedLog && (
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Report Type:</span>
                      <p className="font-medium capitalize">{selectedLog.report_type}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Action:</span>
                      <div className="flex items-center gap-2">
                        {ACTION_ICONS[selectedLog.action]}
                        <span className="font-medium capitalize">
                          {ACTION_LABELS[selectedLog.action] || selectedLog.action}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Performed By:</span>
                      <p className="font-medium">
                        {getProfileName(selectedLog.performed_by)}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Waktu:</span>
                      <p className="font-medium">
                        {format(new Date(selectedLog.performed_at), "dd MMMM yyyy HH:mm:ss", {
                          locale: idLocale,
                        })}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Report ID:</span>
                      <p className="font-mono text-xs">{selectedLog.report_id}</p>
                    </div>
                  </div>

                  {selectedLog.previous_values && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 text-sm">Previous Values</h4>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.previous_values, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedLog.new_values && (
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 text-sm">New Values</h4>
                      <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.new_values, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
