import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Loader2, FileText, History, ExternalLink, Copy } from "lucide-react";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ready_to_send", label: "Siap Dikirim" },
  { value: "sent", label: "Terkirim" },
  { value: "closed", label: "Closed" },
];

interface LetterDetailDialogProps {
  letter: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  canManage: boolean;
}

export function LetterDetailDialog({
  letter,
  open,
  onOpenChange,
  onUpdate,
  canManage,
}: LetterDetailDialogProps) {
  const [status, setStatus] = useState(letter.status);
  const [documentUrl, setDocumentUrl] = useState(letter.document_url || "");
  const [notes, setNotes] = useState(letter.notes || "");

  const { data: activityLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["letter-logs", letter.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("letter_activity_logs")
        .select(`
          *,
          changed_by_profile:profiles!letter_activity_logs_changed_by_fkey(full_name)
        `)
        .eq("letter_id", letter.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found");

      const updates: any = {
        status,
        document_url: documentUrl || null,
        notes: notes || null,
      };

      // If status changed to sent, record sender info
      if (status === "sent" && letter.status !== "sent") {
        updates.sent_by = profile.id;
        updates.sent_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("letters")
        .update(updates)
        .eq("id", letter.id);

      if (error) throw error;

      // Log changes
      const changes: string[] = [];
      if (status !== letter.status) {
        changes.push(`Status: ${letter.status} → ${status}`);
      }
      if (documentUrl !== (letter.document_url || "")) {
        changes.push("Document URL diperbarui");
      }
      if (notes !== (letter.notes || "")) {
        changes.push("Catatan diperbarui");
      }

      if (changes.length > 0) {
        await supabase.from("letter_activity_logs").insert({
          letter_id: letter.id,
          action: "updated",
          old_value: `Status: ${letter.status}`,
          new_value: changes.join(", "),
          changed_by: profile.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Surat berhasil diperbarui!");
      refetchLogs();
      onUpdate();
    },
    onError: (error: any) => {
      toast.error(error.message || "Gagal memperbarui surat");
    },
  });

  const copyLetterNumber = () => {
    navigator.clipboard.writeText(letter.letter_number);
    toast.success("Nomor surat disalin!");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-muted text-muted-foreground";
      case "ready_to_send":
        return "bg-blue-500/20 text-blue-600";
      case "sent":
        return "bg-green-500/20 text-green-600";
      case "closed":
        return "bg-gray-500/20 text-gray-600";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Detail Surat
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="detail" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="detail">Detail</TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              Riwayat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="space-y-4 mt-4">
            {/* Letter Number */}
            <div className="bg-muted/50 p-4 rounded-lg">
              <Label className="text-muted-foreground text-sm">Nomor Surat</Label>
              <div className="flex items-center gap-2 mt-1">
                <p className="font-mono text-lg font-bold">{letter.letter_number}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={copyLetterNumber}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground text-sm">Entitas</Label>
                <p className="font-medium">{letter.entity_code} - {letter.entity_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Kategori</Label>
                <p className="font-medium">{letter.category_code} - {letter.category_name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Tanggal Dibuat</Label>
                <p className="font-medium">
                  {format(new Date(letter.created_at), "dd MMMM yyyy", { locale: idLocale })}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground text-sm">Pembuat</Label>
                <p className="font-medium">{letter.created_by_profile?.full_name || "-"}</p>
              </div>
            </div>

            {/* Recipient */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">Penerima</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Nama</Label>
                  <p className="font-medium">{letter.recipient_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground text-sm">Perusahaan</Label>
                  <p className="font-medium">{letter.recipient_company || "-"}</p>
                </div>
              </div>
            </div>

            {/* Project */}
            {(letter.project_label || letter.project) && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Project / Campaign</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Label</Label>
                    <p className="font-medium">{letter.project_label || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Project</Label>
                    <p className="font-medium">{letter.project?.title || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sent Info */}
            {letter.status === "sent" && letter.sent_at && (
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Informasi Pengiriman</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Dikirim Oleh</Label>
                    <p className="font-medium">{letter.sent_by_profile?.full_name || "-"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Tanggal Kirim</Label>
                    <p className="font-medium">
                      {format(new Date(letter.sent_at), "dd MMMM yyyy HH:mm", { locale: idLocale })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Editable Fields */}
            {canManage && (
              <div className="border-t pt-4 space-y-4">
                <h4 className="font-medium">Update Surat</h4>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Link Dokumen / PDF</Label>
                  <Input
                    placeholder="https://..."
                    value={documentUrl}
                    onChange={(e) => setDocumentUrl(e.target.value)}
                  />
                  {documentUrl && (
                    <Button
                      variant="link"
                      size="sm"
                      className="p-0 h-auto"
                      onClick={() => window.open(documentUrl, "_blank")}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Buka dokumen
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Catatan</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Simpan Perubahan
                  </Button>
                </div>
              </div>
            )}

            {/* Current Status Badge */}
            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-sm text-muted-foreground">Status Saat Ini:</span>
              <Badge className={getStatusColor(letter.status)}>
                {STATUSES.find(s => s.value === letter.status)?.label || letter.status}
              </Badge>
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <div className="space-y-3">
              {activityLogs?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Belum ada aktivitas
                </p>
              ) : (
                activityLogs?.map((log) => (
                  <div
                    key={log.id}
                    className="border rounded-lg p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd MMM yyyy HH:mm", {
                          locale: idLocale,
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{log.new_value}</p>
                    {log.old_value && (
                      <p className="text-xs text-muted-foreground">
                        Sebelumnya: {log.old_value}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Oleh: {log.changed_by_profile?.full_name || "-"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
