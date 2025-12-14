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

export function FinanceLedger() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [subTypeFilter, setSubTypeFilter] = useState<string>("all");

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
    const matchesSubType = subTypeFilter === "all" || entry.sub_type === subTypeFilter;

    return matchesSearch && matchesType && matchesSubType;
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

  const getSubTypeLabel = (subType: string) => {
    const labels: Record<string, string> = {
      payroll: "Payroll",
      reimburse: "Reimburse",
      operational: "Operational",
      project: "Project",
      other: "Other"
    };
    return labels[subType] || subType;
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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by notes, project, or client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subTypeFilter} onValueChange={setSubTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
              <SelectItem value="reimburse">Reimburse</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="project">Project</SelectItem>
              <SelectItem value="other">Other</SelectItem>
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
                      <Badge variant="outline">{getSubTypeLabel(entry.sub_type)}</Badge>
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
