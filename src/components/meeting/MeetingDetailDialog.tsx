import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Calendar, Clock, MapPin, Video, Users, Building2, 
  Link as LinkIcon, Check, X, ExternalLink, CalendarClock,
  FileText, Plus, Pencil, Trash2, Save, Download, Lock
} from "lucide-react";
import { format, parseISO, isToday, isFuture } from "date-fns";
import { id } from "date-fns/locale";
import { generateMOMPDF } from "@/lib/mom-pdf";

interface MeetingDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: any;
  onUpdate: () => void;
  isHRorAdmin?: boolean;
}

interface MOMItem {
  no: number;
  keterangan: string;
  hasil: string;
}

const MeetingDetailDialog = ({ 
  open, 
  onOpenChange, 
  meeting, 
  onUpdate,
  isHRorAdmin 
}: MeetingDetailDialogProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleData, setRescheduleData] = useState({
    meeting_date: "",
    start_time: "",
    end_time: "",
    reschedule_reason: "",
  });
  const [showMOMForm, setShowMOMForm] = useState(false);
  const [momItems, setMomItems] = useState<MOMItem[]>([{ no: 1, keterangan: "", hasil: "" }]);
  const [editingMOM, setEditingMOM] = useState<string | null>(null);
  const [editMomItems, setEditMomItems] = useState<MOMItem[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Fetch participants
  const { data: participants, refetch: refetchParticipants } = useQuery({
    queryKey: ["meeting-participants", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_participants")
        .select(`
          *,
          user:profiles(id, full_name, email)
        `)
        .eq("meeting_id", meeting.id);
      if (error) throw error;
      return data;
    },
    enabled: !!meeting.id,
  });

  // Fetch external participants
  const { data: externalParticipants } = useQuery({
    queryKey: ["meeting-external-participants", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_external_participants")
        .select("*")
        .eq("meeting_id", meeting.id);
      if (error) throw error;
      return data;
    },
    enabled: !!meeting.id,
  });

  // Fetch meeting minutes
  const { data: meetingMinutes, refetch: refetchMOM } = useQuery({
    queryKey: ["meeting-minutes", meeting.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meeting_minutes")
        .select(`
          *,
          creator:created_by(full_name)
        `)
        .eq("meeting_id", meeting.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!meeting.id,
  });

  const isCreator = currentUser?.id === meeting.created_by;
  const canEdit = isCreator || isHRorAdmin;
  const meetingDate = parseISO(meeting.meeting_date);
  const isMeetingUpcoming = isFuture(meetingDate) || isToday(meetingDate);
  const userParticipation = participants?.find(p => p.user_id === currentUser?.id);

  const handleRespond = async (status: "accepted" | "rejected") => {
    if (!userParticipation) return;

    if (status === "rejected") {
      setShowRejectDialog(true);
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .update({
          status,
          responded_at: new Date().toISOString(),
        })
        .eq("id", userParticipation.id);

      if (error) throw error;

      await supabase
        .from("meeting_notifications")
        .update({ is_read: true })
        .eq("meeting_id", meeting.id)
        .eq("user_id", currentUser?.id);

      toast.success("Meeting diterima");
      refetchParticipants();
      queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-meeting-invitations"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal merespon undangan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectionReason.trim()) {
      toast.error("Mohon isi alasan menolak");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meeting_participants")
        .update({
          status: "rejected",
          responded_at: new Date().toISOString(),
          rejection_reason: rejectionReason,
        })
        .eq("id", userParticipation?.id);

      if (error) throw error;

      await supabase
        .from("meeting_notifications")
        .update({ is_read: true })
        .eq("meeting_id", meeting.id)
        .eq("user_id", currentUser?.id);

      toast.success("Meeting ditolak");
      setShowRejectDialog(false);
      setRejectionReason("");
      refetchParticipants();
      queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["pending-meeting-invitations"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menolak undangan");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({ status: newStatus })
        .eq("id", meeting.id);

      if (error) throw error;

      toast.success("Status meeting diperbarui");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleData.meeting_date || !rescheduleData.start_time || !rescheduleData.end_time) {
      toast.error("Mohon lengkapi data reschedule");
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({
          original_date: meeting.original_date || meeting.meeting_date,
          meeting_date: rescheduleData.meeting_date,
          start_time: rescheduleData.start_time,
          end_time: rescheduleData.end_time,
          reschedule_reason: rescheduleData.reschedule_reason,
          rescheduled_at: new Date().toISOString(),
        })
        .eq("id", meeting.id);

      if (error) throw error;

      toast.success("Meeting berhasil di-reschedule");
      setShowReschedule(false);
      setRescheduleData({ meeting_date: "", start_time: "", end_time: "", reschedule_reason: "" });
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal reschedule meeting");
    } finally {
      setIsUpdating(false);
    }
  };

  const addMOMRow = () => {
    setMomItems([...momItems, { no: momItems.length + 1, keterangan: "", hasil: "" }]);
  };

  const removeMOMRow = (index: number) => {
    if (momItems.length === 1) return;
    const newItems = momItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, no: i + 1 }));
    setMomItems(newItems);
  };

  const updateMOMItem = (index: number, field: "keterangan" | "hasil", value: string) => {
    const newItems = [...momItems];
    newItems[index][field] = value;
    setMomItems(newItems);
  };

  const handleAddMOM = async () => {
    const validItems = momItems.filter(item => item.keterangan.trim() || item.hasil.trim());
    if (validItems.length === 0) {
      toast.error("Mohon isi minimal satu baris MOM");
      return;
    }

    setIsUpdating(true);
    try {
      const content = JSON.stringify(validItems.map((item, i) => ({ ...item, no: i + 1 })));
      const { error } = await supabase
        .from("meeting_minutes")
        .insert({
          meeting_id: meeting.id,
          content,
          created_by: currentUser?.id,
        });

      if (error) throw error;

      toast.success("MOM berhasil ditambahkan");
      setMomItems([{ no: 1, keterangan: "", hasil: "" }]);
      setShowMOMForm(false);
      refetchMOM();
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan MOM");
    } finally {
      setIsUpdating(false);
    }
  };

  const startEditMOM = (mom: any) => {
    try {
      const items = JSON.parse(mom.content);
      setEditMomItems(items);
      setEditingMOM(mom.id);
    } catch {
      setEditMomItems([{ no: 1, keterangan: mom.content, hasil: "" }]);
      setEditingMOM(mom.id);
    }
  };

  const addEditMOMRow = () => {
    setEditMomItems([...editMomItems, { no: editMomItems.length + 1, keterangan: "", hasil: "" }]);
  };

  const removeEditMOMRow = (index: number) => {
    if (editMomItems.length === 1) return;
    const newItems = editMomItems.filter((_, i) => i !== index).map((item, i) => ({ ...item, no: i + 1 }));
    setEditMomItems(newItems);
  };

  const updateEditMOMItem = (index: number, field: "keterangan" | "hasil", value: string) => {
    const newItems = [...editMomItems];
    newItems[index][field] = value;
    setEditMomItems(newItems);
  };

  const handleUpdateMOM = async (momId: string) => {
    const validItems = editMomItems.filter(item => item.keterangan.trim() || item.hasil.trim());
    if (validItems.length === 0) {
      toast.error("Mohon isi minimal satu baris MOM");
      return;
    }

    setIsUpdating(true);
    try {
      const content = JSON.stringify(validItems.map((item, i) => ({ ...item, no: i + 1 })));
      const { error } = await supabase
        .from("meeting_minutes")
        .update({
          content,
          updated_at: new Date().toISOString(),
        })
        .eq("id", momId);

      if (error) throw error;

      toast.success("MOM berhasil diperbarui");
      setEditingMOM(null);
      setEditMomItems([]);
      refetchMOM();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui MOM");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteMOM = async (momId: string) => {
    if (!confirm("Hapus MOM ini?")) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meeting_minutes")
        .delete()
        .eq("id", momId);

      if (error) throw error;

      toast.success("MOM berhasil dihapus");
      refetchMOM();
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus MOM");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!meetingMinutes || meetingMinutes.length === 0) {
      toast.error("Tidak ada MOM untuk diexport");
      return;
    }

    // Combine all MOM items
    let allItems: MOMItem[] = [];
    meetingMinutes.forEach((mom: any) => {
      try {
        const items = JSON.parse(mom.content);
        allItems = [...allItems, ...items];
      } catch {
        allItems.push({ no: allItems.length + 1, keterangan: mom.content, hasil: "" });
      }
    });

    // Re-number items
    allItems = allItems.map((item, i) => ({ ...item, no: i + 1 }));

    generateMOMPDF(
      meeting,
      allItems,
      participants || [],
      externalParticipants || []
    );
    toast.success("PDF berhasil didownload");
  };

  const parseMOMContent = (content: string): MOMItem[] => {
    try {
      return JSON.parse(content);
    } catch {
      return [{ no: 1, keterangan: content, hasil: "" }];
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Diterima</Badge>;
      case "rejected":
        return <Badge variant="destructive">Ditolak</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const calculateDuration = () => {
    const [startHour, startMin] = meeting.start_time.split(":").map(Number);
    const [endHour, endMin] = meeting.end_time.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes - startMinutes;
  };

  const duration = calculateDuration();
  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;

  const rejectedParticipants = participants?.filter(p => p.status === "rejected") || [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 flex-wrap">
              {meeting.title}
              {meeting.type === "internal" ? (
                <Badge variant="outline" className="bg-purple-50 text-purple-700">Internal</Badge>
              ) : (
                <Badge variant="outline" className="bg-orange-50 text-orange-700">External</Badge>
              )}
              {meeting.is_confidential && (
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                  <Lock className="w-3 h-3 mr-1" />
                  Rahasia
                </Badge>
              )}
              {meeting.rescheduled_at && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Rescheduled</Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Meeting Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{format(meetingDate, "EEEE, dd MMMM yyyy", { locale: id })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {meeting.start_time.slice(0, 5)} - {meeting.end_time.slice(0, 5)}
                  <span className="text-muted-foreground text-sm ml-2">
                    ({hours > 0 ? `${hours} jam ` : ""}{minutes > 0 ? `${minutes} menit` : ""})
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-2">
                {meeting.mode === "online" ? (
                  <>
                    <Video className="w-4 h-4 text-muted-foreground" />
                    <span>Online</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>Offline</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span>
                  {(participants?.length || 0) + (externalParticipants?.length || 0)} partisipan
                </span>
              </div>
            </div>

            {/* Reschedule Info */}
            {meeting.original_date && meeting.rescheduled_at && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <strong>Rescheduled:</strong> Dari tanggal {format(parseISO(meeting.original_date), "dd MMM yyyy", { locale: id })}
                </p>
                {meeting.reschedule_reason && (
                  <p className="text-sm text-yellow-700 mt-1">Alasan: {meeting.reschedule_reason}</p>
                )}
              </div>
            )}

            {/* Meeting Link/Location */}
            {meeting.mode === "online" && meeting.meeting_link && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" />
                    <span className="text-sm truncate max-w-[300px]">{meeting.meeting_link}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={meeting.meeting_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Buka
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {meeting.mode === "offline" && meeting.location && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{meeting.location}</span>
                </div>
              </div>
            )}

            {/* Client & Project */}
            {(meeting.client || meeting.project) && (
              <div className="flex gap-4">
                {meeting.client && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span>Client: {meeting.client.name}</span>
                  </div>
                )}
                {meeting.project && (
                  <div className="flex items-center gap-2">
                    <span>Project: {meeting.project.title}</span>
                  </div>
                )}
              </div>
            )}

            {/* User Response Section */}
            {userParticipation && isMeetingUpcoming && meeting.status !== "cancelled" && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium mb-3">Status partisipasi Anda:</p>
                {userParticipation.status === "pending" ? (
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleRespond("accepted")} 
                      disabled={isUpdating}
                      className="flex-1"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Terima
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleRespond("rejected")} 
                      disabled={isUpdating}
                      className="flex-1"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Tolak
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {getStatusBadge(userParticipation.status)}
                    <span className="text-sm text-muted-foreground">
                      pada {format(parseISO(userParticipation.responded_at), "dd MMM yyyy HH:mm", { locale: id })}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Tabs */}
            <Tabs defaultValue="participants">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="participants">
                  <Users className="w-4 h-4 mr-2" />
                  Partisipan
                </TabsTrigger>
                <TabsTrigger value="mom">
                  <FileText className="w-4 h-4 mr-2" />
                  MOM ({meetingMinutes?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="participants" className="mt-4 space-y-4">
                {/* Internal Participants */}
                <div>
                  <p className="text-sm font-medium mb-2">Internal ({participants?.length || 0})</p>
                  {participants?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada partisipan internal</p>
                  ) : (
                    <div className="space-y-2">
                      {participants?.map((p) => (
                        <div key={p.id} className="flex items-start justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="font-medium">{p.user?.full_name}</p>
                            <p className="text-sm text-muted-foreground">{p.user?.email}</p>
                            {p.status === "rejected" && p.rejection_reason && (
                              <p className="text-sm text-red-600 mt-1">
                                Alasan: {p.rejection_reason}
                              </p>
                            )}
                          </div>
                          {getStatusBadge(p.status)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejected Participants Summary */}
                {rejectedParticipants.length > 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-800 mb-2">
                      Tidak Hadir ({rejectedParticipants.length})
                    </p>
                    {rejectedParticipants.map((p) => (
                      <div key={p.id} className="text-sm text-red-700">
                        <span className="font-medium">{p.user?.full_name}</span>
                        {p.rejection_reason && <span> - {p.rejection_reason}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* External Participants */}
                <div>
                  <p className="text-sm font-medium mb-2">External ({externalParticipants?.length || 0})</p>
                  {externalParticipants?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Tidak ada partisipan external</p>
                  ) : (
                    <div className="space-y-2">
                      {externalParticipants?.map((p) => (
                        <div key={p.id} className="p-2 border rounded">
                          <p className="font-medium">{p.name}</p>
                          {p.company && <p className="text-sm text-muted-foreground">{p.company}</p>}
                          {p.email && <p className="text-sm text-muted-foreground">{p.email}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="mom" className="mt-4 space-y-4">
                {/* Actions */}
                <div className="flex gap-2">
                  {canEdit && !showMOMForm && (
                    <Button variant="outline" onClick={() => setShowMOMForm(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Tambah MOM
                    </Button>
                  )}
                  {meetingMinutes && meetingMinutes.length > 0 && (
                    <Button variant="outline" onClick={handleDownloadPDF}>
                      <Download className="w-4 h-4 mr-2" />
                      Download PDF
                    </Button>
                  )}
                </div>

                {/* Add MOM Form */}
                {showMOMForm && (
                  <div className="p-4 border rounded-lg space-y-4">
                    <Label className="text-base font-medium">Minutes of Meeting</Label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">No.</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead>Hasil</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {momItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{item.no}</TableCell>
                            <TableCell>
                              <Textarea
                                value={item.keterangan}
                                onChange={(e) => updateMOMItem(index, "keterangan", e.target.value)}
                                placeholder="Keterangan..."
                                rows={2}
                                className="min-w-[150px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Textarea
                                value={item.hasil}
                                onChange={(e) => updateMOMItem(index, "hasil", e.target.value)}
                                placeholder="Hasil..."
                                rows={2}
                                className="min-w-[150px]"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeMOMRow(index)}
                                disabled={momItems.length === 1}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={addMOMRow}>
                        <Plus className="w-4 h-4 mr-2" />
                        Tambah Baris
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddMOM} disabled={isUpdating}>
                        <Save className="w-4 h-4 mr-2" />
                        Simpan
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setShowMOMForm(false);
                        setMomItems([{ no: 1, keterangan: "", hasil: "" }]);
                      }}>
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

                {/* MOM List */}
                {meetingMinutes?.length === 0 && !showMOMForm ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Belum ada MOM untuk meeting ini
                  </p>
                ) : (
                  <div className="space-y-4">
                    {meetingMinutes?.map((mom: any) => (
                      <div key={mom.id} className="border rounded-lg overflow-hidden">
                        {editingMOM === mom.id ? (
                          <div className="p-4 space-y-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[60px]">No.</TableHead>
                                  <TableHead>Keterangan</TableHead>
                                  <TableHead>Hasil</TableHead>
                                  <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {editMomItems.map((item, index) => (
                                  <TableRow key={index}>
                                    <TableCell className="font-medium">{item.no}</TableCell>
                                    <TableCell>
                                      <Textarea
                                        value={item.keterangan}
                                        onChange={(e) => updateEditMOMItem(index, "keterangan", e.target.value)}
                                        rows={2}
                                        className="min-w-[150px]"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Textarea
                                        value={item.hasil}
                                        onChange={(e) => updateEditMOMItem(index, "hasil", e.target.value)}
                                        rows={2}
                                        className="min-w-[150px]"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeEditMOMRow(index)}
                                        disabled={editMomItems.length === 1}
                                      >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={addEditMOMRow}>
                                <Plus className="w-4 h-4 mr-2" />
                                Tambah Baris
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleUpdateMOM(mom.id)} disabled={isUpdating}>
                                <Save className="w-4 h-4 mr-2" />
                                Simpan
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingMOM(null);
                                setEditMomItems([]);
                              }}>
                                Batal
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[60px]">No.</TableHead>
                                  <TableHead>Keterangan</TableHead>
                                  <TableHead>Hasil</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {parseMOMContent(mom.content).map((item: MOMItem) => (
                                  <TableRow key={item.no}>
                                    <TableCell className="font-medium">{item.no}</TableCell>
                                    <TableCell className="whitespace-pre-wrap">{item.keterangan}</TableCell>
                                    <TableCell className="whitespace-pre-wrap">{item.hasil}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                            <div className="flex items-center justify-between p-3 border-t bg-muted/30">
                              <div className="text-xs text-muted-foreground">
                                <span>Oleh: {mom.creator?.full_name || "Unknown"}</span>
                                <span className="mx-2">•</span>
                                <span>{format(parseISO(mom.created_at), "dd MMM yyyy HH:mm", { locale: id })}</span>
                              </div>
                              {canEdit && (
                                <div className="flex gap-1">
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => startEditMOM(mom)}
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    onClick={() => handleDeleteMOM(mom.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Notes */}
            {meeting.notes && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Catatan</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{meeting.notes}</p>
                </div>
              </>
            )}

            {/* Reschedule Form */}
            {showReschedule && (
              <>
                <Separator />
                <div className="p-4 border rounded-lg space-y-4">
                  <p className="font-medium">Reschedule Meeting</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Tanggal Baru</Label>
                      <Input
                        type="date"
                        value={rescheduleData.meeting_date}
                        onChange={(e) => setRescheduleData(prev => ({ ...prev, meeting_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Jam Mulai</Label>
                      <Input
                        type="time"
                        value={rescheduleData.start_time}
                        onChange={(e) => setRescheduleData(prev => ({ ...prev, start_time: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Jam Selesai</Label>
                      <Input
                        type="time"
                        value={rescheduleData.end_time}
                        onChange={(e) => setRescheduleData(prev => ({ ...prev, end_time: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Alasan Reschedule</Label>
                    <Textarea
                      value={rescheduleData.reschedule_reason}
                      onChange={(e) => setRescheduleData(prev => ({ ...prev, reschedule_reason: e.target.value }))}
                      placeholder="Alasan reschedule meeting..."
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleReschedule} disabled={isUpdating}>
                      <CalendarClock className="w-4 h-4 mr-2" />
                      Konfirmasi Reschedule
                    </Button>
                    <Button variant="outline" onClick={() => setShowReschedule(false)}>
                      Batal
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Creator Actions */}
            {canEdit && (
              <>
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {meeting.status === "scheduled" && (
                    <>
                      {!showReschedule && (
                        <Button 
                          variant="outline" 
                          onClick={() => setShowReschedule(true)}
                          disabled={isUpdating}
                        >
                          <CalendarClock className="w-4 h-4 mr-2" />
                          Reschedule
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        onClick={() => handleUpdateStatus("completed")}
                        disabled={isUpdating}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Tandai Selesai
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => handleUpdateStatus("cancelled")}
                        disabled={isUpdating}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Batalkan
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Meeting Meta */}
            <div className="text-xs text-muted-foreground">
              <p>Dibuat oleh: {meeting.creator?.full_name}</p>
              <p>Pada: {format(parseISO(meeting.created_at), "dd MMM yyyy HH:mm", { locale: id })}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tolak Undangan Meeting</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anda akan menolak undangan meeting: <strong>{meeting.title}</strong>
            </p>
            <div>
              <Label>Alasan Menolak *</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Masukkan alasan mengapa Anda tidak bisa hadir..."
                rows={3}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={handleRejectConfirm} disabled={isUpdating}>
              Konfirmasi Tolak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MeetingDetailDialog;
