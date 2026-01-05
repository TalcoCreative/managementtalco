import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Eye, EyeOff, Trash2, Lock, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ClientAccountSectionProps {
  clientId: string;
  client: any;
  canEdit: boolean;
}

const PLATFORMS = [
  "Email",
  "Instagram",
  "TikTok",
  "Facebook Ads",
  "Google Ads",
  "Website",
  "YouTube",
  "Twitter/X",
  "LinkedIn",
  "Other",
];

export function ClientAccountSection({ clientId, client, canEdit }: ClientAccountSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    platform: "",
    username: "",
    password: "",
    notes: "",
  });
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["client-accounts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_accounts")
        .select("*")
        .eq("client_id", clientId)
        .order("platform");
      if (error) throw error;
      return data;
    },
  });

  const handleSave = async () => {
    if (!form.platform || !form.username) {
      toast.error("Platform dan username wajib diisi");
      return;
    }

    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Simple encoding for password (in production, use proper encryption)
      const encodedPassword = form.password ? btoa(form.password) : null;

      const { error } = await supabase.from("client_accounts").insert({
        client_id: clientId,
        platform: form.platform,
        username: form.username,
        password_encrypted: encodedPassword,
        notes: form.notes,
        created_by: session.session.user.id,
      });

      if (error) throw error;

      toast.success("Akun ditambahkan");
      queryClient.invalidateQueries({ queryKey: ["client-accounts", clientId] });
      setDialogOpen(false);
      setForm({ platform: "", username: "", password: "", notes: "" });
    } catch (error: any) {
      toast.error(error.message || "Gagal menambahkan akun");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm("Yakin ingin menghapus data akun ini?")) return;

    try {
      const { error } = await supabase
        .from("client_accounts")
        .delete()
        .eq("id", accountId);

      if (error) throw error;

      toast.success("Akun dihapus");
      queryClient.invalidateQueries({ queryKey: ["client-accounts", clientId] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus akun");
    }
  };

  const togglePasswordVisibility = (accountId: string) => {
    setVisiblePasswords(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} disalin ke clipboard`);
  };

  const decodePassword = (encoded: string | null) => {
    if (!encoded) return "";
    try {
      return atob(encoded);
    } catch {
      return encoded;
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning-foreground">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          <span className="font-medium">Data Confidential</span>
        </div>
        <p className="mt-1 text-xs opacity-80">
          Data akun ini bersifat rahasia. Hanya Super Admin dan Finance yang dapat mengakses.
        </p>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Tambah Akun
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Data Akun</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Platform</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.platform}
                    onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  >
                    <option value="">Pilih platform</option>
                    {PLATFORMS.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Username / Email</Label>
                  <Input
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="username atau email"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="password"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Catatan tambahan..."
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? "Menyimpan..." : "Simpan Akun"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4 text-muted-foreground">Loading...</div>
      ) : accounts && accounts.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Platform</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Password</TableHead>
              <TableHead>Notes</TableHead>
              {canEdit && <TableHead className="w-20">Aksi</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const password = decodePassword(account.password_encrypted);
              const isVisible = visiblePasswords.has(account.id);

              return (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.platform}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{account.username}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(account.username, "Username")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    {password ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">
                          {isVisible ? password : "••••••••"}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => togglePasswordVisibility(account.id)}
                        >
                          {isVisible ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Eye className="h-3 w-3" />
                          )}
                        </Button>
                        {isVisible && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(password, "Password")}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {account.notes || "-"}
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Belum ada data akun</p>
        </div>
      )}
    </div>
  );
}
