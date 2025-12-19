import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Search } from "lucide-react";

export function AssetTransactionHistory() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: transactions, isLoading } = useQuery({
    queryKey: ["all-asset-transactions", typeFilter],
    queryFn: async () => {
      let query = supabase
        .from("asset_transactions")
        .select(`
          *,
          asset:assets(name, code),
          checkout_user:profiles!asset_transactions_checkout_by_fkey(full_name),
          used_user:profiles!asset_transactions_used_by_fkey(full_name),
          checkin_user:profiles!asset_transactions_checkin_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (typeFilter !== "all") {
        query = query.eq("transaction_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const filteredTransactions = transactions?.filter(tx => {
    const searchLower = searchQuery.toLowerCase();
    return (
      tx.asset?.name?.toLowerCase().includes(searchLower) ||
      tx.asset?.code?.toLowerCase().includes(searchLower) ||
      tx.checkout_user?.full_name?.toLowerCase().includes(searchLower) ||
      tx.checkin_user?.full_name?.toLowerCase().includes(searchLower) ||
      tx.used_user?.full_name?.toLowerCase().includes(searchLower)
    );
  });

  const getConditionBadge = (condition: string | null) => {
    if (!condition) return null;
    switch (condition) {
      case 'baik':
        return <Badge variant="outline" className="text-green-400 border-green-500/30">Baik</Badge>;
      case 'rusak':
        return <Badge variant="outline" className="text-red-400 border-red-500/30">Rusak</Badge>;
      case 'maintenance':
        return <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">Maintenance</Badge>;
      default:
        return <Badge variant="outline">{condition}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama barang, kode, atau user..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipe Transaksi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Transaksi</SelectItem>
                <SelectItem value="checkout">Checkout</SelectItem>
                <SelectItem value="checkin">Check-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Barang</TableHead>
                <TableHead>Oleh</TableHead>
                <TableHead>Dipakai / Dititipkan</TableHead>
                <TableHead>Lokasi</TableHead>
                <TableHead>Kondisi</TableHead>
                <TableHead>Catatan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredTransactions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Tidak ada riwayat transaksi
                  </TableCell>
                </TableRow>
              ) : (
                filteredTransactions?.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">
                      {tx.transaction_type === 'checkout' && tx.checkout_at ? (
                        format(new Date(tx.checkout_at), "dd MMM yyyy HH:mm", { locale: idLocale })
                      ) : tx.checkin_at ? (
                        format(new Date(tx.checkin_at), "dd MMM yyyy HH:mm", { locale: idLocale })
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.transaction_type === 'checkout' ? 'default' : 'secondary'}>
                        {tx.transaction_type === 'checkout' ? 'Checkout' : 'Check-in'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{tx.asset?.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{tx.asset?.code}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {tx.transaction_type === 'checkout' 
                        ? tx.checkout_user?.full_name 
                        : tx.checkin_user?.full_name}
                    </TableCell>
                    <TableCell>
                      {tx.transaction_type === 'checkout' && tx.used_user 
                        ? tx.used_user.full_name 
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {tx.transaction_type === 'checkout' 
                        ? tx.checkout_location 
                        : tx.checkin_location}
                    </TableCell>
                    <TableCell>
                      {tx.transaction_type === 'checkin' 
                        ? getConditionBadge(tx.condition_after)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {tx.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
