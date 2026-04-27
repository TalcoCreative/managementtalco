import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, CheckCircle2, XCircle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePermissions } from "@/hooks/usePermissions";

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

const BADGE: Record<string, string> = {
  pending: "bg-yellow-500", approved: "bg-blue-500", paid: "bg-green-500",
  requested: "bg-yellow-500", rejected: "bg-red-500",
};

export default function SalesAdmin() {
  const { isSuperAdmin, isLoading } = usePermissions();
  const qc = useQueryClient();
  const [productFilter, setProductFilter] = useState("all");
  const [salesFilter, setSalesFilter] = useState("all");

  // ---- Queries ----
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => (await (supabase as any).from("products").select("*").order("name")).data || [],
  });
  const { data: settings } = useQuery({
    queryKey: ["admin-commission-settings"],
    queryFn: async () => (await (supabase as any).from("commission_settings").select("*")).data || [],
  });
  const { data: rules } = useQuery({
    queryKey: ["admin-rules"],
    queryFn: async () => (await (supabase as any)
      .from("commission_rules")
      .select("*, profiles(full_name), products(name)")
      .order("created_at", { ascending: false })).data || [],
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users-active"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name").eq("status", "active").order("full_name")).data || [],
  });
  const { data: commissions } = useQuery({
    queryKey: ["admin-commissions"],
    queryFn: async () => (await (supabase as any)
      .from("commissions")
      .select("*, prospects(contact_name, company), products(name), profiles!commissions_sales_id_fkey(full_name)")
      .order("created_at", { ascending: false })).data || [],
  });
  const { data: withdrawals } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => (await (supabase as any)
      .from("withdrawals")
      .select("*, profiles!withdrawals_sales_id_fkey(full_name)")
      .order("request_date", { ascending: false })).data || [],
  });
  const { data: wonProspects } = useQuery({
    queryKey: ["admin-won-prospects"],
    queryFn: async () => (await (supabase as any)
      .from("prospects")
      .select(`
        id,
        contact_name,
        company,
        final_value,
        status,
        deal_status,
        won_approved_at,
        products(name),
        owner:profiles!prospects_owner_id_fkey(full_name),
        pic:profiles!prospects_pic_id_fkey(full_name)
      `)
      .eq("status", "won")
      .order("updated_at", { ascending: false })).data || [],
  });

  const globalPct = settings?.find((s: any) => s.setting_key === "default_commission_percentage")?.setting_value || "10";

  // ---- Mutations ----
  const saveGlobal = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await (supabase as any).from("commission_settings")
        .upsert({ setting_key: "default_commission_percentage", setting_value: val }, { onConflict: "setting_key" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-commission-settings"] }); toast.success("Saved"); },
  });

  const updateCommission = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: any = { status };
      if (status === "approved") patch.approved_at = new Date().toISOString();
      if (status === "paid") patch.paid_at = new Date().toISOString();
      const { error } = await (supabase as any).from("commissions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-commissions"] }); toast.success("Updated"); },
  });

  const approveWon = useMutation({
    mutationFn: async (prospectId: string) => {
      const sessionRes = await supabase.auth.getSession();
      const { error } = await (supabase as any)
        .from("prospects")
        .update({
          won_approved_at: new Date().toISOString(),
          won_approved_by: sessionRes.data.session?.user.id,
        })
        .eq("id", prospectId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-won-prospects"] });
      qc.invalidateQueries({ queryKey: ["admin-commissions"] });
      qc.invalidateQueries({ queryKey: ["my-commissions"] });
      qc.invalidateQueries({ queryKey: ["my-dash-commissions"] });
      toast.success("Won deal approved");
    },
  });

  const updateWithdrawal = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const sessionRes = await supabase.auth.getSession();
      const patch: any = { status, processed_date: new Date().toISOString(), processed_by: sessionRes.data.session?.user.id };
      const { error } = await (supabase as any).from("withdrawals").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }); toast.success("Updated"); },
  });

  // ---- Product dialog ----
  const [productOpen, setProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", description: "", default_commission_percentage: "" });
  const saveProduct = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("products").insert({
        name: productForm.name, description: productForm.description || null,
        default_commission_percentage: productForm.default_commission_percentage ? Number(productForm.default_commission_percentage) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success("Product added"); setProductOpen(false);
      setProductForm({ name: "", description: "", default_commission_percentage: "" });
    },
  });
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-products"] }); toast.success("Deleted"); },
  });

  // ---- Rule dialog ----
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ user_id: "", product_id: "", commission_percentage: "" });
  const saveRule = useMutation({
    mutationFn: async () => {
      if (!ruleForm.user_id && !ruleForm.product_id) throw new Error("Select user and/or product");
      if (!ruleForm.commission_percentage) throw new Error("Enter percentage");
      const payload = {
        user_id: ruleForm.user_id || null,
        product_id: ruleForm.product_id || null,
        commission_percentage: Number(ruleForm.commission_percentage),
      };
      const existingQuery = (supabase as any)
        .from("commission_rules")
        .select("id");

      const userFilteredQuery = ruleForm.user_id ? existingQuery.eq("user_id", ruleForm.user_id) : existingQuery.is("user_id", null);
      const finalQuery = ruleForm.product_id ? userFilteredQuery.eq("product_id", ruleForm.product_id) : userFilteredQuery.is("product_id", null);
      const { data: existing, error: existingError } = await finalQuery.maybeSingle();
      if (existingError) throw existingError;

      const { error } = existing?.id
        ? await (supabase as any).from("commission_rules").update(payload).eq("id", existing.id)
        : await (supabase as any).from("commission_rules").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rules"] });
      toast.success("Rule saved"); setRuleOpen(false);
      setRuleForm({ user_id: "", product_id: "", commission_percentage: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("commission_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-rules"] }); toast.success("Deleted"); },
  });

  // ---- Aggregate stats ----
  const totalLiability = (commissions || []).filter((c: any) => c.status !== "paid").reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
  const totalPaid = (commissions || []).filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + Number(c.commission_amount), 0);
  const pendingWithdrawals = (withdrawals || []).filter((w: any) => w.status === "requested").length;
  const filteredWonProspects = useMemo(() => {
    return (wonProspects || []).filter((item: any) => {
      const matchProduct = productFilter === "all" || item.products?.name === productFilter;
      const ownerName = item.owner?.full_name || item.pic?.full_name || "-";
      const matchSales = salesFilter === "all" || ownerName === salesFilter;
      return matchProduct && matchSales;
    });
  }, [wonProspects, productFilter, salesFilter]);
  const salesNames = Array.from(new Set((wonProspects || []).map((item: any) => item.owner?.full_name || item.pic?.full_name).filter(Boolean)));
  const productNames = Array.from(new Set((products || []).map((item: any) => item.name).filter(Boolean)));

  if (isLoading) return <AppLayout><div className="p-8">Loading...</div></AppLayout>;
  if (!isSuperAdmin) return <AppLayout><div className="p-8 text-center text-muted-foreground">Super admin only.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage products, commissions, and withdrawals</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Commission Liability</p><p className="text-xl font-bold mt-1">{formatRp(totalLiability)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-xl font-bold mt-1">{formatRp(totalPaid)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Pending Withdrawals</p><p className="text-xl font-bold mt-1">{pendingWithdrawals}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Global %</p><p className="text-xl font-bold mt-1">{globalPct}%</p></CardContent></Card>
        </div>

        <Tabs defaultValue="commissions">
          <TabsList>
            <TabsTrigger value="won-history">Won History</TabsTrigger>
            <TabsTrigger value="commissions">Commissions</TabsTrigger>
            <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="rules">Commission Rules</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="won-history">
            <Card>
              <CardHeader>
                <CardTitle>Won Deal History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row">
                  <Select value={salesFilter} onValueChange={setSalesFilter}>
                    <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="All sales" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sales</SelectItem>
                      {salesNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={productFilter} onValueChange={setProductFilter}>
                    <SelectTrigger className="w-full md:w-56"><SelectValue placeholder="All products" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All products</SelectItem>
                      {productNames.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sales</TableHead>
                      <TableHead>Prospect</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Final Value</TableHead>
                      <TableHead>Deal</TableHead>
                      <TableHead>Approval</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredWonProspects.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No won deals found</TableCell></TableRow>
                    ) : filteredWonProspects.map((item: any) => {
                      const salesName = item.owner?.full_name || item.pic?.full_name || "-";
                      const approved = Boolean(item.won_approved_at);
                      return (
                        <TableRow key={item.id}>
                          <TableCell>{salesName}</TableCell>
                          <TableCell>{item.contact_name}<div className="text-xs text-muted-foreground">{item.company || "-"}</div></TableCell>
                          <TableCell>{item.products?.name || "-"}</TableCell>
                          <TableCell className="font-semibold">{formatRp(Number(item.final_value) || 0)}</TableCell>
                          <TableCell><Badge className={`${BADGE.approved} text-white capitalize`}>{item.deal_status || "-"}</Badge></TableCell>
                          <TableCell>
                            {approved ? (
                              <div className="text-xs text-muted-foreground">Approved {format(new Date(item.won_approved_at), "dd MMM yyyy HH:mm")}</div>
                            ) : (
                              <Badge className={`${BADGE.pending} text-white`}>Waiting Admin</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" disabled={approved || approveWon.isPending} onClick={() => approveWon.mutate(item.id)}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Confirm Won
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions */}
          <TabsContent value="commissions">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Sales</TableHead><TableHead>Prospect</TableHead><TableHead>Product</TableHead>
                  <TableHead>Deal</TableHead><TableHead>%</TableHead><TableHead>Commission</TableHead>
                  <TableHead>Status</TableHead><TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(commissions || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No commissions yet</TableCell></TableRow>
                  ) : (commissions || []).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.profiles?.full_name || "-"}</TableCell>
                      <TableCell>{c.prospects?.contact_name}<div className="text-xs text-muted-foreground">{c.prospects?.company}</div></TableCell>
                      <TableCell>{c.products?.name || "-"}</TableCell>
                      <TableCell>{formatRp(c.deal_value)}</TableCell>
                      <TableCell>{c.commission_percentage}%</TableCell>
                      <TableCell className="font-semibold">{formatRp(c.commission_amount)}</TableCell>
                      <TableCell><Badge className={`${BADGE[c.status]} text-white capitalize`}>{c.status}</Badge></TableCell>
                      <TableCell>
                        <Select value={c.status} onValueChange={(v) => updateCommission.mutate({ id: c.id, status: v })}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* Withdrawals */}
          <TabsContent value="withdrawals">
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Sales</TableHead><TableHead>Amount</TableHead><TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead><TableHead>Requested</TableHead><TableHead>Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(withdrawals || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No withdrawals</TableCell></TableRow>
                  ) : (withdrawals || []).map((w: any) => (
                    <TableRow key={w.id}>
                      <TableCell>{w.profiles?.full_name || "-"}</TableCell>
                      <TableCell className="font-semibold">{formatRp(w.amount)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{w.notes || "-"}</TableCell>
                      <TableCell><Badge className={`${BADGE[w.status]} text-white capitalize`}>{w.status}</Badge></TableCell>
                      <TableCell className="text-xs">{format(new Date(w.request_date), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {w.status === "requested" && (<>
                            <Button size="sm" variant="outline" onClick={() => updateWithdrawal.mutate({ id: w.id, status: "approved" })}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="outline" onClick={() => updateWithdrawal.mutate({ id: w.id, status: "rejected" })}><XCircle className="h-3.5 w-3.5" /></Button>
                          </>)}
                          {w.status === "approved" && (
                            <Button size="sm" onClick={() => updateWithdrawal.mutate({ id: w.id, status: "paid" })}><DollarSign className="h-3.5 w-3.5 mr-1" />Mark Paid</Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* Products */}
          <TabsContent value="products">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setProductOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead>Default %</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {(products || []).length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No products yet</TableCell></TableRow>
                  ) : (products || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.description || "-"}</TableCell>
                      <TableCell>{p.default_commission_percentage ? `${p.default_commission_percentage}%` : "-"}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => deleteProduct.mutate(p.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          {/* Rules */}
          <TabsContent value="rules">
            <div className="flex justify-end mb-4">
              <Button onClick={() => setRuleOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Rule</Button>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Priority: User+Product → Product Default → User Default → Global</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Product</TableHead><TableHead>%</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(rules || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No rules</TableCell></TableRow>
                    ) : (rules || []).map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.profiles?.full_name || <span className="text-muted-foreground italic">Any</span>}</TableCell>
                        <TableCell>{r.products?.name || <span className="text-muted-foreground italic">Any</span>}</TableCell>
                        <TableCell className="font-semibold">{r.commission_percentage}%</TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings */}
          <TabsContent value="settings">
            <Card>
              <CardHeader><CardTitle>Global Default Commission</CardTitle></CardHeader>
              <CardContent className="space-y-4 max-w-sm">
                <div>
                  <Label>Percentage (%)</Label>
                  <Input type="number" min="0" max="100" defaultValue={globalPct}
                    onBlur={(e) => { if (e.target.value !== globalPct) saveGlobal.mutate(e.target.value); }} />
                  <p className="text-xs text-muted-foreground mt-2">Used when no rule matches.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Product dialog */}
      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name *</Label><Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={2} /></div>
            <div><Label>Default Commission % (optional)</Label><Input type="number" min="0" max="100" value={productForm.default_commission_percentage} onChange={(e) => setProductForm({ ...productForm, default_commission_percentage: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProductOpen(false)}>Cancel</Button>
            <Button onClick={() => productForm.name && saveProduct.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Commission Rule</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>User (optional)</Label>
              <Select value={ruleForm.user_id} onValueChange={(v) => setRuleForm({ ...ruleForm, user_id: v })}>
                <SelectTrigger><SelectValue placeholder="Any user" /></SelectTrigger>
                <SelectContent>
                  {users?.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product (optional)</Label>
              <Select value={ruleForm.product_id} onValueChange={(v) => setRuleForm({ ...ruleForm, product_id: v })}>
                <SelectTrigger><SelectValue placeholder="Any product" /></SelectTrigger>
                <SelectContent>
                  {products?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Commission %</Label><Input type="number" min="0" max="100" value={ruleForm.commission_percentage} onChange={(e) => setRuleForm({ ...ruleForm, commission_percentage: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">At least one of User or Product must be selected.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleOpen(false)}>Cancel</Button>
            <Button onClick={() => saveRule.mutate()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
