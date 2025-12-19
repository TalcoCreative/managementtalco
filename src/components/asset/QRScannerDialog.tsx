import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Search, QrCode } from "lucide-react";

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

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssetFound: (asset: Asset) => void;
}

export function QRScannerDialog({ open, onOpenChange, onAssetFound }: QRScannerDialogProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    };
  }, []);

  const startScanning = async () => {
    if (!containerRef.current) return;

    try {
      scannerRef.current = new Html5Qrcode("qr-reader");
      setIsScanning(true);

      await scannerRef.current.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        async (decodedText) => {
          await handleQRCode(decodedText);
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      );
    } catch (error: any) {
      console.error("Scanner error:", error);
      toast.error("Tidak dapat mengakses kamera");
      setIsScanning(false);
    }
  };

  const stopScanning = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (error) {
        console.error("Stop scanner error:", error);
      }
    }
    setIsScanning(false);
  };

  const handleQRCode = async (qrData: string) => {
    await stopScanning();

    try {
      // Try to parse QR data
      let assetCode = "";
      try {
        const parsed = JSON.parse(qrData);
        if (parsed.type === "asset" && parsed.code) {
          assetCode = parsed.code;
        }
      } catch {
        // If not JSON, assume it's the asset code directly
        assetCode = qrData;
      }

      if (!assetCode) {
        toast.error("QR Code tidak valid");
        return;
      }

      await searchAsset(assetCode);
    } catch (error: any) {
      toast.error(error.message || "Gagal memproses QR Code");
    }
  };

  const searchAsset = async (code: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("assets")
        .select(`
          *,
          current_holder:profiles!assets_current_holder_id_fkey(full_name),
          creator:profiles!assets_created_by_fkey(full_name)
        `)
        .eq("code", code.trim())
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          toast.error("Asset tidak ditemukan");
        } else {
          throw error;
        }
        return;
      }

      toast.success(`Asset ditemukan: ${data.name}`);
      onAssetFound(data as Asset);
    } catch (error: any) {
      toast.error(error.message || "Gagal mencari asset");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSearch = async () => {
    if (!manualCode.trim()) {
      toast.error("Masukkan kode barang");
      return;
    }
    await searchAsset(manualCode);
  };

  const handleClose = async () => {
    await stopScanning();
    setManualCode("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scan QR / Cari Asset
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="scan" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scan" className="gap-2">
              <Camera className="h-4 w-4" />
              Scan QR
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <Search className="h-4 w-4" />
              Cari Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" className="mt-4">
            <div className="space-y-4">
              <div
                id="qr-reader"
                ref={containerRef}
                className="w-full aspect-square bg-muted rounded-lg overflow-hidden"
              />
              
              {!isScanning ? (
                <Button onClick={startScanning} className="w-full gap-2">
                  <Camera className="h-4 w-4" />
                  Mulai Scan
                </Button>
              ) : (
                <Button onClick={stopScanning} variant="outline" className="w-full">
                  Stop Scan
                </Button>
              )}

              <p className="text-sm text-muted-foreground text-center">
                Arahkan kamera ke QR Code pada barang
              </p>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <div className="space-y-4">
              <div>
                <Label>Kode Barang</Label>
                <Input
                  placeholder="Contoh: AST-XXX-XXX"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleManualSearch();
                    }
                  }}
                />
              </div>
              <Button 
                onClick={handleManualSearch} 
                className="w-full gap-2"
                disabled={isSearching}
              >
                <Search className="h-4 w-4" />
                {isSearching ? "Mencari..." : "Cari Asset"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
