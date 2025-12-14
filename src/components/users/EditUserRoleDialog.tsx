import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface EditUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentRole?: string;
}

const roles = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr", label: "HR" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "socmed_admin", label: "Social Media Admin" },
  { value: "copywriter", label: "Copywriter" },
  { value: "video_editor", label: "Video Editor" },
  { value: "finance", label: "Finance" },
  { value: "accounting", label: "Accounting" },
  { value: "marketing", label: "Marketing" },
  { value: "photographer", label: "Photographer" },
  { value: "director", label: "Director" },
  { value: "project_manager", label: "Project Manager" },
];

export function EditUserRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRole,
}: EditUserRoleDialogProps) {
  const [role, setRole] = useState(currentRole || "");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Delete existing role
      if (currentRole) {
        await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId);
      }

      // Insert new role
      const { error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: userId,
          role: role as any,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User role updated successfully",
      });

      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Role for {userName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Updating..." : "Update Role"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
