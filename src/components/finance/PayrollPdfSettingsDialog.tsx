import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Upload, Trash2, Building2, PenTool, FileText, Palette, 
  Type, Layout, Save, Eye, Settings2 
} from "lucide-react";

interface PayrollPdfSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PdfSettings {
  // Company Info
  company_logo?: string | null;
  pdf_company_name: string;
  pdf_company_tagline: string;
  pdf_company_address: string;
  pdf_city: string;
  
  // Document
  pdf_document_title: string;
  pdf_footer_text: string;
  
  // Signature
  hr_signature?: string | null;
  hr_name: string;
  pdf_giver_label: string;
  pdf_receiver_label: string;
  pdf_giver_role: string;
  pdf_receiver_role: string;
  pdf_show_signature: boolean;
  
  // Styling
  pdf_logo_width: number;
  pdf_logo_height: number;
  pdf_primary_color: string;
  pdf_header_font_size: number;
  pdf_body_font_size: number;
  pdf_margin: number;
  pdf_show_terbilang: boolean;
  
  // Paper
  pdf_paper_size: string;
  pdf_orientation: string;
}

// Preview scale factor: how many pixels per mm for accurate preview
const PDF_PREVIEW_SCALE = 2.5; // 2.5px per mm gives good visual match

const defaultSettings: PdfSettings = {
  pdf_company_name: "TALCO CREATIVE INDONESIA",
  pdf_company_tagline: "Creative Agency & Digital Marketing Solutions",
  pdf_company_address: "Jakarta, Indonesia",
  pdf_city: "Jakarta",
  pdf_document_title: "SLIP GAJI KARYAWAN",
  pdf_footer_text: "Dokumen ini dicetak secara otomatis dan sah tanpa tanda tangan basah.",
  hr_name: "HR Manager",
  pdf_giver_label: "Pemberi,",
  pdf_receiver_label: "Penerima,",
  pdf_giver_role: "Human Resources",
  pdf_receiver_role: "Karyawan",
  pdf_show_signature: true,
  pdf_logo_width: 40,  // mm - larger default for better visibility
  pdf_logo_height: 40,
  pdf_primary_color: "41,128,185",
  pdf_header_font_size: 18,
  pdf_body_font_size: 10,
  pdf_margin: 15,
  pdf_show_terbilang: true,
  pdf_paper_size: "a4",
  pdf_orientation: "portrait",
};

