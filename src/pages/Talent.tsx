import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Sparkles, Link2 } from "lucide-react";
import { toast } from "sonner";
import { TalentFormDialog, TALENT_CATEGORIES, type TalentRecord } from "@/components/talent/TalentFormDialog";
import { TalentDetailDialog, formatRupiah } from "@/components/talent/TalentDetailDialog";
import { TalentShareLinkPanel } from "@/components/talent/ShootingTalentSection";
import { DesktopRecommendBanner } from "@/components/shared/DesktopRecommendBanner";

export default function Talent() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editing, setEditing] = useState<TalentRecord | null>(null);
  const [selected, setSelected] = useState<TalentRecord | null>(null);

  const { data: talents, isLoading } = useQuery({
    queryKey: ["talents", search, categoryFilter, statusFilter],
    queryFn: async () => {
      let query = supabase.from("talents").select("*").order("created_at", { ascending: false });
      if (search.trim()) query = query.or(`name.ilike.%${search.trim()}%,city.ilike.%${search.trim()}%,instagram.ilike.%${search.trim()}%`);
      if (categoryFilter !== "all") query = query.eq("category", categoryFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as TalentRecord[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("talents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["talents"] });
      toast.success("Talent dihapus");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t: TalentRecord) => { setEditing(t); setFormOpen(true); setDetailOpen(false); };

  return (
    <AppLayout>
      <div className="space-y-6">
        <DesktopRecommendBanner featureLabel="Talent Database" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="section-header !mb-0 flex-1" style={{ "--section-color": "var(--section-social)" } as React.CSSProperties}>
            <div className="section-icon"><Sparkles className="h-5 w-5" /></div>
            <div>
              <h1 className="section-title">Talent</h1>
              <p className="section-subtitle">Database talent untuk kebutuhan shooting</p>
            </div>
          </div>
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Tambah Talent
          </Button>
        </div>

        <Tabs defaultValue="database">
          <TabsList>
            <TabsTrigger value="database">Database</TabsTrigger>
            <TabsTrigger value="share"><Link2 className="mr-1 h-4 w-4" /> Link Publik</TabsTrigger>
          </TabsList>

          <TabsContent value="database" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap gap-4">
                  <div className="min-w-[200px] flex-1">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kota, instagram..." className="pl-9" />
                    </div>
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Kategori" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Kategori</SelectItem>
                      {TALENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Talent</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Kota</TableHead>
                      <TableHead>Ukuran</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center">Loading...</TableCell></TableRow>
                    ) : (talents?.length ?? 0) === 0 ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center">Belum ada talent</TableCell></TableRow>
                    ) : (
                      talents!.map((t) => (
                        <TableRow key={t.id} className="cursor-pointer" onClick={() => { setSelected(t); setDetailOpen(true); }}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {t.photo_url ? (
                                <img src={t.photo_url} alt={t.name} className="h-10 w-10 rounded-lg object-cover" loading="lazy" />
                              ) : (
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-xs">{t.name.charAt(0)}</div>
                              )}
                              <div>
                                <p className="font-medium">{t.name}</p>
                                <p className="text-xs text-muted-foreground">{t.instagram || t.phone || "-"}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{t.category || "-"}</TableCell>
                          <TableCell>{t.city || "-"}</TableCell>
                          <TableCell className="text-sm">
                            {[t.height_cm ? `${t.height_cm}cm` : null, t.weight_kg ? `${t.weight_kg}kg` : null, t.shirt_size].filter(Boolean).join(" / ") || "-"}
                          </TableCell>
                          <TableCell>{formatRupiah(t.rate)}</TableCell>
                          <TableCell>
                            <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(t)} aria-label="Edit talent">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => { if (confirm(`Hapus talent ${t.name}?`)) deleteMutation.mutate(t.id); }}
                              aria-label="Hapus talent"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="share">
            <Card>
              <CardHeader><CardTitle className="text-base">Katalog Talent Publik</CardTitle></CardHeader>
              <CardContent><TalentShareLinkPanel /></CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <TalentFormDialog open={formOpen} onOpenChange={setFormOpen} talent={editing} />
      <TalentDetailDialog talent={selected} open={detailOpen} onOpenChange={setDetailOpen} onEdit={openEdit} />
    </AppLayout>
  );
}
