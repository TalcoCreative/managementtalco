import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Upload, Download, Eye, Trash2, FileText } from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientContractSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

export function ClientContractSection({ clientId, client, canEdit }: ClientContractSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["client-contracts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contracts")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!form.start_date || !form.end_date) {
      toast.error("Tanggal kontrak wajib diisi");
      return;
    }

    setUploading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      let fileUrl = null;
      let fileName = null;

      if (file) {
        const fileExt = file.name.split(".").pop();
        const filePath = `${clientId}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from("client-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("client-files")
          .getPublicUrl(filePath);

        fileUrl = urlData.publicUrl;
        fileName = file.name;
      }

      const status = isPast(new Date(form.end_date)) ? "expired" : "active";

      const { error } = await supabase.from("client_contracts").insert({
        client_id: clientId,
        start_date: form.start_date,
        end_date: form.end_date,
        status,
        file_url: fileUrl,
        file_name: fileName,
        notes: form.notes,
        created_by: session.session.user.id,
      });

      if (error) throw error;

      // Log activity
      await supabase.rpc("log_client_activity", {
        p_client_id: clientId,
        p_action: "contract_upload",
        p_description: `Contract uploaded: ${form.start_date} - ${form.end_date}`,
        p_changed_by: session.session.user.id,
      });

      toast.success("Kontrak berhasil ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["client-contracts", clientId] });
      setDialogOpen(false);
      setForm({ start_date: "", end_date: "", notes: "" });
      setFile(null);
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan kontrak");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (contractId: string) => {
    if (!confirm("Yakin ingin menghapus kontrak ini?")) return;

    try {
      const { error } = await supabase
        .from("client_contracts")
        .delete()
        .eq("id", contractId);

      if (error) throw error;

      toast.success("Kontrak dihapus");
      queryClient.invalidateQueries({ queryKey: ["client-contracts", clientId] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus kontrak");
    }
  };

  const getStatusBadge = (contract: any) => {
    const endDate = new Date(contract.end_date);
    const daysRemaining = differenceInDays(endDate, new Date());

    if (contract.status === "expired" || daysRemaining < 0) {
      return <Badge variant="destructive">Expired</Badge>;
    }
    if (daysRemaining <= 30) {
      return <Badge variant="outline" className="border-warning text-warning">Expiring Soon</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Kontrak
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Kontrak Baru</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Tanggal Mulai</Label>
                    <Input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Tanggal Berakhir</Label>
                    <Input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>File Kontrak (MOU/Contract)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Catatan tambahan..."
                  />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Mengupload..." : "Upload Kontrak"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : contracts && contracts.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Periode</TableHead>
              <TableHead>Durasi</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit && <TableHead className="w-20">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((contract) => {
              const startDate = new Date(contract.start_date);
              const endDate = new Date(contract.end_date);
              const duration = differenceInDays(endDate, startDate);
              const months = Math.round(duration / 30);

              return (
                <TableRow key={contract.id}>
                  <TableCell>
                    {format(startDate, "dd MMM yyyy")} - {format(endDate, "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>{months} bulan</TableCell>
                  <TableCell>{getStatusBadge(contract)}</TableCell>
                  <TableCell>
                    {contract.file_url ? (
                      <div className="flex items-center gap-2">
                        <a
                          href={contract.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Eye className="h-3 w-3" />
                          Preview
                        </a>
                        <a
                          href={contract.file_url}
                          download={contract.file_name}
                          className="flex items-center gap-1 text-primary hover:underline text-sm"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">No file</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {contract.notes || "-"}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(contract.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada kontrak</p>
        </div>
      )}
    </div>
  );
}
