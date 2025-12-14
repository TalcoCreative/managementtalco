import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { Phone, Mail, Building2, MapPin, Send, Trash2, History, Edit2, Save, X } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "meeting", label: "Meeting", color: "bg-purple-500" },
  { value: "proposal", label: "Proposal", color: "bg-orange-500" },
  { value: "negotiation", label: "Negotiation", color: "bg-indigo-500" },
  { value: "won", label: "Won", color: "bg-green-500" },
  { value: "lost", label: "Lost", color: "bg-red-500" },
];

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" },
  { value: "cold_call", label: "Cold Call" },
  { value: "other", label: "Other" },
];

interface ProspectDetailDialogProps {
  prospect: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProspectDetailDialog({ prospect, open, onOpenChange }: ProspectDetailDialogProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [editData, setEditData] = useState({
    contact_name: prospect.contact_name,
    email: prospect.email || "",
    phone: prospect.phone || "",
    company: prospect.company || "",
    location: prospect.location || "",
    needs: prospect.needs || "",
    product_service: prospect.product_service || "",
    source: prospect.source,
    pic_id: prospect.pic_id || "",
  });

  const { data: comments, isLoading: commentsLoading } = useQuery({
    queryKey: ["prospect-comments", prospect.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_comments" as any)
        .select(`
          *,
          author:profiles!prospect_comments_author_id_fkey(id, full_name)
        `)
        .eq("prospect_id", prospect.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: statusHistory } = useQuery({
    queryKey: ["prospect-status-history", prospect.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_status_history" as any)
        .select(`
          *,
          changed_by_profile:profiles!prospect_status_history_changed_by_fkey(id, full_name)
        `)
        .eq("prospect_id", prospect.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: users } = useQuery({
    queryKey: ["users-for-pic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("prospect_comments" as any).insert({
        prospect_id: prospect.id,
        author_id: session.session.user.id,
        content: newComment,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-comments", prospect.id] });
      toast.success("Comment added");
      setNewComment("");
    },
    onError: (error) => {
      toast.error("Failed to add comment");
      console.error(error);
    },
  });

  const updateProspectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("prospects" as any)
        .update({
          contact_name: editData.contact_name,
          email: editData.email || null,
          phone: editData.phone || null,
          company: editData.company || null,
          location: editData.location || null,
          needs: editData.needs || null,
          product_service: editData.product_service || null,
          source: editData.source,
          pic_id: editData.pic_id || null,
        })
        .eq("id", prospect.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      toast.success("Prospect updated");
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Failed to update prospect");
      console.error(error);
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("prospect_comments" as any)
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-comments", prospect.id] });
      toast.success("Comment deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete comment");
      console.error(error);
    },
  });

  const getStatusBadge = (status: string) => {
    const statusOption = STATUS_OPTIONS.find((s) => s.value === status);
    return (
      <Badge className={`${statusOption?.color} text-white`}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    addCommentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {prospect.contact_name}
              {getStatusBadge(prospect.status)}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isEditing) {
                  setEditData({
                    contact_name: prospect.contact_name,
                    email: prospect.email || "",
                    phone: prospect.phone || "",
                    company: prospect.company || "",
                    location: prospect.location || "",
                    needs: prospect.needs || "",
                    product_service: prospect.product_service || "",
                    source: prospect.source,
                    pic_id: prospect.pic_id || "",
                  });
                }
                setIsEditing(!isEditing);
              }}
            >
              {isEditing ? <X className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            </Button>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="comments">Comments ({comments?.length || 0})</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <ScrollArea className="h-[400px] pr-4">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Contact Name</Label>
                      <Input
                        value={editData.contact_name}
                        onChange={(e) =>
                          setEditData({ ...editData, contact_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        value={editData.email}
                        onChange={(e) =>
                          setEditData({ ...editData, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input
                        value={editData.phone}
                        onChange={(e) =>
                          setEditData({ ...editData, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Company</Label>
                      <Input
                        value={editData.company}
                        onChange={(e) =>
                          setEditData({ ...editData, company: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Location</Label>
                      <Input
                        value={editData.location}
                        onChange={(e) =>
                          setEditData({ ...editData, location: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label>Source</Label>
                      <Select
                        value={editData.source}
                        onValueChange={(value) =>
                          setEditData({ ...editData, source: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SOURCE_OPTIONS.map((source) => (
                            <SelectItem key={source.value} value={source.value}>
                              {source.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>PIC</Label>
                      <Select
                        value={editData.pic_id}
                        onValueChange={(value) =>
                          setEditData({ ...editData, pic_id: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select PIC" />
                        </SelectTrigger>
                        <SelectContent>
                          {users?.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Product/Service</Label>
                      <Input
                        value={editData.product_service}
                        onChange={(e) =>
                          setEditData({ ...editData, product_service: e.target.value })
                        }
                      />
                    </div>
                    <div className="col-span-2">
                      <Label>Needs</Label>
                      <Textarea
                        value={editData.needs}
                        onChange={(e) =>
                          setEditData({ ...editData, needs: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                  </div>
                  <Button
                    onClick={() => updateProspectMutation.mutate()}
                    disabled={updateProspectMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {prospect.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{prospect.email}</span>
                      </div>
                    )}
                    {prospect.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{prospect.phone}</span>
                      </div>
                    )}
                    {prospect.company && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{prospect.company}</span>
                      </div>
                    )}
                    {prospect.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{prospect.location}</span>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <Label className="text-muted-foreground">Source</Label>
                    <p>{SOURCE_OPTIONS.find(s => s.value === prospect.source)?.label}</p>
                  </div>

                  {prospect.product_service && (
                    <div>
                      <Label className="text-muted-foreground">Product/Service Interest</Label>
                      <p>{prospect.product_service}</p>
                    </div>
                  )}

                  {prospect.needs && (
                    <div>
                      <Label className="text-muted-foreground">Needs / Requirements</Label>
                      <p className="whitespace-pre-wrap">{prospect.needs}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">PIC</Label>
                      <p>{prospect.pic?.full_name || "Not assigned"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created By</Label>
                      <p>{prospect.created_by_profile?.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Created At</Label>
                      <p>{format(new Date(prospect.created_at), "dd MMM yyyy HH:mm")}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Last Updated</Label>
                      <p>{format(new Date(prospect.updated_at), "dd MMM yyyy HH:mm")}</p>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="comments" className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button
                size="icon"
                onClick={handleAddComment}
                disabled={addCommentMutation.isPending || !newComment.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="h-[350px]">
              {commentsLoading ? (
                <p className="text-center text-muted-foreground py-4">Loading...</p>
              ) : comments?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments?.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-3 rounded-lg bg-muted/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {comment.author?.full_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "dd MMM yyyy HH:mm")}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteCommentMutation.mutate(comment.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history">
            <ScrollArea className="h-[400px]">
              {statusHistory?.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No status changes yet</p>
              ) : (
                <div className="space-y-3">
                  {statusHistory?.map((history) => (
                    <div
                      key={history.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                    >
                      <History className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(history.old_status)}
                          <span>→</span>
                          {getStatusBadge(history.new_status)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          by {history.changed_by_profile?.full_name} •{" "}
                          {format(new Date(history.created_at), "dd MMM yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
