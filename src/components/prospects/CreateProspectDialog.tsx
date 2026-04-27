import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SOURCE_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "website", label: "Website" },
  { value: "social_media", label: "Social Media" },
  { value: "event", label: "Event" },
  { value: "cold_call", label: "Cold Call" },
  { value: "other", label: "Other" },
];

interface CreateProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When true, defaults owner to current user and hides PIC selection */
  salesMode?: boolean;
}

export function CreateProspectDialog({ open, onOpenChange, salesMode }: CreateProspectDialogProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    contact_name: "",
    email: "",
    phone: "",
    company: "",
    location: "",
    needs: "",
    product_service: "",
    source: "referral",
    pic_id: "",
    product_id: "",
    estimated_value: "",
  });

  const { data: users } = useQuery({
    queryKey: ["users-for-pic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("prospects" as any).insert({
        contact_name: formData.contact_name,
        email: formData.email || null,
        phone: formData.phone || null,
        company: formData.company || null,
        location: formData.location || null,
        needs: formData.needs || null,
        product_service: formData.product_service || null,
        source: formData.source,
        pic_id: formData.pic_id || session.session.user.id,
        product_id: formData.product_id || null,
        estimated_value: formData.estimated_value ? Number(formData.estimated_value) : null,
        owner_id: session.session.user.id,
        created_by: session.session.user.id,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
      queryClient.invalidateQueries({ queryKey: ["my-prospects"] });
      toast.success("Prospect created successfully");
      onOpenChange(false);
      setFormData({
        contact_name: "",
        email: "",
        phone: "",
        company: "",
        location: "",
        needs: "",
        product_service: "",
        source: "referral",
        pic_id: "",
        product_id: "",
        estimated_value: "",
      });
    },
    onError: (error: any) => {
      toast.error(error?.message || "Failed to create prospect");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_name.trim()) {
      toast.error("Contact name is required");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Prospect</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="contact_name">Contact Name *</Label>
              <Input id="contact_name" value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="John Doe" />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com" />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+62 812 3456 7890" />
            </div>

            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Company Name" />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input id="location" value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Jakarta" />
            </div>

            <div>
              <Label htmlFor="source">Source</Label>
              <Select value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!salesMode && (
              <div>
                <Label htmlFor="pic_id">PIC</Label>
                <Select value={formData.pic_id}
                  onValueChange={(value) => setFormData({ ...formData, pic_id: value })}>
                  <SelectTrigger><SelectValue placeholder="Select PIC" /></SelectTrigger>
                  <SelectContent>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="product_id">Product</Label>
              <Select value={formData.product_id}
                onValueChange={(value) => setFormData({ ...formData, product_id: value })}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="estimated_value">Estimated Value (Rp)</Label>
              <Input id="estimated_value" type="number" min="0" value={formData.estimated_value}
                onChange={(e) => setFormData({ ...formData, estimated_value: e.target.value })}
                placeholder="5000000" />
            </div>

            <div className="col-span-2">
              <Label htmlFor="product_service">Product/Service Notes</Label>
              <Input id="product_service" value={formData.product_service}
                onChange={(e) => setFormData({ ...formData, product_service: e.target.value })}
                placeholder="Optional free-text notes" />
            </div>

            <div className="col-span-2">
              <Label htmlFor="needs">Needs / Requirements</Label>
              <Textarea id="needs" value={formData.needs}
                onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                placeholder="Describe the prospect's needs..." rows={3} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Prospect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
