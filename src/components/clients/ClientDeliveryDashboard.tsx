import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Settings2, RefreshCw, Target, Info } from 'lucide-react';
import { toast } from 'sonner';
import { achievement, cyclePeriod, DELIVERY_METRICS, jakartaToday, resolvedTargets, type Targets } from '@/lib/client-delivery';
import type { Tables } from '@/integrations/supabase/types';

export function ClientDeliveryDashboard({ client }: { client: Tables<'clients'> }) {
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState('period');
  const [day, setDay] = useState(client.quota_cycle_day);
  const [draft, setDraft] = useState<Targets>({});
  const [saving, setSaving] = useState(false);
  const period = cyclePeriod(client.quota_cycle_day, jakartaToday(), offset);
  const defaults = (client.quota_default_targets ?? {}) as Targets;
  const editable = !permissions.isLoading && (permissions.canEdit('clients') || permissions.isSuperAdmin);
  const key = ['client-delivery',client.id,period.start,period.end];
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [actual, override] = await Promise.all([
        supabase.rpc('client_delivery_actuals',{p_client_id:client.id,p_start:period.start,p_end:period.end}),
        supabase.from('client_quota_periods').select('*').eq('client_id',client.id).eq('period_start',period.start).eq('period_end',period.end).maybeSingle(),
      ]);
      if (actual.error) throw actual.error;
      if (override.error) throw override.error;
      return { actual: actual.data as Targets, override: override.data };
    },
  });
  const targets = resolvedTargets(defaults,data?.override?.targets as Targets | undefined);
  function edit() { setScope('period'); setDay(client.quota_cycle_day); setDraft({...targets}); setOpen(true); }
  async function save() {
    if (!Number.isInteger(day) || day < 1 || day > 31 || Object.values(draft).some(v => !Number.isFinite(v) || v < 0)) {
      toast.error('Enter a valid cycle day and non-negative targets.'); return;
    }
    setSaving(true);
    try {
      const result = scope === 'default'
        ? await supabase.from('clients').update({quota_cycle_day:day,quota_default_targets:draft}).eq('id',client.id)
        : await supabase.from('client_quota_periods').upsert({client_id:client.id,period_start:period.start,period_end:period.end,targets:draft,updated_at:new Date().toISOString()},{onConflict:'client_id,period_start'});
      if (result.error) throw result.error;
      await Promise.all([queryClient.invalidateQueries({queryKey:['client',client.id]}),queryClient.invalidateQueries({queryKey:['client-delivery',client.id]})]);
      toast.success('Targets saved'); setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Unable to save targets'); }
    finally { setSaving(false); }
  }
  async function reset() {
    if (!data?.override) return;
    setSaving(true);
    const result = await supabase.from('client_quota_periods').delete().eq('id',data.override.id);
    setSaving(false);
    if (result.error) { toast.error(result.error.message); return; }
    await queryClient.invalidateQueries({queryKey:key});
    toast.success('Recurring targets restored'); setOpen(false);
  }
  const number = (value: number, currency = false) => currency
    ? new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(value)
    : new Intl.NumberFormat('id-ID').format(value);
  return <section className="space-y-5 border-b pb-6" aria-label="Delivery targets">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-xl font-semibold"><Target className="h-5 w-5 text-primary"/>Delivery targets</h2>
        <p className="text-sm text-muted-foreground">{data?.override ? 'Custom period targets' : 'Recurring targets'} · Cycle starts on day {client.quota_cycle_day}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous period" onClick={()=>setOffset(v=>v-1)}><ChevronLeft className="h-4 w-4"/></Button>
        <span className="text-sm font-medium">{period.start} — {period.end}</span>
        <Button variant="outline" size="icon" aria-label="Next period" onClick={()=>setOffset(v=>v+1)}><ChevronRight className="h-4 w-4"/></Button>
        {offset !== 0 && <Button variant="ghost" onClick={()=>setOffset(0)}>Current</Button>}
        <Button variant="ghost" size="icon" aria-label="Refresh achievements" disabled={isFetching} onClick={()=>refetch()}><RefreshCw className="h-4 w-4"/></Button>
        {editable && <Button variant="outline" onClick={edit}><Settings2 className="mr-2 h-4 w-4"/>Set targets</Button>}
      </div>
    </div>
    {error ? <p role="alert" className="text-destructive">Unable to load achievements. <Button variant="link" onClick={()=>refetch()}>Retry</Button></p>
    : isLoading ? <p className="text-muted-foreground">Loading achievements…</p>
    : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {DELIVERY_METRICS.map(metric=>{
        const target = targets[metric.key] ?? 0, actual = data?.actual[metric.key] ?? 0;
        const {remaining,percentage} = achievement(target,actual);
        const currency = 'currency' in metric && metric.currency === true;
        return <div key={metric.key} className="min-w-0 rounded-2xl border bg-card p-4 text-card-foreground">
          <div className="flex items-center justify-between gap-2"><h3 className="font-medium">{metric.label}</h3><span title={metric.source}><Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-label={metric.source}/></span></div>
          <p className="my-3 break-words text-2xl font-semibold">{number(actual,currency)}</p>
          <Progress value={percentage} className="h-1.5"/>
          <div className="mt-3 space-y-1 text-sm"><p className="text-muted-foreground">Target: {target > 0 ? number(target,currency) : 'Not set'}</p>
            {target > 0 && <p className={remaining > 0 ? 'text-warning' : 'text-success'}>{remaining > 0 ? `${number(remaining,currency)} remaining` : 'Target achieved'}</p>}</div>
        </div>;
      })}
    </div>}
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>Content: published EP only, by publish date (Jakarta). Graphics includes feeds and carousels; these counters overlap.</p>
      <p>Ads spend: dated Ads Budget spending transactions. Reports and leads: only complete reporting ranges inside this period; no daily estimates.</p>
      {(data?.actual.partial_reports ?? 0)>0 && <p className="text-warning">{data?.actual.partial_reports} overlapping reports excluded: their reporting ranges cross this period’s boundaries.</p>}
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>Delivery targets</DialogTitle></DialogHeader>
      <Label>Apply to</Label><Select value={scope} onValueChange={v=>{setScope(v);setDraft({... (v==='default' ? defaults : targets)});}}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="period">This period only</SelectItem><SelectItem value="default">Recurring defaults</SelectItem></SelectContent></Select>
      {scope==='default' ? <div className="space-y-2"><Label htmlFor="cycle-day">Cycle start day (1–31)</Label><Input id="cycle-day" type="number" min={1} max={31} value={day} onChange={e=>setDay(Number(e.target.value))}/></div> : <p className="text-sm text-muted-foreground">{period.start} — {period.end}</p>}
      <div className="grid grid-cols-2 gap-4">{DELIVERY_METRICS.map(metric=><div key={metric.key} className="space-y-2"><Label htmlFor={`target-${metric.key}`}>{metric.label}{'currency' in metric ? ' (IDR)' : ''}</Label><Input id={`target-${metric.key}`} type="number" min={0} step={1} value={draft[metric.key] ?? 0} onChange={e=>setDraft(v=>({...v,[metric.key]:Number(e.target.value)}))}/></div>)}</div>
      <div className="flex flex-wrap justify-end gap-2">{scope==='period' && data?.override && <Button variant="ghost" disabled={saving} onClick={reset}>Use recurring defaults</Button>}<Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save targets'}</Button></div>
    </DialogContent></Dialog>
  </section>;
}