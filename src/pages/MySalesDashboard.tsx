import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, Wallet, CheckCircle2, Clock, ThumbsUp } from "lucide-react";

const STATUS_LIST = ["new", "contacted", "meeting", "proposal", "negotiation", "won", "lost"];
const TEMP_LIST = ["cold", "warm", "hot"];

const formatRp = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

export default function MySalesDashboard() {
  const { data: userId } = useQuery({
    queryKey: ["session-uid"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.user.id ?? null;
    },
  });

  const { data: prospects } = useQuery({
    queryKey: ["my-dash-prospects", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await (supabase as any).from("prospects").select("*").eq("owner_id", userId);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: commissions } = useQuery({
    queryKey: ["my-dash-commissions", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await (supabase as any).from("commissions").select("*").eq("sales_id", userId);
      return data || [];
    },
    enabled: !!userId,
  });

  const { data: withdrawals } = useQuery({
    queryKey: ["my-dash-withdrawals", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await (supabase as any).from("withdrawals").select("*").eq("sales_id", userId);
      return data || [];
    },
    enabled: !!userId,
  });

  const totalProspect = prospects?.length || 0;
  const won = (prospects || []).filter((p: any) => p.status === "won");
  const totalRevenue = won.reduce((sum: number, p: any) => sum + (Number(p.final_value) || 0), 0);

  const sumByStatus = (s: string) =>
    (commissions || []).filter((c: any) => c.status === s).reduce((sum: number, c: any) => sum + Number(c.commission_amount), 0);

  const commPending = sumByStatus("pending");
  const commApproved = sumByStatus("approved");
  const commPaid = sumByStatus("paid");

  const totalWithdrawn = (withdrawals || [])
    .filter((w: any) => w.status === "paid")
    .reduce((sum: number, w: any) => sum + Number(w.amount), 0);

  const pendingWithdraw = (withdrawals || [])
    .filter((w: any) => w.status === "requested" || w.status === "approved")
    .reduce((sum: number, w: any) => sum + Number(w.amount), 0);

  const availableBalance = commApproved + commPaid - totalWithdrawn - pendingWithdraw;

  const pipelineCounts = STATUS_LIST.map((s) => ({
    status: s,
    count: (prospects || []).filter((p: any) => p.status === s).length,
  }));

  const tempCounts = TEMP_LIST.map((t) => ({
    temp: t,
    count: (prospects || []).filter((p: any) => p.temperature === t).length,
  }));

  const Stat = ({ icon: Icon, label, value, color }: any) => (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Sales Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your private performance overview</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat icon={Target} label="Total Prospect" value={totalProspect} color="bg-blue-500" />
          <Stat icon={CheckCircle2} label="Total Won" value={won.length} color="bg-green-500" />
          <Stat icon={TrendingUp} label="Total Revenue" value={formatRp(totalRevenue)} color="bg-purple-500" />
          <Stat icon={Wallet} label="Available Balance" value={formatRp(availableBalance)} color="bg-amber-500" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Pending Commission</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{formatRp(commPending)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ThumbsUp className="h-4 w-4" /> Approved</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{formatRp(commApproved)}</p></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Paid</CardTitle></CardHeader>
            <CardContent><p className="text-xl font-bold">{formatRp(commPaid)}</p></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Pipeline</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-3">
              {pipelineCounts.map((p) => (
                <div key={p.status} className="text-center p-3 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground capitalize">{p.status}</p>
                  <p className="text-xl font-bold mt-1">{p.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Temperature</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3">
              {tempCounts.map((t) => (
                <Badge key={t.temp} variant="outline" className="text-base py-2 px-4 capitalize">
                  {t.temp}: {t.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Available Balance</span><span className="font-semibold">{formatRp(availableBalance)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Pending Withdrawal</span><span>{formatRp(pendingWithdraw)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Total Withdrawn</span><span>{formatRp(totalWithdrawn)}</span></div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
