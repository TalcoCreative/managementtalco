import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Plus, Pencil, Package } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface ClientQuotaSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

const QUOTA_TYPES = [
  { value: "konten", label: "Konten", color: "bg-blue-500" },
  { value: "shooting", label: "Shooting", color: "bg-purple-500" },
  { value: "event", label: "Event", color: "bg-green-500" },
  { value: "campaign", label: "Campaign", color: "bg-orange-500" },
];

export function ClientQuotaSection({ clientId, client, canEdit }: ClientQuotaSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuota, setEditingQuota] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    quota_type: "",
    total_quota: "",
  });
  const queryClient = useQueryClient();

  const { data: quotas, isLoading } = useQuery({
    queryKey: ["client-quotas", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_quotas")
        .select("*")
        .eq("client_id", clientId)
        .order("quota_type");
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!form.quota_type || !form.total_quota) {
      toast.error("Jenis kuota dan total kuota wajib diisi");
      return;
    }

    setSaving(true);
    try {
      if (editingQuota) {
        const { error } = await supabase
          .from("client_quotas")
          .update({
            total_quota: parseInt(form.total_quota),
          })
          .eq("id", editingQuota.id);

        if (error) throw error;
        toast.success("Kuota diperbarui");
      } else {
        const { error } = await supabase.from("client_quotas").insert({
          client_id: clientId,
          quota_type: form.quota_type,
          total_quota: parseInt(form.total_quota),
          used_quota: 0,
        });

        if (error) throw error;

        // Log activity
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          await supabase.rpc("log_client_activity", {
            p_client_id: clientId,
            p_action: "quota_added",
            p_description: `Quota ${form.quota_type} added: ${form.total_quota}`,
            p_changed_by: session.session.user.id,
          });
        }

        toast.success("Kuota ditambahkan");
      }

      queryClient.invalidateQueries({ queryKey: ["client-quotas", clientId] });
      setDialogOpen(false);
      setEditingQuota(null);
      setForm({ quota_type: "", total_quota: "" });
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan kuota");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (quota: any) => {
    setEditingQuota(quota);
    setForm({
      quota_type: quota.quota_type,
      total_quota: quota.total_quota.toString(),
    });
    setDialogOpen(true);
  };

  const openAddDialog = () => {
    setEditingQuota(null);
    setForm({ quota_type: "", total_quota: "" });
    setDialogOpen(true);
  };

  const getQuotaConfig = (type: string) => {
    return QUOTA_TYPES.find(q => q.value === type) || { label: type, color: "bg-gray-500" };
  };

  const existingTypes = quotas?.map(q => q.quota_type) || [];
  const availableTypes = QUOTA_TYPES.filter(t => !existingTypes.includes(t.value));

  return (
    <div className="space-y-4">
      {canEdit && availableTypes.length > 0 && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAddDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Kuota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingQuota ? "Edit Kuota" : "Tambah Kuota Baru"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Jenis Kuota</Label>
                  {editingQuota ? (
                    <Input value={getQuotaConfig(form.quota_type).label} disabled />
                  ) : (
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.quota_type}
                      onChange={(e) => setForm({ ...form, quota_type: e.target.value })}
                    >
                      <option value="">Pilih jenis kuota</option>
                      {availableTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <Label>Total Kuota</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.total_quota}
                    onChange={(e) => setForm({ ...form, total_quota: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? "Menyimpan..." : editingQuota ? "Update Kuota" : "Tambah Kuota"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : quotas && quotas.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {quotas.map((quota) => {
            const config = getQuotaConfig(quota.quota_type);
            const percentage = quota.total_quota > 0 
              ? (quota.used_quota / quota.total_quota) * 100 
              : 0;
            const remaining = quota.total_quota - quota.used_quota;

            return (
              <Card key={quota.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${config.color}`} />
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">{config.label}</h4>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEdit(quota)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Progress value={percentage} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Terpakai: <span className="font-medium text-foreground">{quota.used_quota}</span>
                      </span>
                      <span className="text-muted-foreground">
                        Total: <span className="font-medium text-foreground">{quota.total_quota}</span>
                      </span>
                    </div>
                    <div className="text-center mt-2">
                      <span className={`text-lg font-bold ${remaining < 0 ? "text-destructive" : remaining <= 3 ? "text-warning" : "text-success"}`}>
                        {remaining}
                      </span>
                      <span className="text-sm text-muted-foreground ml-1">sisa</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada data kuota</p>
          <p className="text-xs mt-1">Kuota akan terpotong otomatis dari task/shooting/event yang selesai</p>
        </div>
      )}
    </div>
  );
}
