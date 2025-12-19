import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const formSchema = z.object({
  usedByType: z.enum(["self", "other"]),
  usedById: z.string().optional(),
  locationType: z.enum(["gudang", "external"]),
  externalLocation: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Asset {
  id: string;
  name: string;
  code: string;
  condition: string;
}

interface CheckoutDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CheckoutDialog({ asset, open, onOpenChange, onSuccess }: CheckoutDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Fetch current user
  const { data: currentUser } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("user_id", session.session.user.email)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all users for "used by other" option
  const { data: users } = useQuery({
    queryKey: ["all-users-checkout"],
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

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      usedByType: "self",
      locationType: "gudang",
      notes: "",
    },
  });

  const usedByType = form.watch("usedByType");
  const locationType = form.watch("locationType");

  const onSubmit = async (values: FormValues) => {
    if (!asset || !currentUser) return;

    setIsSubmitting(true);
    try {
      const usedById = values.usedByType === "self" 
        ? currentUser.id 
        : values.usedById;

      const location = values.locationType === "gudang" 
        ? "Gudang Pamulang" 
        : values.externalLocation;

      // Create transaction record
      const { error: txError } = await supabase.from("asset_transactions").insert({
        asset_id: asset.id,
        transaction_type: "checkout",
        checkout_by: currentUser.id,
        used_by: usedById,
        checkout_location: location,
        checkout_at: new Date().toISOString(),
        condition_before: asset.condition,
        notes: values.notes || null,
      });

      if (txError) throw txError;

      // Update asset status
      const { error: assetError } = await supabase
        .from("assets")
        .update({
          status: "borrowed",
          current_holder_id: usedById,
          current_location: location,
        })
        .eq("id", asset.id);

      if (assetError) throw assetError;

      toast.success("Checkout berhasil!");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-transactions"] });
      onSuccess();
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(error.message || "Gagal melakukan checkout");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    onOpenChange(false);
  };

  if (!asset) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Checkout - Ambil Barang</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="font-medium">{asset.name}</p>
          <p className="text-sm text-muted-foreground font-mono">{asset.code}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Diambil oleh</Label>
              <p className="font-medium">{currentUser?.full_name}</p>
            </div>

            <FormField
              control={form.control}
              name="usedByType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dipakai oleh</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="self" id="self" />
                        <Label htmlFor="self">Diri Sendiri</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="other" id="other" />
                        <Label htmlFor="other">Orang Lain</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {usedByType === "other" && (
              <FormField
                control={form.control}
                name="usedById"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pilih Karyawan</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih karyawan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="locationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi Penggunaan</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gudang" id="gudang" />
                        <Label htmlFor="gudang">Gudang Pamulang</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="external" id="external" />
                        <Label htmlFor="external">External</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {locationType === "external" && (
              <FormField
                control={form.control}
                name="externalLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi External</FormLabel>
                    <FormControl>
                      <Input placeholder="Masukkan lokasi" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keperluan / Catatan (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Keperluan penggunaan..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Memproses..." : "Checkout"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
