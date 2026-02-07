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
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Calendar, Clock, MapPin, Video, Users, Building2, 
  Link as LinkIcon, Check, X, ExternalLink, CalendarClock,
  FileText, Plus, Pencil, Trash2, Save, Download, Lock
} from "lucide-react";
import { format, parseISO, isToday, isFuture } from "date-fns";
import { id } from "date-fns/locale";
import { generateMOMPDF } from "@/lib/mom-pdf";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showEditParticipants, setShowEditParticipants] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [editExternalParticipants, setEditExternalParticipants] = useState<{id?: string; name: string; company: string; email: string}[]>([]);
  const [showEditEndTime, setShowEditEndTime] = useState(false);
  const [editEndTime, setEditEndTime] = useState("");
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

  // Fetch all profiles for edit participants
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
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
      const updateData: any = { status: newStatus };
      
      // If marking as completed, set end_time to current time
      if (newStatus === "completed") {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        updateData.end_time = `${hours}:${minutes}:00`;
      }
      
      const { error } = await supabase
        .from("meetings")
        .update(updateData)
        .eq("id", meeting.id);

      if (error) throw error;

      // If meeting is completed and has a linked task, mark the task as done
      if (newStatus === "completed" && meeting.task_id) {
        const { error: taskError } = await supabase
          .from("tasks")
          .update({ status: "done" })
          .eq("id", meeting.task_id);
        
        if (taskError) {
          console.error("Error updating task:", taskError);
          // Don't throw - meeting update was successful
        } else {
          toast.success("Meeting selesai & task terkait ditandai selesai");
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
          onUpdate();
          return;
        }
      }

      toast.success("Status meeting diperbarui");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEditParticipants = () => {
    // Initialize selected participants from current participants
    const currentParticipantIds = participants?.map(p => p.user_id) || [];
    setSelectedParticipants(currentParticipantIds);
    // Initialize external participants
    const currentExternal = externalParticipants?.map(p => ({
      id: p.id,
      name: p.name,
      company: p.company || "",
      email: p.email || "",
    })) || [];
    setEditExternalParticipants(currentExternal.length > 0 ? currentExternal : []);
    setShowEditParticipants(true);
  };

  const handleParticipantToggle = (profileId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(profileId) 
        ? prev.filter(id => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleAddExternalParticipant = () => {
    setEditExternalParticipants(prev => [...prev, { name: "", company: "", email: "" }]);
  };

  const handleRemoveExternalParticipant = (index: number) => {
    setEditExternalParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateExternalParticipant = (index: number, field: "name" | "company" | "email", value: string) => {
    setEditExternalParticipants(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSaveParticipants = async () => {
    setIsUpdating(true);
    try {
      const currentParticipantIds = participants?.map(p => p.user_id) || [];
      
      // Find participants to add
      const toAdd = selectedParticipants.filter(id => !currentParticipantIds.includes(id));
      
      // Find participants to remove
      const toRemove = currentParticipantIds.filter(id => !selectedParticipants.includes(id));
      
      // Add new participants
      if (toAdd.length > 0) {
        const newParticipants = toAdd.map(userId => ({
          meeting_id: meeting.id,
          user_id: userId,
          status: "pending",
        }));
        
        const { error: addError } = await supabase
          .from("meeting_participants")
          .insert(newParticipants);
        
        if (addError) throw addError;
        
        // Create notifications for new participants
        const notifications = toAdd.map(userId => ({
          meeting_id: meeting.id,
          user_id: userId,
        }));
        
        await supabase
          .from("meeting_notifications")
          .insert(notifications);
      }
      
      // Remove participants
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from("meeting_participants")
          .delete()
          .eq("meeting_id", meeting.id)
          .in("user_id", toRemove);
        
        if (removeError) throw removeError;
        
        // Remove their notifications too
        await supabase
          .from("meeting_notifications")
          .delete()
          .eq("meeting_id", meeting.id)
          .in("user_id", toRemove);
      }
      
      // Handle external participants
      const currentExternalIds = externalParticipants?.map(p => p.id) || [];
      const editExternalIds = editExternalParticipants.filter(p => p.id).map(p => p.id!);
      
      // Remove deleted external participants
      const externalToRemove = currentExternalIds.filter(id => !editExternalIds.includes(id));
      if (externalToRemove.length > 0) {
        await supabase
          .from("meeting_external_participants")
          .delete()
          .in("id", externalToRemove);
      }
      
      // Update existing and add new external participants
      for (const ext of editExternalParticipants) {
        if (!ext.name.trim()) continue; // Skip empty entries
        
        if (ext.id) {
          // Update existing
          await supabase
            .from("meeting_external_participants")
            .update({
              name: ext.name,
              company: ext.company || null,
              email: ext.email || null,
            })
            .eq("id", ext.id);
        } else {
          // Insert new
          await supabase
            .from("meeting_external_participants")
            .insert({
              meeting_id: meeting.id,
              name: ext.name,
              company: ext.company || null,
              email: ext.email || null,
            });
        }
      }
      
      toast.success("Peserta meeting berhasil diperbarui");
      setShowEditParticipants(false);
      refetchParticipants();
      queryClient.invalidateQueries({ queryKey: ["meeting-external-participants", meeting.id] });
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui peserta");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleStartEditEndTime = () => {
    setEditEndTime(meeting.end_time?.slice(0, 5) || "");
    setShowEditEndTime(true);
  };

  const handleSaveEndTime = async () => {
    if (!editEndTime) {
      toast.error("Mohon isi jam berakhir");
      return;
    }
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from("meetings")
        .update({ end_time: editEndTime })
        .eq("id", meeting.id);
      
      if (error) throw error;
      
      toast.success("Jam berakhir meeting berhasil diperbarui");
      setShowEditEndTime(false);
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui jam berakhir");
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
    // Re-fetch auth user to ensure we have current session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      toast.error("Session tidak valid. Silakan refresh halaman.");
      return;
    }

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
          created_by: user.id,
        });

      if (error) throw error;

      toast.success("MOM berhasil ditambahkan");
      setMomItems([{ no: 1, keterangan: "", hasil: "" }]);
      setShowMOMForm(false);
      refetchMOM();
    } catch (error: any) {
      console.error("Add MOM error:", error);
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
        <DialogContent className="max-w-3xl p-0 max-h-[90vh]">
          <ScrollArea className="max-h-[85vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
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
                {showEditEndTime ? (
                  <div className="flex items-center gap-2">
                    <span>{meeting.start_time.slice(0, 5)} -</span>
                    <Input
                      type="time"
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-28 h-8"
                    />
                    <Button size="sm" variant="ghost" onClick={handleSaveEndTime} disabled={isUpdating}>
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowEditEndTime(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span>
                      {meeting.start_time.slice(0, 5)} - {meeting.end_time.slice(0, 5)}
                      <span className="text-muted-foreground text-sm ml-2">
                        ({hours > 0 ? `${hours} jam ` : ""}{minutes > 0 ? `${minutes} menit` : ""})
                      </span>
                    </span>
                    {canEdit && (
                      <Button size="sm" variant="ghost" onClick={handleStartEditEndTime} className="h-6 px-2">
                        <Pencil className="w-3 h-3" />
                      </Button>
                    )}
                  </>
                )}
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
                {/* Edit Participants Button */}
                {canEdit && !showEditParticipants && meeting.status !== "cancelled" && (
                  <Button variant="outline" size="sm" onClick={handleStartEditParticipants}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Peserta
                  </Button>
                )}

                {/* Edit Participants Form */}
                {showEditParticipants && (
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
                    {/* Internal Participants */}
                    <div>
                      <Label className="text-base font-medium">Peserta Internal</Label>
                      <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-background mt-2">
                        {allProfiles?.filter(p => p.id !== meeting.created_by).map((profile) => (
                          <div key={profile.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`edit-${profile.id}`}
                              checked={selectedParticipants.includes(profile.id)}
                              onCheckedChange={() => handleParticipantToggle(profile.id)}
                            />
                            <label htmlFor={`edit-${profile.id}`} className="text-sm cursor-pointer flex-1">
                              {profile.full_name}
                              <span className="text-muted-foreground ml-1">({profile.email})</span>
                            </label>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {selectedParticipants.length} peserta internal dipilih
                      </p>
                    </div>

                    {/* External Participants */}
                    <div>
                      <Label className="text-base font-medium">Peserta External</Label>
                      <div className="space-y-3 mt-2">
                        {editExternalParticipants.map((ext, index) => (
                          <div key={index} className="p-3 border rounded-lg bg-background space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">Peserta External #{index + 1}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveExternalParticipant(index)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <Label className="text-xs">Nama *</Label>
                                <Input
                                  value={ext.name}
                                  onChange={(e) => handleUpdateExternalParticipant(index, "name", e.target.value)}
                                  placeholder="Nama"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Perusahaan</Label>
                                <Input
                                  value={ext.company}
                                  onChange={(e) => handleUpdateExternalParticipant(index, "company", e.target.value)}
                                  placeholder="Perusahaan"
                                  className="h-8"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Email</Label>
                                <Input
                                  value={ext.email}
                                  onChange={(e) => handleUpdateExternalParticipant(index, "email", e.target.value)}
                                  placeholder="Email"
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleAddExternalParticipant}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Peserta External
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t">
                      <Button onClick={handleSaveParticipants} disabled={isUpdating} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        Simpan Semua
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setShowEditParticipants(false)}
                      >
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

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
                  {!showMOMForm && (
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
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={isUpdating}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Hapus Meeting
                  </Button>
                </div>
              </>
            )}

            {/* Meeting Meta */}
            <div className="text-xs text-muted-foreground">
              <p>Dibuat oleh: {meeting.creator?.full_name}</p>
              <p>Pada: {format(parseISO(meeting.created_at), "dd MMM yyyy HH:mm", { locale: id })}</p>
            </div>
          </div>
            </div>
          </ScrollArea>
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

      {/* Delete Meeting Dialog */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Hapus Meeting"
        description={`Apakah Anda yakin ingin menghapus meeting "${meeting.title}"? Semua data terkait (participants, MOM, notifications) akan ikut terhapus.`}
        loading={isDeleting}
        onConfirm={async (reason) => {
          setIsDeleting(true);
          try {
            // Delete related data first
            await supabase.from("meeting_minutes").delete().eq("meeting_id", meeting.id);
            await supabase.from("meeting_participants").delete().eq("meeting_id", meeting.id);
            await supabase.from("meeting_external_participants").delete().eq("meeting_id", meeting.id);
            await supabase.from("meeting_notifications").delete().eq("meeting_id", meeting.id);
            
            // Delete the meeting
            const { error } = await supabase.from("meetings").delete().eq("id", meeting.id);
            if (error) throw error;

            // Log deletion
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from("deletion_logs").insert({
                entity_type: "meeting",
                entity_id: meeting.id,
                entity_name: meeting.title,
                deleted_by: user.id,
                reason: reason,
              });
            }

            toast.success("Meeting berhasil dihapus");
            queryClient.invalidateQueries({ queryKey: ["meetings"] });
            queryClient.invalidateQueries({ queryKey: ["meeting-notifications"] });
            setShowDeleteDialog(false);
            onOpenChange(false);
          } catch (error: any) {
            toast.error(error.message || "Gagal menghapus meeting");
          } finally {
            setIsDeleting(false);
          }
        }}
      />
    </>
  );
};

export default MeetingDetailDialog;
