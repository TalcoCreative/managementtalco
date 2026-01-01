import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, Check, Link as LinkIcon, Globe, Lock } from "lucide-react";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  entityType: "task" | "project" | "shooting" | "meeting";
  onGenerateToken: () => Promise<string>;
  onDisableSharing: () => Promise<void>;
}

export function ShareLinkDialog({
  open,
  onOpenChange,
  shareToken,
  entityType,
  onGenerateToken,
  onDisableSharing,
}: ShareLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const getShareUrl = () => {
    if (!shareToken) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${entityType}/${shareToken}`;
  };

  const handleToggleSharing = async () => {
    setLoading(true);
    try {
      if (shareToken) {
        await onDisableSharing();
        toast.success("Public sharing disabled");
      } else {
        await onGenerateToken();
        toast.success("Public link generated!");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update sharing settings");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const url = getShareUrl();
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const entityLabel = {
    task: "Task",
    project: "Project",
    shooting: "Shooting",
    meeting: "Meeting",
  }[entityType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Share {entityLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Toggle Public Sharing */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              {shareToken ? (
                <Globe className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label className="text-base font-medium">Public Link</Label>
                <p className="text-sm text-muted-foreground">
                  {shareToken
                    ? "Anyone with the link can view"
                    : "Only team members can access"}
                </p>
              </div>
            </div>
            <Switch
              checked={!!shareToken}
              onCheckedChange={handleToggleSharing}
              disabled={loading}
            />
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`w-2 h-2 rounded-full ${
                shareToken ? "bg-green-500" : "bg-red-500"
              }`}
            />
            <span className={shareToken ? "text-green-600" : "text-red-600"}>
              {shareToken ? "🟢 Public Enabled" : "🔴 Not Shared"}
            </span>
          </div>

          {/* Share Link Input */}
          {shareToken && (
            <div className="space-y-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={getShareUrl()}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link with anyone to give them view-only access.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
