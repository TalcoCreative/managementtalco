import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { Search, BookOpen, ArrowUpCircle, ArrowDownCircle, Trash2, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { 
  FINANCE_CATEGORIES, 
  getMainCategoryLabel, 
  getSubCategoryLabel,
  getAllSubCategories 
} from "@/lib/finance-categories";

export function FinanceLedger() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: ledgerEntries, isLoading } = useQuery({
    queryKey: ["finance-ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*, projects(title), clients(name)")
        .order("date", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const filteredEntries = ledgerEntries?.filter(entry => {
    const matchesSearch = 
      entry.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.projects?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "all" || entry.type === typeFilter;
    const matchesCategory = categoryFilter === "all" || entry.sub_type === categoryFilter;
    const matchesSubCategory = subCategoryFilter === "all" || entry.sub_category === subCategoryFilter;
    const matchesDateRange = entry.date >= startDate && entry.date <= endDate;

    return matchesSearch && matchesType && matchesCategory && matchesSubCategory && matchesDateRange;
  });

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;
    
    try {
      // Also delete related payroll/expense if exists
      if (entryToDelete.source === "payroll") {
        await supabase
          .from("payroll")
          .update({ ledger_entry_id: null, status: "planned", paid_at: null })
          .eq("ledger_entry_id", entryToDelete.id);
        
        await supabase
          .from("expenses")
          .delete()
          .eq("ledger_entry_id", entryToDelete.id);
      }

      const { error } = await supabase
        .from("ledger_entries")
        .delete()
        .eq("id", entryToDelete.id);

      if (error) throw error;

      toast.success("Entry ledger berhasil dihapus");
      setDeleteDialogOpen(false);
      setEntryToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus entry");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const getTypeColor = (type: string) => {
    return type === "income" ? "bg-green-500" : "bg-destructive";
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      payroll: "Payroll",
      reimburse: "Reimburse",
      recurring: "Recurring",
      manual: "Manual",
      income: "Income"
    };
    return labels[source] || source;
  };

  const allSubCategories = getAllSubCategories();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          Ledger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <Label className="text-sm mb-2 block">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
          </div>
          <div className="min-w-[120px]">
            <Label className="text-sm mb-2 block">Dari</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="min-w-[120px]">
            <Label className="text-sm mb-2 block">Sampai</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div className="min-w-[120px]">
            <Label className="text-sm mb-2 block">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <Label className="text-sm mb-2 block">Category</Label>
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubCategoryFilter("all"); }}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {FINANCE_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : filteredEntries && filteredEntries.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Project/Client</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(entry.date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {entry.type === "income" ? (
                          <ArrowUpCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <ArrowDownCircle className="h-4 w-4 text-destructive" />
                        )}
                        <Badge className={getTypeColor(entry.type)}>
                          {entry.type === "income" ? "Income" : "Expense"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline">{getMainCategoryLabel(entry.sub_type)}</Badge>
                        {entry.sub_category && (
                          <div className="text-xs text-muted-foreground">
                            {getSubCategoryLabel(entry.sub_type, entry.sub_category)}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {entry.projects?.title && <div>{entry.projects.title}</div>}
                        {entry.clients?.name && (
                          <div className="text-muted-foreground">{entry.clients.name}</div>
                        )}
                        {!entry.projects?.title && !entry.clients?.name && "-"}
                      </div>
                    </TableCell>
                    <TableCell className={`text-right font-medium ${entry.type === "income" ? "text-green-500" : "text-destructive"}`}>
                      {entry.type === "income" ? "+" : "-"}{formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getSourceLabel(entry.source)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {entry.notes || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setEntryToDelete(entry);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No ledger entries found</p>
          </div>
        )}
      </CardContent>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Entry Ledger</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus entry ini?
              {entryToDelete?.source === "payroll" && (
                <span className="block mt-2 text-yellow-600">
                  Entry ini berasal dari Payroll. Status payroll terkait akan dikembalikan ke "Planned".
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEntry}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}