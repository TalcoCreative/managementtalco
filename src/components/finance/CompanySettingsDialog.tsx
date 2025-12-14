import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Building2, PenTool } from "lucide-react";

interface CompanySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompanySettingsDialog({ open, onOpenChange }: CompanySettingsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [hrName, setHrName] = useState("");
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*");
      
      if (error) throw error;
      
      const settingsMap: Record<string, string | null> = {};
      data?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      return settingsMap;
    },
  });

  useEffect(() => {
    if (settings?.hr_name) {
      setHrName(settings.hr_name);
    }
  }, [settings]);

  const uploadFile = async (file: File, type: "logo" | "signature") => {
    try {
      setUploading(true);
      
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${type}_${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      const settingKey = type === "logo" ? "company_logo" : "hr_signature";
      
      const { error: updateError } = await supabase
        .from("company_settings")
        .update({ 
          setting_value: publicUrl,
          updated_at: new Date().toISOString(),
          updated_by: session.session.user.id
        })
        .eq("setting_key", settingKey);

      if (updateError) throw updateError;

      toast.success(`${type === "logo" ? "Logo" : "Signature"} uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large. Max 2MB");
        return;
      }
      uploadFile(file, "logo");
    }
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File too large. Max 2MB");
        return;
      }
      uploadFile(file, "signature");
    }
  };

  const removeSetting = async (type: "logo" | "signature") => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const settingKey = type === "logo" ? "company_logo" : "hr_signature";
      
      const { error } = await supabase
        .from("company_settings")
        .update({ 
          setting_value: null,
          updated_at: new Date().toISOString(),
          updated_by: session.session.user.id
        })
        .eq("setting_key", settingKey);

      if (error) throw error;

      toast.success(`${type === "logo" ? "Logo" : "Signature"} removed`);
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const saveHrName = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Check if hr_name exists
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("setting_key", "hr_name")
        .single();

      if (existing) {
        const { error } = await supabase
          .from("company_settings")
          .update({ 
            setting_value: hrName,
            updated_at: new Date().toISOString(),
            updated_by: session.session.user.id
          })
          .eq("setting_key", "hr_name");

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_settings")
          .insert({ 
            setting_key: "hr_name",
            setting_value: hrName,
            updated_by: session.session.user.id
          });

        if (error) throw error;
      }

      toast.success("HR name saved");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pengaturan Perusahaan</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Company Logo */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Logo Perusahaan
            </Label>
            
            {settings?.company_logo ? (
              <div className="flex items-center gap-4">
                <img 
                  src={settings.company_logo} 
                  alt="Company Logo" 
                  className="h-16 w-16 object-contain border rounded"
                />
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => removeSetting("logo")}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  disabled={uploading}
                  className="flex-1"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload logo perusahaan (max 2MB). Akan ditampilkan di header slip gaji.
            </p>
          </div>

          {/* HR Signature */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <PenTool className="h-4 w-4" />
              Tanda Tangan HR
            </Label>
            
            {settings?.hr_signature ? (
              <div className="flex items-center gap-4">
                <img 
                  src={settings.hr_signature} 
                  alt="HR Signature" 
                  className="h-16 object-contain border rounded bg-white p-2"
                />
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => removeSetting("signature")}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  disabled={uploading}
                  className="flex-1"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload tanda tangan HR (max 2MB). Akan ditampilkan di kolom "Pemberi" slip gaji.
            </p>
          </div>

          {/* HR Name */}
          <div className="space-y-3">
            <Label>Nama HR</Label>
            <div className="flex gap-2">
              <Input
                value={hrName}
                onChange={(e) => setHrName(e.target.value)}
                placeholder="Nama lengkap HR"
              />
              <Button onClick={saveHrName}>Simpan</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nama yang akan ditampilkan di bawah tanda tangan.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
