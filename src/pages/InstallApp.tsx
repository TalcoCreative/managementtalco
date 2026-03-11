import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, Share, Plus, MoreVertical, Check, Bell, Settings } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useNavigate } from "react-router-dom";

export default function InstallApp() {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const navigate = useNavigate();

  const handleInstall = async () => {
    const success = await promptInstall();
    if (success) {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <img src="/pwa-512.png" alt="Talco" className="w-16 h-16 rounded-xl" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Install Talco App</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Pasang Talco Management System di perangkat Anda untuk akses cepat seperti aplikasi native
          </p>
        </div>

        {/* Install Button */}
        {isInstalled ? (
          <Card className="border-success/30 bg-success/5">
            <CardContent className="flex items-center justify-center gap-3 py-6">
              <Check className="h-6 w-6 text-success" />
              <span className="text-lg font-medium text-success">Talco sudah terpasang!</span>
            </CardContent>
          </Card>
        ) : isInstallable ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6">
              <Button onClick={handleInstall} size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Install Talco App
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardContent className="py-6 text-center text-muted-foreground">
              Tombol install akan muncul otomatis. Ikuti panduan manual di bawah.
            </CardContent>
          </Card>
        )}

        {/* Android Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-green-500" />
              Android (Chrome)
            </CardTitle>
            <CardDescription>Cara install di HP Android</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">1</span>
                <div>
                  <p className="font-medium">Buka Chrome</p>
                  <p className="text-sm text-muted-foreground">Kunjungi ms.talco.id di browser Chrome</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">2</span>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Tap menu</p>
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">(titik tiga di pojok kanan atas)</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">3</span>
                <div>
                  <p className="font-medium">Pilih "Install app" atau "Add to Home screen"</p>
                  <p className="text-sm text-muted-foreground">Ikuti petunjuk untuk menyelesaikan instalasi</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* iOS Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-blue-500" />
              iPhone / iPad (Safari)
            </CardTitle>
            <CardDescription>Cara install di perangkat Apple</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">1</span>
                <div>
                  <p className="font-medium">Buka Safari</p>
                  <p className="text-sm text-muted-foreground">Kunjungi ms.talco.id di browser Safari (bukan Chrome)</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">2</span>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Tap tombol Share</p>
                  <Share className="h-5 w-5 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">(kotak dengan panah ke atas)</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">3</span>
                <div className="flex items-center gap-2">
                  <p className="font-medium">Pilih "Add to Home Screen"</p>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">4</span>
                <div>
                  <p className="font-medium">Tap "Add" di pojok kanan atas</p>
                  <p className="text-sm text-muted-foreground">Aplikasi akan muncul di home screen Anda</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Desktop Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5 text-purple-500" />
              Desktop (Chrome / Edge)
            </CardTitle>
            <CardDescription>Cara install di komputer</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">1</span>
                <div>
                  <p className="font-medium">Buka ms.talco.id di Chrome atau Edge</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">2</span>
                <div>
                  <p className="font-medium">Klik ikon install di address bar</p>
                  <p className="text-sm text-muted-foreground">Biasanya ada ikon + atau komputer di pojok kanan address bar</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">3</span>
                <div>
                  <p className="font-medium">Klik "Install" pada popup</p>
                  <p className="text-sm text-muted-foreground">Aplikasi akan terpasang dan bisa diakses dari Start Menu / Applications</p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Enable Notifications */}
        <Card className="border-orange-500/30 bg-orange-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Aktifkan Push Notification
            </CardTitle>
            <CardDescription>Langkah penting setelah install agar tidak ketinggalan update</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-orange-500/10 p-4 text-sm text-foreground">
              <p className="font-semibold mb-2">⚠️ Setelah install, Anda WAJIB mengaktifkan notifikasi:</p>
              <ol className="space-y-3 mt-3">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-semibold text-xs">1</span>
                  <span>Buka aplikasi Talco dan login</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-semibold text-xs">2</span>
                  <span>Klik foto profil Anda → pilih <strong>"Profile Settings"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-semibold text-xs">3</span>
                  <span>Scroll ke bagian <strong>"Push Notifications"</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-semibold text-xs">4</span>
                  <span>Klik <strong>"Aktifkan Notifikasi"</strong> dan izinkan di browser</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-orange-500/20 text-orange-600 flex items-center justify-center font-semibold text-xs">5</span>
                  <span>Klik <strong>"Test Push Notification"</strong> untuk memastikan berhasil</span>
                </li>
              </ol>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={() => navigate("/profile-settings")}>
              <Settings className="h-4 w-4" />
              Buka Profile Settings
            </Button>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle>Keuntungan Install Talco App</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-3 md:grid-cols-2">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Akses cepat dari home screen</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Tampilan fullscreen tanpa address bar</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Bekerja offline untuk fitur dasar</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Loading lebih cepat</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Push notification real-time</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Pengalaman seperti native app</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Back Button */}
        <div className="text-center">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Kembali
          </Button>
        </div>
      </div>
    </div>
  );
}
