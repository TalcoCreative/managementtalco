import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface FormData {
  id: string;
  name: string;
  description: string | null;
  slug: string;
}

interface Question {
  id: string;
  label: string;
  field_type: string;
  is_required: boolean;
  field_order: number;
  options: string[] | null;
  placeholder: string | null;
}

export default function PublicForm() {
  const { slug } = useParams();
  const [form, setForm] = useState<FormData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File>>({});
  const [checkboxAnswers, setCheckboxAnswers] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForm();
  }, [slug]);

  const loadForm = async () => {
    try {
      const { data: f, error: fErr } = await supabase
        .from("forms")
        .select("*")
        .eq("slug", slug!)
        .eq("is_public", true)
        .eq("status", "active")
        .single();
      if (fErr || !f) { setError("Form tidak ditemukan atau tidak aktif"); setLoading(false); return; }
      setForm(f);

      const { data: qs } = await supabase
        .from("form_questions")
        .select("*")
        .eq("form_id", f.id)
        .order("field_order");
      setQuestions((qs || []).map((q: any) => ({ ...q, options: q.options as string[] | null })));
    } catch {
      setError("Gagal memuat form");
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // Validate required fields
    for (const q of questions) {
      if (!q.is_required) continue;
      if (q.field_type === "checkbox") {
        if (!checkboxAnswers[q.id]?.length) {
          toast.error(`"${q.label}" wajib diisi`);
          setSubmitting(false);
          return;
        }
      } else if (q.field_type === "file") {
        if (!files[q.id]) {
          toast.error(`"${q.label}" wajib diisi`);
          setSubmitting(false);
          return;
        }
      } else {
        if (!answers[q.id]?.trim()) {
          toast.error(`"${q.label}" wajib diisi`);
          setSubmitting(false);
          return;
        }
      }
    }

    try {
      // Detect name and email from answers
      let respondentName: string | null = null;
      let respondentEmail: string | null = null;
      for (const q of questions) {
        const val = answers[q.id];
        if (!val) continue;
        const label = q.label.toLowerCase();
        if (!respondentName && (label.includes("nama") || label.includes("name"))) respondentName = val;
        if (!respondentEmail && (q.field_type === "email" || label.includes("email"))) respondentEmail = val;
      }

      // Create response
      const responseId = crypto.randomUUID();
      const { error: rErr } = await supabase.from("form_responses").insert({
        id: responseId,
        form_id: form!.id,
        respondent_name: respondentName,
        respondent_email: respondentEmail,
      });
      if (rErr) throw rErr;

      // Upload files first
      const fileUrls: Record<string, string> = {};
      for (const [qId, file] of Object.entries(files)) {
        const ext = file.name.split('.').pop();
        const path = `${form!.id}/${responseId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("form-uploads").upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("form-uploads").getPublicUrl(path);
        fileUrls[qId] = urlData.publicUrl;
      }

      // Insert answers
      const answerRows = questions.map(q => {
        let text = answers[q.id] || null;
        if (q.field_type === "checkbox") {
          text = (checkboxAnswers[q.id] || []).join(", ");
        }
        return {
          response_id: responseId,
          question_id: q.id,
          answer_text: text,
          answer_file_url: fileUrls[q.id] || null,
        };
      }).filter(a => a.answer_text || a.answer_file_url);

      if (answerRows.length > 0) {
        const { error: aErr } = await supabase.from("form_answers").insert(answerRows);
        if (aErr) throw aErr;
      }

      setSubmitted(true);
    } catch (err: any) {
      toast.error("Gagal mengirim: " + err.message);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">{error || "Form tidak ditemukan"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Terima kasih!</h2>
            <p className="text-muted-foreground">Respons Anda berhasil dikirim.</p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setAnswers({}); setFiles({}); setCheckboxAnswers({}); }}>
              Kirim lagi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-2xl">{form.name}</CardTitle>
            {form.description && <CardDescription>{form.description}</CardDescription>}
          </CardHeader>
        </Card>

        <form onSubmit={handleSubmit} className="space-y-4">
          {questions.map(q => (
            <Card key={q.id}>
              <CardContent className="pt-6 space-y-2">
                <Label className="text-sm font-medium">
                  {q.label}
                  {q.is_required && <span className="text-destructive ml-1">*</span>}
                </Label>

                {q.field_type === "short_text" && (
                  <Input
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || ""}
                  />
                )}

                {q.field_type === "long_text" && (
                  <Textarea
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || ""}
                    rows={4}
                  />
                )}

                {q.field_type === "email" && (
                  <Input
                    type="email"
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "email@example.com"}
                  />
                )}

                {q.field_type === "phone" && (
                  <Input
                    type="tel"
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "08xxxxxxxxxx"}
                  />
                )}

                {q.field_type === "number" && (
                  <Input
                    type="number"
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                    placeholder={q.placeholder || "0"}
                  />
                )}

                {q.field_type === "date" && (
                  <Input
                    type="date"
                    value={answers[q.id] || ""}
                    onChange={e => setAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                  />
                )}

                {q.field_type === "dropdown" && (
                  <Select value={answers[q.id] || ""} onValueChange={v => setAnswers(p => ({ ...p, [q.id]: v }))}>
                    <SelectTrigger><SelectValue placeholder="Pilih..." /></SelectTrigger>
                    <SelectContent>
                      {(q.options || []).map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {q.field_type === "multiple_choice" && (
                  <RadioGroup value={answers[q.id] || ""} onValueChange={v => setAnswers(p => ({ ...p, [q.id]: v }))}>
                    {(q.options || []).map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                        <Label htmlFor={`${q.id}-${opt}`}>{opt}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {q.field_type === "checkbox" && (
                  <div className="space-y-2">
                    {(q.options || []).map(opt => (
                      <div key={opt} className="flex items-center space-x-2">
                        <Checkbox
                          checked={(checkboxAnswers[q.id] || []).includes(opt)}
                          onCheckedChange={checked => {
                            setCheckboxAnswers(p => {
                              const curr = p[q.id] || [];
                              return { ...p, [q.id]: checked ? [...curr, opt] : curr.filter(x => x !== opt) };
                            });
                          }}
                        />
                        <Label>{opt}</Label>
                      </div>
                    ))}
                  </div>
                )}

                {q.field_type === "file" && (
                  <Input
                    type="file"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) setFiles(p => ({ ...p, [q.id]: file }));
                    }}
                  />
                )}
              </CardContent>
            </Card>
          ))}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim...</> : "Kirim"}
          </Button>
        </form>
      </div>
    </div>
  );
}
