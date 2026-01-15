import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Type, 
  AlignLeft, 
  Mail, 
  Phone, 
  FileUp, 
  Link, 
  List, 
  ChevronDown, 
  Star, 
  ToggleLeft 
} from "lucide-react";
import { toast } from "sonner";

interface FormBuilderDialogProps {
  formId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface FormField {
  id?: string;
  form_id: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  helper_text: string | null;
  is_required: boolean;
  options: string[] | null;
  field_order: number;
}

const FIELD_TYPES = [
  { value: "short_text", label: "Teks Singkat", icon: Type },
  { value: "long_text", label: "Teks Panjang", icon: AlignLeft },
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Nomor Telepon", icon: Phone },
  { value: "file", label: "Upload File", icon: FileUp },
  { value: "url", label: "URL", icon: Link },
  { value: "multiple_choice", label: "Pilihan Ganda", icon: List },
  { value: "dropdown", label: "Dropdown", icon: ChevronDown },
  { value: "rating", label: "Rating", icon: Star },
  { value: "yes_no", label: "Ya / Tidak", icon: ToggleLeft },
];

export function FormBuilderDialog({
  formId,
  open,
  onOpenChange,
}: FormBuilderDialogProps) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<FormField[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: form } = useQuery({
    queryKey: ["recruitment-form", formId],
    queryFn: async () => {
      if (!formId) return null;
      const { data, error } = await supabase
        .from("recruitment_forms")
        .select("*")
        .eq("id", formId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  const { data: existingFields } = useQuery({
    queryKey: ["recruitment-form-fields", formId],
    queryFn: async () => {
      if (!formId) return [];
      const { data, error } = await supabase
        .from("recruitment_form_fields")
        .select("*")
        .eq("form_id", formId)
        .order("field_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!formId,
  });

  useEffect(() => {
    if (existingFields) {
      setFields(existingFields.map(f => ({
        ...f,
        options: f.options as string[] | null
      })));
      setHasChanges(false);
    }
  }, [existingFields]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error("No form ID");

      // Delete all existing fields
      await supabase
        .from("recruitment_form_fields")
        .delete()
        .eq("form_id", formId);

      // Insert new fields
      if (fields.length > 0) {
        const { error } = await supabase
          .from("recruitment_form_fields")
          .insert(
            fields.map((field, index) => ({
              form_id: formId,
              field_type: field.field_type,
              label: field.label,
              placeholder: field.placeholder,
              helper_text: field.helper_text,
              is_required: field.is_required,
              options: field.options,
              field_order: index,
            }))
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recruitment-form-fields", formId] });
      toast.success("Form berhasil disimpan!");
      setHasChanges(false);
    },
    onError: (error) => {
      toast.error("Gagal menyimpan form: " + error.message);
    },
  });

  const addField = (type: string) => {
    if (!formId) return;
    const fieldType = FIELD_TYPES.find(f => f.value === type);
    const newField: FormField = {
      form_id: formId,
      field_type: type,
      label: fieldType?.label || "Field Baru",
      placeholder: null,
      helper_text: null,
      is_required: false,
      options: type === "multiple_choice" || type === "dropdown" ? ["Opsi 1", "Opsi 2"] : null,
      field_order: fields.length,
    };
    setFields([...fields, newField]);
    setHasChanges(true);
  };

  const updateField = (index: number, updates: Partial<FormField>) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], ...updates };
    setFields(newFields);
    setHasChanges(true);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === fields.length - 1)
    ) {
      return;
    }
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
    setHasChanges(true);
  };

  const getFieldIcon = (type: string) => {
    const fieldType = FIELD_TYPES.find(f => f.value === type);
    return fieldType?.icon || Type;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Form Builder: {form?.name || "Loading..."}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Field Types Panel */}
          <div className="w-64 border-r pr-4 overflow-hidden flex flex-col">
            <p className="text-sm font-medium mb-3">Tambah Field</p>
            <ScrollArea className="flex-1">
              <div className="space-y-2 pr-2">
                {FIELD_TYPES.map((type) => (
                  <Button
                    key={type.value}
                    variant="outline"
                    className="w-full justify-start h-10"
                    onClick={() => addField(type.value)}
                  >
                    <type.icon className="mr-2 h-4 w-4" />
                    {type.label}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Form Preview / Editor */}
          <ScrollArea className="flex-1">
            <div className="space-y-4 pr-4">
              {/* Position indicator */}
              <Card className="bg-muted/50">
                <CardContent className="py-3">
                  <p className="text-sm text-muted-foreground">
                    Posisi: <span className="font-medium text-foreground">{form?.position}</span>
                  </p>
                </CardContent>
              </Card>

              {fields.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <p>Belum ada field. Tambahkan field dari panel kiri.</p>
                  </CardContent>
                </Card>
              ) : (
                <Accordion type="single" collapsible className="space-y-2">
                  {fields.map((field, index) => {
                    const FieldIcon = getFieldIcon(field.field_type);
                    return (
                      <AccordionItem
                        key={index}
                        value={`field-${index}`}
                        className="border rounded-lg"
                      >
                        <AccordionTrigger className="px-4 hover:no-underline">
                          <div className="flex items-center gap-3 flex-1">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            <FieldIcon className="h-4 w-4" />
                            <span className="font-medium">{field.label}</span>
                            {field.is_required && (
                              <span className="text-xs text-destructive">*</span>
                            )}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Label</Label>
                              <Input
                                value={field.label}
                                onChange={(e) => updateField(index, { label: e.target.value })}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Placeholder</Label>
                              <Input
                                value={field.placeholder || ""}
                                onChange={(e) => updateField(index, { placeholder: e.target.value })}
                                placeholder="Teks placeholder..."
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Helper Text</Label>
                              <Input
                                value={field.helper_text || ""}
                                onChange={(e) => updateField(index, { helper_text: e.target.value })}
                                placeholder="Teks bantuan..."
                              />
                            </div>

                            {(field.field_type === "multiple_choice" || field.field_type === "dropdown") && (
                              <div className="space-y-2">
                                <Label>Opsi (satu per baris)</Label>
                                <textarea
                                  className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                                  value={(field.options || []).join("\n")}
                                  onChange={(e) =>
                                    updateField(index, {
                                      options: e.target.value.split("\n").filter(Boolean),
                                    })
                                  }
                                  placeholder="Opsi 1&#10;Opsi 2&#10;Opsi 3"
                                />
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={field.is_required}
                                  onCheckedChange={(checked) =>
                                    updateField(index, { is_required: checked })
                                  }
                                />
                                <Label>Wajib diisi</Label>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => moveField(index, "up")}
                                  disabled={index === 0}
                                >
                                  ↑
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => moveField(index, "down")}
                                  disabled={index === fields.length - 1}
                                >
                                  ↓
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeField(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
