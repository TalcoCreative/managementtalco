import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Users, Bell, MessageSquare, Loader2, Send, Shield, Globe } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { sendTestEventWhatsApp } from "@/lib/whatsapp-utils";

const TEST_MESSAGES: Record<string, string> = {
  announcement: "📢 *Test Pengumuman*\n\nIni adalah pesan tes untuk notifikasi Announcement.",
  attendance_reminder: "📋 *Test Attendance*\n\nIni adalah pesan tes untuk notifikasi Attendance (Clock In/Out).",
  event_created: "🎉 *Test Event Created*\n\nIni adalah pesan tes untuk notifikasi Event baru.",
  leave_request: "📝 *Test Leave Request*\n\nIni adalah pesan tes untuk notifikasi pengajuan Cuti/Izin.",
  meeting_created: "📅 *Test Meeting Created*\n\nIni adalah pesan tes untuk notifikasi Meeting baru.",
  meeting_reminder: "📅 *Test Meeting Reminder*\n\nIni adalah pesan tes untuk notifikasi Reminder Meeting.",
  recruitment_new: "👤 *Test New Candidate*\n\nIni adalah pesan tes untuk notifikasi Kandidat baru.",
  project_created: "📁 *Test Project Created*\n\nIni adalah pesan tes untuk notifikasi Project baru.",
  shooting_created: "📷 *Test Shooting Created*\n\nIni adalah pesan tes untuk notifikasi Shooting baru.",
  shooting_reminder: "📷 *Test Shooting Reminder*\n\nIni adalah pesan tes untuk notifikasi Reminder Shooting.",
  task_created: "📝 *Test Task Created*\n\nIni adalah pesan tes untuk notifikasi Task baru dibuat.",
  task_assigned: "📝 *Test Task Assigned*\n\nIni adalah pesan tes untuk notifikasi Task di-assign.",
  task_comment: "💬 *Test Task Comment*\n\nIni adalah pesan tes untuk notifikasi Komentar baru di Task.",
  task_deadline: "⏰ *Test Task Deadline*\n\nIni adalah pesan tes untuk notifikasi Reminder Deadline Task.",
  task_mention: "🔔 *Test Task Mention*\n\nIni adalah pesan tes untuk notifikasi Mention di Task.",
  task_status_updated: "🔄 *Test Task Status*\n\nIni adalah pesan tes untuk notifikasi perubahan Status Task.",
};

const AVAILABLE_ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr", label: "HR" },
  { value: "finance", label: "Finance" },
  { value: "project_manager", label: "Project Manager" },
];

