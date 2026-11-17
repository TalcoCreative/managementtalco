import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HardDriveUpload, Square, Link2, Trash2, RefreshCw, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

type Status = { pending: number; pending_mb: number; done: number; failed: number; links_pending: number; cleanup_pending: number };
type Log = { time: Date; text: string; tone?: "error" | "ok" };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("migrate-storage-to-drive", { body });
  if (error) {
    const details = (error as any).context?.text ? await (error as any).context.text() : error.message;
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function DriveBackupCard() {
  const qc = useQueryClient();
  const [running, setRunning] = useState<null | "migrate" | "apply" | "cleanup">(null);
  const [logs, setLogs] = useState<Log[]>([]);
  const stopRef = useRef(false);
  const log = (text: string, tone?: Log["tone"]) => setLogs((l) => [{ time: new Date(), text, tone }, ...l].slice(0, 300));

  const { data: status, refetch } = useQuery({
    queryKey: ["drive-backup-status"],
    queryFn: async () => (await call({ action: "status" })) as Status,
  });

  const { data: history } = useQuery({
    queryKey: ["drive-backup-history"],
    queryFn: async () => {
      const { data } = await supabase.from("storage_drive_map" as any)
        .select("bucket,path,drive_url,error,created_at,applied,cloud_deleted")
        .order("created_at", { ascending: false }).limit(100);
      return (data ?? []) as any[];
    },
  });

  const refresh = () => { refetch(); qc.invalidateQueries({ queryKey: ["drive-backup-history"] }); };

  const loop = async (kind: "migrate" | "apply" | "cleanup") => {
    stopRef.current = false;
    setRunning(kind);
    try {
      while (!stopRef.current) {
        if (kind === "migrate") {
          const r = await call({ action: "migrate", limit: 10 });
          if (r.rateLimited) { log("Google Drive asked to slow down — waiting 60 seconds…"); await sleep(65000); continue; }
          if (!r.processed) { log("All files copied to Drive.", "ok"); break; }
          log(`Copied ${r.ok} of ${r.processed} files to Drive`, r.ok < r.processed ? "error" : "ok");
        } else if (kind === "apply") {
          const s = (await call({ action: "status" })) as Status;
          if (!s.links_pending) { log("All links in the app now point to Drive.", "ok"); break; }
          const r = await call({ action: "apply" });
          log(`Updated ${r.updated} saved links (${s.links_pending} files left)`, "ok");
        } else {
          const r = await call({ action: "cleanup" });
          if (!r.removed) { log("Old Cloud copies removed.", "ok"); break; }
          log(`Removed ${r.removed} old Cloud copies`, "ok");
        }
        refresh();
      }
      if (stopRef.current) log("Stopped.");
    } catch (e: any) {
      log(`Error: ${e.message}`, "error");
      toast.error(e.message);
    } finally {
      setRunning(null);
      refresh();
    }
  };

  const stat = (label: string, v?: number | string) => (
    <div className="rounded-2xl bg-muted/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">{v ?? "–"}</p>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><HardDriveUpload className="h-5 w-5 text-primary" /> Backup to Google Drive</CardTitle>
        <CardDescription>
          Move old uploaded files to Google Drive. Keep this page open while it runs — you can stop and continue anytime.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stat("Waiting to move", status ? `${status.pending} (${status.pending_mb} MB)` : undefined)}
          {stat("Moved to Drive", status?.done)}
          {stat("Failed", status?.failed)}
          {stat("Links to update", status?.links_pending)}
          {stat("Cloud copies to remove", status?.cleanup_pending)}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!!running} onClick={() => loop("migrate")}><HardDriveUpload className="h-4 w-4 mr-1" /> 1. Copy files to Drive</Button>
          <Button variant="secondary" disabled={!!running} onClick={() => loop("apply")}><Link2 className="h-4 w-4 mr-1" /> 2. Update links</Button>
          <Button variant="destructive" disabled={!!running || !status?.cleanup_pending}
            onClick={() => { if (confirm("Remove the old copies from Cloud storage? Files stay safe in Google Drive.")) loop("cleanup"); }}>
            <Trash2 className="h-4 w-4 mr-1" /> 3. Remove Cloud copies
          </Button>
          {running && <Button variant="outline" onClick={() => { stopRef.current = true; }}><Square className="h-4 w-4 mr-1" /> Stop</Button>}
          {!!status?.failed && !running && (
            <Button variant="outline" onClick={async () => { await call({ action: "retry_failed" }); log("Failed files queued again."); refresh(); }}>
              <RotateCcw className="h-4 w-4 mr-1" /> Retry failed
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
        </div>

        {logs.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-1">Activity</p>
            <ScrollArea className="h-40 rounded-2xl border p-2">
              {logs.map((l, i) => (
                <p key={i} className={`text-xs font-mono ${l.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                  {format(l.time, "HH:mm:ss")} — {l.text}
                </p>
              ))}
            </ScrollArea>
          </div>
        )}

        <div>
          <p className="text-sm font-medium mb-1">File log (latest 100)</p>
          <ScrollArea className="h-64 rounded-2xl border">
            <div className="divide-y">
              {(history ?? []).map((h) => (
                <div key={h.bucket + h.path} className="p-2 text-xs space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.drive_url ? <Badge variant="secondary">Moved</Badge> : <Badge variant="destructive">Failed</Badge>}
                    {h.applied && <Badge variant="outline">Link updated</Badge>}
                    {h.cloud_deleted && <Badge variant="outline">Cloud copy removed</Badge>}
                    <span className="text-muted-foreground">{format(new Date(h.created_at), "dd MMM HH:mm")}</span>
                  </div>
                  <p className="break-all text-foreground">{h.bucket}/{h.path}</p>
                  {h.drive_url && <a href={h.drive_url} target="_blank" rel="noreferrer" className="text-primary underline">Open in Drive</a>}
                  {h.error && <p className="text-destructive break-all">{h.error}</p>}
                </div>
              ))}
              {!history?.length && <p className="p-3 text-xs text-muted-foreground">No files moved yet.</p>}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
