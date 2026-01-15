import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Search, Users, UserCheck, Clock, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateCandidateDialog } from "@/components/recruitment/CreateCandidateDialog";
import { CandidateDetailDialog } from "@/components/recruitment/CandidateDetailDialog";
import { ExcelActions } from "@/components/shared/ExcelActions";
import { CANDIDATE_COLUMNS } from "@/lib/excel-utils";
import { usePositionOptions } from "@/hooks/usePositions";

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "bg-blue-500" },
  { value: "screening_hr", label: "Screening HR", color: "bg-yellow-500" },
  { value: "interview_user", label: "Interview User", color: "bg-orange-500" },
  { value: "interview_final", label: "Interview Final", color: "bg-purple-500" },
  { value: "offering", label: "Offering", color: "bg-indigo-500" },
  { value: "hired", label: "Hired", color: "bg-green-500" },
  { value: "rejected", label: "Rejected", color: "bg-red-500" },
];

export default function Recruitment() {
  const { positionOptions } = usePositionOptions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          *,
          hr_pic:profiles!candidates_hr_pic_id_fkey(id, full_name)
        `)
        .order("applied_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ candidateId, newStatus, oldStatus }: { candidateId: string; newStatus: string; oldStatus: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Update candidate status
      const { error: updateError } = await supabase
        .from("candidates")
        .update({ status: newStatus as any })
        .eq("id", candidateId);
      if (updateError) throw updateError;

      // Create status history
      const { error: historyError } = await supabase
        .from("candidate_status_history")
        .insert({
          candidate_id: candidateId,
          old_status: oldStatus as any,
          new_status: newStatus as any,
          changed_by: session.session.user.id,
        });
      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const filteredCandidates = useMemo(() => {
    if (!candidates) return [];
    return candidates.filter((candidate) => {
      const matchesSearch =
        candidate.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        candidate.position.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || candidate.status === statusFilter;
      const matchesPosition = positionFilter === "all" || candidate.position === positionFilter;
      return matchesSearch && matchesStatus && matchesPosition;
    });
  }, [candidates, searchQuery, statusFilter, positionFilter]);

  // Dashboard stats
  const stats = useMemo(() => {
    if (!candidates) return { total: 0, applied: 0, inProcess: 0, hired: 0, rejected: 0 };
    return {
      total: candidates.length,
      applied: candidates.filter((c) => c.status === "applied").length,
      inProcess: candidates.filter((c) => 
        ["screening_hr", "interview_user", "interview_final", "offering"].includes(c.status)
      ).length,
      hired: candidates.filter((c) => c.status === "hired").length,
      rejected: candidates.filter((c) => c.status === "rejected").length,
    };
  }, [candidates]);

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  // Export data for Excel
  const exportData = candidates?.map(c => ({
    full_name: c.full_name,
    email: c.email,
    phone: c.phone,
    position: c.position,
    division: c.division,
    location: c.location || '',
    cv_url: c.cv_url || '',
    portfolio_url: c.portfolio_url || '',
    status: c.status,
  })) || [];

  const handleImportCandidates = async (data: any[]) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      toast.error("Tidak terautentikasi");
      return;
    }

    for (const row of data) {
      if (!row.full_name || !row.email || !row.position) continue;
      
      // Check if candidate already exists
      const { data: existing } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", row.email)
        .single();

      if (!existing) {
        await supabase.from("candidates").insert({
          full_name: row.full_name,
          email: row.email,
          phone: row.phone || '',
          position: row.position,
          division: row.division || 'General',
          location: row.location || null,
          cv_url: row.cv_url || null,
          portfolio_url: row.portfolio_url || null,
          status: row.status || 'applied',
          created_by: session.session.user.id,
        });
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["candidates"] });
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Recruitment</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Database kandidat karyawan</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <ExcelActions
              data={exportData}
              columns={CANDIDATE_COLUMNS}
              filename="candidates"
              onImport={handleImportCandidates}
            />
            <Button onClick={() => setCreateDialogOpen(true)} className="flex-1 sm:flex-none h-12 sm:h-10">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Kandidat
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Total Kandidat</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Applied</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-blue-600">{stats.applied}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Dalam Proses</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-orange-600">{stats.inProcess}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium">Hired</CardTitle>
              <UserCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-green-600">{stats.hired}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, email, atau posisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 sm:h-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 sm:h-10">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-full sm:w-[180px] h-12 sm:h-10">
              <SelectValue placeholder="Filter Posisi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Posisi</SelectItem>
              {positionOptions.map((position) => (
                <SelectItem key={position.value} value={position.value}>
                  {position.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Nama</TableHead>
                  <TableHead className="min-w-[120px]">Posisi</TableHead>
                  <TableHead className="min-w-[140px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">HR PIC</TableHead>
                  <TableHead className="min-w-[100px]">Tanggal Apply</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredCandidates.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Tidak ada kandidat ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <TableRow
                      key={candidate.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedCandidateId(candidate.id)}
                    >
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{candidate.full_name}</p>
                          <p className="text-xs text-muted-foreground">{candidate.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>{candidate.position}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={candidate.status}
                          onValueChange={(value) =>
                            updateStatusMutation.mutate({
                              candidateId: candidate.id,
                              newStatus: value,
                              oldStatus: candidate.status,
                            })
                          }
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue>{getStatusBadge(candidate.status)}</SelectValue>
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
                      <TableCell>{candidate.hr_pic?.full_name || "-"}</TableCell>
                      <TableCell>
                        {format(new Date(candidate.applied_at), "dd MMM yyyy")}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateCandidateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <CandidateDetailDialog
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </AppLayout>
  );
}
