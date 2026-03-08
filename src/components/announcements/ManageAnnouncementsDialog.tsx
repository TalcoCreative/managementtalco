import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";

interface ManageAnnouncementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageAnnouncementsDialog({
  open,
  onOpenChange,
}: ManageAnnouncementsDialogProps) {
  const queryClient = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["all-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*, profiles(full_name)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast.success(
        currentStatus ? "Announcement deactivated" : "Announcement activated"
      );
      queryClient.invalidateQueries({ queryKey: ["all-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
    } catch (error: any) {
      toast.error("Failed to update status: " + error.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      toast.success("Announcement deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["all-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      setDeleteId(null);
    } catch (error: any) {
      toast.error("Failed to delete: " + error.message);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return <Badge variant="destructive">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-500 hover:bg-orange-600">High</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      default:
        return <Badge variant="outline">Low</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Manage Announcements</DialogTitle>
          </DialogHeader>

          <ScrollArea className="h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : announcements && announcements.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {announcements.map((announcement) => (
                    <TableRow key={announcement.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{announcement.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {announcement.content}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(announcement.priority)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>
                            {format(new Date(announcement.created_at), "dd MMM yyyy")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {announcement.profiles?.full_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={announcement.is_active ? "default" : "outline"}
                        >
                          {announcement.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleToggleActive(announcement.id, announcement.is_active)
                            }
                            title={
                              announcement.is_active ? "Deactivate" : "Activate"
                            }
                          >
                            {announcement.is_active ? (
                              <ToggleRight className="h-4 w-4 text-primary" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(announcement.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">No announcements yet</p>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Announcement"
        description="Are you sure you want to delete this announcement? This action cannot be undone."
      />
    </>
  );
}
