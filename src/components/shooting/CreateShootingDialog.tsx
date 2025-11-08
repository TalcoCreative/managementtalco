import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { z } from "zod";

const shootingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  scheduled_date: z.string().min(1, "Date is required"),
  scheduled_time: z.string().min(1, "Time is required"),
  location: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export function CreateShootingDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    scheduled_date: "",
    scheduled_time: "",
    location: "",
    director: "",
    runner: "",
    notes: "",
  });
  const [selectedCampers, setSelectedCampers] = useState<string[]>([]);
  const [selectedAdditional, setSelectedAdditional] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch users for crew selection
  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      shootingSchema.parse(formData);
      
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create shooting schedule
      const { data: shooting, error: shootingError } = await supabase
        .from("shooting_schedules")
        .insert({
          title: formData.title.trim(),
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          location: formData.location.trim() || null,
          director: formData.director || null,
          runner: formData.runner || null,
          notes: formData.notes.trim() || null,
          requested_by: session.session.user.id,
          status: "pending",
        })
        .select()
        .single();

      if (shootingError) throw shootingError;

      // Add campers
      if (selectedCampers.length > 0) {
        const camperRecords = selectedCampers.map(userId => ({
          shooting_id: shooting.id,
          user_id: userId,
          role: 'camper',
        }));
        
        const { error: campersError } = await supabase
          .from("shooting_crew")
          .insert(camperRecords);
        
        if (campersError) throw campersError;
      }

      // Add additional crew
      if (selectedAdditional.length > 0) {
        const additionalRecords = selectedAdditional.map(userId => ({
          shooting_id: shooting.id,
          user_id: userId,
          role: 'additional',
        }));
        
        const { error: additionalError } = await supabase
          .from("shooting_crew")
          .insert(additionalRecords);
        
        if (additionalError) throw additionalError;
      }

      toast.success("Shooting schedule requested successfully!");
      setOpen(false);
      setFormData({
        title: "",
        scheduled_date: "",
        scheduled_time: "",
        location: "",
        director: "",
        runner: "",
        notes: "",
      });
      setSelectedCampers([]);
      setSelectedAdditional([]);
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-crew"] });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message || "Failed to create shooting schedule");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Request Shooting
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Shooting Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  maxLength={200}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scheduled_date">Date *</Label>
                  <Input
                    id="scheduled_date"
                    type="date"
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduled_time">Time *</Label>
                  <Input
                    id="scheduled_time"
                    type="time"
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="director">Director (Optional)</Label>
                  <Select
                    value={formData.director}
                    onValueChange={(value) => setFormData({ ...formData, director: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select director" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="runner">Runner (Optional)</Label>
                  <Select
                    value={formData.runner}
                    onValueChange={(value) => setFormData({ ...formData, runner: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select runner" />
                    </SelectTrigger>
                    <SelectContent>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Campers (Optional)</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-32 overflow-y-auto">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`camper-${user.id}`}
                        checked={selectedCampers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCampers([...selectedCampers, user.id]);
                          } else {
                            setSelectedCampers(selectedCampers.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <label htmlFor={`camper-${user.id}`} className="text-sm cursor-pointer">
                        {user.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Additional Crew (Optional)</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-32 overflow-y-auto">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`additional-${user.id}`}
                        checked={selectedAdditional.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAdditional([...selectedAdditional, user.id]);
                          } else {
                            setSelectedAdditional(selectedAdditional.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <label htmlFor={`additional-${user.id}`} className="text-sm cursor-pointer">
                        {user.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  maxLength={1000}
                  rows={3}
                />
              </div>
            </div>
          </ScrollArea>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit Request"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
