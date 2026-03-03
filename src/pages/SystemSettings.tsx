import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { Bot, Eye, EyeOff, Save, AlertTriangle, Settings } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const AI_MODELS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
];

export default function SystemSettings() {
  const { isSuperAdmin, userId } = usePermissions();
  const queryClient = useQueryClient();
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState("0.2");
  const [maxTokens, setMaxTokens] = useState("1200");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["ai-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["ai_api_key", "ai_model", "ai_temperature", "ai_max_tokens", "ai_usage_count"]);
      const map: Record<string, string> = {};
      data?.forEach((s) => {
        map[s.setting_key] = s.setting_value || "";
      });
      return map;
    },
    enabled: isSuperAdmin,
  });

  useEffect(() => {
    if (settings) {
      setApiKey(settings["ai_api_key"] || "");
      setModel(settings["ai_model"] || "gpt-4o-mini");
      setTemperature(settings["ai_temperature"] || "0.2");
      setMaxTokens(settings["ai_max_tokens"] || "1200");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const pairs = [
        { setting_key: "ai_api_key", setting_value: apiKey },
        { setting_key: "ai_model", setting_value: model },
        { setting_key: "ai_temperature", setting_value: temperature },
        { setting_key: "ai_max_tokens", setting_value: maxTokens },
      ];
      for (const pair of pairs) {
        await supabase
          .from("company_settings")
          .upsert(
            { ...pair, updated_by: userId, updated_at: new Date().toISOString() },
            { onConflict: "setting_key" }
          );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
      toast.success("AI configuration saved");
    },
    onError: () => toast.error("Failed to save configuration"),
  });

  if (!isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">Access restricted to Super Admin.</p>
        </div>
      </AppLayout>
    );
  }

  const hasApiKey = !!settings?.["ai_api_key"];
  const usageCount = settings?.["ai_usage_count"] || "0";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Configure system-wide settings</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-600/15 to-indigo-600/15 flex items-center justify-center">
                <Bot className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base">AI Configuration</CardTitle>
                <CardDescription>Configure OpenAI integration for Talco AI Operations</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!hasApiKey && !apiKey && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400">API Key not configured</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Set your OpenAI API key to enable AI Operations chat.</p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>OpenAI API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input
                  type="number"
                  step="100"
                  min="100"
                  max="4096"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Total AI queries: <span className="font-medium text-foreground">{usageCount}</span>
              </p>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
