import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateCampaignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}


const statuses = [
  { value: "contacted", label: "Baru Dikontak" },
  { value: "negotiation", label: "Nego" },
  { value: "deal", label: "Deal" },
  { value: "production", label: "Produksi" },
  { value: "visit", label: "Visit" },
  { value: "ready_to_post", label: "Siap Posting" },
  { value: "posted", label: "Posted" },
  { value: "completed", label: "Selesai" },
];

export function CreateCampaignDialog({ open, onOpenChange }: CreateCampaignDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    kol_id: "",
    client_id: "",
    project_id: "",
    campaign_name: "",
    platform: "",
    is_visit: false,
    visit_location: "",
    status: "contacted",
    fee: "",
    bank_account_number: "",
    bank_account_name: "",
    pic_id: "",
  });

  const { data: kols } = useQuery({
    queryKey: ["kol-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kol_database")
        .select("id, name, username")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-list", formData.client_id],
    queryFn: async () => {
      let query = supabase.from("projects").select("id, title");
      if (formData.client_id) {
        query = query.eq("client_id", formData.client_id);
      }
      const { data, error } = await query.order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!formData.client_id,
  });

  const { data: users } = useQuery({
    queryKey: ["pic-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const userId = session.session.user.id;

      // Create campaign
      const { data: campaign, error } = await supabase
        .from("kol_campaigns")
        .insert({
          kol_id: data.kol_id,
          client_id: data.client_id || null,
          project_id: data.project_id || null,
          campaign_name: data.campaign_name,
          platform: data.platform,
          is_visit: data.is_visit,
          visit_location: data.is_visit ? data.visit_location : null,
          status: data.status,
          fee: data.fee ? parseFloat(data.fee) : null,
          bank_account_number: data.bank_account_number || null,
          bank_account_name: data.bank_account_name || null,
          pic_id: data.pic_id || null,
          created_by: userId,
          updated_by: userId,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial history entry
      await supabase.from("kol_campaign_history").insert({
        campaign_id: campaign.id,
        action: "created",
        new_value: `Campaign created with status: ${data.status}`,
        created_by: userId,
      });

      return campaign;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      toast.success("Campaign berhasil dibuat");
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Gagal membuat campaign: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      kol_id: "",
      client_id: "",
      project_id: "",
      campaign_name: "",
      platform: "",
      is_visit: false,
      visit_location: "",
      status: "contacted",
      fee: "",
      bank_account_number: "",
      bank_account_name: "",
      pic_id: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.kol_id || !formData.campaign_name || !formData.platform) {
      toast.error("KOL, Campaign Name, dan Platform wajib diisi");
      return;
    }
    createMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Assign KOL ke Campaign</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* KOL Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold">Pilih KOL</h3>
              <div className="space-y-2">
                <Label htmlFor="kol_id">KOL *</Label>
                <Select
                  value={formData.kol_id}
                  onValueChange={(value) => setFormData({ ...formData, kol_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih KOL" />
                  </SelectTrigger>
                  <SelectContent>
                    {kols?.map((kol) => (
                      <SelectItem key={kol.id} value={kol.id}>
                        {kol.name} (@{kol.username})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Client & Project */}
            <div className="space-y-4">
              <h3 className="font-semibold">Client & Campaign</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client_id">Client</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_id">Project</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                    disabled={!formData.client_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaign_name">Campaign Name *</Label>
                <Input
                  id="campaign_name"
                  value={formData.campaign_name}
                  onChange={(e) => setFormData({ ...formData, campaign_name: e.target.value })}
                  placeholder="Nama campaign"
                />
              </div>
            </div>

            {/* Platform & Visit */}
            <div className="space-y-4">
              <h3 className="font-semibold">Platform & Visit</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="platform">Platform *</Label>
                  <Input
                    id="platform"
                    value={formData.platform}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    placeholder="Contoh: IG Story, TikTok, YouTube, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_visit"
                    checked={formData.is_visit}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_visit: checked })}
                  />
                  <Label htmlFor="is_visit">Visit</Label>
                </div>
              </div>
              {formData.is_visit && (
                <div className="space-y-2">
                  <Label htmlFor="visit_location">Lokasi Visit</Label>
                  <Input
                    id="visit_location"
                    value={formData.visit_location}
                    onChange={(e) => setFormData({ ...formData, visit_location: e.target.value })}
                    placeholder="Lokasi visit"
                  />
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="space-y-4">
              <h3 className="font-semibold">Payment</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fee">Fee (Rp)</Label>
                  <Input
                    id="fee"
                    type="number"
                    value={formData.fee}
                    onChange={(e) => setFormData({ ...formData, fee: e.target.value })}
                    placeholder="1000000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pic_id">PIC</Label>
                  <Select
                    value={formData.pic_id}
                    onValueChange={(value) => setFormData({ ...formData, pic_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih PIC" />
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
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bank_account_name">Nama Rekening KOL</Label>
                  <Input
                    id="bank_account_name"
                    value={formData.bank_account_name}
                    onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                    placeholder="Nama pemilik rekening"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_number">Nomor Rekening KOL</Label>
                  <Input
                    id="bank_account_number"
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
