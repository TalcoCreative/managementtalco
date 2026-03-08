import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Search, MoreVertical, Trash2, Pencil, Copy, ExternalLink,
  FileText, BarChart3, Eye, EyeOff,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Form {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  is_public: boolean;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  _response_count?: number;
}

export default function Forms() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editForm, setEditForm] = useState<Form | null>(null);
  const [deleteForm, setDeleteForm] = useState<Form | null>(null);
  const [newForm, setNewForm] = useState({ name: "", description: "", is_public: true, theme: "clean", form_template: "" });
  const [embedForm, setEmbedForm] = useState<Form | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: forms, isLoading } = useQuery({
    queryKey: ["general-forms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: counts } = await supabase
        .from("form_responses")
        .select("form_id");

      const countMap: Record<string, number> = {};
      counts?.forEach((r: any) => {
        countMap[r.form_id] = (countMap[r.form_id] || 0) + 1;
      });

      return (data || []).map((f: any) => ({
        ...f,
        _response_count: countMap[f.id] || 0,
      })) as Form[];
    },
  });

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).substring(2, 6);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const slug = generateSlug(newForm.name);
      const { error } = await supabase.from("forms").insert({
        name: newForm.name,
        description: newForm.description || null,
        is_public: newForm.is_public,
        theme: newForm.theme,
        slug,
        created_by: session.session.user.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-forms"] });
      setCreateOpen(false);
      setNewForm({ name: "", description: "", is_public: true, theme: "clean" });
      toast.success("Form created successfully");
    },
    onError: (e) => toast.error("Failed to create form: " + e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (form: Form) => {
      const { error } = await supabase
        .from("forms")
        .update({ name: form.name, description: form.description, is_public: form.is_public })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-forms"] });
      setEditForm(null);
      toast.success("Form updated");
    },
    onError: (e) => toast.error("Failed to update: " + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("forms").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-forms"] });
      setDeleteForm(null);
      toast.success("Form archived");
    },
    onError: (e) => toast.error("Failed to archive: " + e.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (form: Form) => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");
      const slug = generateSlug(form.name + " copy");

      const { data: newFormData, error: formError } = await supabase.from("forms").insert({
        name: form.name + " (Copy)",
        description: form.description,
        is_public: form.is_public,
        slug,
        created_by: session.session.user.id,
      }).select().single();
      if (formError) throw formError;

      const { data: questions } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", form.id)
        .order("field_order");
      if (questions && questions.length > 0) {
        const newQuestions = questions.map((q: any) => ({
          form_id: newFormData.id,
          label: q.label,
          field_type: q.field_type,
          is_required: q.is_required,
          field_order: q.field_order,
          options: q.options,
          placeholder: q.placeholder,
        }));
        await supabase.from("form_questions").insert(newQuestions);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["general-forms"] });
      toast.success("Form duplicated successfully");
    },
    onError: (e) => toast.error("Failed to duplicate: " + e.message),
  });

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`https://ms.talco.id/forms/${slug}`);
    toast.success("Link copied!");
  };

  const filtered = forms?.filter(f =>
    f.status !== "archived" && (
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    )
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Form Builder</h1>
            <p className="text-muted-foreground text-sm">
              Create forms for recruitment, surveys, client intake, and more
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="h-12 sm:h-10">
            <Plus className="mr-2 h-4 w-4" />
            Create Form
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Forms</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{filtered.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Public</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-green-600">{filtered.filter(f => f.is_public).length}</div></CardContent>
          </Card>
          <Card className="col-span-2 sm:col-span-1">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Responses</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-primary">{filtered.reduce((s, f) => s + (f._response_count || 0), 0)}</div></CardContent>
          </Card>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search forms..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 sm:h-10" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Form Name</TableHead>
                  <TableHead className="min-w-[80px]">Responses</TableHead>
                  <TableHead className="min-w-[80px]">Access</TableHead>
                  <TableHead className="min-w-[120px]">Created</TableHead>
                  <TableHead className="min-w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No results found" : "No forms yet."}
                  </TableCell></TableRow>
                ) : filtered.map(form => (
                  <TableRow key={form.id} className="cursor-pointer" onClick={() => navigate(`/forms/${form.id}`)}>
                    <TableCell>
                      <div>
                        <p className="font-semibold">{form.name}</p>
                        {form.description && <p className="text-xs text-muted-foreground line-clamp-1">{form.description}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{form._response_count || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      {form.is_public ? (
                        <Badge className="bg-green-500 text-white"><Eye className="h-3 w-3 mr-1" />Public</Badge>
                      ) : (
                        <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />Private</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(form.created_at), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}`)}>
                            <FileText className="mr-2 h-4 w-4" />Edit Form
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/forms/${form.id}/responses`)}>
                            <BarChart3 className="mr-2 h-4 w-4" />View Responses
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEditForm({ ...form })}>
                            <Pencil className="mr-2 h-4 w-4" />Edit Info
                          </DropdownMenuItem>
                           {form.is_public && (
                            <>
                              <DropdownMenuItem onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
                                <ExternalLink className="mr-2 h-4 w-4" />Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyLink(form.slug)}>
                                <Copy className="mr-2 h-4 w-4" />Copy Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setEmbedForm(form)}>
                                <FileText className="mr-2 h-4 w-4" />Embed Code
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => duplicateMutation.mutate(form)}>
                            <Copy className="mr-2 h-4 w-4" />Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteForm(form)}>
                            <Trash2 className="mr-2 h-4 w-4" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New Form</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Form Name *</Label>
              <Input value={newForm.name} onChange={e => setNewForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Client Satisfaction Survey" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={newForm.description} onChange={e => setNewForm(p => ({ ...p, description: e.target.value }))} placeholder="Form description (optional)" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Public Form</Label>
              <Switch checked={newForm.is_public} onCheckedChange={v => setNewForm(p => ({ ...p, is_public: v }))} />
            </div>
            <div>
              <Label>Theme</Label>
              <Select value={newForm.theme} onValueChange={v => setNewForm(p => ({ ...p, theme: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clean">Clean (Light)</SelectItem>
                  <SelectItem value="dark">Dark Mode</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newForm.name.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editForm} onOpenChange={o => !o && setEditForm(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Form</DialogTitle></DialogHeader>
          {editForm && (
            <div className="space-y-4">
              <div>
                <Label>Form Name</Label>
                <Input value={editForm.name} onChange={e => setEditForm(p => p ? { ...p, name: e.target.value } : null)} />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={editForm.description || ""} onChange={e => setEditForm(p => p ? { ...p, description: e.target.value } : null)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Public Form</Label>
                <Switch checked={editForm.is_public} onCheckedChange={v => setEditForm(p => p ? { ...p, is_public: v } : null)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)}>Cancel</Button>
            <Button onClick={() => editForm && updateMutation.mutate(editForm)}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteForm} onOpenChange={o => !o && setDeleteForm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Form?</AlertDialogTitle>
            <AlertDialogDescription>
              Form "{deleteForm?.name}" will be archived. Existing responses will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteForm && deleteMutation.mutate(deleteForm.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Embed Code Dialog */}
      <Dialog open={!!embedForm} onOpenChange={o => !o && setEmbedForm(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>Embed Form: {embedForm?.name}</DialogTitle></DialogHeader>
          {embedForm && (() => {
            const shortDomain = "https://ms.talco.id";
            const publicUrl = `${shortDomain}/forms/${embedForm.slug}`;
            const embedCode = `<iframe src="${publicUrl}" width="100%" height="700" frameborder="0" style="border:none;border-radius:12px;"></iframe>`;
            const scriptEmbed = `<div id="talco-form-${embedForm.slug}"></div>\n<script src="${shortDomain}/embed-form.js" data-form-slug="${embedForm.slug}"></script>`;
            return (
              <div className="space-y-4">
                <div>
                  <Label>Direct Link</Label>
                  <div className="flex gap-2 mt-1">
                    <Input readOnly value={publicUrl} />
                    <Button variant="outline" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copied!"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Iframe Embed</Label>
                  <Textarea readOnly value={embedCode} rows={3} className="font-mono text-xs mt-1" />
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => { navigator.clipboard.writeText(embedCode); toast.success("Embed code copied!"); }}>
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                </div>
                <div>
                  <Label>Script Embed</Label>
                  <Textarea readOnly value={scriptEmbed} rows={3} className="font-mono text-xs mt-1" />
                  <Button variant="outline" size="sm" className="mt-1" onClick={() => { navigator.clipboard.writeText(scriptEmbed); toast.success("Script code copied!"); }}>
                    <Copy className="h-3 w-3 mr-1" />Copy
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
