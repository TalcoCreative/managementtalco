import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useRoleOptions } from "@/hooks/usePositions";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateUserDialog({ open, onOpenChange }: CreateUserDialogProps) {
  const { roleOptions } = useRoleOptions();
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    role: "",
    phone: "",
    address: "",
    birthDate: "",
    ktpNumber: "",
    emergencyContact: "",
    contractStart: "",
    contractEnd: "",
    bankAccountNumber: "",
    bankAccountName: "",
    gajiPokok: "",
    tjTransport: "",
    tjInternet: "",
    tjKpi: "",
  });

  const updateForm = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.role) {
      toast.error("Pilih role terlebih dahulu");
      return;
    }
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          phone: form.phone || null,
          address: form.address || null,
          birthDate: form.birthDate || null,
          ktpNumber: form.ktpNumber || null,
          emergencyContact: form.emergencyContact || null,
          contractStart: form.contractStart || null,
          contractEnd: form.contractEnd || null,
          bankAccountNumber: form.bankAccountNumber || null,
          bankAccountName: form.bankAccountName || null,
          gajiPokok: form.gajiPokok ? Number(form.gajiPokok) : 0,
          tjTransport: form.tjTransport ? Number(form.tjTransport) : 0,
          tjInternet: form.tjInternet ? Number(form.tjInternet) : 0,
          tjKpi: form.tjKpi ? Number(form.tjKpi) : 0,
        },
      });

      if (error) throw error;

      toast.success("User berhasil dibuat!");
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      toast.error(error.message || "Gagal membuat user");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      email: "",
      password: "",
      fullName: "",
      role: "",
      phone: "",
      address: "",
      birthDate: "",
      ktpNumber: "",
      emergencyContact: "",
      contractStart: "",
      contractEnd: "",
      bankAccountNumber: "",
      bankAccountName: "",
      gajiPokok: "",
      tjTransport: "",
      tjInternet: "",
      tjKpi: "",
    });
  };

  const roleSelectOptions = roleOptions.map((r) => ({
    value: r.value,
    label: r.label,
    sublabel: r.department || undefined,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Tambah Anggota Tim Baru</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Akun */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">🔐 Informasi Akun</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nama Lengkap *</Label>
                  <Input id="fullName" value={form.fullName} onChange={(e) => updateForm("fullName", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input id="password" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <SearchableSelect
                    options={roleSelectOptions}
                    value={form.role}
                    onValueChange={(v) => updateForm("role", v)}
                    placeholder="Pilih role"
                    searchPlaceholder="Cari role..."
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Data Pribadi */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">👤 Data Pribadi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">No. Telepon</Label>
                  <Input id="phone" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} placeholder="08xxxxxxxxxx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="birthDate">Tanggal Lahir</Label>
                  <Input id="birthDate" type="date" value={form.birthDate} onChange={(e) => updateForm("birthDate", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ktpNumber">No. KTP</Label>
                  <Input id="ktpNumber" value={form.ktpNumber} onChange={(e) => updateForm("ktpNumber", e.target.value)} placeholder="16 digit" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContact">Kontak Darurat</Label>
                  <Input id="emergencyContact" value={form.emergencyContact} onChange={(e) => updateForm("emergencyContact", e.target.value)} placeholder="Nama - No. HP" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Input id="address" value={form.address} onChange={(e) => updateForm("address", e.target.value)} placeholder="Alamat lengkap" />
                </div>
              </div>
            </div>

            <Separator />

            {/* Kontrak */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">📄 Kontrak</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contractStart">Mulai Kontrak</Label>
                  <Input id="contractStart" type="date" value={form.contractStart} onChange={(e) => updateForm("contractStart", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contractEnd">Akhir Kontrak</Label>
                  <Input id="contractEnd" type="date" value={form.contractEnd} onChange={(e) => updateForm("contractEnd", e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Bank */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">🏦 Rekening Bank</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Nama Pemilik Rekening</Label>
                  <Input id="bankAccountName" value={form.bankAccountName} onChange={(e) => updateForm("bankAccountName", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">No. Rekening</Label>
                  <Input id="bankAccountNumber" value={form.bankAccountNumber} onChange={(e) => updateForm("bankAccountNumber", e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Gaji */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">💰 Komponen Gaji</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gajiPokok">Gaji Pokok</Label>
                  <Input id="gajiPokok" type="number" value={form.gajiPokok} onChange={(e) => updateForm("gajiPokok", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tjTransport">Tj. Transport</Label>
                  <Input id="tjTransport" type="number" value={form.tjTransport} onChange={(e) => updateForm("tjTransport", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tjInternet">Tj. Internet</Label>
                  <Input id="tjInternet" type="number" value={form.tjInternet} onChange={(e) => updateForm("tjInternet", e.target.value)} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tjKpi">Tj. KPI</Label>
                  <Input id="tjKpi" type="number" value={form.tjKpi} onChange={(e) => updateForm("tjKpi", e.target.value)} placeholder="0" />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Membuat..." : "Buat User"}
            </Button>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
