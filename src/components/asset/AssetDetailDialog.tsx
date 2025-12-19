import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Download, QrCode, ArrowRightLeft, History, Package, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CheckoutDialog } from "./CheckoutDialog";
import { CheckinDialog } from "./CheckinDialog";
import { DeleteConfirmDialog } from "@/components/shared/DeleteConfirmDialog";

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

interface AssetDetailDialogProps {
  asset: Asset | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  canManage: boolean;
}

export function AssetDetailDialog({ 
  asset, 
  open, 
  onOpenChange, 
  onUpdate,
  canManage 
}: AssetDetailDialogProps) {
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkinDialogOpen, setCheckinDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch transaction history for this asset
  const { data: transactions } = useQuery({
    queryKey: ["asset-transactions", asset?.id],
    queryFn: async () => {
      if (!asset?.id) return [];
      const { data, error } = await supabase
        .from("asset_transactions")
        .select(`
          *,
          checkout_user:profiles!asset_transactions_checkout_by_fkey(full_name),
          used_user:profiles!asset_transactions_used_by_fkey(full_name),
          checkin_user:profiles!asset_transactions_checkin_by_fkey(full_name)
        `)
        .eq("asset_id", asset.id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!asset?.id && open,
  });

  if (!asset) return null;

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

  const downloadQR = () => {
    if (!asset.qr_code) return;
    
    const svg = document.getElementById("detail-qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `QR-${asset.code}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", asset.id);

      if (error) throw error;

      toast.success("Asset berhasil dihapus");
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Gagal menghapus asset");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {asset.name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="detail" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="detail">Detail</TabsTrigger>
              <TabsTrigger value="qr">QR Code</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="detail" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Kode Barang</p>
                  <p className="font-mono font-medium">{asset.code}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kategori</p>
                  <p className="font-medium">{asset.category}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(asset.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kondisi</p>
                  {getConditionBadge(asset.condition)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lokasi Saat Ini</p>
                  <p className="font-medium">{asset.current_location || asset.default_location}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pemegang Saat Ini</p>
                  <p className="font-medium">{asset.current_holder?.full_name || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Lokasi Default</p>
                  <p className="font-medium">{asset.default_location}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Dibuat Oleh</p>
                  <p className="font-medium">{asset.creator?.full_name || "-"}</p>
                </div>
              </div>

              {asset.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Deskripsi</p>
                  <p className="text-sm">{asset.description}</p>
                </div>
              )}

              <Separator />

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {asset.status === 'available' && (
                  <Button onClick={() => setCheckoutDialogOpen(true)} className="gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Checkout (Ambil Barang)
                  </Button>
                )}
                {asset.status === 'borrowed' && (
                  <Button onClick={() => setCheckinDialogOpen(true)} className="gap-2">
                    <ArrowRightLeft className="h-4 w-4" />
                    Check-in (Kembalikan)
                  </Button>
                )}
                {canManage && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setDeleteDialogOpen(true)}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus Asset
                  </Button>
                )}
              </div>
            </TabsContent>

            <TabsContent value="qr" className="mt-4">
              {asset.qr_code ? (
                <Card>
                  <CardContent className="pt-6 flex flex-col items-center">
                    <QRCodeSVG
                      id="detail-qr-code-svg"
                      value={asset.qr_code}
                      size={200}
                      level="H"
                      includeMargin
                    />
                    <p className="mt-4 font-mono text-sm text-muted-foreground">
                      {asset.code}
                    </p>
                    <Button onClick={downloadQR} className="mt-4 gap-2">
                      <Download className="h-4 w-4" />
                      Download QR
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  QR Code belum tersedia
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <div className="space-y-3">
                {transactions?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Belum ada riwayat transaksi
                  </div>
                ) : (
                  transactions?.map((tx) => (
                    <Card key={tx.id}>
                      <CardContent className="py-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <Badge variant={tx.transaction_type === 'checkout' ? 'default' : 'secondary'}>
                              {tx.transaction_type === 'checkout' ? 'Checkout' : 'Check-in'}
                            </Badge>
                            <div className="mt-2 text-sm space-y-1">
                              {tx.transaction_type === 'checkout' ? (
                                <>
                                  <p>Diambil oleh: <span className="font-medium">{tx.checkout_user?.full_name}</span></p>
                                  {tx.used_user && tx.used_by !== tx.checkout_by && (
                                    <p>Dipakai oleh: <span className="font-medium">{tx.used_user?.full_name}</span></p>
                                  )}
                                  <p>Lokasi: <span className="text-muted-foreground">{tx.checkout_location}</span></p>
                                </>
                              ) : (
                                <>
                                  <p>Dikembalikan oleh: <span className="font-medium">{tx.checkin_user?.full_name}</span></p>
                                  <p>Lokasi: <span className="text-muted-foreground">{tx.checkin_location}</span></p>
                                  <p>Kondisi: {getConditionBadge(tx.condition_after || 'baik')}</p>
                                </>
                              )}
                              {tx.notes && (
                                <p className="text-muted-foreground">Catatan: {tx.notes}</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {tx.transaction_type === 'checkout' && tx.checkout_at && (
                              <p>{format(new Date(tx.checkout_at), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                            )}
                            {tx.transaction_type === 'checkin' && tx.checkin_at && (
                              <p>{format(new Date(tx.checkin_at), "dd MMM yyyy HH:mm", { locale: idLocale })}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <CheckoutDialog
        asset={asset}
        open={checkoutDialogOpen}
        onOpenChange={setCheckoutDialogOpen}
        onSuccess={() => {
          onUpdate();
          setCheckoutDialogOpen(false);
        }}
      />

      <CheckinDialog
        asset={asset}
        open={checkinDialogOpen}
        onOpenChange={setCheckinDialogOpen}
        onSuccess={() => {
          onUpdate();
          setCheckinDialogOpen(false);
        }}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Asset"
        description={`Apakah Anda yakin ingin menghapus asset "${asset.name}"? Semua riwayat transaksi juga akan dihapus.`}
      />
    </>
  );
}
