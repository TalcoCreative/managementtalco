import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import { X, Shield } from "lucide-react";
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
  { value: "finance", label: "Finance" },
  { value: "accounting", label: "Accounting" },
  { value: "marketing", label: "Marketing" },
  { value: "photographer", label: "Photographer" },
  { value: "director", label: "Director" },
  { value: "project_manager", label: "Project Manager" },
];

export function AddUserRoleDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentRoles,
}: AddUserRoleDialogProps) {
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedDynamicRole, setSelectedDynamicRole] = useState("");
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const availableRoles = allRoles.filter(role => !currentRoles.includes(role.value));

  // Fetch dynamic roles
  const { data: dynamicRoles } = useQuery({
    queryKey: ["dynamic-roles-list"],
    queryFn: async () => {
      const { data } = await supabase.from("dynamic_roles").select("id, name").order("name");
      return data || [];
    },
    enabled: open,
  });

  // Fetch user's current dynamic role
  const { data: userDynamicRole, refetch: refetchDynamic } = useQuery({
    queryKey: ["user-dynamic-role-assignment", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_dynamic_roles")
        .select("role_id, dynamic_roles(name)")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
    enabled: open && !!userId,
  });

  const handleAddRole = async () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("user_roles").insert([{ user_id: userId, role: selectedRole as any }]);
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
      const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", roleToRemove as any);
      if (error) throw error;
      toast.success("Role removed successfully");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDynamicRole = async () => {
    if (!selectedDynamicRole) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      // Upsert - replace existing assignment
      const { error } = await supabase.from("user_dynamic_roles").upsert(
        { user_id: userId, role_id: selectedDynamicRole, assigned_by: session.session?.user.id },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      toast.success("Access role berhasil diassign");
      refetchDynamic();
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-role-counts"] });
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-role"] });
      setSelectedDynamicRole("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveDynamicRole = async () => {
    setLoading(true);
    try {
      await supabase.from("user_dynamic_roles").delete().eq("user_id", userId);
      toast.success("Access role dihapus");
      refetchDynamic();
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-role-counts"] });
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-role"] });
    } catch {
      toast.error("Gagal menghapus access role");
    } finally {
      setLoading(false);
    }
  };

  const getRoleColor = (role: string) => {
    const map: Record<string, string> = {
      super_admin: "bg-primary", hr: "bg-blue-500", socmed_admin: "bg-yellow-500",
      graphic_designer: "bg-purple-500", copywriter: "bg-green-500", video_editor: "bg-red-500",
      finance: "bg-emerald-500", accounting: "bg-cyan-500", marketing: "bg-orange-500",
      photographer: "bg-pink-500", director: "bg-indigo-500", project_manager: "bg-teal-500",
    };
    return map[role] || "bg-muted";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Roles for {userName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Legacy Roles */}
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
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAddRole} disabled={loading || !selectedRole}>Add</Button>
              </div>
            </div>
          )}

          {/* Dynamic Access Role */}
          <Separator />
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-primary" />
              Access Control Role
            </Label>
            <p className="text-xs text-muted-foreground">Mengontrol menu dan fitur apa yang bisa diakses user ini.</p>
            
            {(userDynamicRole as any)?.dynamic_roles?.name ? (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  {(userDynamicRole as any).dynamic_roles.name}
                </Badge>
                <Button variant="ghost" size="sm" onClick={handleRemoveDynamicRole} disabled={loading} className="text-destructive h-7">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-amber-600">Belum diassign — user tidak punya akses (kecuali Super Admin).</p>
            )}

            {dynamicRoles && dynamicRoles.length > 0 && (
              <div className="flex gap-2">
                <Select value={selectedDynamicRole} onValueChange={setSelectedDynamicRole}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Pilih access role..." />
                  </SelectTrigger>
                  <SelectContent>
                    {dynamicRoles.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssignDynamicRole} disabled={loading || !selectedDynamicRole}>Assign</Button>
              </div>
            )}

            {(!dynamicRoles || dynamicRoles.length === 0) && (
              <p className="text-xs text-muted-foreground">Belum ada access role. Buat di System → Role & Access Control.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
