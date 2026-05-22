import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Search, X } from "lucide-react";

interface ClientAssignmentPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

/**
 * Reusable multi-select for assigning KOLs to clients.
 * Pure controlled component — parent handles persistence.
 */
export function ClientAssignmentPicker({ selectedIds, onChange }: ClientAssignmentPickerProps) {
  const [search, setSearch] = useState("");

  const { data: clients = [] } = useQuery({
    queryKey: ["kol-assign-clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, company")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c: any) =>
        c.name?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const selectedClients = clients.filter((c: any) => selectedIds.includes(c.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Assign ke Client (opsional, bisa banyak)</Label>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-xs text-muted-foreground hover:text-destructive"
          >
            Reset
          </button>
        )}
      </div>

      {selectedClients.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedClients.map((c: any) => (
            <Badge
              key={c.id}
              variant="secondary"
              className="gap-1 cursor-pointer"
              onClick={() => toggle(c.id)}
            >
              {c.name}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari client..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <div className="max-h-44 overflow-y-auto rounded-lg border border-border/60 divide-y divide-border/40">
        {filtered.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            Tidak ada client
          </div>
        ) : (
          filtered.map((c: any) => {
            const checked = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  {c.company && (
                    <p className="text-xs text-muted-foreground truncate">{c.company}</p>
                  )}
                </div>
                <div
                  className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                    checked
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </div>
              </button>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        KOL akan muncul di halaman publik Hub setiap client yang dipilih. Client tidak melihat client lain.
      </p>
    </div>
  );
}

/**
 * Helper: sync the kol_database_clients pivot for a given KOL.
 * Strategy: delete missing + insert new (no upsert needed; small dataset).
 */
export async function syncKolClientAssignments(kolId: string, clientIds: string[], userId: string) {
  // Fetch existing
  const { data: existing, error: exErr } = await supabase
    .from("kol_database_clients")
    .select("id, client_id")
    .eq("kol_id", kolId);
  if (exErr) throw exErr;

  const existingIds = new Set((existing || []).map((r: any) => r.client_id));
  const targetIds = new Set(clientIds);

  const toDelete = (existing || []).filter((r: any) => !targetIds.has(r.client_id)).map((r: any) => r.id);
  const toInsert = clientIds.filter((id) => !existingIds.has(id));

  if (toDelete.length > 0) {
    const { error } = await supabase.from("kol_database_clients").delete().in("id", toDelete);
    if (error) throw error;
  }
  if (toInsert.length > 0) {
    const rows = toInsert.map((client_id) => ({ kol_id: kolId, client_id, created_by: userId }));
    const { error } = await supabase.from("kol_database_clients").insert(rows);
    if (error) throw error;
  }
}
