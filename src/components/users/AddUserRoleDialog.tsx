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
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AddUserRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentRoles: string[];
}

const allRoles = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr", label: "HR" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "socmed_admin", label: "Social Media Admin" },
  { value: "copywriter", label: "Copywriter" },
  { value: "video_editor", label: "Video Editor" },
];

export function AddUserRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRoles,
}: AddUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const availableRoles = allRoles.filter(role => !currentRoles.includes(role.value));

  const handleAddRole = async () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: userId,
          role: selectedRole as any,
        }]);

      if (error) throw error;

      toast.success("Role added successfully");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setSelectedRole("");
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleToRemove: string) => {
    if (currentRoles.length <= 1) {
      toast.error("User must have at least one role");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", roleToRemove as "super_admin" | "hr" | "graphic_designer" | "socmed_admin" | "copywriter" | "video_editor");

      if (error) throw error;

      toast.success("Role removed successfully");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-primary";
      case "hr":
        return "bg-blue-500";
      case "socmed_admin":
        return "bg-yellow-500";
      case "graphic_designer":
        return "bg-purple-500";
      case "copywriter":
        return "bg-green-500";
      case "video_editor":
        return "bg-red-500";
      default:
        return "bg-muted";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Roles for {userName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Roles</Label>
            <div className="flex flex-wrap gap-2">
              {currentRoles.map((role) => (
                <Badge key={role} className={`${getRoleColor(role)} flex items-center gap-1`}>
                  {role.replace(/_/g, " ")}
                  <button
                    onClick={() => handleRemoveRole(role)}
                    disabled={loading || currentRoles.length <= 1}
                    className="hover:bg-white/20 rounded-full p-0.5 disabled:opacity-50"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {availableRoles.length > 0 && (
            <div className="space-y-2">
              <Label>Add New Role</Label>
              <div className="flex gap-2">
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a role to add" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddRole} disabled={loading || !selectedRole}>
                  Add
                </Button>
              </div>
            </div>
          )}

          {availableRoles.length === 0 && (
            <p className="text-sm text-muted-foreground">User has all available roles</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
