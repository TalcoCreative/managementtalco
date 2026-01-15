import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ExternalLink, Copy, Eye, ChevronDown, Sparkles } from "lucide-react";
import { toast } from "sonner";

const INDUSTRIES = [
  "Healthcare",
  "Finance", 
  "Education",
  "F&B",
  "Creative / Agency",
  "Personal Brand",
  "Event / Community",
  "Custom"
];

const OBJECTIVES = [
  "Awareness",
  "Education",
  "Promotion",
  "Personal Branding",
  "Event Campaign",
  "Lead Generation"
];

const TONES = [
  "Educational",
  "Professional",
  "Friendly",
  "Emotional",
  "Authoritative"
];

const PLATFORMS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "LinkedIn",
  "Multi-platform"
];

const CONTENT_FORMATS = [
  "Feed",
  "Carousel",
  "Story",
  "Reels / Short Video",
  "Video Ads",
  "Graphic Ads",
  "Podcast",
  "Event Post"
];

const CAMPAIGN_TYPES = [
  "Evergreen",
  "Launch",
  "Promo",
  "Event",
  "Trend-based"
];

interface FormData {
  industry: string;
  brandName: string;
  mainTopic: string;
  productService: string;
  objective: string;
  targetAudience: string;
  tone: string;
  primaryPlatform: string;
  contentFormats: string[];
  campaignType: string;
  ctaGoal: string;
  secondaryPlatforms: string;
  location: string;
  competitorReference: string;
  additionalNotes: string;
}

const generatePrompt = (data: FormData): string => {
  const formatsText = data.contentFormats.length > 0 ? data.contentFormats.join(", ") : "Various formats";
  
  return `You are an expert content strategist, researcher, and creative director with deep expertise in ${data.industry} industry. Your role combines research analysis, strategic planning, creative execution, and ethical content creation.

=== CONTEXT ===
Brand/Project: ${data.brandName}
Industry: ${data.industry}
Main Topic/Theme: ${data.mainTopic}
Product/Service/Message: ${data.productService}
Campaign Objective: ${data.objective}
Target Audience: ${data.targetAudience}
Tone & Personality: ${data.tone}
Primary Platform: ${data.primaryPlatform}
Content Formats Needed: ${formatsText}
Campaign Type: ${data.campaignType}
CTA Goal: ${data.ctaGoal}
${data.secondaryPlatforms ? `Secondary Platforms: ${data.secondaryPlatforms}` : ""}
${data.location ? `Location/Market: ${data.location}` : ""}
${data.competitorReference ? `Competitor Reference: ${data.competitorReference}` : ""}
${data.additionalNotes ? `Additional Notes: ${data.additionalNotes}` : ""}

=== PHASE 1: DEEP RESEARCH ===
Please conduct thorough research on:
1. Current trends in ${data.industry} industry related to ${data.mainTopic}
2. Target audience (${data.targetAudience}) behavior, pain points, and content preferences
3. ${data.primaryPlatform} algorithm best practices and optimal posting strategies
4. Competitor analysis and content gaps in the market
5. Trending hashtags, sounds, and formats for ${data.primaryPlatform}

=== PHASE 2: CONTENT STRATEGY ===
Based on research, develop:
1. Content pillars and themes aligned with ${data.objective}
2. Content calendar structure (weekly/monthly)
3. Hook strategies for ${data.targetAudience}
4. Engagement tactics specific to ${data.primaryPlatform}
5. Cross-platform adaptation strategy

=== PHASE 3: CONTENT GENERATION ===
Create content for the following formats: ${formatsText}

For each format, provide:
1. 3 caption variations (short, medium, long)
2. Hook options (first line/first 3 seconds)
3. Script outline (for video content)
4. Visual/design direction
5. Hashtag strategy (mix of trending + niche)
6. Best posting time recommendations

=== PHASE 4: PLATFORM OPTIMIZATION ===
Optimize for ${data.primaryPlatform}:
1. Algorithm-friendly formatting
2. Engagement prompts and CTA placement
3. Accessibility considerations (alt text, captions)
4. A/B testing suggestions

=== PHASE 5: ETHICAL & SAFETY NOTES ===
Include:
1. Content authenticity guidelines
2. Disclosure requirements (if applicable)
3. Cultural sensitivity considerations
4. Brand safety checklist

Please provide comprehensive, actionable content that I can implement immediately for ${data.brandName}.`;
};

