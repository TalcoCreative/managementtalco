import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "sonner";
import { Eye, EyeOff, Globe, Lock, User } from "lucide-react";

function LanguageCard() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600/15 to-cyan-600/15 flex items-center justify-center">
            <Globe className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <CardTitle className="text-base">{t("Language", "Bahasa")}</CardTitle>
            <CardDescription>{t("Choose your preferred system language", "Pilih bahasa sistem yang diinginkan")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3">
          <Button
            variant={language === "en" ? "default" : "outline"}
            onClick={() => setLanguage("en")}
            className="flex-1 gap-2"
          >
            🇬🇧 English
          </Button>
          <Button
            variant={language === "id" ? "default" : "outline"}
            onClick={() => setLanguage("id")}
            className="flex-1 gap-2"
          >
            🇮🇩 Bahasa Indonesia
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChangePasswordCard() {
  const { t } = useLanguage();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error(t("Password must be at least 6 characters", "Password minimal 6 karakter"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("Passwords do not match", "Password tidak cocok"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success(t("Password updated successfully", "Password berhasil diubah"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || t("Failed to update password", "Gagal mengubah password"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-600/15 to-red-600/15 flex items-center justify-center">
            <Lock className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-base">{t("Change Password", "Ubah Password")}</CardTitle>
            <CardDescription>{t("Update your account password", "Perbarui password akun Anda")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>{t("New Password", "Password Baru")}</Label>
          <div className="relative">
            <Input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("Confirm Password", "Konfirmasi Password")}</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleChangePassword} disabled={loading || !newPassword || !confirmPassword} className="gap-2">
            <Lock className="h-4 w-4" />
            {loading ? t("Updating...", "Mengubah...") : t("Update Password", "Ubah Password")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfileSettings() {
  const { t } = useLanguage();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("Profile Settings", "Pengaturan Profil")}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t("Manage your personal preferences", "Kelola preferensi pribadi Anda")}</p>
          </div>
        </div>

        <LanguageCard />
        <ChangePasswordCard />
      </div>
    </AppLayout>
  );
}
