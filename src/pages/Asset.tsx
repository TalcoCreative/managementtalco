import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, QrCode, Search, Package, ScanLine, History, Filter } from "lucide-react";
import { CreateAssetDialog } from "@/components/asset/CreateAssetDialog";
import { AssetDetailDialog } from "@/components/asset/AssetDetailDialog";
import { QRScannerDialog } from "@/components/asset/QRScannerDialog";
import { AssetTransactionHistory } from "@/components/asset/AssetTransactionHistory";

interface Asset {
  id: string;
  name: string;
  code: string;
  category: string;
  default_location: string;
  condition: string;
  status: string;
  description: string | null;
  qr_code: string | null;
  current_holder_id: string | null;
  current_location: string | null;
  created_by: string;
  created_at: string;
  current_holder?: {
    full_name: string;
  } | null;
  creator?: {
    full_name: string;
  } | null;
}

export default function Asset() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [scannerDialogOpen, setScannerDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Check user role for permissions
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-asset"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.session.user.id);
      if (error) throw error;
      return data?.map(r => r.role) || [];
    },
  });

  const canManageAssets = userRoles?.includes('super_admin') || 
                          userRoles?.includes('hr') || 
                          userRoles?.includes('project_manager');

  // Fetch assets
  const { data: assets, isLoading, refetch } = useQuery({
    queryKey: ["assets", statusFilter, categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from("assets")
        .select(`
          *,
          current_holder:profiles!assets_current_holder_id_fkey(full_name),
          creator:profiles!assets_created_by_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter !== "all") {
        query = query.eq("category", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Asset[];
    },
  });

  // Get unique categories
  const categories = [...new Set(assets?.map(a => a.category) || [])];

  // Filter assets by search query
  const filteredAssets = assets?.filter(asset => 
    asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Available</Badge>;
      case 'borrowed':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Borrowed</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Lost</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getConditionBadge = (condition: string) => {
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

  // Stats
  const stats = {
    total: assets?.length || 0,
    available: assets?.filter(a => a.status === 'available').length || 0,
    borrowed: assets?.filter(a => a.status === 'borrowed').length || 0,
    lost: assets?.filter(a => a.status === 'lost').length || 0,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Asset Management</h1>
            <p className="text-muted-foreground">Kelola dan tracking barang kantor dengan QR Code</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setScannerDialogOpen(true)}
              className="gap-2"
            >
              <ScanLine className="h-4 w-4" />
              Scan QR
            </Button>
            {canManageAssets && (
              <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Asset
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Assets</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <div className="h-3 w-3 rounded-full bg-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.available}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Borrowed</CardTitle>
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.borrowed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lost</CardTitle>
              <div className="h-3 w-3 rounded-full bg-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500">{stats.lost}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list" className="gap-2">
              <Package className="h-4 w-4" />
              Asset List
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Transaction History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari nama atau kode barang..."
                      className="pl-10"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="borrowed">Borrowed</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Assets Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kode</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Kondisi</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Pemegang</TableHead>
                      <TableHead>QR</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8">
                          Loading...
                        </TableCell>
                      </TableRow>
                    ) : filteredAssets?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          Tidak ada asset ditemukan
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets?.map((asset) => (
                        <TableRow key={asset.id}>
                          <TableCell className="font-mono text-sm">{asset.code}</TableCell>
                          <TableCell className="font-medium">{asset.name}</TableCell>
                          <TableCell>{asset.category}</TableCell>
                          <TableCell>{getStatusBadge(asset.status)}</TableCell>
                          <TableCell>{getConditionBadge(asset.condition)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {asset.current_location || asset.default_location}
                          </TableCell>
                          <TableCell>
                            {asset.current_holder?.full_name || "-"}
                          </TableCell>
                          <TableCell>
                            {asset.qr_code ? (
                              <QrCode className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedAsset(asset);
                                setDetailDialogOpen(true);
                              }}
                            >
                              Detail
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

          <TabsContent value="history">
            <AssetTransactionHistory />
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <CreateAssetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={() => refetch()}
      />

      <AssetDetailDialog
        asset={selectedAsset}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        onUpdate={() => refetch()}
        canManage={canManageAssets || false}
      />

      <QRScannerDialog
        open={scannerDialogOpen}
        onOpenChange={setScannerDialogOpen}
        onAssetFound={(asset) => {
          setScannerDialogOpen(false);
          setSelectedAsset(asset);
          setDetailDialogOpen(true);
        }}
      />
    </AppLayout>
  );
}