export default function ContentBuilder() {
  const [formData, setFormData] = useState<FormData>({
    industry: "",
    brandName: "",
    mainTopic: "",
    productService: "",
    objective: "",
    targetAudience: "",
    tone: "",
    primaryPlatform: "",
    contentFormats: [],
    campaignType: "",
    ctaGoal: "",
    secondaryPlatforms: "",
    location: "",
    competitorReference: "",
    additionalNotes: ""
  });
  
  const [optionalOpen, setOptionalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const isFormValid = 
    formData.industry &&
    formData.brandName &&
    formData.mainTopic &&
    formData.productService &&
    formData.objective &&
    formData.targetAudience &&
    formData.tone &&
    formData.primaryPlatform &&
    formData.contentFormats.length > 0 &&
    formData.campaignType &&
    formData.ctaGoal;

  const handleFormatToggle = (format: string) => {
    setFormData(prev => ({
      ...prev,
      contentFormats: prev.contentFormats.includes(format)
        ? prev.contentFormats.filter(f => f !== format)
        : [...prev.contentFormats, format]
    }));
  };

  const generatedPrompt = generatePrompt(formData);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast.success("Prompt copied to clipboard!");
  };

  const handleOpenChatGPT = () => {
    const encodedPrompt = encodeURIComponent(generatedPrompt);
    const url = `https://chatgpt.com/?model=gpt-4&q=${encodedPrompt}`;
    window.open(url, "_blank");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Content Builder</h1>
          <p className="text-muted-foreground">Generate AI-powered content prompts for your social media strategy</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Build Your Content Prompt
            </CardTitle>
            <CardDescription>
              Fill in the details below to generate a comprehensive content strategy prompt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Required Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="industry">Industry *</Label>
                <Select value={formData.industry} onValueChange={(v) => setFormData(prev => ({ ...prev, industry: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(ind => (
                      <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="brandName">Brand / Project Name *</Label>
                <Input
                  id="brandName"
                  value={formData.brandName}
                  onChange={(e) => setFormData(prev => ({ ...prev, brandName: e.target.value }))}
                  placeholder="Enter brand or project name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mainTopic">Main Topic / Theme *</Label>
                <Input
                  id="mainTopic"
                  value={formData.mainTopic}
                  onChange={(e) => setFormData(prev => ({ ...prev, mainTopic: e.target.value }))}
                  placeholder="e.g., Sustainable Fashion, Digital Marketing"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productService">Product / Service / Message *</Label>
                <Input
                  id="productService"
                  value={formData.productService}
                  onChange={(e) => setFormData(prev => ({ ...prev, productService: e.target.value }))}
                  placeholder="What are you promoting?"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="objective">Objective *</Label>
                <Select value={formData.objective} onValueChange={(v) => setFormData(prev => ({ ...prev, objective: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select objective" />
                  </SelectTrigger>
                  <SelectContent>
                    {OBJECTIVES.map(obj => (
                      <SelectItem key={obj} value={obj}>{obj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="targetAudience">Target Audience *</Label>
                <Input
                  id="targetAudience"
                  value={formData.targetAudience}
                  onChange={(e) => setFormData(prev => ({ ...prev, targetAudience: e.target.value }))}
                  placeholder="e.g., Women 25-35, Tech enthusiasts"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Tone & Personality *</Label>
                <Select value={formData.tone} onValueChange={(v) => setFormData(prev => ({ ...prev, tone: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TONES.map(tone => (
                      <SelectItem key={tone} value={tone}>{tone}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryPlatform">Primary Platform *</Label>
                <Select value={formData.primaryPlatform} onValueChange={(v) => setFormData(prev => ({ ...prev, primaryPlatform: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(platform => (
                      <SelectItem key={platform} value={platform}>{platform}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaignType">Campaign Type *</Label>
                <Select value={formData.campaignType} onValueChange={(v) => setFormData(prev => ({ ...prev, campaignType: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPAIGN_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ctaGoal">CTA Goal *</Label>
                <Input
                  id="ctaGoal"
                  value={formData.ctaGoal}
                  onChange={(e) => setFormData(prev => ({ ...prev, ctaGoal: e.target.value }))}
                  placeholder="e.g., Visit website, Book consultation"
                />
              </div>
            </div>

            {/* Content Formats - Multi-select */}
            <div className="space-y-3">
              <Label>Content Formats * (Select multiple)</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {CONTENT_FORMATS.map(format => (
                  <div key={format} className="flex items-center space-x-2">
                    <Checkbox
                      id={format}
                      checked={formData.contentFormats.includes(format)}
                      onCheckedChange={() => handleFormatToggle(format)}
                    />
                    <label htmlFor={format} className="text-sm cursor-pointer">{format}</label>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional Fields */}
            <Collapsible open={optionalOpen} onOpenChange={setOptionalOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span>Optional Fields</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${optionalOpen ? "rotate-180" : ""}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="secondaryPlatforms">Secondary Platforms</Label>
                    <Input
                      id="secondaryPlatforms"
                      value={formData.secondaryPlatforms}
                      onChange={(e) => setFormData(prev => ({ ...prev, secondaryPlatforms: e.target.value }))}
                      placeholder="e.g., Twitter, Facebook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location">Location / Market</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="e.g., Indonesia, Southeast Asia"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="competitorReference">Competitor Reference</Label>
                    <Input
                      id="competitorReference"
                      value={formData.competitorReference}
                      onChange={(e) => setFormData(prev => ({ ...prev, competitorReference: e.target.value }))}
                      placeholder="e.g., @competitor1, brand xyz"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="additionalNotes">Additional Notes</Label>
                    <Textarea
                      id="additionalNotes"
                      value={formData.additionalNotes}
                      onChange={(e) => setFormData(prev => ({ ...prev, additionalNotes: e.target.value }))}
                      placeholder="Any specific requirements or context..."
                      rows={3}
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="flex-1" disabled={!isFormValid}>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview Prompt
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Generated Prompt Preview</DialogTitle>
                  </DialogHeader>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto">
                    {generatedPrompt}
                  </pre>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" onClick={handleCopyPrompt} className="flex-1">
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </Button>
                    <Button onClick={handleOpenChatGPT} className="flex-1">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in ChatGPT
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button variant="outline" onClick={handleCopyPrompt} disabled={!isFormValid} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Prompt
              </Button>

              <Button onClick={handleOpenChatGPT} disabled={!isFormValid} className="flex-1">
                <ExternalLink className="h-4 w-4 mr-2" />
                🚀 Generate with ChatGPT
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Prompt will open in ChatGPT (new tab). No AI processing happens locally.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
