import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle, Star, Briefcase } from "lucide-react";

interface FormField {
  id: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  helper_text: string | null;
  is_required: boolean;
  options: string[] | null;
  field_order: number;
}

export default function PublicApplyForm() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [fileUploads, setFileUploads] = useState<Record<string, File | null>>({});
  const [submitted, setSubmitted] = useState(false);

  const { data: form, isLoading: formLoading, error: formError } = useQuery({
    queryKey: ["public-form", slug],
    queryFn: async () => {
      if (!slug) throw new Error("No slug");
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("*")
        .eq("slug", slug)
        .eq("status", "active")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: fields } = useQuery({
    queryKey: ["public-form-fields", form?.id],
    queryFn: async () => {
      if (!form?.id) return [];
      const { data, error } = await supabase
        .from("recruitment_form_fields")
        .select("*")
        .eq("form_id", form.id)
        .order("field_order", { ascending: true });
      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!form?.id,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form || !fields) throw new Error("Form not loaded");

      // Validate required fields
      for (const field of fields) {
        if (field.is_required) {
          const value = formValues[field.id];
          if (!value && field.field_type !== "file") {
            throw new Error(`${field.label} wajib diisi`);
          }
          if (field.field_type === "file" && !fileUploads[field.id]) {
            throw new Error(`${field.label} wajib diupload`);
          }
        }
      }

      // Upload files first
      const uploadedFiles: Record<string, string> = {};
      for (const [fieldId, file] of Object.entries(fileUploads)) {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `recruitment/${form.id}/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from("company-assets")
            .upload(filePath, file);
          
          if (uploadError) throw uploadError;
          
          const { data: urlData } = supabase.storage
            .from("company-assets")
            .getPublicUrl(filePath);
          
          uploadedFiles[fieldId] = urlData.publicUrl;
        }
      }

      // Prepare submission data
      const submissionData = { ...formValues, ...uploadedFiles };

      // Extract candidate info from submission
      const nameField = fields.find(f => f.field_type === "short_text" && f.label.toLowerCase().includes("nama"));
      const emailField = fields.find(f => f.field_type === "email");
      const phoneField = fields.find(f => f.field_type === "phone");
      const cvField = fields.find(f => f.field_type === "file" && f.label.toLowerCase().includes("cv"));

      const fullName = nameField ? formValues[nameField.id] : "Unknown";
      const email = emailField ? formValues[emailField.id] : "";
      const phone = phoneField ? formValues[phoneField.id] : "";
      const cvUrl = cvField ? uploadedFiles[cvField.id] : null;

      // Create candidate record
      // NOTE: For public (non-login) submissions we MUST NOT request returning rows,
      // because candidates are not selectable by anon due to RLS.
      const createUuid = () => {
        if (typeof crypto === "undefined" || !crypto.getRandomValues) {
          throw new Error("Browser tidak mendukung pembuatan ID aman");
        }
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        // RFC4122 v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      };

      const candidateId = createUuid();

      const candidatePayload = {
        id: candidateId,
        full_name: fullName,
        email: email,
        phone: phone,
        position: form.position,
        division: "General",
        cv_url: cvUrl,
        source_form_id: form.id,
        created_by: form.created_by,
      };

      const { error: candidateError } = await supabase
        .from("candidates")
        .insert(candidatePayload);

      if (candidateError) {
        console.error("[PublicApplyForm] Candidate insert blocked", {
          candidateError,
          candidatePayload,
          formId: form.id,
          formSlug: form.slug,
          formStatus: form.status,
        });
        throw candidateError;
      }

      // Store form submission
      const { error: submissionError } = await supabase
        .from("recruitment_form_submissions")
        .insert({
          form_id: form.id,
          candidate_id: candidateId,
          submission_data: submissionData,
        });

      if (submissionError) {
        console.error("[PublicApplyForm] Submission insert failed", {
          submissionError,
          formId: form.id,
          candidateId,
        });
        throw submissionError;
      }

      return { id: candidateId };
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFileChange = (fieldId: string, file: File | null) => {
    if (file && file.size > 5 * 1024 * 1024) {
      toast.error("Ukuran file maksimal 5MB");
      return;
    }
    setFileUploads({ ...fileUploads, [fieldId]: file });
  };

  const renderField = (field: FormField) => {
    const value = formValues[field.id] || "";

    switch (field.field_type) {
      case "short_text":
        return (
          <Input
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
            placeholder={field.placeholder || ""}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
          />
        );

      case "long_text":
        return (
          <Textarea
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
            placeholder={field.placeholder || ""}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[120px]"
          />
        );

      case "email":
        return (
          <Input
            type="email"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
            placeholder={field.placeholder || "email@example.com"}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
          />
        );

      case "phone":
        return (
          <Input
            type="tel"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
            placeholder={field.placeholder || "08xxxxxxxxxx"}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
          />
        );

      case "url":
        return (
          <Input
            type="url"
            value={value}
            onChange={(e) => setFormValues({ ...formValues, [field.id]: e.target.value })}
            placeholder={field.placeholder || "https://..."}
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 h-12"
          />
        );

      case "file":
        return (
          <div className="space-y-2">
            <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-500 transition-colors">
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => handleFileChange(field.id, e.target.files?.[0] || null)}
              />
              {fileUploads[field.id] ? (
                <span className="text-green-400 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  {fileUploads[field.id]?.name}
                </span>
              ) : (
                <span className="text-zinc-400 flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Klik untuk upload file
                </span>
              )}
            </label>
          </div>
        );

      case "multiple_choice":
        return (
          <RadioGroup
            value={value}
            onValueChange={(val) => setFormValues({ ...formValues, [field.id]: val })}
            className="space-y-3"
          >
            {(field.options || []).map((option, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                <RadioGroupItem
                  value={option}
                  id={`${field.id}-${idx}`}
                  className="border-zinc-600"
                />
                <Label htmlFor={`${field.id}-${idx}`} className="text-zinc-300 cursor-pointer">
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "dropdown":
        return (
          <Select
            value={value}
            onValueChange={(val) => setFormValues({ ...formValues, [field.id]: val })}
          >
            <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white h-12">
              <SelectValue placeholder={field.placeholder || "Pilih opsi..."} />
            </SelectTrigger>
            <SelectContent className="bg-zinc-800 border-zinc-700">
              {(field.options || []).map((option, idx) => (
                <SelectItem key={idx} value={option} className="text-white hover:bg-zinc-700">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "rating":
        return (
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFormValues({ ...formValues, [field.id]: star })}
                className="p-1"
              >
                <Star
                  className={`h-8 w-8 transition-colors ${
                    star <= (value || 0)
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-zinc-600"
                  }`}
                />
              </button>
            ))}
          </div>
        );

      case "yes_no":
        return (
          <div className="flex gap-4">
            <Button
              type="button"
              variant={value === "Ya" ? "default" : "outline"}
              onClick={() => setFormValues({ ...formValues, [field.id]: "Ya" })}
              className={value === "Ya" 
                ? "bg-green-600 hover:bg-green-700" 
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }
            >
              Ya
            </Button>
            <Button
              type="button"
              variant={value === "Tidak" ? "default" : "outline"}
              onClick={() => setFormValues({ ...formValues, [field.id]: "Tidak" })}
              className={value === "Tidak" 
                ? "bg-red-600 hover:bg-red-700" 
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              }
            >
              Tidak
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  if (formLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (formError || !form) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Form Tidak Ditemukan</h1>
          <p className="text-zinc-400">Form ini tidak tersedia atau sudah tidak aktif.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-md text-center space-y-6">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="h-10 w-10 text-green-400" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-white">Terima Kasih!</h1>
            <p className="text-zinc-400 leading-relaxed">
              Terima kasih sudah mendaftar di Talco.
              <br />
              Data kamu sudah kami terima.
              <br />
              Tim kami akan menghubungi kamu jika profil kamu sesuai dengan kebutuhan kami.
            </p>
          </div>
          <p className="text-zinc-500 text-sm">Thanks for joining Talco ✨</p>
          <Button
            variant="outline"
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => window.close()}
          >
            Tutup Halaman
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 rounded-full mb-6">
            <Briefcase className="h-4 w-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">{form.position}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {form.name}
          </h1>
          {form.description && (
            <p className="text-zinc-400 text-lg">{form.description}</p>
          )}
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitMutation.mutate();
          }}
          className="space-y-8"
        >
          {fields?.map((field) => (
            <div key={field.id} className="space-y-3">
              <Label className="text-white text-lg flex items-center gap-1">
                {field.label}
                {field.is_required && <span className="text-red-400">*</span>}
              </Label>
              {field.helper_text && (
                <p className="text-sm text-zinc-500">{field.helper_text}</p>
              )}
              {renderField(field)}
            </div>
          ))}

          <div className="pt-6">
            <Button
              type="submit"
              className="w-full h-14 text-lg bg-white text-zinc-900 hover:bg-zinc-200"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Mengirim...
                </>
              ) : (
                "Kirim Lamaran"
              )}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-12 text-center text-zinc-600 text-sm">
          Powered by Talco Management System
        </div>
      </div>
    </div>
  );
}
