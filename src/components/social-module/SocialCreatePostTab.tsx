import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ImagePlus,
  CalendarIcon,
  Send,
  Clock,
  Instagram,
  Facebook,
  Loader2,
  CheckCircle2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSocialAccounts, useSocialPosts } from "@/hooks/useSocialModule";

interface Props {
  onPostCreated?: () => void;
}

// Demo images for simulation
const DEMO_IMAGES = [
  "https://picsum.photos/seed/demo1/800/800",
  "https://picsum.photos/seed/demo2/800/800",
  "https://picsum.photos/seed/demo3/800/800",
  "https://picsum.photos/seed/demo4/800/800",
];

export function SocialCreatePostTab({ onPostCreated }: Props) {
  const { data: accounts } = useSocialAccounts();
  const { createPost } = useSocialPosts();
  const [accountId, setAccountId] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [scheduleDate, setScheduleDate] = useState<Date>();
  const [scheduleTime, setScheduleTime] = useState("12:00");
  const [isScheduled, setIsScheduled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const connectedAccounts = accounts?.filter(
    (a: any) => a.status === "connected" || a.is_connected === true
  );

  const selectedAccount = connectedAccounts?.find((a: any) => a.id === accountId);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        // Use a demo image URL for the DB
        setImageUrl(DEMO_IMAGES[Math.floor(Math.random() * DEMO_IMAGES.length)]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!accountId || !caption.trim()) return;

    setSubmitting(true);
    // Simulate processing
    await new Promise((r) => setTimeout(r, 1200));

    let scheduledTime: string | undefined;
    if (isScheduled && scheduleDate) {
      const [h, m] = scheduleTime.split(":").map(Number);
      const d = new Date(scheduleDate);
      d.setHours(h, m, 0, 0);
      scheduledTime = d.toISOString();
    }

    await createPost.mutateAsync({
      accountId,
      caption,
      imageUrl: imageUrl || DEMO_IMAGES[0],
      scheduledTime,
      platform: selectedAccount?.platform || "instagram",
    });

    setSubmitting(false);
    setSuccess(true);

    // Reset after showing success
    setTimeout(() => {
      setSuccess(false);
      setCaption("");
      setImageUrl("");
      setImagePreview("");
      setAccountId("");
      setScheduleDate(undefined);
      setIsScheduled(false);
      onPostCreated?.();
    }, 2000);
  };

  if (success) {
    return (
      <Card>
        <CardContent className="py-16 flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-semibold">Post Created Successfully!</h3>
          <p className="text-muted-foreground text-center max-w-md">
            {isScheduled
              ? `Your post has been scheduled for ${scheduleDate ? format(scheduleDate, "PPP") : ""} at ${scheduleTime}.`
              : "Your post has been published immediately."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Form */}
      <div className="lg:col-span-3 space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Post</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Account Select */}
            <div className="space-y-2">
              <Label>Select Account *</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an account..." />
                </SelectTrigger>
                <SelectContent>
                  {connectedAccounts?.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        {a.platform === "instagram" ? (
                          <Instagram className="h-4 w-4 text-pink-500" />
                        ) : (
                          <Facebook className="h-4 w-4 text-blue-600" />
                        )}
                        {a.account_name || a.platform}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label>Image</Label>
              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full max-h-64 object-cover rounded-xl border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setImagePreview("");
                      setImageUrl("");
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-xl cursor-pointer hover:bg-accent/30 transition-colors">
                  <ImagePlus className="h-8 w-8 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">
                    Click to upload image
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                </label>
              )}
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label>Caption *</Label>
              <Textarea
                placeholder="Write your caption here..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground text-right">
                {caption.length} characters
              </p>
            </div>

            {/* Schedule Toggle */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Button
                  variant={isScheduled ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsScheduled(!isScheduled)}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {isScheduled ? "Scheduled" : "Schedule for later"}
                </Button>
                {!isScheduled && (
                  <span className="text-xs text-muted-foreground">
                    Post will be published immediately
                  </span>
                )}
              </div>

              {isScheduled && (
                <div className="flex flex-wrap gap-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[200px] justify-start text-left font-normal",
                          !scheduleDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduleDate ? format(scheduleDate, "PPP") : "Pick date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduleDate}
                        onSelect={setScheduleDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="w-[130px]"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSubmit}
          disabled={!accountId || !caption.trim() || submitting}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {submitting
            ? "Publishing..."
            : isScheduled
            ? "Schedule Post"
            : "Publish Now"}
        </Button>
      </div>

      {/* Preview */}
      <div className="lg:col-span-2">
        <Card className="sticky top-6">
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden bg-background">
              {/* Header */}
              <div className="flex items-center gap-2 p-3 border-b">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                <div>
                  <p className="text-xs font-semibold">
                    {selectedAccount?.account_name || "Select account"}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {selectedAccount?.platform || "Platform"}
                  </p>
                </div>
              </div>
              {/* Image */}
              <div className="aspect-square bg-muted flex items-center justify-center">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-12 w-12 text-muted-foreground/30" />
                )}
              </div>
              {/* Caption */}
              <div className="p-3">
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {caption || (
                    <span className="text-muted-foreground italic">
                      Your caption will appear here...
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
