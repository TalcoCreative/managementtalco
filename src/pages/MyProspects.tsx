import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CreateProspectDialog } from "@/components/prospects/CreateProspectDialog";
import { ProspectDetailDialog } from "@/components/prospects/ProspectDetailDialog";

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "negotiation", label: "Negotiation" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STATUS_COLOR: Record<string, string> = {
  new: "bg-blue-500", contacted: "bg-yellow-500", meeting: "bg-purple-500",
  proposal: "bg-orange-500", negotiation: "bg-indigo-500", won: "bg-green-500", lost: "bg-red-500",
};

export default function MyProspects() {
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);

  const { data: userId } = useQuery({
    queryKey: ["session-uid"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },
  });

  const qc = useQueryClient();

  const { data: prospects, isLoading } = useQuery({
    queryKey: ["my-prospects", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("prospects")
        .select("*, products(name)")
        .eq("owner_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await (supabase as any).from("prospects").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-prospects", userId] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to update"),
  });

  const filtered = (prospects || []).filter((p: any) =>
    !searchQuery ||
    p.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatRp = (n: number | null) =>
    n ? new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n) : "-";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">My Prospects</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your private sales pipeline</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />Add Prospect
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or company..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Estimated</TableHead>
                  <TableHead>Final</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No prospects yet</TableCell></TableRow>
                ) : filtered.map((p: any) => (
                  <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(p)}>
                    <TableCell className="font-medium">{p.contact_name}</TableCell>
                    <TableCell>{p.company || "-"}</TableCell>
                    <TableCell>{p.products?.name || "-"}</TableCell>
                    <TableCell>{formatRp(p.estimated_value)}</TableCell>
                    <TableCell>{formatRp(p.final_value)}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select value={p.status} onValueChange={(v) => updateStatus.mutate({ id: p.id, status: v })}>
                        <SelectTrigger className="h-8 w-[140px]">
                          <SelectValue>
                            <Badge className={`${STATUS_COLOR[p.status] || "bg-gray-500"} text-white capitalize`}>{p.status}</Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {p.deal_status ? <Badge variant="outline">{p.deal_status}</Badge> : "-"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(p.created_at), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <CreateProspectDialog open={createOpen} onOpenChange={setCreateOpen} salesMode />
      {selected && (
        <ProspectDetailDialog
          prospect={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      )}
    </AppLayout>
  );
}
