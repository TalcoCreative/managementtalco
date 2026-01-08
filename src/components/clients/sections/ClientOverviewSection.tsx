import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Pencil, Save, X, Calendar, User, Building, Briefcase, Link, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface ClientOverviewSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

// Generate a unique slug from client name
const generateSlug = (clientName: string): string => {
  const baseSlug = clientName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
  
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${baseSlug}-${randomSuffix}`;
};

export function ClientOverviewSection({ clientId, client, canEdit }: ClientOverviewSectionProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: client.name || "",
    company: client.company || "",
    email: client.email || "",
    phone: client.phone || "",
    status: client.status || "active",
    industry: client.industry || "",
    pic_name: client.pic_name || "",
    pic_contact: client.pic_contact || "",
    start_date: client.start_date || "",
  });
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update(form)
        .eq("id", clientId);

      if (error) throw error;

      // Log activity
      const { data: session } = await supabase.auth.getSession();
      if (session.session) {
        await supabase.rpc("log_client_activity", {
          p_client_id: clientId,
          p_action: "update_overview",
          p_description: "Client overview updated",
          p_changed_by: session.session.user.id,
        });
      }

      toast.success("Client berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
      setEditing(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui client");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyDashboardLink = () => {
    const dashboardUrl = `https://ms.talco.id/${client.dashboard_slug}`;
    navigator.clipboard.writeText(dashboardUrl);
    toast.success("Link dashboard berhasil disalin!");
  };

  const handleGenerateSlug = async () => {
    try {
      const newSlug = generateSlug(client.name);
      const { error } = await supabase
        .from("clients")
        .update({ dashboard_slug: newSlug })
        .eq("id", clientId);

      if (error) throw error;
      
      toast.success("Dashboard slug berhasil dibuat!");
      queryClient.invalidateQueries({ queryKey: ["client", clientId] });
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat slug");
    }
  };

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Nama:</span>
              <span className="font-medium">{client.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Company:</span>
              <span className="font-medium">{client.company || "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Industry:</span>
              <span className="font-medium">{client.industry || "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Start Date:</span>
              <span className="font-medium">
                {client.start_date ? format(new Date(client.start_date), "dd MMM yyyy") : "-"}
              </span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">PIC:</span>
              <span className="font-medium">{client.pic_name || "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">PIC Contact:</span>
              <span className="font-medium">{client.pic_contact || "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{client.email || "-"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Phone:</span>
              <span className="font-medium">{client.phone || "-"}</span>
            </div>
          </div>
        </div>

        {/* Dashboard Link Section */}
        <div className="pt-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Link className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Client Dashboard Link</span>
          </div>
          {client.dashboard_slug ? (
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 min-w-0 truncate">
                https://ms.talco.id/{client.dashboard_slug}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyDashboardLink}>
                <Copy className="h-3 w-3 mr-1" />
                Copy
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open(`/dashboard/${client.dashboard_slug}`, "_blank")}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Open
              </Button>
              {canEdit && (
                <Button variant="ghost" size="sm" onClick={handleGenerateSlug}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Belum ada link dashboard</span>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={handleGenerateSlug}>
                  Generate Link
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
          <X className="h-4 w-4 mr-2" />
          Batal
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <Label>Nama Client</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Company</Label>
            <Input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />
          </div>
          <div>
            <Label>Industry</Label>
            <Input
              value={form.industry}
              onChange={(e) => setForm({ ...form, industry: e.target.value })}
              placeholder="e.g. Technology, F&B, Fashion"
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label>PIC Name</Label>
            <Input
              value={form.pic_name}
              onChange={(e) => setForm({ ...form, pic_name: e.target.value })}
            />
          </div>
          <div>
            <Label>PIC Contact</Label>
            <Input
              value={form.pic_contact}
              onChange={(e) => setForm({ ...form, pic_contact: e.target.value })}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div>
            <Label>Start Date Kerjasama</Label>
            <Input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
