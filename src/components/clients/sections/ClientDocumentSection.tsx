import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Upload, Download, Eye, Trash2, FileText, File } from "lucide-react";
import { format } from "date-fns";
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

interface ClientDocumentSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

const DOCUMENT_TYPES = [
  { value: "mou", label: "MOU" },
  { value: "invoice", label: "Invoice" },
  { value: "proposal", label: "Proposal" },
  { value: "surat", label: "Surat" },
  { value: "kontrak", label: "Kontrak" },
  { value: "other", label: "Lainnya" },
];

export function ClientDocumentSection({ clientId, client, canEdit }: ClientDocumentSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    document_type: "",
    title: "",
    notes: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: ["client-documents", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_documents")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleUpload = async () => {
    if (!form.document_type || !form.title) {
      toast.error("Tipe dokumen dan judul wajib diisi");
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
        const filePath = `${clientId}/documents/${Date.now()}.${fileExt}`;
        
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

      // Check for existing documents with same type and title for versioning
      const existingDocs = documents?.filter(
        d => d.document_type === form.document_type && d.title === form.title
      ) || [];
      const newVersion = existingDocs.length > 0 
        ? Math.max(...existingDocs.map(d => d.version)) + 1 
        : 1;

      const { error } = await supabase.from("client_documents").insert({
        client_id: clientId,
        document_type: form.document_type,
        title: form.title,
        file_url: fileUrl,
        file_name: fileName,
        version: newVersion,
        notes: form.notes,
        created_by: session.session.user.id,
      });

      if (error) throw error;

      // Log activity
      await supabase.rpc("log_client_activity", {
        p_client_id: clientId,
        p_action: "document_upload",
        p_description: `Document uploaded: ${form.title} (v${newVersion})`,
        p_changed_by: session.session.user.id,
      });

      toast.success("Dokumen berhasil diupload");
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
      setDialogOpen(false);
      setForm({ document_type: "", title: "", notes: "" });
      setFile(null);
    } catch (error: any) {
      toast.error(error.message || "Gagal mengupload dokumen");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm("Yakin ingin menghapus dokumen ini?")) return;

    try {
      const { error } = await supabase
        .from("client_documents")
        .delete()
        .eq("id", documentId);

      if (error) throw error;

      toast.success("Dokumen dihapus");
      queryClient.invalidateQueries({ queryKey: ["client-documents", clientId] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus dokumen");
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
  };

  const getFileIcon = (fileName: string | null) => {
    if (!fileName) return <File className="h-4 w-4" />;
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Upload Dokumen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Dokumen</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tipe Dokumen</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.document_type}
                    onChange={(e) => setForm({ ...form, document_type: e.target.value })}
                  >
                    <option value="">Pilih tipe dokumen</option>
                    {DOCUMENT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Judul Dokumen</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. MOU Kerjasama 2025"
                  />
                </div>
                <div>
                  <Label>File</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
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
                  {uploading ? "Mengupload..." : "Upload Dokumen"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : documents && documents.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dokumen</TableHead>
              <TableHead>Tipe</TableHead>
              <TableHead>Versi</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getFileIcon(doc.file_name)}
                    <div>
                      <p className="font-medium">{doc.title}</p>
                      {doc.file_name && (
                        <p className="text-xs text-muted-foreground">{doc.file_name}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{getDocumentTypeLabel(doc.document_type)}</Badge>
                </TableCell>
                <TableCell>v{doc.version}</TableCell>
                <TableCell>{format(new Date(doc.created_at), "dd MMM yyyy")}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {doc.file_url && (
                      <>
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </a>
                        <a
                          href={doc.file_url}
                          download={doc.file_name}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada dokumen</p>
        </div>
      )}
    </div>
  );
}
