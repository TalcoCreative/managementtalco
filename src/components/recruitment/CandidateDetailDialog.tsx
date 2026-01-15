import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail,
  Phone,
  MapPin,
  FileText,
  Briefcase,
  Calendar,
  User,
  Star,
  History,
  MessageSquare,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface CandidateDetailDialogProps {
  candidateId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS = [
  { value: "applied", label: "Applied", color: "bg-blue-500" },
  { value: "screening_hr", label: "Screening HR", color: "bg-yellow-500" },
  { value: "interview_user", label: "Interview User", color: "bg-orange-500" },
  { value: "interview_final", label: "Interview Final", color: "bg-purple-500" },
  { value: "offering", label: "Offering", color: "bg-indigo-500" },
  { value: "hired", label: "Hired", color: "bg-green-500" },
  { value: "rejected", label: "Rejected", color: "bg-red-500" },
];

export function CandidateDetailDialog({
  candidateId,
  open,
  onOpenChange,
}: CandidateDetailDialogProps) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState("");
  const [assessmentType, setAssessmentType] = useState<string>("hr");
  const [assessmentRating, setAssessmentRating] = useState<number>(3);
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data: candidate } = useQuery({
    queryKey: ["candidate", candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const { data, error } = await supabase
        .from("candidates")
        .select(`
          *,
          hr_pic:profiles!candidates_hr_pic_id_fkey(id, full_name)
        `)
        .eq("id", candidateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const { data: statusHistory } = useQuery({
    queryKey: ["candidate-status-history", candidateId],
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("candidate_status_history")
        .select(`
          *,
          changed_by_user:profiles!candidate_status_history_changed_by_fkey(id, full_name)
        `)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const { data: assessments } = useQuery({
    queryKey: ["candidate-assessments", candidateId],
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("candidate_assessments")
        .select(`
          *,
          assessor:profiles!candidate_assessments_assessor_id_fkey(id, full_name)
        `)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  const { data: notes } = useQuery({
    queryKey: ["candidate-notes", candidateId],
    queryFn: async () => {
      if (!candidateId) return [];
      const { data, error } = await supabase
        .from("candidate_notes")
        .select(`
          *,
          author:profiles!candidate_notes_author_id_fkey(id, full_name)
        `)
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!candidateId,
  });

  // Latest form submission (jawaban dari form builder)
  const { data: latestSubmission } = useQuery({
    queryKey: ["candidate-form-submission", candidateId],
    queryFn: async () => {
      if (!candidateId) return null;
      const { data, error } = await supabase
        .from("recruitment_form_submissions")
        .select("id, form_id, submission_data, submitted_at")
        .eq("candidate_id", candidateId)
        .order("submitted_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as null | {
        id: string;
        form_id: string;
        submission_data: Record<string, any>;
        submitted_at: string;
      };
    },
    enabled: !!candidateId,
  });

  const { data: submissionFields } = useQuery({
    queryKey: ["candidate-form-fields", latestSubmission?.form_id],
    queryFn: async () => {
      if (!latestSubmission?.form_id) return [];
      const { data, error } = await supabase
        .from("recruitment_form_fields")
        .select("id, label, field_type, field_order")
        .eq("form_id", latestSubmission.form_id)
        .order("field_order", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        label: string;
        field_type: string;
        field_order: number;
      }>;
    },
    enabled: !!latestSubmission?.form_id,
  });

  const answerItems = useMemo(() => {
    if (!latestSubmission) return [];
    const payload = (latestSubmission.submission_data || {}) as Record<string, any>;

    // Jika fields tersedia, pakai label dari builder. Kalau tidak, fallback ke key JSON.
    if (submissionFields && submissionFields.length > 0) {
      return submissionFields.map((f) => ({
        id: f.id,
        label: f.label,
        fieldType: f.field_type,
        value: payload[f.id],
      }));
    }

    return Object.entries(payload).map(([key, value]) => ({
      id: key,
      label: key,
      fieldType: typeof value,
      value,
    }));
  }, [latestSubmission, submissionFields]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ newStatus, oldStatus }: { newStatus: string; oldStatus: string }) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !candidateId) throw new Error("Not authenticated");

      const { error: updateError } = await supabase
        .from("candidates")
        .update({ status: newStatus as any })
        .eq("id", candidateId);
      if (updateError) throw updateError;

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
      queryClient.invalidateQueries({ queryKey: ["candidate", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidate-status-history", candidateId] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Status updated");
    },
    onError: (error) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !candidateId) throw new Error("Not authenticated");

      const { error } = await supabase.from("candidate_notes").insert({
        candidate_id: candidateId,
        author_id: session.session.user.id,
        content: newNote,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-notes", candidateId] });
      setNewNote("");
      toast.success("Catatan ditambahkan");
    },
    onError: (error) => {
      toast.error("Gagal menambahkan catatan: " + error.message);
    },
  });

  const addAssessmentMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session || !candidateId) throw new Error("Not authenticated");

      const { error } = await supabase.from("candidate_assessments").insert({
        candidate_id: candidateId,
        assessor_id: session.session.user.id,
        assessment_type: assessmentType,
        rating: assessmentRating,
        notes: assessmentNotes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-assessments", candidateId] });
      setAssessmentNotes("");
      setAssessmentRating(3);
      toast.success("Penilaian ditambahkan");
    },
    onError: (error) => {
      toast.error("Gagal menambahkan penilaian: " + error.message);
    },
  });

  const handleDeleteCandidate = async () => {
    if (!candidateId) return;
    setDeleting(true);
    try {
      // Delete related data first
      await supabase.from("candidate_notes").delete().eq("candidate_id", candidateId);
      await supabase.from("candidate_assessments").delete().eq("candidate_id", candidateId);
      await supabase.from("candidate_status_history").delete().eq("candidate_id", candidateId);

      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidateId);

      if (error) throw error;

      toast.success("Kandidat dihapus");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
    } catch (error: any) {
      toast.error("Gagal menghapus kandidat");
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  if (!candidate) return null;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">{candidate.full_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="info" className="text-xs sm:text-sm">Info</TabsTrigger>
            <TabsTrigger value="answers" className="text-xs sm:text-sm">Jawaban</TabsTrigger>
            <TabsTrigger value="history" className="text-xs sm:text-sm">Riwayat</TabsTrigger>
            <TabsTrigger value="assessment" className="text-xs sm:text-sm">Penilaian</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs sm:text-sm">Catatan</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4">
            <TabsContent value="info" className="space-y-4 mt-4">
              {/* Status */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Status Rekrutmen</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={candidate.status}
                    onValueChange={(value) =>
                      updateStatusMutation.mutate({
                        newStatus: value,
                        oldStatus: candidate.status,
                      })
                    }
                  >
                    <SelectTrigger className="w-full sm:w-[200px] h-12 sm:h-10">
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
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Informasi Kontak</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${candidate.email}`} className="text-primary hover:underline">
                      {candidate.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${candidate.phone}`} className="text-primary hover:underline">
                      {candidate.phone}
                    </a>
                  </div>
                  {candidate.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{candidate.location}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Position Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Posisi</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <span>{candidate.position}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>Divisi: {candidate.division}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Apply: {format(new Date(candidate.applied_at), "dd MMMM yyyy")}</span>
                  </div>
                  {candidate.hr_pic && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>HR PIC: {candidate.hr_pic.full_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Dokumen</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {candidate.cv_url ? (
                    <a
                      href={candidate.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Lihat CV</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <p className="text-muted-foreground text-sm">CV belum diupload</p>
                  )}
                  {candidate.portfolio_url && (
                    <a
                      href={candidate.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Briefcase className="h-4 w-4" />
                      <span>Lihat Portfolio</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
               </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="answers" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Jawaban Form</CardTitle>
                </CardHeader>
                <CardContent>
                  {!latestSubmission ? (
                    <p className="text-muted-foreground text-sm">Belum ada jawaban dari form builder.</p>
                  ) : answerItems.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Jawaban tidak ditemukan.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Submitted: {format(new Date(latestSubmission.submitted_at), "dd MMM yyyy HH:mm")}
                      </p>
                      {answerItems.map((item) => {
                        const v = item.value;
                        const isEmpty = v === undefined || v === null || v === "";
                        const asText =
                          typeof v === "string" || typeof v === "number" || typeof v === "boolean"
                            ? String(v)
                            : JSON.stringify(v);

                        const isLink = typeof v === "string" && /^https?:\/\//i.test(v);

                        return (
                          <div key={item.id} className="rounded-lg border p-3">
                            <p className="text-sm font-medium">{item.label}</p>
                            <div className="mt-1 text-sm text-muted-foreground break-words">
                              {isEmpty ? (
                                <span>-</span>
                              ) : isLink ? (
                                <a
                                  href={String(v)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  Buka
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span>{asText}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>


            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Riwayat Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statusHistory && statusHistory.length > 0 ? (
                    <div className="space-y-3">
                      {statusHistory.map((history: any) => (
                        <div key={history.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {getStatusBadge(history.old_status)}
                              <span className="text-muted-foreground">→</span>
                              {getStatusBadge(history.new_status)}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Oleh {history.changed_by_user?.full_name} •{" "}
                              {format(new Date(history.created_at), "dd MMM yyyy HH:mm")}
                            </p>
                            {history.notes && (
                              <p className="text-sm mt-1">{history.notes}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Belum ada riwayat perubahan status</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="assessment" className="space-y-4 mt-4">
              {/* Add Assessment */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    Tambah Penilaian
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipe Penilaian</Label>
                      <Select value={assessmentType} onValueChange={setAssessmentType}>
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hr">HR Assessment</SelectItem>
                          <SelectItem value="user_interview">User Interview Assessment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Rating (1-5)</Label>
                      <Select
                        value={assessmentRating.toString()}
                        onValueChange={(v) => setAssessmentRating(parseInt(v))}
                      >
                        <SelectTrigger className="h-12 sm:h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((r) => (
                            <SelectItem key={r} value={r.toString()}>
                              {r} - {r === 1 ? "Poor" : r === 2 ? "Fair" : r === 3 ? "Good" : r === 4 ? "Very Good" : "Excellent"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Catatan Penilaian</Label>
                    <Textarea
                      value={assessmentNotes}
                      onChange={(e) => setAssessmentNotes(e.target.value)}
                      placeholder="Tulis penilaian Anda..."
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={() => addAssessmentMutation.mutate()}
                    disabled={addAssessmentMutation.isPending}
                    className="h-12 sm:h-10"
                  >
                    {addAssessmentMutation.isPending ? "Menyimpan..." : "Simpan Penilaian"}
                  </Button>
                </CardContent>
              </Card>

              {/* Assessment List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Daftar Penilaian</CardTitle>
                </CardHeader>
                <CardContent>
                  {assessments && assessments.length > 0 ? (
                    <div className="space-y-4">
                      {assessments.map((assessment: any) => (
                        <div key={assessment.id} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">
                              {assessment.assessment_type === "hr" ? "HR Assessment" : "User Interview"}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < assessment.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          {assessment.notes && <p className="text-sm">{assessment.notes}</p>}
                          <p className="text-xs text-muted-foreground mt-2">
                            Oleh {assessment.assessor?.full_name} •{" "}
                            {format(new Date(assessment.created_at), "dd MMM yyyy HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Belum ada penilaian</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes" className="space-y-4 mt-4">
              {/* Add Note */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Tambah Catatan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Tulis catatan internal..."
                    rows={3}
                  />
                  <Button
                    onClick={() => addNoteMutation.mutate()}
                    disabled={!newNote.trim() || addNoteMutation.isPending}
                    className="h-12 sm:h-10"
                  >
                    {addNoteMutation.isPending ? "Menyimpan..." : "Tambah Catatan"}
                  </Button>
                </CardContent>
              </Card>

              {/* Notes List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Catatan Internal</CardTitle>
                </CardHeader>
                <CardContent>
                  {notes && notes.length > 0 ? (
                    <div className="space-y-3">
                      {notes.map((note: any) => (
                        <div key={note.id} className="p-3 border rounded-lg">
                          <p className="text-sm">{note.content}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Oleh {note.author?.full_name} •{" "}
                            {format(new Date(note.created_at), "dd MMM yyyy HH:mm")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">Belum ada catatan</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {/* Delete Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Hapus Kandidat
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Kandidat?</AlertDialogTitle>
          <AlertDialogDescription>
            Apakah Anda yakin ingin menghapus kandidat "{candidate.full_name}"? 
            Semua data termasuk notes, assessments, dan history akan dihapus. Tindakan ini tidak dapat dibatalkan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteCandidate}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Menghapus..." : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
