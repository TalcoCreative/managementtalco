import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, FileText, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

interface EventDocumentsTabProps {
  eventId: string;
  canManage: boolean;
}

const documentTypes = [
  { value: "documentation", label: "Dokumentasi" },
  { value: "report", label: "Report" },
  { value: "evaluation", label: "Evaluasi" },
  { value: "other", label: "Lainnya" },
];

export function EventDocumentsTab({ eventId, canManage }: EventDocumentsTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const [documentType, setDocumentType] = useState("documentation");
  const [notes, setNotes] = useState("");

  const { data: documents, refetch } = useQuery({
    queryKey: ["event-documents", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_documents")
        .select(`
          *,
          uploader:profiles(full_name)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addDocumentMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.session.user.email)
        .single();

      if (!profile) throw new Error("Profile not found");

      const { error } = await supabase.from("event_documents").insert({
        event_id: eventId,
        title,
        document_url: documentUrl || null,
        document_type: documentType,
        notes,
        uploaded_by: profile.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokumen berhasil ditambahkan");
      resetForm();
      setAddOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error adding document:", error);
      toast.error("Gagal menambahkan dokumen");
    },
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_documents")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokumen dihapus");
      refetch();
    },
    onError: () => {
      toast.error("Gagal menghapus dokumen");
    },
  });

  const resetForm = () => {
    setTitle("");
    setDocumentUrl("");
    setDocumentType("documentation");
    setNotes("");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <h3 className="font-medium">Dokumen Post-Event</h3>
          <Badge variant="outline">{documents?.length || 0} dokumen</Badge>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Dokumen
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Judul</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Diupload oleh</TableHead>
            <TableHead>Tanggal</TableHead>
            <TableHead>Link</TableHead>
            {canManage && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Belum ada dokumen
              </TableCell>
            </TableRow>
          ) : (
            documents?.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{doc.title}</div>
                    {doc.notes && (
                      <div className="text-sm text-muted-foreground line-clamp-1">
                        {doc.notes}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {documentTypes.find(t => t.value === doc.document_type)?.label || doc.document_type}
                  </Badge>
                </TableCell>
                <TableCell>{doc.uploader?.full_name || "-"}</TableCell>
                <TableCell>
                  {format(new Date(doc.created_at), "d MMM yyyy", { locale: localeId })}
                </TableCell>
                <TableCell>
                  {doc.document_url ? (
                    <a
                      href={doc.document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-1"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Buka
                    </a>
                  ) : (
                    "-"
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteDocumentMutation.mutate(doc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Dokumen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Judul *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Judul dokumen"
              />
            </div>
            <div>
              <Label>Tipe Dokumen</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>URL Dokumen</Label>
              <Input
                value={documentUrl}
                onChange={(e) => setDocumentUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => addDocumentMutation.mutate()}
                disabled={addDocumentMutation.isPending || !title}
              >
                Tambah
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
