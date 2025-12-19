import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Plus, Eye, Edit, Trash2, FileWarning } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";

interface DisciplinaryCase {
  id: string;
  employee_id: string;
  reported_by: string;
  case_date: string;
  violation_type: string;
  description: string;
  evidence_url: string | null;
  severity: string;
  status: string;
  action_taken: string | null;
  action_date: string | null;
  notes: string | null;
  created_at: string;
  employee?: { full_name: string };
  reporter?: { full_name: string };
}

const violationTypes = [
  "Keterlambatan",
  "Absensi Tanpa Keterangan",
  "Pelanggaran SOP",
  "Insubordinasi",
  "Konflik dengan Rekan Kerja",
  "Pelanggaran Etika",
  "Kinerja Buruk",
  "Penyalahgunaan Aset",
  "Lainnya"
];

const severityLevels = [
  { value: "minor", label: "Minor", color: "bg-yellow-500" },
  { value: "moderate", label: "Moderate", color: "bg-orange-500" },
  { value: "major", label: "Major", color: "bg-red-500" },
  { value: "critical", label: "Critical", color: "bg-destructive" }
];

const statusOptions = [
  { value: "pending", label: "Pending Review", color: "bg-yellow-500" },
  { value: "investigating", label: "Investigating", color: "bg-blue-500" },
  { value: "warning_issued", label: "Warning Issued", color: "bg-orange-500" },
  { value: "resolved", label: "Resolved", color: "bg-green-500" },
  { value: "dismissed", label: "Dismissed", color: "bg-gray-500" }
];

