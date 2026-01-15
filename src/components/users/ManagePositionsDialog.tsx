import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";

interface ManagePositionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

import { DEPARTMENTS } from "@/hooks/usePositions";


const COLORS = [
  { value: "#ef4444", label: "Merah" },
  { value: "#f97316", label: "Oranye" },
  { value: "#eab308", label: "Kuning" },
  { value: "#22c55e", label: "Hijau" },
  { value: "#10b981", label: "Emerald" },
  { value: "#14b8a6", label: "Teal" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#3b82f6", label: "Biru" },
  { value: "#6366f1", label: "Indigo" },
  { value: "#8b5cf6", label: "Ungu" },
  { value: "#ec4899", label: "Pink" },
];

export function ManagePositionsDialog({
  open,
  onOpenChange,
}: ManagePositionsDialogProps) {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", department: "", color: "" });
  const [newPosition, setNewPosition] = useState({ name: "", department: "", color: "#6366f1" });
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: positions, isLoading } = useQuery({
    queryKey: ["positions", false],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("positions")
        .select("*")
        .order("department", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const { error } = await supabase.from("positions").insert({
        name: newPosition.name,
        department: newPosition.department || null,
        color: newPosition.color,
        created_by: session.session.user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Posisi berhasil ditambahkan");
      setNewPosition({ name: "", department: "", color: "#6366f1" });
      setShowAddForm(false);
    },
    onError: (error: any) => {
      if (error.message?.includes("duplicate")) {
        toast.error("Posisi dengan nama ini sudah ada");
      } else {
        toast.error("Gagal menambahkan posisi: " + error.message);
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("positions")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Posisi berhasil diperbarui");
      setEditingId(null);
    },
    onError: (error: any) => {
      toast.error("Gagal memperbarui posisi: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("positions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      toast.success("Posisi berhasil dihapus");
    },
    onError: (error: any) => {
      toast.error("Gagal menghapus posisi: " + error.message);
    },
  });

  const startEdit = (position: any) => {
    setEditingId(position.id);
    setEditForm({
      name: position.name,
      department: position.department || "",
      color: position.color || "#6366f1",
    });
  };

  const saveEdit = () => {
    if (!editingId || !editForm.name) return;
    updateMutation.mutate({
      id: editingId,
      updates: {
        name: editForm.name,
        department: editForm.department || null,
        color: editForm.color,
      },
    });
  };

  const toggleActive = (id: string, currentActive: boolean) => {
    updateMutation.mutate({ id, updates: { is_active: !currentActive } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Kelola Posisi</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Add New Position */}
          {!showAddForm ? (
            <Button onClick={() => setShowAddForm(true)} variant="outline" className="w-fit">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Posisi Baru
            </Button>
          ) : (
            <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Nama Posisi *</Label>
                  <Input
                    value={newPosition.name}
                    onChange={(e) => setNewPosition({ ...newPosition, name: e.target.value })}
                    placeholder="Contoh: Data Analyst"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={newPosition.department}
                    onValueChange={(value) => setNewPosition({ ...newPosition, department: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Warna</Label>
                  <Select
                    value={newPosition.color}
                    onValueChange={(value) => setNewPosition({ ...newPosition, color: value })}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: newPosition.color }}
                          />
                          {COLORS.find(c => c.value === newPosition.color)?.label || "Pilih"}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {COLORS.map((color) => (
                        <SelectItem key={color.value} value={color.value}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: color.value }}
                            />
                            {color.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => createMutation.mutate()}
                  disabled={!newPosition.name || createMutation.isPending}
                  size="sm"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewPosition({ name: "", department: "", color: "#6366f1" });
                  }}
                >
                  Batal
                </Button>
              </div>
            </div>
          )}

          {/* Positions List */}
          <ScrollArea className="flex-1 min-h-0 max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Warna</TableHead>
                  <TableHead>Nama Posisi</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : positions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Belum ada posisi
                    </TableCell>
                  </TableRow>
                ) : (
                  positions?.map((position) => (
                    <TableRow key={position.id}>
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{ backgroundColor: position.color || "#6366f1" }}
                        />
                      </TableCell>
                      <TableCell>
                        {editingId === position.id ? (
                          <Input
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="h-8"
                          />
                        ) : (
                          <span className={!position.is_active ? "text-muted-foreground" : ""}>
                            {position.name}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {editingId === position.id ? (
                          <Select
                            value={editForm.department}
                            onValueChange={(value) => setEditForm({ ...editForm, department: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Pilih" />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((dept) => (
                                <SelectItem key={dept} value={dept}>
                                  {dept}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {position.department || "Tidak ada"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={position.is_active}
                          onCheckedChange={() => toggleActive(position.id, position.is_active)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {editingId === position.id ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={saveEdit}>
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1 justify-end">
                            <Button size="icon" variant="ghost" onClick={() => startEdit(position)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(position.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
