import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Users, Bell, MessageSquare, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function WASettingsTab() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

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
        .update({ [field]: value, updated_at: new Date().toISOString() })
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
        .update({ group_ids, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-notification-settings"] }),
    onError: (err: any) => toast.error("Gagal update group: " + err.message),
  });

  const handleAddGroup = (settingId: string, currentGroups: string[], groupId: string) => {
    if (!groupId || currentGroups.includes(groupId)) return;
    groupMutation.mutate({ id: settingId, group_ids: [...currentGroups, groupId] });
  };

  const handleRemoveGroup = (settingId: string, currentGroups: string[], groupId: string) => {
    groupMutation.mutate({ id: settingId, group_ids: currentGroups.filter((g) => g !== groupId) });
  };

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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncGroups(false)}
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Sync Groups
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
            Atur jenis notifikasi yang aktif dan group tujuan pengiriman
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {(settings || []).map((setting: any) => {
            const assignedGroups: string[] = setting.group_ids || [];
            return (
              <div
                key={setting.id}
                className="flex flex-col gap-3 p-4 rounded-xl border border-border/30 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium text-sm">{setting.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{setting.event_type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Personal</span>
                      <Switch
                        checked={setting.send_to_personal}
                        onCheckedChange={(val) =>
                          toggleMutation.mutate({ id: setting.id, field: "send_to_personal", value: val })
                        }
                      />
                    </div>
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

                {/* Group Assignment */}
                <div className="flex items-center gap-2 flex-wrap">
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