export function DisciplinaryCases() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<DisciplinaryCase | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const [formData, setFormData] = useState({
    employee_id: "",
    case_date: format(new Date(), "yyyy-MM-dd"),
    violation_type: "",
    description: "",
    severity: "minor",
    notes: ""
  });

  const [editFormData, setEditFormData] = useState({
    status: "",
    action_taken: "",
    action_date: "",
    notes: ""
  });

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    }
  });

  // Fetch all profiles
  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    }
  });

  // Fetch disciplinary cases
  const { data: cases, isLoading } = useQuery({
    queryKey: ["disciplinary-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disciplinary_cases")
        .select(`
          *,
          employee:profiles!disciplinary_cases_employee_id_fkey(full_name),
          reporter:profiles!disciplinary_cases_reported_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as DisciplinaryCase[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from("disciplinary_cases")
        .insert({
          employee_id: data.employee_id,
          reported_by: currentUser?.id,
          case_date: data.case_date,
          violation_type: data.violation_type,
          description: data.description,
          severity: data.severity,
          notes: data.notes || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-cases"] });
      toast.success("Kasus disipliner berhasil dicatat");
      setCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Gagal mencatat kasus: " + error.message);
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editFormData }) => {
      const { error } = await supabase
        .from("disciplinary_cases")
        .update({
          status: data.status,
          action_taken: data.action_taken || null,
          action_date: data.action_date || null,
          notes: data.notes || null
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-cases"] });
      toast.success("Kasus berhasil diupdate");
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Gagal update kasus: " + error.message);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("disciplinary_cases")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["disciplinary-cases"] });
      toast.success("Kasus berhasil dihapus");
      setDeleteConfirmOpen(false);
      setSelectedCase(null);
    },
    onError: (error) => {
      toast.error("Gagal menghapus kasus: " + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      employee_id: "",
      case_date: format(new Date(), "yyyy-MM-dd"),
      violation_type: "",
      description: "",
      severity: "minor",
      notes: ""
    });
  };

  const handleCreate = () => {
    if (!formData.employee_id || !formData.violation_type || !formData.description) {
      toast.error("Lengkapi semua field yang diperlukan");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleViewDetail = (caseData: DisciplinaryCase) => {
    setSelectedCase(caseData);
    setDetailDialogOpen(true);
  };

  const handleEdit = (caseData: DisciplinaryCase) => {
    setSelectedCase(caseData);
    setEditFormData({
      status: caseData.status,
      action_taken: caseData.action_taken || "",
      action_date: caseData.action_date || "",
      notes: caseData.notes || ""
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (caseData: DisciplinaryCase) => {
    setSelectedCase(caseData);
    setDeleteConfirmOpen(true);
  };

  const getSeverityBadge = (severity: string) => {
    const level = severityLevels.find(s => s.value === severity);
    return <Badge className={level?.color || "bg-gray-500"}>{level?.label || severity}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const option = statusOptions.find(s => s.value === status);
    return <Badge className={option?.color || "bg-gray-500"}>{option?.label || status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <FileWarning className="h-5 w-5" />
          Disciplinary Cases ({cases?.length || 0})
        </h3>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Catat Kasus Baru
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jenis Pelanggaran</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dilaporkan Oleh</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : cases?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Tidak ada kasus disipliner tercatat
                    </TableCell>
                  </TableRow>
                ) : (
                  cases?.map((caseData) => (
                    <TableRow key={caseData.id}>
                      <TableCell>
                        {format(new Date(caseData.case_date), "dd MMM yyyy", { locale: idLocale })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {caseData.employee?.full_name || "-"}
                      </TableCell>
                      <TableCell>{caseData.violation_type}</TableCell>
                      <TableCell>{getSeverityBadge(caseData.severity)}</TableCell>
                      <TableCell>{getStatusBadge(caseData.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {caseData.reporter?.full_name || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleViewDetail(caseData)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(caseData)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(caseData)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Catat Kasus Disipliner
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Karyawan *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih karyawan" />
                </SelectTrigger>
                <SelectContent>
                  {profiles?.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tanggal Kejadian *</Label>
              <Input
                type="date"
                value={formData.case_date}
                onChange={(e) => setFormData({ ...formData, case_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Jenis Pelanggaran *</Label>
              <Select
                value={formData.violation_type}
                onValueChange={(value) => setFormData({ ...formData, violation_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis pelanggaran" />
                </SelectTrigger>
                <SelectContent>
                  {violationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severity *</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) => setFormData({ ...formData, severity: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {severityLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Deskripsi Kejadian *</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Jelaskan detail kejadian..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan Tambahan</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Catatan tambahan (opsional)..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Kasus Disipliner</DialogTitle>
          </DialogHeader>
          {selectedCase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Karyawan</Label>
                  <p className="font-medium">{selectedCase.employee?.full_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tanggal Kejadian</Label>
                  <p>{format(new Date(selectedCase.case_date), "dd MMM yyyy", { locale: idLocale })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Jenis Pelanggaran</Label>
                  <p>{selectedCase.violation_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Severity</Label>
                  <div className="mt-1">{getSeverityBadge(selectedCase.severity)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">{getStatusBadge(selectedCase.status)}</div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Dilaporkan Oleh</Label>
                  <p>{selectedCase.reporter?.full_name}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Deskripsi</Label>
                <p className="text-sm mt-1">{selectedCase.description}</p>
              </div>
              {selectedCase.action_taken && (
                <div>
                  <Label className="text-muted-foreground">Tindakan yang Diambil</Label>
                  <p className="text-sm mt-1">{selectedCase.action_taken}</p>
                </div>
              )}
              {selectedCase.notes && (
                <div>
                  <Label className="text-muted-foreground">Catatan</Label>
                  <p className="text-sm mt-1">{selectedCase.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Update Kasus - {selectedCase?.employee?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tindakan yang Diambil</Label>
              <Textarea
                value={editFormData.action_taken}
                onChange={(e) => setEditFormData({ ...editFormData, action_taken: e.target.value })}
                placeholder="Contoh: Surat Peringatan 1, Penundaan Kenaikan Gaji, dll"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Tanggal Tindakan</Label>
              <Input
                type="date"
                value={editFormData.action_date}
                onChange={(e) => setEditFormData({ ...editFormData, action_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Catatan tambahan..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button 
              onClick={() => selectedCase && updateMutation.mutate({ id: selectedCase.id, data: editFormData })}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Hapus Kasus Disipliner
            </DialogTitle>
          </DialogHeader>
          <p>
            Apakah Anda yakin ingin menghapus kasus disipliner untuk{" "}
            <strong>{selectedCase?.employee?.full_name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Batal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedCase && deleteMutation.mutate(selectedCase.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
