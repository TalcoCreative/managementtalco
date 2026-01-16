import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  usePlatformAccounts,
  useCreatePlatformAccount,
  useUpdatePlatformAccount,
  useDeletePlatformAccount,
} from "@/hooks/useReports";
import { PLATFORMS, type Platform } from "@/lib/report-constants";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, MoreHorizontal, Pencil, Trash2, Instagram, Facebook, Linkedin, Youtube, Music2, MapPin } from "lucide-react";

const PlatformIcon = ({ platform }: { platform: string }) => {
  const icons: Record<string, React.ReactNode> = {
    instagram: <Instagram className="h-4 w-4" />,
    facebook: <Facebook className="h-4 w-4" />,
    linkedin: <Linkedin className="h-4 w-4" />,
    youtube: <Youtube className="h-4 w-4" />,
    tiktok: <Music2 className="h-4 w-4" />,
    google_business: <MapPin className="h-4 w-4" />,
  };
  return icons[platform] || null;
};

export function PlatformAccountsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("");

  const [formData, setFormData] = useState({
    client_id: "",
    platform: "" as Platform | "",
    account_name: "",
    username_url: "",
    status: "active" as "active" | "inactive",
  });

  const { data: accounts = [], isLoading } = usePlatformAccounts();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useCreatePlatformAccount();
  const updateMutation = useUpdatePlatformAccount();
  const deleteMutation = useDeletePlatformAccount();

  const filteredAccounts = accounts.filter((acc) => {
    if (filterClient && acc.client_id !== filterClient) return false;
    if (filterPlatform && acc.platform !== filterPlatform) return false;
    return true;
  });

  const handleOpenCreate = () => {
    setSelectedAccount(null);
    setFormData({
      client_id: "",
      platform: "",
      account_name: "",
      username_url: "",
      status: "active",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (account: typeof accounts[0]) => {
    setSelectedAccount(account.id);
    setFormData({
      client_id: account.client_id,
      platform: account.platform,
      account_name: account.account_name,
      username_url: account.username_url || "",
      status: account.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.client_id || !formData.platform || !formData.account_name) {
      return;
    }

    if (selectedAccount) {
      updateMutation.mutate(
        { id: selectedAccount, ...formData } as any,
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(formData as any, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (selectedAccount) {
      deleteMutation.mutate(selectedAccount, {
        onSuccess: () => setDeleteDialogOpen(false),
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Platform Accounts</CardTitle>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Account
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Semua Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Semua Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Semua Platform</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Nama Account</TableHead>
                <TableHead>Username/URL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada platform account
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((acc) => (
                  <TableRow key={acc.id}>
                    <TableCell className="font-medium">
                      {acc.clients?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <PlatformIcon platform={acc.platform} />
                        {PLATFORMS.find((p) => p.value === acc.platform)?.label}
                      </div>
                    </TableCell>
                    <TableCell>{acc.account_name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {acc.username_url || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={acc.status === "active" ? "default" : "secondary"}>
                        {acc.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(acc)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => {
                              setSelectedAccount(acc.id);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Hapus
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {selectedAccount ? "Edit Platform Account" : "Tambah Platform Account"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Platform *</Label>
                <Select
                  value={formData.platform}
                  onValueChange={(v) => setFormData({ ...formData, platform: v as Platform })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nama Account *</Label>
                <Input
                  value={formData.account_name}
                  onChange={(e) =>
                    setFormData({ ...formData, account_name: e.target.value })
                  }
                  placeholder="Nama akun/halaman"
                />
              </div>
              <div className="space-y-2">
                <Label>Username/URL</Label>
                <Input
                  value={formData.username_url}
                  onChange={(e) =>
                    setFormData({ ...formData, username_url: e.target.value })
                  }
                  placeholder="@username atau link profil"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) =>
                    setFormData({ ...formData, status: v as "active" | "inactive" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.client_id ||
                  !formData.platform ||
                  !formData.account_name
                }
              >
                {selectedAccount ? "Simpan" : "Tambah"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Platform Account?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus platform account beserta semua report
                yang terkait. Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
