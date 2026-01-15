import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, Pencil, Calendar, Building2, Star } from "lucide-react";

interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  holiday_type: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

interface HolidayFormData {
  name: string;
  start_date: string;
  end_date: string;
  holiday_type: string;
  description: string;
  is_active: boolean;
}

const holidayTypeLabels: Record<string, string> = {
  national: "Libur Nasional",
  office: "Libur Kantor",
  special: "Libur Khusus",
};

const holidayTypeIcons: Record<string, typeof Calendar> = {
  national: Calendar,
  office: Building2,
  special: Star,
};

const Holiday = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [formData, setFormData] = useState<HolidayFormData>({
    name: "",
    start_date: "",
    end_date: "",
    holiday_type: "national",
    description: "",
    is_active: true,
  });

  // Check access
  const { data: userRoles, isLoading: rolesLoading } = useQuery({
    queryKey: ["user-roles-holiday"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      if (error) throw error;
      return data.map((r) => r.role);
    },
  });

  const canAccess = userRoles?.some((r) => 
    r === "super_admin" || r === "hr"
  );

  // Fetch holidays
  const { data: holidays, isLoading } = useQuery({
    queryKey: ["holidays"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data as Holiday[];
    },
    enabled: canAccess,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: HolidayFormData & { id?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (data.id) {
        // Update
        const { error } = await supabase
          .from("holidays")
          .update({
            name: data.name,
            start_date: data.start_date,
            end_date: data.end_date,
            holiday_type: data.holiday_type,
            description: data.description || null,
            is_active: data.is_active,
          })
          .eq("id", data.id);
        
        if (error) throw error;
      } else {
        // Create
        const { error } = await supabase
          .from("holidays")
          .insert({
            name: data.name,
            start_date: data.start_date,
            end_date: data.end_date,
            holiday_type: data.holiday_type,
            description: data.description || null,
            is_active: data.is_active,
            created_by: user.id,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      setDialogOpen(false);
      resetForm();
      toast.success(editingHoliday ? "Libur berhasil diperbarui" : "Libur berhasil ditambahkan");
    },
    onError: (error) => {
      toast.error("Gagal menyimpan: " + error.message);
    },
  });

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("holidays")
        .update({ is_active })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast.success("Status libur diperbarui");
    },
    onError: (error) => {
      toast.error("Gagal mengubah status: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      start_date: "",
      end_date: "",
      holiday_type: "national",
      description: "",
      is_active: true,
    });
    setEditingHoliday(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      name: holiday.name,
      start_date: holiday.start_date,
      end_date: holiday.end_date,
      holiday_type: holiday.holiday_type,
      description: holiday.description || "",
      is_active: holiday.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error("Mohon lengkapi data yang wajib diisi");
      return;
    }

    if (formData.end_date < formData.start_date) {
      toast.error("Tanggal selesai harus setelah tanggal mulai");
      return;
    }

    saveMutation.mutate({
      ...formData,
      id: editingHoliday?.id,
    });
  };

  const getHolidayTypeBadge = (type: string) => {
    const Icon = holidayTypeIcons[type] || Calendar;
    const colors: Record<string, string> = {
      national: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      office: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      special: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };

    return (
      <Badge className={`${colors[type] || ""} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {holidayTypeLabels[type] || type}
      </Badge>
    );
  };

  if (rolesLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Memuat...</p>
        </div>
      </AppLayout>
    );
  }

  if (!canAccess) {
    navigate("/");
    return null;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Kalender Libur</h1>
          <p className="text-muted-foreground">Manajemen hari libur perusahaan</p>
        </div>

        <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daftar Hari Libur
          </CardTitle>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Tambah Libur
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Memuat data...</p>
          ) : holidays?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Belum ada data libur. Klik "Tambah Libur" untuk menambahkan.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Libur</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-center">Status Aktif</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holidays?.map((holiday) => (
                    <TableRow key={holiday.id}>
                      <TableCell className="font-medium">{holiday.name}</TableCell>
                      <TableCell>
                        {format(parseISO(holiday.start_date), "d MMM yyyy", { locale: id })}
                        {holiday.start_date !== holiday.end_date && (
                          <> - {format(parseISO(holiday.end_date), "d MMM yyyy", { locale: id })}</>
                        )}
                      </TableCell>
                      <TableCell>{getHolidayTypeBadge(holiday.holiday_type)}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {holiday.description || "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={holiday.is_active}
                          onCheckedChange={(checked) =>
                            toggleActiveMutation.mutate({ id: holiday.id, is_active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(holiday)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? "Edit Libur" : "Tambah Libur Baru"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Libur *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Contoh: Hari Raya Idul Fitri"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Tanggal Mulai *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Tanggal Selesai *</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="holiday_type">Jenis Libur *</Label>
              <Select
                value={formData.holiday_type}
                onValueChange={(value) => setFormData({ ...formData, holiday_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis libur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="national">Libur Nasional</SelectItem>
                  <SelectItem value="office">Libur Kantor</SelectItem>
                  <SelectItem value="special">Libur Khusus</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Keterangan (opsional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Keterangan tambahan..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Status Aktif</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </AppLayout>
  );
};

export default Holiday;
