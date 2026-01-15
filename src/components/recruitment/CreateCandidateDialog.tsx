import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { usePositions, useDepartments } from "@/hooks/usePositions";

interface CreateCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateCandidateDialog({ open, onOpenChange }: CreateCandidateDialogProps) {
  const queryClient = useQueryClient();
  const { data: positions } = usePositions();
  const { departments } = useDepartments();
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    location: "",
    cv_url: "",
    portfolio_url: "",
    position: "",
    division: "",
    hr_pic_id: "",
    applied_at: new Date().toISOString().split("T")[0],
  });

  const { data: hrUsers } = useQuery({
    queryKey: ["hr-users"],
    queryFn: async () => {
      // Get user_ids with HR or Super Admin role
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["hr", "super_admin"]);
      if (roleError) throw roleError;
      
      if (!roleData || roleData.length === 0) return [];
      
      // Get unique user_ids
      const userIds = [...new Set(roleData.map(r => r.user_id))];
      
      // Get profiles for these users
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profileError) throw profileError;
      
      return profiles || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("candidates").insert({
        full_name: formData.full_name,
        email: formData.email,
        phone: formData.phone,
        location: formData.location || null,
        cv_url: formData.cv_url || null,
        portfolio_url: formData.portfolio_url || null,
        position: formData.position,
        division: formData.division,
        hr_pic_id: formData.hr_pic_id || null,
        applied_at: formData.applied_at,
        created_by: session.session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      toast.success("Kandidat berhasil ditambahkan");
      onOpenChange(false);
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        location: "",
        cv_url: "",
        portfolio_url: "",
        position: "",
        division: "",
        hr_pic_id: "",
        applied_at: new Date().toISOString().split("T")[0],
      });
    },
    onError: (error) => {
      toast.error("Gagal menambahkan kandidat: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email || !formData.phone || !formData.position || !formData.division) {
      toast.error("Mohon lengkapi data yang wajib diisi");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Kandidat Baru</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nama Lengkap *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Nomor HP *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Lokasi</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="position">Posisi yang Dilamar *</Label>
              <Select
                value={formData.position}
                onValueChange={(value) => setFormData({ ...formData, position: value })}
              >
                <SelectTrigger className="h-12 sm:h-10">
                  <SelectValue placeholder="Pilih posisi" />
                </SelectTrigger>
                <SelectContent>
                  {positions?.map((pos) => (
                    <SelectItem key={pos.id} value={pos.name}>
                      {pos.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="division">Divisi *</Label>
              <Select
                value={formData.division}
                onValueChange={(value) => setFormData({ ...formData, division: value })}
              >
                <SelectTrigger className="h-12 sm:h-10">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((div) => (
                    <SelectItem key={div} value={div}>
                      {div}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cv_url">Link CV</Label>
              <Input
                id="cv_url"
                type="url"
                placeholder="https://..."
                value={formData.cv_url}
                onChange={(e) => setFormData({ ...formData, cv_url: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="portfolio_url">Link Portfolio (opsional)</Label>
              <Input
                id="portfolio_url"
                type="url"
                placeholder="https://..."
                value={formData.portfolio_url}
                onChange={(e) => setFormData({ ...formData, portfolio_url: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hr_pic">HR PIC</Label>
              <Select
                value={formData.hr_pic_id}
                onValueChange={(value) => setFormData({ ...formData, hr_pic_id: value })}
              >
                <SelectTrigger className="h-12 sm:h-10">
                  <SelectValue placeholder="Pilih HR PIC" />
                </SelectTrigger>
                <SelectContent>
                  {hrUsers?.map((user: any) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="applied_at">Tanggal Apply</Label>
              <Input
                id="applied_at"
                type="date"
                value={formData.applied_at}
                onChange={(e) => setFormData({ ...formData, applied_at: e.target.value })}
                className="h-12 sm:h-10"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-12 sm:h-10">
              Batal
            </Button>
            <Button type="submit" disabled={createMutation.isPending} className="h-12 sm:h-10">
              {createMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
