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
  condition: z.enum(["baik", "rusak"]),
  returnType: z.enum(["gudang", "transfer"]),
  transferToId: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface Asset {
  id: string;
  name: string;
  code: string;
  condition: string;
  current_holder_id: string | null;
}

interface CheckinDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CheckinDialog({ asset, open, onOpenChange, onSuccess }: CheckinDialogProps) {
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

  // Fetch all users for transfer option
  const { data: users } = useQuery({
    queryKey: ["all-users-checkin"],
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
      condition: "baik",
      returnType: "gudang",
      notes: "",
    },
  });

  const returnType = form.watch("returnType");

  const onSubmit = async (values: FormValues) => {
    if (!asset || !currentUser) return;

    setIsSubmitting(true);
    try {
      const isTransfer = values.returnType === "transfer" && values.transferToId;
      const checkinLocation = isTransfer 
        ? `Dititipkan ke ${users?.find(u => u.id === values.transferToId)?.full_name}` 
        : "Gudang Pamulang";

      // Create transaction record
      const { error: txError } = await supabase.from("asset_transactions").insert({
        asset_id: asset.id,
        transaction_type: "checkin",
        checkin_by: currentUser.id,
        checkin_location: checkinLocation,
        checkin_at: new Date().toISOString(),
        condition_before: asset.condition,
        condition_after: values.condition,
        notes: values.notes || null,
      });

      if (txError) throw txError;

      // Update asset status
      const updateData: any = {
        condition: values.condition,
      };

      if (isTransfer) {
        // Transfer to another user - status stays borrowed
        updateData.current_holder_id = values.transferToId;
        updateData.current_location = checkinLocation;
      } else {
        // Return to gudang - status becomes available
        updateData.status = "available";
        updateData.current_holder_id = null;
        updateData.current_location = "Gudang Pamulang";
      }

      const { error: assetError } = await supabase
        .from("assets")
        .update(updateData)
        .eq("id", asset.id);

      if (assetError) throw assetError;

      toast.success(isTransfer ? "Barang berhasil dititipkan!" : "Barang berhasil dikembalikan!");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["asset-transactions"] });
      onSuccess();
    } catch (error: any) {
      console.error("Checkin error:", error);
      toast.error(error.message || "Gagal melakukan check-in");
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
          <DialogTitle>Check-in - Kembalikan Barang</DialogTitle>
        </DialogHeader>

        <div className="mb-4 p-3 bg-muted rounded-lg">
          <p className="font-medium">{asset.name}</p>
          <p className="text-sm text-muted-foreground font-mono">{asset.code}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Dikembalikan oleh</Label>
              <p className="font-medium">{currentUser?.full_name}</p>
            </div>

            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kondisi Barang</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="baik" id="baik" />
                        <Label htmlFor="baik">Baik</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="rusak" id="rusak" />
                        <Label htmlFor="rusak">Rusak</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="returnType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lokasi Pengembalian</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="gudang" id="return-gudang" />
                        <Label htmlFor="return-gudang">Gudang Pamulang</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="transfer" id="transfer" />
                        <Label htmlFor="transfer">Titipkan ke Karyawan Lain</Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            {returnType === "transfer" && (
              <FormField
                control={form.control}
                name="transferToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titipkan ke</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih karyawan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users?.filter(u => u.id !== currentUser?.id).map((user) => (
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Catatan pengembalian..." {...field} />
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
                {isSubmitting ? "Memproses..." : "Check-in"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