export default function WASettingsTab() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const [testingEvent, setTestingEvent] = useState<string | null>(null);

  // Fetch notification settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["wa-notification-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_notification_settings")
        .select("*")
        .order("label");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch dynamic roles for role filter options
  const { data: dynamicRoles } = useQuery({
    queryKey: ["dynamic-roles-wa"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dynamic_roles")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch groups
  const { data: groups, isLoading: loadingGroups } = useQuery({
    queryKey: ["wa-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_groups")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Sync groups from Fonnte
  const handleSyncGroups = async (refresh: boolean = false) => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("fonnte-groups", {
        body: { action: refresh ? "refresh" : "get" },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`${data.groups?.length || 0} group berhasil disinkronkan`);
        queryClient.invalidateQueries({ queryKey: ["wa-groups"] });
      } else {
        toast.error(data?.detail || "Gagal mengambil daftar group");
      }
    } catch (err: any) {
      toast.error("Gagal sync: " + (err.message || "Unknown error"));
    } finally {
      setSyncing(false);
    }
  };

  // Toggle setting
  const toggleMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from("wa_notification_settings")
        .update({ [field]: value, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-notification-settings"] }),
    onError: (err: any) => toast.error("Gagal update: " + err.message),
  });

  // Update group assignment
  const groupMutation = useMutation({
    mutationFn: async ({ id, group_ids }: { id: string; group_ids: string[] }) => {
      const { error } = await supabase
        .from("wa_notification_settings")
        .update({ group_ids, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-notification-settings"] }),
    onError: (err: any) => toast.error("Gagal update group: " + err.message),
  });

  // Update role filter
  const roleFilterMutation = useMutation({
    mutationFn: async ({ id, role_filter }: { id: string; role_filter: string[] }) => {
      const { error } = await supabase
        .from("wa_notification_settings")
        .update({ role_filter, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-notification-settings"] }),
    onError: (err: any) => toast.error("Gagal update role filter: " + err.message),
  });

  const handleAddGroup = (settingId: string, currentGroups: string[], groupId: string) => {
    if (!groupId || currentGroups.includes(groupId)) return;
    groupMutation.mutate({ id: settingId, group_ids: [...currentGroups, groupId] });
  };

  const handleRemoveGroup = (settingId: string, currentGroups: string[], groupId: string) => {
    groupMutation.mutate({ id: settingId, group_ids: currentGroups.filter((g) => g !== groupId) });
  };

  const handleToggleRole = (settingId: string, currentRoles: string[], role: string) => {
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter(r => r !== role)
      : [...currentRoles, role];
    roleFilterMutation.mutate({ id: settingId, role_filter: newRoles });
  };

  const handleTestEvent = async (eventType: string) => {
    setTestingEvent(eventType);
    try {
      const testMsg = TEST_MESSAGES[eventType] || `Test notifikasi untuk event: ${eventType}`;
      const result = await sendTestEventWhatsApp(eventType, testMsg);
      if (result?.success) {
        const resultCount = result.results?.length || 0;
        toast.success(`Test berhasil! ${resultCount} pesan terkirim.`);
      } else {
        toast.error(result?.message || "Test gagal");
      }
    } catch (err: any) {
      toast.error("Test gagal: " + (err.message || "Unknown error"));
    } finally {
      setTestingEvent(null);
    }
  };

  // Get all role options (static + dynamic)
  const allRoleOptions = [
    ...AVAILABLE_ROLES,
    ...(dynamicRoles || []).map(r => ({
      value: r.name.toLowerCase().replace(/\s+/g, "_"),
      label: r.name,
    })),
  ];
  // Deduplicate
  const roleOptionsMap = new Map<string, string>();
  allRoleOptions.forEach(r => { if (!roleOptionsMap.has(r.value)) roleOptionsMap.set(r.value, r.label); });
  const roleOptions = Array.from(roleOptionsMap.entries()).map(([value, label]) => ({ value, label }));

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Group Sync Section */}
      <Card className="rounded-2xl border-border/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" />
                WhatsApp Groups
              </CardTitle>
              <CardDescription className="mt-1">
                Sinkronkan group dari WhatsApp untuk menerima notifikasi
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncGroups(true)}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Refresh & Sync
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGroups ? (
            <p className="text-sm text-muted-foreground">Loading groups...</p>
          ) : !groups || groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada group. Klik "Refresh & Sync" untuk mengambil daftar group dari WhatsApp.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {groups.map((g: any) => (
                <Badge key={g.id} variant="secondary" className="text-xs py-1 px-3">
                  {g.name}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="rounded-2xl border-border/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Notification Settings
          </CardTitle>
          <CardDescription>
            Atur jenis notifikasi: Personal (user terlibat), Semua User, Group WA, atau Role tertentu
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {(settings || []).map((setting: any) => {
            const assignedGroups: string[] = setting.group_ids || [];
            const currentRoleFilter: string[] = setting.role_filter || [];
            const isTesting = testingEvent === setting.event_type;
            return (
              <div
                key={setting.id}
                className="flex flex-col gap-3 p-4 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{setting.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{setting.event_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestEvent(setting.event_type)}
                      disabled={isTesting}
                      className="gap-1.5 text-xs h-7"
                    >
                      {isTesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Test
                    </Button>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Aktif</span>
                      <Switch
                        checked={setting.is_enabled}
                        onCheckedChange={(val) =>
                          toggleMutation.mutate({ id: setting.id, field: "is_enabled", value: val })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Category Toggles */}
                <div className="flex flex-wrap items-center gap-4 px-1">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`personal-${setting.id}`}
                      checked={setting.send_to_personal}
                      onCheckedChange={(val) =>
                        toggleMutation.mutate({ id: setting.id, field: "send_to_personal", value: val })
                      }
                    />
                    <Label htmlFor={`personal-${setting.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Personal (yang terlibat)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`allUsers-${setting.id}`}
                      checked={setting.send_to_all_users || false}
                      onCheckedChange={(val) =>
                        toggleMutation.mutate({ id: setting.id, field: "send_to_all_users", value: val })
                      }
                    />
                    <Label htmlFor={`allUsers-${setting.id}`} className="text-xs cursor-pointer flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      Semua User
                    </Label>
                  </div>
                </div>

                {/* Role Filter */}
                <div className="flex items-center gap-2 flex-wrap px-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <Shield className="h-3 w-3" /> Role:
                  </span>
                  {roleOptions.map(role => (
                    <div key={role.value} className="flex items-center gap-1.5">
                      <Checkbox
                        id={`role-${setting.id}-${role.value}`}
                        checked={currentRoleFilter.includes(role.value)}
                        onCheckedChange={() => handleToggleRole(setting.id, currentRoleFilter, role.value)}
                      />
                      <Label htmlFor={`role-${setting.id}-${role.value}`} className="text-xs cursor-pointer">
                        {role.label}
                      </Label>
                    </div>
                  ))}
                </div>

                {/* Group Assignment */}
                <div className="flex items-center gap-2 flex-wrap px-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Groups:</span>
                  {assignedGroups.map((gId) => {
                    const groupName = groups?.find((g: any) => g.id === gId)?.name || gId;
                    return (
                      <Badge
                        key={gId}
                        variant="outline"
                        className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                        onClick={() => handleRemoveGroup(setting.id, assignedGroups, gId)}
                        title="Klik untuk hapus"
                      >
                        {groupName} ×
                      </Badge>
                    );
                  })}
                  {groups && groups.length > 0 && (
                    <Select
                      onValueChange={(val) => handleAddGroup(setting.id, assignedGroups, val)}
                      value=""
                    >
                      <SelectTrigger className="h-7 w-40 text-xs">
                        <SelectValue placeholder="+ Tambah group" />
                      </SelectTrigger>
                      <SelectContent>
                        {groups
                          .filter((g: any) => !assignedGroups.includes(g.id))
                          .map((g: any) => (
                            <SelectItem key={g.id} value={g.id} className="text-xs">
                              {g.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
