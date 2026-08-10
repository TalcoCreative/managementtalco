import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Session } from "@supabase/supabase-js";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const guardAndRedirect = async (sess: Session | null) => {
      if (!sess) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", sess.user.id)
        .maybeSingle();
      if (!prof || prof.status === "non_active") {
        await supabase.auth.signOut();
        toast.error(
          "Akun Anda tidak terdaftar atau sudah dinonaktifkan. Silakan menghubungi management."
        );
        return;
      }
      navigate("/clients");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (session) {
          guardAndRedirect(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        guardAndRedirect(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      if (signInData.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", signInData.user.id)
          .maybeSingle();
        if (!prof || prof.status === "non_active") {
          await supabase.auth.signOut();
          toast.error(
            "Akun Anda tidak terdaftar atau sudah dinonaktifkan. Silakan menghubungi management."
          );
          setLoading(false);
          return;
        }
      }
      toast.success("Logged in successfully!");
    } catch (error: any) {
      toast.error(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/20 via-background to-secondary/20 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">
            Talco Creative Indonesia
          </CardTitle>
          <CardDescription className="text-base">
            Management System
          </CardDescription>
          <p className="text-sm text-muted-foreground mt-2">
            Sign in to your account
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Loading..." : "Sign In"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Akun hanya dibuat oleh admin. Hubungi management jika belum punya akses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