export function PayrollPdfSettingsDialog({ open, onOpenChange }: PayrollPdfSettingsDialogProps) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<PdfSettings>(defaultSettings);
  const queryClient = useQueryClient();

  const { data: dbSettings, isLoading } = useQuery({
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
    if (dbSettings) {
      setSettings({
        company_logo: dbSettings.company_logo,
        pdf_company_name: dbSettings.pdf_company_name || defaultSettings.pdf_company_name,
        pdf_company_tagline: dbSettings.pdf_company_tagline || defaultSettings.pdf_company_tagline,
        pdf_company_address: dbSettings.pdf_company_address || defaultSettings.pdf_company_address,
        pdf_city: dbSettings.pdf_city || defaultSettings.pdf_city,
        pdf_document_title: dbSettings.pdf_document_title || defaultSettings.pdf_document_title,
        pdf_footer_text: dbSettings.pdf_footer_text || defaultSettings.pdf_footer_text,
        hr_signature: dbSettings.hr_signature,
        hr_name: dbSettings.hr_name || defaultSettings.hr_name,
        pdf_giver_label: dbSettings.pdf_giver_label || defaultSettings.pdf_giver_label,
        pdf_receiver_label: dbSettings.pdf_receiver_label || defaultSettings.pdf_receiver_label,
        pdf_giver_role: dbSettings.pdf_giver_role || defaultSettings.pdf_giver_role,
        pdf_receiver_role: dbSettings.pdf_receiver_role || defaultSettings.pdf_receiver_role,
        pdf_show_signature: dbSettings.pdf_show_signature !== "false",
        pdf_logo_width: Number(dbSettings.pdf_logo_width) || defaultSettings.pdf_logo_width,
        pdf_logo_height: Number(dbSettings.pdf_logo_height) || defaultSettings.pdf_logo_height,
        pdf_primary_color: dbSettings.pdf_primary_color || defaultSettings.pdf_primary_color,
        pdf_header_font_size: Number(dbSettings.pdf_header_font_size) || defaultSettings.pdf_header_font_size,
        pdf_body_font_size: Number(dbSettings.pdf_body_font_size) || defaultSettings.pdf_body_font_size,
        pdf_margin: Number(dbSettings.pdf_margin) || defaultSettings.pdf_margin,
        pdf_show_terbilang: dbSettings.pdf_show_terbilang !== "false",
        pdf_paper_size: dbSettings.pdf_paper_size || defaultSettings.pdf_paper_size,
        pdf_orientation: dbSettings.pdf_orientation || defaultSettings.pdf_orientation,
      });
    }
  }, [dbSettings]);

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
      await saveSetting(settingKey, publicUrl);
      
      setSettings(prev => ({
        ...prev,
        [type === "logo" ? "company_logo" : "hr_signature"]: publicUrl
      }));

      toast.success(`${type === "logo" ? "Logo" : "Tanda tangan"} berhasil diupload`);
    } catch (error: any) {
      toast.error(error.message || "Upload gagal");
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "signature") => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("File terlalu besar. Max 2MB");
        return;
      }
      uploadFile(file, type);
    }
  };

  const removeFile = async (type: "logo" | "signature") => {
    try {
      const settingKey = type === "logo" ? "company_logo" : "hr_signature";
      await saveSetting(settingKey, null);
      
      setSettings(prev => ({
        ...prev,
        [type === "logo" ? "company_logo" : "hr_signature"]: null
      }));

      toast.success(`${type === "logo" ? "Logo" : "Tanda tangan"} dihapus`);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const saveSetting = async (key: string, value: string | null) => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) throw new Error("Not authenticated");

    const { data: existing } = await supabase
      .from("company_settings")
      .select("id")
      .eq("setting_key", key)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("company_settings")
        .update({ 
          setting_value: value,
          updated_at: new Date().toISOString(),
          updated_by: session.session.user.id
        })
        .eq("setting_key", key);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("company_settings")
        .insert({ 
          setting_key: key,
          setting_value: value,
          updated_by: session.session.user.id
        });

      if (error) throw error;
    }
    
    queryClient.invalidateQueries({ queryKey: ["company-settings"] });
  };

  const saveAllSettings = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const settingsToSave: Record<string, string> = {
        pdf_company_name: settings.pdf_company_name,
        pdf_company_tagline: settings.pdf_company_tagline,
        pdf_company_address: settings.pdf_company_address,
        pdf_city: settings.pdf_city,
        pdf_document_title: settings.pdf_document_title,
        pdf_footer_text: settings.pdf_footer_text,
        hr_name: settings.hr_name,
        pdf_giver_label: settings.pdf_giver_label,
        pdf_receiver_label: settings.pdf_receiver_label,
        pdf_giver_role: settings.pdf_giver_role,
        pdf_receiver_role: settings.pdf_receiver_role,
        pdf_show_signature: String(settings.pdf_show_signature),
        pdf_logo_width: String(settings.pdf_logo_width),
        pdf_logo_height: String(settings.pdf_logo_height),
        pdf_primary_color: settings.pdf_primary_color,
        pdf_header_font_size: String(settings.pdf_header_font_size),
        pdf_body_font_size: String(settings.pdf_body_font_size),
        pdf_margin: String(settings.pdf_margin),
        pdf_show_terbilang: String(settings.pdf_show_terbilang),
        pdf_paper_size: settings.pdf_paper_size,
        pdf_orientation: settings.pdf_orientation,
      };

      for (const [key, value] of Object.entries(settingsToSave)) {
        await saveSetting(key, value);
      }

      toast.success("Semua pengaturan berhasil disimpan");
      queryClient.invalidateQueries({ queryKey: ["company-settings"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const parseColor = (colorStr: string) => {
    const parts = colorStr.split(",").map(p => parseInt(p.trim()));
    if (parts.length === 3) {
      return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
    }
    return "rgb(41, 128, 185)";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Pengaturan PDF Slip Gaji
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="company" className="w-full">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="company" className="text-xs">
              <Building2 className="h-4 w-4 mr-1" />
              Perusahaan
            </TabsTrigger>
            <TabsTrigger value="document" className="text-xs">
              <FileText className="h-4 w-4 mr-1" />
              Dokumen
            </TabsTrigger>
            <TabsTrigger value="signature" className="text-xs">
              <PenTool className="h-4 w-4 mr-1" />
              Tanda Tangan
            </TabsTrigger>
            <TabsTrigger value="styling" className="text-xs">
              <Palette className="h-4 w-4 mr-1" />
              Tampilan
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[500px] mt-4">
            {/* Company Tab */}
            <TabsContent value="company" className="space-y-6 px-1">
              <div className="space-y-4">
                <h3 className="font-medium">Logo Perusahaan</h3>
                {settings.company_logo ? (
                  <div className="flex items-center gap-4">
                    <img 
                      src={settings.company_logo} 
                      alt="Company Logo" 
                      className="h-20 w-20 object-contain border rounded p-1"
                    />
                    <div className="space-y-2">
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => removeFile("logo")}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Hapus
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Logo akan ditampilkan di header slip gaji
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, "logo")}
                      disabled={uploading}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Format: JPG, PNG. Max 2MB
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nama Perusahaan</Label>
                  <Input
                    value={settings.pdf_company_name}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_company_name: e.target.value }))}
                    placeholder="Nama perusahaan"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Tagline / Deskripsi</Label>
                  <Input
                    value={settings.pdf_company_tagline}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_company_tagline: e.target.value }))}
                    placeholder="Tagline perusahaan"
                  />
                </div>
                <div className="col-span-2">
                  <Label>Alamat</Label>
                  <Textarea
                    value={settings.pdf_company_address}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_company_address: e.target.value }))}
                    placeholder="Alamat lengkap perusahaan"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Kota</Label>
                  <Input
                    value={settings.pdf_city}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_city: e.target.value }))}
                    placeholder="Kota"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Digunakan untuk tanggal cetak
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Document Tab */}
            <TabsContent value="document" className="space-y-6 px-1">
              <div className="space-y-4">
                <div>
                  <Label>Judul Dokumen</Label>
                  <Input
                    value={settings.pdf_document_title}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_document_title: e.target.value }))}
                    placeholder="SLIP GAJI KARYAWAN"
                  />
                </div>

                <div>
                  <Label>Footer / Catatan Kaki</Label>
                  <Textarea
                    value={settings.pdf_footer_text}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_footer_text: e.target.value }))}
                    placeholder="Catatan di bagian bawah dokumen"
                    rows={2}
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tampilkan Terbilang</Label>
                    <p className="text-xs text-muted-foreground">
                      Menampilkan nominal dalam huruf
                    </p>
                  </div>
                  <Switch
                    checked={settings.pdf_show_terbilang}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, pdf_show_terbilang: checked }))}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Signature Tab */}
            <TabsContent value="signature" className="space-y-6 px-1">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Tampilkan Bagian Tanda Tangan</Label>
                  <p className="text-xs text-muted-foreground">
                    Menampilkan kolom tanda tangan pemberi dan penerima
                  </p>
                </div>
                <Switch
                  checked={settings.pdf_show_signature}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, pdf_show_signature: checked }))}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                {/* Left - Giver */}
                <div className="space-y-4">
                  <h4 className="font-medium">Pemberi (Kiri)</h4>
                  
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={settings.pdf_giver_label}
                      onChange={(e) => setSettings(prev => ({ ...prev, pdf_giver_label: e.target.value }))}
                      placeholder="Pemberi,"
                    />
                  </div>

                  <div>
                    <Label>Nama HR / Penandatangan</Label>
                    <Input
                      value={settings.hr_name}
                      onChange={(e) => setSettings(prev => ({ ...prev, hr_name: e.target.value }))}
                      placeholder="Nama lengkap"
                    />
                  </div>

                  <div>
                    <Label>Jabatan</Label>
                    <Input
                      value={settings.pdf_giver_role}
                      onChange={(e) => setSettings(prev => ({ ...prev, pdf_giver_role: e.target.value }))}
                      placeholder="Human Resources"
                    />
                  </div>

                  <div>
                    <Label>Gambar Tanda Tangan</Label>
                    {settings.hr_signature ? (
                      <div className="flex items-center gap-4 mt-2">
                        <img 
                          src={settings.hr_signature} 
                          alt="Signature" 
                          className="h-16 object-contain border rounded bg-white p-2"
                        />
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => removeFile("signature")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, "signature")}
                        disabled={uploading}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* Right - Receiver */}
                <div className="space-y-4">
                  <h4 className="font-medium">Penerima (Kanan)</h4>
                  
                  <div>
                    <Label>Label</Label>
                    <Input
                      value={settings.pdf_receiver_label}
                      onChange={(e) => setSettings(prev => ({ ...prev, pdf_receiver_label: e.target.value }))}
                      placeholder="Penerima,"
                    />
                  </div>

                  <div>
                    <Label>Jabatan</Label>
                    <Input
                      value={settings.pdf_receiver_role}
                      onChange={(e) => setSettings(prev => ({ ...prev, pdf_receiver_role: e.target.value }))}
                      placeholder="Karyawan"
                    />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Nama penerima akan otomatis diisi dengan nama karyawan
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Styling Tab */}
            <TabsContent value="styling" className="space-y-6 px-1">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label>Ukuran Kertas</Label>
                  <Select
                    value={settings.pdf_paper_size}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, pdf_paper_size: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a4">A4</SelectItem>
                      <SelectItem value="letter">Letter</SelectItem>
                      <SelectItem value="legal">Legal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Orientasi</Label>
                  <Select
                    value={settings.pdf_orientation}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, pdf_orientation: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Margin (mm)</Label>
                  <Input
                    type="number"
                    value={settings.pdf_margin}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_margin: Number(e.target.value) }))}
                    min={5}
                    max={50}
                  />
                </div>
                <div>
                  <Label>Lebar Logo (mm)</Label>
                  <Input
                    type="number"
                    value={settings.pdf_logo_width}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_logo_width: Number(e.target.value) }))}
                    min={10}
                    max={100}
                  />
                </div>
                <div>
                  <Label>Tinggi Logo (mm)</Label>
                  <Input
                    type="number"
                    value={settings.pdf_logo_height}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_logo_height: Number(e.target.value) }))}
                    min={10}
                    max={100}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Font Size Header (pt)</Label>
                  <Input
                    type="number"
                    value={settings.pdf_header_font_size}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_header_font_size: Number(e.target.value) }))}
                    min={10}
                    max={36}
                  />
                </div>
                <div>
                  <Label>Font Size Body (pt)</Label>
                  <Input
                    type="number"
                    value={settings.pdf_body_font_size}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_body_font_size: Number(e.target.value) }))}
                    min={8}
                    max={16}
                  />
                </div>
              </div>

              <Separator />

              <div>
                <Label>Warna Utama (RGB)</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={settings.pdf_primary_color}
                    onChange={(e) => setSettings(prev => ({ ...prev, pdf_primary_color: e.target.value }))}
                    placeholder="41,128,185"
                  />
                  <div 
                    className="w-10 h-10 rounded border"
                    style={{ backgroundColor: parseColor(settings.pdf_primary_color) }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Format: R,G,B (contoh: 41,128,185 untuk biru)
                </p>
              </div>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="px-1">
              <div className="border rounded-lg p-4 bg-white">
              <div className="max-w-md mx-auto space-y-4">
                  {/* Header Preview - scaled to match PDF proportions */}
                  <div className="flex items-start gap-3">
                    {settings.company_logo ? (
                      <img 
                        src={settings.company_logo} 
                        alt="Logo" 
                        className="object-contain flex-shrink-0"
                        style={{ 
                          width: `${settings.pdf_logo_width * PDF_PREVIEW_SCALE}px`, 
                          height: `${settings.pdf_logo_height * PDF_PREVIEW_SCALE}px` 
                        }}
                      />
                    ) : (
                      <div 
                        className="bg-muted flex items-center justify-center text-xs text-muted-foreground flex-shrink-0"
                        style={{ 
                          width: `${settings.pdf_logo_width * PDF_PREVIEW_SCALE}px`, 
                          height: `${settings.pdf_logo_height * PDF_PREVIEW_SCALE}px` 
                        }}
                      >
                        Logo
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h2 
                        className="font-bold truncate"
                        style={{ 
                          fontSize: `${Math.max(14, settings.pdf_header_font_size * 0.9)}px`,
                          color: parseColor(settings.pdf_primary_color)
                        }}
                      >
                        {settings.pdf_company_name}
                      </h2>
                      <p className="text-gray-500 text-sm">{settings.pdf_company_tagline}</p>
                      <p className="text-gray-500 text-xs">{settings.pdf_company_address}</p>
                    </div>
                  </div>

                  <div 
                    className="border-t-2 border-b"
                    style={{ borderColor: parseColor(settings.pdf_primary_color) }}
                  />

                  <h3 className="text-center font-bold">{settings.pdf_document_title}</h3>
                  <p className="text-center text-sm text-gray-500">Periode: Januari 2025</p>

                  <div className="bg-gray-50 rounded p-3 text-sm">
                    <p><span className="text-gray-500">Nama Karyawan:</span> <strong>John Doe</strong></p>
                    <p><span className="text-gray-500">Jabatan:</span> <strong>Developer</strong></p>
                  </div>

                  <div className="text-sm">
                    <div 
                      className="text-white p-2 rounded-t font-medium"
                      style={{ backgroundColor: parseColor(settings.pdf_primary_color) }}
                    >
                      RINCIAN GAJI
                    </div>
                    <div className="border p-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Gaji Pokok</span>
                        <span>Rp 5.000.000</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tunjangan</span>
                        <span>Rp 1.000.000</span>
                      </div>
                    </div>
                    <div 
                      className="text-white p-2 rounded-b font-bold flex justify-between"
                      style={{ backgroundColor: parseColor(settings.pdf_primary_color) }}
                    >
                      <span>TOTAL</span>
                      <span>Rp 6.000.000</span>
                    </div>
                  </div>

                  {settings.pdf_show_terbilang && (
                    <p className="text-xs italic text-gray-500">
                      Terbilang: Enam Juta Rupiah
                    </p>
                  )}

                  {settings.pdf_show_signature && (
                    <div className="flex justify-between pt-4">
                      <div className="text-center">
                        <p className="text-sm font-medium">{settings.pdf_giver_label}</p>
                        {settings.hr_signature ? (
                          <img src={settings.hr_signature} alt="Sign" className="h-12 mx-auto my-2" />
                        ) : (
                          <div className="h-12 my-2" />
                        )}
                        <p className="font-bold underline">{settings.hr_name}</p>
                        <p className="text-xs text-gray-500">{settings.pdf_giver_role}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{settings.pdf_receiver_label}</p>
                        <div className="h-12 my-2" />
                        <p className="font-bold underline">John Doe</p>
                        <p className="text-xs text-gray-500">{settings.pdf_receiver_role}</p>
                      </div>
                    </div>
                  )}

                  <p className="text-center text-xs text-gray-400 pt-4">
                    {settings.pdf_footer_text}
                  </p>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={saveAllSettings} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Menyimpan..." : "Simpan Semua"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
