import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Shield, Trash2, Edit, Users, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_GROUPS, ALL_FEATURE_KEYS, PermissionAction } from "@/hooks/usePermissions";
import { usePermissions } from "@/hooks/usePermissions";
import { format } from "date-fns";

const PERMISSION_ACTIONS: { key: PermissionAction; label: string }[] = [
  { key: "can_view", label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_edit", label: "Edit" },
  { key: "can_delete", label: "Delete" },
  { key: "can_export", label: "Export" },
  { key: "can_comment", label: "Comment" },
  { key: "can_mention", label: "Mention" },
];

export default function RoleManagement() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRoleId, setEditRoleId] = useState<string | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [permState, setPermState] = useState<Record<string, Record<PermissionAction, boolean>>>({});

  // Fetch roles
  const { data: roles, isLoading } = useQuery({
    queryKey: ["dynamic-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_roles")
        .select("*, role_permissions(*)")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch user counts per role
  const { data: userCounts } = useQuery({
    queryKey: ["user-dynamic-role-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_dynamic_roles")
        .select("role_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach((r: any) => {
        counts[r.role_id] = (counts[r.role_id] || 0) + 1;
      });
      return counts;
    },
  });

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const { data: role, error } = await supabase
        .from("dynamic_roles")
        .insert({ name: newRoleName.trim(), description: newRoleDesc.trim() || null, created_by: session.session?.user.id })
        .select()
        .single();
      if (error) throw error;

      // Initialize all permissions as false
      const perms = ALL_FEATURE_KEYS.map(key => ({
        role_id: role.id,
        feature_key: key,
        can_view: false, can_create: false, can_edit: false, can_delete: false,
        can_export: false, can_comment: false, can_mention: false,
      }));
      await supabase.from("role_permissions").insert(perms);

      queryClient.invalidateQueries({ queryKey: ["dynamic-roles"] });
      setCreateOpen(false);
      setNewRoleName("");
      setNewRoleDesc("");
      toast.success("Role berhasil dibuat");
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat role");
    } finally {
      setSaving(false);
    }
  };

  const openPermEditor = (roleId: string) => {
    const role = roles?.find((r: any) => r.id === roleId);
    if (!role) return;

    const state: Record<string, Record<PermissionAction, boolean>> = {};
    (role as any).role_permissions?.forEach((p: any) => {
      state[p.feature_key] = {
        can_view: p.can_view,
        can_create: p.can_create,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
        can_export: p.can_export,
        can_comment: p.can_comment,
        can_mention: p.can_mention,
      };
    });
    setPermState(state);
    setEditRoleId(roleId);
  };

  const togglePerm = (featureKey: string, action: PermissionAction) => {
    setPermState(prev => ({
      ...prev,
      [featureKey]: {
        ...(prev[featureKey] || { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_comment: false, can_mention: false }),
        [action]: !(prev[featureKey]?.[action] ?? false),
      },
    }));
  };

  const toggleGroupAll = (featureKeys: string[], action: PermissionAction) => {
    const allChecked = featureKeys.every(k => permState[k]?.[action]);
    setPermState(prev => {
      const next = { ...prev };
      featureKeys.forEach(k => {
        next[k] = {
          ...(next[k] || { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_comment: false, can_mention: false }),
          [action]: !allChecked,
        };
      });
      return next;
    });
  };

  const savePermissions = async () => {
    if (!editRoleId) return;
    setSaving(true);
    try {
      // Upsert all permissions
      const perms = ALL_FEATURE_KEYS.map(key => ({
        role_id: editRoleId,
        feature_key: key,
        ...(permState[key] || { can_view: false, can_create: false, can_edit: false, can_delete: false, can_export: false, can_comment: false, can_mention: false }),
      }));

      // Delete existing and re-insert
      await supabase.from("role_permissions").delete().eq("role_id", editRoleId);
      const { error } = await supabase.from("role_permissions").insert(perms);
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["dynamic-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      setEditRoleId(null);
      toast.success("Permission berhasil disimpan");
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan permission");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    if (!confirm("Hapus role ini? User yang menggunakan role ini akan kehilangan akses.")) return;
    try {
      await supabase.from("dynamic_roles").delete().eq("id", roleId);
      queryClient.invalidateQueries({ queryKey: ["dynamic-roles"] });
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["user-dynamic-role-counts"] });
      toast.success("Role berhasil dihapus");
    } catch {
      toast.error("Gagal menghapus role");
    }
  };

  const editingRole = roles?.find((r: any) => r.id === editRoleId);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Role & Access Control
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Manage roles and feature permissions for your team</p>
          </div>
          {isSuperAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="h-24 bg-muted rounded-t-2xl" />
              </Card>
            ))}
          </div>
        ) : roles && roles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map((role: any) => {
              const permCount = role.role_permissions?.filter((p: any) => p.can_view).length || 0;
              return (
                <Card key={role.id} className="hover:shadow-lg transition-all cursor-pointer group" onClick={() => openPermEditor(role.id)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                        {role.description && (
                          <p className="text-xs text-muted-foreground mt-1">{role.description}</p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>{userCounts?.[role.id] || 0} user</span>
                      </div>
                      <div>
                        <span>{permCount} feature</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(role.updated_at), "dd MMM yyyy")}
                      </span>
                      {isSuperAdmin && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openPermEditor(role.id); }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Belum ada role. Buat role pertama untuk mengatur akses tim.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Role Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Buat Role Baru</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Role Name</Label>
              <Input value={newRoleName} onChange={e => setNewRoleName(e.target.value)} placeholder="e.g. Project Manager" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} placeholder="Role description..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRole} disabled={saving || !newRoleName.trim()}>
              {saving ? "Saving..." : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permission Editor Dialog */}
      <Dialog open={!!editRoleId} onOpenChange={(open) => { if (!open) setEditRoleId(null); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Permission: {editingRole?.name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="px-6 pb-6 max-h-[70vh]">
            <div className="space-y-6 pt-4">
              {FEATURE_GROUPS.map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="font-semibold text-sm">{group.label}</h3>
                    <Separator className="flex-1" />
                  </div>
                  {/* Header row */}
                  <div className="hidden md:grid grid-cols-[1fr_repeat(7,_48px)] gap-1 mb-2 px-3">
                    <span className="text-xs text-muted-foreground">Feature</span>
                    {PERMISSION_ACTIONS.map(a => (
                      <button
                        key={a.key}
                        className="text-[10px] text-muted-foreground text-center hover:text-foreground transition-colors"
                        onClick={() => toggleGroupAll(group.features.map(f => f.key), a.key)}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  {group.features.map(feature => (
                    <div key={feature.key} className="grid grid-cols-2 md:grid-cols-[1fr_repeat(7,_48px)] gap-1 items-center px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <span className="text-sm col-span-2 md:col-span-1 font-medium">{feature.label}</span>
                      {PERMISSION_ACTIONS.map(action => (
                        <div key={action.key} className="flex items-center justify-center">
                          <label className="flex items-center gap-1.5 md:gap-0">
                            <Checkbox
                              checked={permState[feature.key]?.[action.key] ?? false}
                              onCheckedChange={() => togglePerm(feature.key, action.key)}
                            />
                            <span className="text-xs md:hidden">{action.label}</span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 px-6 pb-6 border-t pt-4">
            <Button variant="outline" onClick={() => setEditRoleId(null)}>Batal</Button>
            <Button onClick={savePermissions} disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan Permission"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
