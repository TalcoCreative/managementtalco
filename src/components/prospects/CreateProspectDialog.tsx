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
}

export function CreateProspectDialog({ open, onOpenChange }: CreateProspectDialogProps) {
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
        pic_id: formData.pic_id || null,
        created_by: session.session.user.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospects"] });
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
      });
    },
    onError: (error) => {
      toast.error("Failed to create prospect");
      console.error(error);
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
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) =>
                  setFormData({ ...formData, contact_name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+62 812 3456 7890"
              />
            </div>

            <div>
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                value={formData.company}
                onChange={(e) =>
                  setFormData({ ...formData, company: e.target.value })
                }
                placeholder="Company Name"
              />
            </div>

            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Jakarta"
              />
            </div>

            <div>
              <Label htmlFor="source">Source</Label>
              <Select
                value={formData.source}
                onValueChange={(value) =>
                  setFormData({ ...formData, source: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((source) => (
                    <SelectItem key={source.value} value={source.value}>
                      {source.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pic_id">PIC (Person In Charge)</Label>
              <Select
                value={formData.pic_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, pic_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select PIC" />
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

            <div className="col-span-2">
              <Label htmlFor="product_service">Product/Service Interest</Label>
              <Input
                id="product_service"
                value={formData.product_service}
                onChange={(e) =>
                  setFormData({ ...formData, product_service: e.target.value })
                }
                placeholder="Video Production, Social Media Management, etc."
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="needs">Needs / Requirements</Label>
              <Textarea
                id="needs"
                value={formData.needs}
                onChange={(e) =>
                  setFormData({ ...formData, needs: e.target.value })
                }
                placeholder="Describe the prospect's needs and requirements..."
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create Prospect"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
