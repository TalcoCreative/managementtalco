import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, Download, ExternalLink, FileText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function FormResponses() {
  const { formId } = useParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponseId, setSelectedResponseId] = useState<string | null>(null);

  const { data: form } = useQuery({
    queryKey: ["form-detail", formId],
    queryFn: async () => {
      const { data, error } = await supabase.from("forms").select("*").eq("id", formId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  const { data: questions } = useQuery({
    queryKey: ["form-questions-resp", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", formId!)
        .order("field_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  const { data: responses } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_responses")
        .select("*")
        .eq("form_id", formId!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  const { data: allAnswers } = useQuery({
    queryKey: ["form-all-answers", formId],
    queryFn: async () => {
      if (!responses || responses.length === 0) return [];
      const responseIds = responses.map(r => r.id);
      const { data, error } = await supabase
        .from("form_answers")
        .select("*")
        .in("response_id", responseIds);
      if (error) throw error;
      return data || [];
    },
    enabled: !!responses && responses.length > 0,
  });

  const answerMap = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    allAnswers?.forEach((a: any) => {
      if (!m[a.response_id]) m[a.response_id] = {};
      m[a.response_id][a.question_id] = a;
    });
    return m;
  }, [allAnswers]);

  const filtered = responses?.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (r.respondent_name?.toLowerCase().includes(q)) return true;
    if (r.respondent_email?.toLowerCase().includes(q)) return true;
    const answers = answerMap[r.id];
    if (answers) {
      return Object.values(answers).some((a: any) =>
        (a.answer_text || "").toLowerCase().includes(q)
      );
    }
    return false;
  }) || [];

  const selectedResponse = responses?.find(r => r.id === selectedResponseId);
  const selectedAnswers = selectedResponseId ? answerMap[selectedResponseId] || {} : {};

  const exportCSV = () => {
    if (!questions || !responses) return;
    const headers = ["Submitted", "Name", "Email", ...questions.map((q: any) => q.label)];
    const rows = responses.map(r => {
      const answers = answerMap[r.id] || {};
      return [
        format(new Date(r.submitted_at), "yyyy-MM-dd HH:mm"),
        r.respondent_name || "",
        r.respondent_email || "",
        ...questions.map((q: any) => {
          const a = answers[q.id];
          return a?.answer_text || a?.answer_file_url || "";
        }),
      ];
    });

    const csvContent = [headers, ...rows].map(row =>
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${form?.name || "form"}-responses.csv`;
    link.click();
    toast.success("CSV berhasil diunduh");
  };

  const openFileUrl = async (url: string) => {
    try {
      const publicPrefix = '/storage/v1/object/public/';
      const idx = url.indexOf(publicPrefix);
      if (idx !== -1) {
        const fullPath = url.substring(idx + publicPrefix.length);
        const slashIdx = fullPath.indexOf('/');
        const bucket = fullPath.substring(0, slashIdx);
        const path = fullPath.substring(slashIdx + 1);
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (data?.signedUrl) { window.open(data.signedUrl, '_blank'); return; }
      }
    } catch {}
    window.open(url, '_blank');
  };

  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/forms/${formId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Respons: {form?.name || "..."}</h1>
              <p className="text-muted-foreground text-sm">{filtered.length} respons</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!responses?.length}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cari respons..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 h-12 sm:h-10" />
        </div>

        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Tanggal</TableHead>
                  <TableHead className="min-w-[150px]">Nama</TableHead>
                  <TableHead className="min-w-[180px]">Email</TableHead>
                  {questions?.slice(0, 3).map((q: any) => (
                    <TableHead key={q.id} className="min-w-[150px]">{q.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={(questions?.length || 0) + 3} className="text-center py-8 text-muted-foreground">Belum ada respons</TableCell></TableRow>
                ) : filtered.map(r => {
                  const answers = answerMap[r.id] || {};
                  return (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedResponseId(r.id)}>
                      <TableCell>{format(new Date(r.submitted_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell>{r.respondent_name || "-"}</TableCell>
                      <TableCell>{r.respondent_email || "-"}</TableCell>
                      {questions?.slice(0, 3).map((q: any) => {
                        const a = answers[q.id];
                        const val = a?.answer_text || (a?.answer_file_url ? "📎 File" : "-");
                        return <TableCell key={q.id} className="max-w-[200px] truncate">{val}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Response Detail */}
      <Dialog open={!!selectedResponseId} onOpenChange={o => !o && setSelectedResponseId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detail Respons</DialogTitle>
          </DialogHeader>
          {selectedResponse && (
            <ScrollArea className="flex-1 pr-4" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              <div className="space-y-4">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>Submitted: {format(new Date(selectedResponse.submitted_at), "dd MMM yyyy HH:mm")}</span>
                  {selectedResponse.respondent_name && <span>• {selectedResponse.respondent_name}</span>}
                  {selectedResponse.respondent_email && <span>• {selectedResponse.respondent_email}</span>}
                </div>

                {questions?.map((q: any) => {
                  const a = selectedAnswers[q.id];
                  const hasFile = !!a?.answer_file_url;
                  const hasText = !!a?.answer_text;
                  const isLong = hasText && a.answer_text.length > 200;

                  return (
                    <Card key={q.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          {q.label}
                          {q.is_required && <Badge variant="destructive" className="text-xs">Wajib</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {!hasText && !hasFile ? (
                          <p className="text-muted-foreground text-sm">-</p>
                        ) : hasFile ? (
                          <button
                            onClick={() => openFileUrl(a.answer_file_url)}
                            className="flex items-center gap-2 text-primary hover:underline cursor-pointer"
                          >
                            <FileText className="h-4 w-4" />
                            <span>Buka File</span>
                            <ExternalLink className="h-3 w-3" />
                          </button>
                        ) : isLong ? (
                          <ScrollArea className="max-h-[200px]">
                            <p className="text-sm whitespace-pre-wrap">{a.answer_text}</p>
                          </ScrollArea>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{a.answer_text}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
