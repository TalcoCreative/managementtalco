import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Download, QrCode } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nama barang wajib diisi"),
  code: z.string().min(1, "Kode barang wajib diisi"),
  category: z.string().min(1, "Kategori wajib diisi"),
  default_location: z.string().default("Gudang Pamulang"),
  condition: z.enum(["baik", "rusak", "maintenance"]),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const categories = [
  "Elektronik",
  "Furniture",
  "Kamera & Lighting",
  "Audio & Video",
  "Kendaraan",
  "Perlengkapan Kantor",
  "Alat Tulis",
  "Lainnya",
];

interface CreateAssetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateAssetDialog({ open, onOpenChange, onSuccess }: CreateAssetDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [createdAssetCode, setCreatedAssetCode] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      category: "",
      default_location: "Gudang Pamulang",
      condition: "baik",
      description: "",
    },
  });

  const generateAssetCode = () => {
    const prefix = "AST";
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
  };

  const handleAutoGenerateCode = () => {
    const code = generateAssetCode();
    form.setValue("code", code);
  };

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        toast.error("Please login first");
        return;
      }

      // Get user profile ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", session.session.user.email)
        .single();

      if (!profile) {
        toast.error("Profile not found");
        return;
      }

      // Generate QR code data
      const qrData = JSON.stringify({
        type: "asset",
        code: values.code,
        id: crypto.randomUUID(),
      });

      const { data, error } = await supabase.from("assets").insert({
        name: values.name,
        code: values.code,
        category: values.category,
        default_location: values.default_location,
        current_location: values.default_location,
        condition: values.condition,
        description: values.description || null,
        qr_code: qrData,
        status: "available",
        created_by: profile.id,
      }).select().single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Kode barang sudah digunakan");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Asset berhasil ditambahkan!");
      setGeneratedQR(qrData);
      setCreatedAssetCode(values.code);
      onSuccess();
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    } catch (error: any) {
      console.error("Error creating asset:", error);
      toast.error(error.message || "Gagal menambahkan asset");
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadQR = () => {
    if (!createdAssetCode) return;
    
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${createdAssetCode}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleClose = () => {
    form.reset();
    setGeneratedQR(null);
    setCreatedAssetCode(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {generatedQR ? "QR Code Generated" : "Add New Asset"}
          </DialogTitle>
        </DialogHeader>

        {generatedQR ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center">
                <QRCodeSVG
                  id="qr-code-svg"
                  value={generatedQR}
                  size={200}
                  level="H"
                  includeMargin
                />
                <p className="mt-4 font-mono text-sm text-muted-foreground">
                  {createdAssetCode}
                </p>
              </CardContent>
            </Card>
            <div className="flex gap-2">
              <Button onClick={downloadQR} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download QR
              </Button>
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Barang</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Kamera Sony A7III" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kode Barang</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input placeholder="AST-XXX-XXX" {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoGenerateCode}
                      >
                        Auto
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="default_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi Default</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kondisi Awal</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kondisi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="baik">Baik</SelectItem>
                        <SelectItem value="rusak">Rusak</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi (Opsional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Deskripsi tambahan tentang barang..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Batal
                </Button>
                <Button type="submit" disabled={isSubmitting} className="gap-2">
                  <QrCode className="h-4 w-4" />
                  {isSubmitting ? "Menyimpan..." : "Simpan & Generate QR"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
