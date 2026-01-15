import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, ExternalLink, Clock, Target } from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface SalesInsightTableProps {
  prospects: any[];
  activityLogs: any[];
  statusHistory: any[];
  onProspectClick: (id: string) => void;
}

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "meeting", label: "Meeting", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-orange-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-indigo-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const CLOSING_STATUS_ORDER = ["negotiation", "proposal", "meeting", "contacted", "new"];

type SortOption = "duration_desc" | "duration_asc" | "closing_proximity" | "created_desc";

export function SalesInsightTable({ prospects, activityLogs, statusHistory, onProspectClick }: SalesInsightTableProps) {
  const [sortBy, setSortBy] = useState<SortOption>("duration_desc");

  const prospectsWithInsights = useMemo(() => {
    return prospects
      .filter(p => p.status !== "won" && p.status !== "lost")
      .map(prospect => {
        // Find when they entered current status
        const history = statusHistory
          .filter(h => h.prospect_id === prospect.id)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const statusEntry = history.find(h => h.new_status === prospect.status);
        const enteredAt = statusEntry ? parseISO(statusEntry.created_at) : parseISO(prospect.created_at);
        const daysInStatus = differenceInDays(new Date(), enteredAt);
        const totalDays = differenceInDays(new Date(), parseISO(prospect.created_at));

        // Count activities
        const activityCount = activityLogs.filter(a => a.prospect_id === prospect.id).length;

        // Calculate closing proximity score (higher = closer to closing)
        const closingIndex = CLOSING_STATUS_ORDER.indexOf(prospect.status);
        const closingProximity = closingIndex >= 0 ? CLOSING_STATUS_ORDER.length - closingIndex : 0;

        return {
          ...prospect,
          daysInStatus,
          totalDays,
          activityCount,
          closingProximity,
        };
      });
  }, [prospects, statusHistory, activityLogs]);

  const sortedProspects = useMemo(() => {
    const sorted = [...prospectsWithInsights];
    
    switch (sortBy) {
      case "duration_desc":
        return sorted.sort((a, b) => b.daysInStatus - a.daysInStatus);
      case "duration_asc":
        return sorted.sort((a, b) => a.daysInStatus - b.daysInStatus);
      case "closing_proximity":
        return sorted.sort((a, b) => b.closingProximity - a.closingProximity);
      case "created_desc":
        return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      default:
        return sorted;
    }
  }, [prospectsWithInsights, sortBy]);

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find(s => s.value === status);
    return (
      <Badge className={cn(statusOption?.color, "text-white")}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <Target className="h-5 w-5" />
          Prospect Insights
        </CardTitle>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="w-[200px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="duration_desc">Longest Duration First</SelectItem>
            <SelectItem value="duration_asc">Shortest Duration First</SelectItem>
            <SelectItem value="closing_proximity">Closest to Closing</SelectItem>
            <SelectItem value="created_desc">Recently Created</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days in Status</TableHead>
                <TableHead>Total Days</TableHead>
                <TableHead>Activities</TableHead>
                <TableHead>PIC</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No active prospects found
                  </TableCell>
                </TableRow>
              ) : (
                sortedProspects.slice(0, 20).map(prospect => (
                  <TableRow 
                    key={prospect.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onProspectClick(prospect.id)}
                  >
                    <TableCell>
                      <div className="font-medium">{prospect.contact_name}</div>
                      {prospect.email && (
                        <div className="text-xs text-muted-foreground">{prospect.email}</div>
                      )}
                    </TableCell>
                    <TableCell>{prospect.company || "-"}</TableCell>
                    <TableCell>{getStatusBadge(prospect.status)}</TableCell>
                    <TableCell>
                      <div className={cn(
                        "flex items-center gap-1",
                        prospect.daysInStatus > 7 && "text-destructive font-medium"
                      )}>
                        <Clock className="h-3 w-3" />
                        {prospect.daysInStatus} days
                      </div>
                    </TableCell>
                    <TableCell>{prospect.totalDays} days</TableCell>
                    <TableCell>
                      <Badge variant="outline">{prospect.activityCount}</Badge>
                    </TableCell>
                    <TableCell>{prospect.pic?.full_name || "-"}</TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          onProspectClick(prospect.id);
                        }}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {sortedProspects.length > 20 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Showing 20 of {sortedProspects.length} prospects
          </p>
        )}
      </CardContent>
    </Card>
  );
}
