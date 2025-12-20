import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Building } from "lucide-react";
import { toast } from "sonner";

interface EventVendorTabProps {
  eventId: string;
  canManage: boolean;
}

const vendorStatusColors: Record<string, string> = {
  contacted: "bg-gray-100 text-gray-800",
  negotiation: "bg-yellow-100 text-yellow-800",
  deal: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
};

const vendorStatusLabels: Record<string, string> = {
  contacted: "Contacted",
  negotiation: "Negotiation",
  deal: "Deal",
  confirmed: "Confirmed",
};

export function EventVendorTab({ eventId, canManage }: EventVendorTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [purpose, setPurpose] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors, refetch } = useQuery({
    queryKey: ["event-vendors", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_vendors")
        .select("*")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addVendorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_vendors").insert({
        event_id: eventId,
        name,
        contact,
        purpose,
        cost: cost ? parseFloat(cost) : null,
        notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor berhasil ditambahkan");
      resetForm();
      setAddOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error adding vendor:", error);
      toast.error("Gagal menambahkan vendor");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("event_vendors")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status vendor diperbarui");
      refetch();
    },
    onError: () => {
      toast.error("Gagal memperbarui status");
    },
  });

  const updatePaidMutation = useMutation({
    mutationFn: async ({ id, is_paid }: { id: string; is_paid: boolean }) => {
      const { error } = await supabase
        .from("event_vendors")
        .update({ is_paid })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status pembayaran diperbarui");
      refetch();
    },
    onError: () => {
      toast.error("Gagal memperbarui status pembayaran");
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_vendors")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vendor dihapus");
      refetch();
    },
    onError: () => {
      toast.error("Gagal menghapus vendor");
    },
  });

  const resetForm = () => {
    setName("");
    setContact("");
    setPurpose("");
    setCost("");
    setNotes("");
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          <h3 className="font-medium">Vendor</h3>
          <Badge variant="outline">{vendors?.length || 0} vendor</Badge>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Tambah Vendor
          </Button>
        )}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama Vendor</TableHead>
            <TableHead>Keperluan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Biaya</TableHead>
            <TableHead>Pembayaran</TableHead>
            {canManage && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Belum ada vendor
              </TableCell>
            </TableRow>
          ) : (
            vendors?.map((vendor) => (
              <TableRow key={vendor.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{vendor.name}</div>
                    {vendor.contact && (
                      <div className="text-sm text-muted-foreground">{vendor.contact}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>{vendor.purpose || "-"}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={vendor.status}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: vendor.id, status })}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="negotiation">Negotiation</SelectItem>
                        <SelectItem value="deal">Deal</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={vendorStatusColors[vendor.status]}>
                      {vendorStatusLabels[vendor.status]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {vendor.cost ? formatCurrency(vendor.cost) : "-"}
                </TableCell>
                <TableCell>
                  {canManage ? (
                    <Button
                      size="sm"
                      variant={vendor.is_paid ? "default" : "outline"}
                      onClick={() => updatePaidMutation.mutate({ id: vendor.id, is_paid: !vendor.is_paid })}
                    >
                      {vendor.is_paid ? "Paid" : "Unpaid"}
                    </Button>
                  ) : (
                    <Badge variant={vendor.is_paid ? "default" : "secondary"}>
                      {vendor.is_paid ? "Paid" : "Unpaid"}
                    </Badge>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteVendorMutation.mutate(vendor.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Vendor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nama Vendor *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nama vendor"
              />
            </div>
            <div>
              <Label>Kontak</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Nomor telepon atau email"
              />
            </div>
            <div>
              <Label>Keperluan</Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Keperluan vendor"
              />
            </div>
            <div>
              <Label>Biaya (opsional)</Label>
              <Input
                type="number"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => addVendorMutation.mutate()}
                disabled={addVendorMutation.isPending || !name}
              >
                Tambah
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
