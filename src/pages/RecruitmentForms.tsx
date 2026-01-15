import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, FileEdit, Eye, Copy, MoreVertical, Trash2, ExternalLink, Code } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateRecruitmentFormDialog } from "@/components/recruitment-forms/CreateRecruitmentFormDialog";
import { FormBuilderDialog } from "@/components/recruitment-forms/FormBuilderDialog";
import { EmbedCodeDialog } from "@/components/recruitment-forms/EmbedCodeDialog";
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

interface RecruitmentForm {
  id: string;
  name: string;
  position: string;
  description: string | null;
  slug: string;
  status: string;
  created_at: string;
  created_by: string;
}

export default function RecruitmentForms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [embedDialogFormId, setEmbedDialogFormId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<RecruitmentForm | null>(null);
  const queryClient = useQueryClient();

  const { data: forms, isLoading } = useQuery({
    queryKey: ["recruitment-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as RecruitmentForm[];
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      const { error } = await supabase
        .from("recruitment_forms")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-forms"] });
      toast.success("Status form diperbarui");
    },
    onError: (error) => {
      toast.error("Gagal mengubah status: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("recruitment_forms")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-forms"] });
      toast.success("Form dihapus");
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    },
    onError: (error) => {
      toast.error("Gagal menghapus form: " + error.message);
    },
  });

  const filteredForms = forms?.filter((form) =>
    form.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    form.position.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const copyPublicUrl = (slug: string) => {
    const url = `https://ms.talco.id/apply/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link form disalin!");
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Form Builder</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Buat dan kelola form rekrutmen untuk embed di website
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)} className="h-12 sm:h-10">
            <Plus className="mr-2 h-4 w-4" />
            Buat Form Baru
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Form</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{forms?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Form Aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {forms?.filter(f => f.status === 'active').length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Form Nonaktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">
                {forms?.filter(f => f.status === 'inactive').length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari form..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 sm:h-10"
          />
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Nama Form</TableHead>
                  <TableHead className="min-w-[150px]">Posisi</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[120px]">Dibuat</TableHead>
                  <TableHead className="min-w-[100px] text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredForms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? "Tidak ada form ditemukan" : "Belum ada form. Buat form pertama Anda!"}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <div>
                          <p className="font-semibold">{form.name}</p>
                          {form.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {form.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{form.position}</TableCell>
                      <TableCell>
                        <Badge
                          variant={form.status === "active" ? "default" : "secondary"}
                          className={form.status === "active" ? "bg-green-500" : ""}
                        >
                          {form.status === "active" ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(form.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedFormId(form.id)}>
                              <FileEdit className="mr-2 h-4 w-4" />
                              Edit Form
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/apply/${form.slug}`, '_blank')}>
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Form
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyPublicUrl(form.slug)}>
                              <Copy className="mr-2 h-4 w-4" />
                              Salin Link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEmbedDialogFormId(form.id)}>
                              <Code className="mr-2 h-4 w-4" />
                              Embed Code
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: form.id,
                                  newStatus: form.status === "active" ? "inactive" : "active",
                                })
                              }
                            >
                              {form.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setFormToDelete(form);
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
          </CardContent>
        </Card>
      </div>

      <CreateRecruitmentFormDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      <FormBuilderDialog
        formId={selectedFormId}
        open={!!selectedFormId}
        onOpenChange={(open) => !open && setSelectedFormId(null)}
      />

      <EmbedCodeDialog
        formId={embedDialogFormId}
        open={!!embedDialogFormId}
        onOpenChange={(open) => !open && setEmbedDialogFormId(null)}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Form?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus form "{formToDelete?.name}"?
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => formToDelete && deleteMutation.mutate(formToDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
