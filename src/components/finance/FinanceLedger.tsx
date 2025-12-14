import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Search, BookOpen, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
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

    return matchesSearch && matchesType && matchesCategory && matchesSubCategory;
  });

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
          Ledger (Read-Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="relative col-span-2 md:col-span-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setSubCategoryFilter("all"); }}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {FINANCE_CATEGORIES.map(cat => (
                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subCategoryFilter} onValueChange={setSubCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Sub-Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sub-Categories</SelectItem>
              {(categoryFilter === "all" 
                ? allSubCategories 
                : FINANCE_CATEGORIES.find(c => c.value === categoryFilter)?.subCategories || []
              ).map(sub => (
                <SelectItem key={sub.value} value={sub.value}>{sub.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </Card>
  );
}
