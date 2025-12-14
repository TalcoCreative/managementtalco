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
import { Plus, X } from "lucide-react";
import { z } from "zod";

const shootingSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  client_id: z.string().min(1, "Client is required"),
  project_id: z.string().min(1, "Project is required"),
  scheduled_date: z.string().min(1, "Date is required"),
  scheduled_time: z.string().min(1, "Time is required"),
  location: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1000).optional(),
});

interface Freelancer {
  name: string;
  cost: number;
  role: string;
}

export function CreateShootingDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    client_id: "",
    project_id: "",
    scheduled_date: "",
    scheduled_time: "",
    location: "",
    director: "",
    runner: "",
    notes: "",
  });
  const [selectedCampers, setSelectedCampers] = useState<string[]>([]);
  const [selectedAdditional, setSelectedAdditional] = useState<string[]>([]);
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [newFreelancer, setNewFreelancer] = useState<Freelancer>({ name: "", cost: 0, role: "camper" });
  const queryClient = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, status")
        .or("status.is.null,status.eq.active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects } = useQuery({
    queryKey: ["projects-by-client", formData.client_id],
    queryFn: async () => {
      if (!formData.client_id) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .eq("client_id", formData.client_id)
        .order("title");
      if (error) throw error;
      return data;
    },
    enabled: !!formData.client_id,
  });

  const addFreelancer = () => {
    if (!newFreelancer.name.trim()) {
      toast.error("Freelancer name is required");
      return;
    }
    setFreelancers([...freelancers, { ...newFreelancer, name: newFreelancer.name.trim() }]);
    setNewFreelancer({ name: "", cost: 0, role: "camper" });
  };

  const removeFreelancer = (index: number) => {
    setFreelancers(freelancers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      shootingSchema.parse(formData);
      
      setLoading(true);
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create the task first
      const { data: task, error: taskError } = await supabase
        .from("tasks")
        .insert({
          title: `Shooting: ${formData.title.trim()}`,
          description: `Shooting schedule for ${formData.title}\nLocation: ${formData.location || "TBD"}\nTime: ${formData.scheduled_time}`,
          project_id: formData.project_id,
          created_by: session.session.user.id,
          assigned_to: formData.director || session.session.user.id,
          deadline: formData.scheduled_date,
          priority: "high",
          status: "pending",
        })
        .select()
        .single();

      if (taskError) throw taskError;

      const { data: shooting, error: shootingError } = await supabase
        .from("shooting_schedules")
        .insert({
          title: formData.title.trim(),
          client_id: formData.client_id,
          project_id: formData.project_id,
          task_id: task.id,
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

      // Add user campers
      if (selectedCampers.length > 0) {
        const camperRecords = selectedCampers.map(userId => ({
          shooting_id: shooting.id,
          user_id: userId,
          role: 'camper',
          is_freelance: false,
        }));
        
        const { error: campersError } = await supabase
          .from("shooting_crew")
          .insert(camperRecords);
        
        if (campersError) throw campersError;
      }

      // Add user additional crew
      if (selectedAdditional.length > 0) {
        const additionalRecords = selectedAdditional.map(userId => ({
          shooting_id: shooting.id,
          user_id: userId,
          role: 'additional',
          is_freelance: false,
        }));
        
        const { error: additionalError } = await supabase
          .from("shooting_crew")
          .insert(additionalRecords);
        
        if (additionalError) throw additionalError;
      }

      // Add freelancers
      if (freelancers.length > 0) {
        const freelancerRecords = freelancers.map(f => ({
          shooting_id: shooting.id,
          user_id: null,
          role: f.role,
          is_freelance: true,
          freelance_name: f.name,
          freelance_cost: f.cost,
        }));
        
        const { error: freelancerError } = await supabase
          .from("shooting_crew")
          .insert(freelancerRecords);
        
        if (freelancerError) throw freelancerError;
      }

      // Create notifications only for involved users
      const notifyUsers = new Set([
        ...selectedCampers,
        ...selectedAdditional,
        formData.director,
        formData.runner,
      ].filter(Boolean));

      if (notifyUsers.size > 0) {
        const notifications = Array.from(notifyUsers).map(userId => {
          let role = 'crew';
          if (userId === formData.director) role = 'director';
          else if (userId === formData.runner) role = 'runner';
          else if (selectedCampers.includes(userId)) role = 'camper';
          else if (selectedAdditional.includes(userId)) role = 'additional';
          
          return {
            shooting_id: shooting.id,
            user_id: userId,
            status: 'pending',
            crew_role: role,
          };
        });

        await supabase.from("shooting_notifications").insert(notifications);
      }

      toast.success("Shooting schedule requested successfully!");
      setOpen(false);
      setFormData({
        title: "",
        client_id: "",
        project_id: "",
        scheduled_date: "",
        scheduled_time: "",
        location: "",
        director: "",
        runner: "",
        notes: "",
      });
      setSelectedCampers([]);
      setSelectedAdditional([]);
      setFreelancers([]);
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-crew"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["active-tasks"] });
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
                  <Label>Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: "" })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients?.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Project *</Label>
                  <Select
                    value={formData.project_id}
                    onValueChange={(value) => setFormData({ ...formData, project_id: value })}
                    disabled={!formData.client_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={formData.client_id ? "Select project" : "Select client first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects?.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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

              {/* Freelancers Section */}
              <div className="space-y-2">
                <Label>Freelancers (Optional)</Label>
                <div className="border rounded-md p-4 space-y-3">
                  {freelancers.length > 0 && (
                    <div className="space-y-2">
                      {freelancers.map((f, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <span className="flex-1 text-sm">{f.name}</span>
                          <span className="text-sm text-muted-foreground capitalize">{f.role}</span>
                          <span className="text-sm font-medium">Rp {f.cost.toLocaleString()}</span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFreelancer(index)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    <Input
                      placeholder="Name"
                      value={newFreelancer.name}
                      onChange={(e) => setNewFreelancer({ ...newFreelancer, name: e.target.value })}
                      className="col-span-2"
                    />
                    <Select
                      value={newFreelancer.role}
                      onValueChange={(value) => setNewFreelancer({ ...newFreelancer, role: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="camper">Camper</SelectItem>
                        <SelectItem value="additional">Additional</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Cost"
                      value={newFreelancer.cost || ""}
                      onChange={(e) => setNewFreelancer({ ...newFreelancer, cost: Number(e.target.value) })}
                    />
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={addFreelancer}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Freelancer
                  </Button>
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
