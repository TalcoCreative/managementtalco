import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Search, Download, ExternalLink, FileText, BarChart3, ListChecks } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid,
} from "recharts";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const CHOICE_TYPES = ["multiple_choice", "checkbox", "dropdown", "yes_no", "image_choice", "ranking"];
const SCALE_TYPES = ["likert", "rating", "nps", "slider", "emoji_rating", "semantic_diff"];
const TEXT_TYPES = ["short_text", "long_text", "email", "phone", "url", "address"];
const STOPWORDS = new Set([
  "yang","dan","di","ke","dari","untuk","dengan","atau","ini","itu","saya","kami","kita",
  "the","and","or","of","to","a","an","is","are","in","on","for","with","this","that",
  "as","by","be","at","it","i","we","you","my","our","your",
]);

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
        .from("form_questions").select("*").eq("form_id", formId!).order("field_order");
      if (error) throw error;
      return data || [];
    },
    enabled: !!formId,
  });

  const { data: responses } = useQuery({
    queryKey: ["form-responses", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_responses").select("*").eq("form_id", formId!)
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
      const { data, error } = await supabase
        .from("form_answers").select("*")
        .in("response_id", responses.map(r => r.id));
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

  // ---------- Analytics ----------
  const analytics = useMemo(() => {
    const out: Array<{ q: any; kind: string; data: any }> = [];
    if (!questions || !responses) return out;

    questions.forEach((q: any) => {
      // collect raw answers for this question across all responses
      const raws: string[] = [];
      const filesCount = { count: 0 };
      responses.forEach(r => {
        const a = answerMap[r.id]?.[q.id];
        if (!a) return;
        if (a.answer_file_url) filesCount.count++;
        if (a.answer_text) raws.push(String(a.answer_text));
      });

      if (CHOICE_TYPES.includes(q.field_type)) {
        const counts: Record<string, number> = {};
        raws.forEach(r => {
          // checkbox/ranking can be comma-separated
          const parts = q.field_type === "checkbox" || q.field_type === "ranking"
            ? r.split(",").map(s => s.trim()).filter(Boolean)
            : [r.trim()];
          parts.forEach(p => { counts[p] = (counts[p] || 0) + 1; });
        });
        out.push({
          q, kind: "choice",
          data: Object.entries(counts).map(([k, v]) => ({ name: k, value: v })),
        });
      } else if (SCALE_TYPES.includes(q.field_type)) {
        const counts: Record<string, number> = {};
        let sum = 0, n = 0;
        raws.forEach(r => {
          const num = parseFloat(r);
          if (!Number.isNaN(num)) { sum += num; n++; }
          counts[r] = (counts[r] || 0) + 1;
        });
        const sorted = Object.entries(counts).sort((a, b) => {
          const na = parseFloat(a[0]); const nb = parseFloat(b[0]);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
          return a[0].localeCompare(b[0]);
        });
        out.push({
          q, kind: "scale",
          data: { distribution: sorted.map(([k, v]) => ({ name: k, value: v })), avg: n ? sum / n : 0, count: n },
        });
      } else if (TEXT_TYPES.includes(q.field_type)) {
        const words: Record<string, number> = {};
        raws.forEach(r => {
          r.toLowerCase().replace(/[^a-z0-9\u00C0-\u017F\s]/g, " ").split(/\s+/).forEach(w => {
            if (w.length < 3 || STOPWORDS.has(w)) return;
            words[w] = (words[w] || 0) + 1;
          });
        });
        const top = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([k, v]) => ({ name: k, value: v }));
        out.push({ q, kind: "text", data: { words: top, samples: raws.slice(0, 3), totalAnswers: raws.length } });
      } else if (["file", "image_upload", "video_upload", "document_upload", "signature"].includes(q.field_type)) {
        out.push({ q, kind: "file", data: { count: filesCount.count } });
      } else if (["date", "datetime", "month", "year", "time"].includes(q.field_type)) {
        const counts: Record<string, number> = {};
        raws.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
        out.push({
          q, kind: "date",
          data: Object.entries(counts).sort((a,b)=>a[0].localeCompare(b[0])).map(([k, v]) => ({ name: k, value: v })),
        });
      }
    });
    return out;
  }, [questions, responses, answerMap]);

  // submissions over time
  const overTime = useMemo(() => {
    if (!responses) return [];
    const map: Record<string, number> = {};
    responses.forEach(r => {
      const k = format(new Date(r.submitted_at), "dd MMM");
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).reverse().map(([name, value]) => ({ name, value }));
  }, [responses]);

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
              <p className="text-muted-foreground text-sm">{responses?.length || 0} respons · {questions?.length || 0} pertanyaan</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!responses?.length}>
            <Download className="mr-2 h-4 w-4" />Export CSV
          </Button>
        </div>

        <Tabs defaultValue="responses" className="space-y-4">
          <TabsList>
            <TabsTrigger value="responses"><ListChecks className="h-4 w-4 mr-2" />Respons</TabsTrigger>
            <TabsTrigger value="dashboard"><BarChart3 className="h-4 w-4 mr-2" />Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="responses" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Respons</div><div className="text-2xl font-bold">{responses?.length || 0}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Pertanyaan</div><div className="text-2xl font-bold">{questions?.length || 0}</div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Rata-rata Jawaban / Respons</div><div className="text-2xl font-bold">{responses?.length ? Math.round((allAnswers?.length || 0) / responses.length) : 0}</div></CardContent></Card>
            </div>

            {overTime.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Submission Trend</CardTitle></CardHeader>
                <CardContent className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={overTime}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} allowDecimals={false} />
                      <Tooltip />
                      <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {analytics.map(({ q, kind, data }) => (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      {q.label}
                      <Badge variant="outline" className="text-xs">{q.field_type}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {kind === "choice" && data.length > 0 && (
                      <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                          {data.length <= 5 ? (
                            <PieChart>
                              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                                {data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          ) : (
                            <BarChart data={data}>
                              <XAxis dataKey="name" fontSize={10} />
                              <YAxis fontSize={11} allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      </div>
                    )}
                    {kind === "scale" && (
                      <>
                        <div className="text-xs text-muted-foreground mb-1">Rata-rata: <span className="font-semibold text-foreground">{data.avg.toFixed(2)}</span> · {data.count} respons</div>
                        <div className="h-48">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.distribution}>
                              <XAxis dataKey="name" fontSize={11} />
                              <YAxis fontSize={11} allowDecimals={false} />
                              <Tooltip />
                              <Bar dataKey="value" fill="#10b981" radius={[6, 6, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                    {kind === "text" && (
                      <div className="space-y-3">
                        <div className="text-xs text-muted-foreground">{data.totalAnswers} jawaban · top kata kunci</div>
                        {data.words.length > 0 ? (
                          <div className="h-44">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={data.words} layout="vertical">
                                <XAxis type="number" fontSize={11} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" fontSize={11} width={80} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : <div className="text-xs text-muted-foreground italic">Belum cukup data</div>}
                        {data.samples.length > 0 && (
                          <div className="space-y-1 border-t pt-2">
                            <div className="text-xs font-medium">Sample:</div>
                            {data.samples.map((s: string, i: number) => (
                              <div key={i} className="text-xs text-muted-foreground line-clamp-2">"{s}"</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {kind === "file" && (
                      <div className="text-3xl font-bold">{data.count} <span className="text-sm font-normal text-muted-foreground">file diunggah</span></div>
                    )}
                    {kind === "date" && data.length > 0 && (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data}>
                            <XAxis dataKey="name" fontSize={10} />
                            <YAxis fontSize={11} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {analytics.length === 0 && (
                <Card className="lg:col-span-2"><CardContent className="py-12 text-center text-muted-foreground text-sm">Belum ada data untuk divisualisasikan</CardContent></Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Response Detail */}
      <Dialog open={!!selectedResponseId} onOpenChange={o => !o && setSelectedResponseId(null)}>
        <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-3 border-b">
            <DialogTitle>Detail Respons</DialogTitle>
          </DialogHeader>
          {selectedResponse && (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>Submitted: {format(new Date(selectedResponse.submitted_at), "dd MMM yyyy HH:mm")}</span>
                  {selectedResponse.respondent_name && <span>• {selectedResponse.respondent_name}</span>}
                  {selectedResponse.respondent_email && <span>• {selectedResponse.respondent_email}</span>}
                </div>

                {questions?.map((q: any) => {
                  const a = selectedAnswers[q.id];
                  const hasFile = !!a?.answer_file_url;
                  const hasText = !!a?.answer_text;

                  return (
                    <Card key={q.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                          {q.label}
                          {q.is_required && <Badge variant="destructive" className="text-xs">Wajib</Badge>}
                          <Badge variant="outline" className="text-xs">{q.field_type}</Badge>
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
                        ) : (
                          <p className="text-sm whitespace-pre-wrap break-words">{a.answer_text}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
