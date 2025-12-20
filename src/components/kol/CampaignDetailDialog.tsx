import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Clock, User, DollarSign, Link as LinkIcon, Image } from "lucide-react";

interface CampaignDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaign: any;
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

const statusColors: Record<string, string> = {
  contacted: "bg-gray-500",
  negotiation: "bg-yellow-500",
  deal: "bg-blue-500",
  production: "bg-purple-500",
  visit: "bg-cyan-500",
  ready_to_post: "bg-orange-500",
  posted: "bg-green-500",
  completed: "bg-emerald-600",
};

export function CampaignDetailDialog({ open, onOpenChange, campaign }: CampaignDetailDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(campaign.status);
  const [isPaid, setIsPaid] = useState(campaign.is_paid);
  const [isPosted, setIsPosted] = useState(campaign.is_posted);
  const [postLink, setPostLink] = useState(campaign.post_link || "");
  const [evidenceUrl, setEvidenceUrl] = useState(campaign.evidence_url || "");
  const [historyNote, setHistoryNote] = useState("");

  // Reset state when campaign prop changes
  useEffect(() => {
    setStatus(campaign.status);
    setIsPaid(campaign.is_paid);
    setIsPosted(campaign.is_posted);
    setPostLink(campaign.post_link || "");
    setEvidenceUrl(campaign.evidence_url || "");
  }, [campaign]);

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ["campaign-history", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kol_campaign_history")
        .select("*, created_by_profile:profiles!kol_campaign_history_created_by_fkey(full_name)")
        .eq("campaign_id", campaign.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const userId = session.session.user.id;

      // Update campaign
      const { error } = await supabase
        .from("kol_campaigns")
        .update({
          ...updates,
          updated_by: userId,
        })
        .eq("id", campaign.id);

      if (error) throw error;

      // Add history entry
      let action = "updated";
      let notes = historyNote;

      if (updates.status && updates.status !== campaign.status) {
        action = "status_change";
        notes = `Status changed from ${campaign.status} to ${updates.status}. ${historyNote}`;
      } else if (updates.is_paid !== undefined && updates.is_paid !== campaign.is_paid) {
        action = "payment";
        notes = updates.is_paid ? `Marked as paid. ${historyNote}` : `Marked as unpaid. ${historyNote}`;
      } else if (updates.is_posted !== undefined && updates.is_posted !== campaign.is_posted) {
        action = "posted";
        notes = updates.is_posted ? `Marked as posted. ${historyNote}` : `Marked as not posted. ${historyNote}`;
      }

      await supabase.from("kol_campaign_history").insert({
        campaign_id: campaign.id,
        action,
        old_value: JSON.stringify({ status: campaign.status, is_paid: campaign.is_paid, is_posted: campaign.is_posted }),
        new_value: JSON.stringify(updates),
        notes,
        created_by: userId,
      });

      return updates;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kol-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-history", campaign.id] });
      toast.success("Campaign berhasil diupdate");
      setHistoryNote("");
    },
    onError: (error: any) => {
      toast.error("Gagal mengupdate campaign: " + error.message);
    },
  });

  const handleStatusChange = (newStatus: string) => {
    setStatus(newStatus);
  };

  const handleSave = () => {
    const updates: any = {};
    
    if (status !== campaign.status) updates.status = status;
    if (isPaid !== campaign.is_paid) {
      updates.is_paid = isPaid;
      if (isPaid) updates.paid_at = new Date().toISOString();
    }
    if (isPosted !== campaign.is_posted) updates.is_posted = isPosted;
    if (postLink !== (campaign.post_link || "")) updates.post_link = postLink || null;
    if (evidenceUrl !== (campaign.evidence_url || "")) updates.evidence_url = evidenceUrl || null;

    if (Object.keys(updates).length === 0) {
      toast.info("Tidak ada perubahan");
      return;
    }

    updateMutation.mutate(updates);
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      created: "Dibuat",
      status_change: "Status Berubah",
      payment: "Payment",
      posted: "Posting",
      updated: "Diupdate",
    };
    return labels[action] || action;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Campaign: {campaign.kol?.name}
            <Badge className={`${statusColors[campaign.status]} text-white`}>
              {statuses.find(s => s.value === campaign.status)?.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detail & Update</TabsTrigger>
            <TabsTrigger value="history">Activity History</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-6 py-4">
                {/* Campaign Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Informasi Campaign</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">KOL</p>
                      <p className="font-medium">{campaign.kol?.name} (@{campaign.kol?.username})</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Client</p>
                      <p className="font-medium">{campaign.client?.name || "-"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Campaign</p>
                      <p className="font-medium">{campaign.campaign_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Platform</p>
                      <p className="font-medium">{campaign.platform}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Visit</p>
                      <p className="font-medium">
                        {campaign.is_visit ? `Ya - ${campaign.visit_location || ""}` : "Tidak"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">PIC</p>
                      <p className="font-medium">{campaign.pic?.full_name || "-"}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Status Update */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Update Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={status} onValueChange={handleStatusChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Payment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Fee</p>
                        <p className="font-medium">{formatCurrency(campaign.fee)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Rekening</p>
                        <p className="font-medium">
                          {campaign.bank_account_name || "-"}<br />
                          {campaign.bank_account_number || ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_paid"
                        checked={isPaid}
                        onCheckedChange={setIsPaid}
                      />
                      <Label htmlFor="is_paid">Sudah Dibayar</Label>
                    </div>
                    {campaign.paid_at && (
                      <p className="text-sm text-muted-foreground">
                        Dibayar pada: {format(new Date(campaign.paid_at), "dd MMM yyyy HH:mm")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Posting Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Image className="h-4 w-4" /> Posting Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="is_posted"
                        checked={isPosted}
                        onCheckedChange={setIsPosted}
                      />
                      <Label htmlFor="is_posted">Sudah Posting</Label>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="post_link">Link Hasil Posting</Label>
                      <Input
                        id="post_link"
                        value={postLink}
                        onChange={(e) => setPostLink(e.target.value)}
                        placeholder="https://instagram.com/p/..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="evidence_url">Evidence URL (Screenshot)</Label>
                      <Input
                        id="evidence_url"
                        value={evidenceUrl}
                        onChange={(e) => setEvidenceUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="history_note">Catatan Update</Label>
                  <Textarea
                    id="history_note"
                    value={historyNote}
                    onChange={(e) => setHistoryNote(e.target.value)}
                    placeholder="Catatan untuk perubahan ini..."
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)}>
                    Tutup
                  </Button>
                  <Button onClick={handleSave} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="history">
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                {historyLoading ? (
                  <p className="text-center text-muted-foreground">Loading...</p>
                ) : history?.length === 0 ? (
                  <p className="text-center text-muted-foreground">Belum ada riwayat</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                    {history?.map((item: any) => (
                      <div key={item.id} className="relative pl-10 pb-6">
                        <div className="absolute left-2.5 w-3 h-3 rounded-full bg-primary" />
                        <div className="bg-muted/50 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{getActionLabel(item.action)}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(item.created_at), "dd MMM yyyy HH:mm")}
                            </span>
                          </div>
                          {item.notes && (
                            <p className="text-sm mb-2">{item.notes}</p>
                          )}
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="h-3 w-3" />
                            {item.created_by_profile?.full_name || "Unknown"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
