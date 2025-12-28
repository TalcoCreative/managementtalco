import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, Save } from "lucide-react";

interface Freelancer {
  id?: string;
  name: string;
  cost: number;
  role: string;
}

interface EditShootingDialogProps {
  shootingId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditShootingDialog({ shootingId, open, onOpenChange, onSuccess }: EditShootingDialogProps) {
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
  const [deletedFreelancerIds, setDeletedFreelancerIds] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch shooting detail
  const { data: shooting } = useQuery({
    queryKey: ["shooting-edit", shootingId],
    queryFn: async () => {
      if (!shootingId) return null;
      const { data, error } = await supabase
        .from("shooting_schedules")
        .select("*")
        .eq("id", shootingId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!shootingId && open,
  });

  // Fetch crew
  const { data: crew } = useQuery({
    queryKey: ["shooting-crew-edit", shootingId],
    queryFn: async () => {
      if (!shootingId) return [];
      const { data, error } = await supabase
        .from("shooting_crew")
        .select("*")
        .eq("shooting_id", shootingId);
      if (error) throw error;
      return data;
    },
    enabled: !!shootingId && open,
  });

  // Fetch users
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

  // Fetch clients
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

  // Fetch projects based on selected client
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

  // Populate form when shooting data is loaded
  useEffect(() => {
    if (shooting) {
      setFormData({
        title: shooting.title || "",
        client_id: shooting.client_id || "",
        project_id: shooting.project_id || "",
        scheduled_date: shooting.scheduled_date || "",
        scheduled_time: shooting.scheduled_time || "",
        location: shooting.location || "",
        director: shooting.director || "",
        runner: shooting.runner || "",
        notes: shooting.notes || "",
      });
    }
  }, [shooting]);

  // Populate crew when data is loaded
  useEffect(() => {
    if (crew) {
      const campers = crew.filter(c => c.role === 'camper' && !c.is_freelance && c.user_id).map(c => c.user_id!);
      const additional = crew.filter(c => c.role === 'additional' && !c.is_freelance && c.user_id).map(c => c.user_id!);
      const freelancerList = crew.filter(c => c.is_freelance).map(c => ({
        id: c.id,
        name: c.freelance_name || "",
        cost: c.freelance_cost || 0,
        role: c.role,
      }));
      
      setSelectedCampers(campers);
      setSelectedAdditional(additional);
      setFreelancers(freelancerList);
      setDeletedFreelancerIds([]);
    }
  }, [crew]);

  const addFreelancer = () => {
    if (!newFreelancer.name.trim()) {
      toast.error("Freelancer name is required");
      return;
    }
    setFreelancers([...freelancers, { ...newFreelancer, name: newFreelancer.name.trim() }]);
    setNewFreelancer({ name: "", cost: 0, role: "camper" });
  };

  const removeFreelancer = (index: number) => {
    const freelancer = freelancers[index];
    if (freelancer.id) {
      setDeletedFreelancerIds(prev => [...prev, freelancer.id!]);
    }
    setFreelancers(freelancers.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shootingId) return;
    
    setLoading(true);
    try {
      // Update shooting schedule
      const { error: shootingError } = await supabase
        .from("shooting_schedules")
        .update({
          title: formData.title.trim(),
          client_id: formData.client_id || null,
          project_id: formData.project_id || null,
          scheduled_date: formData.scheduled_date,
          scheduled_time: formData.scheduled_time,
          location: formData.location.trim() || null,
          director: formData.director || null,
          runner: formData.runner || null,
          notes: formData.notes.trim() || null,
        })
        .eq("id", shootingId);

      if (shootingError) throw shootingError;

      // Delete all existing non-freelance crew
      await supabase
        .from("shooting_crew")
        .delete()
        .eq("shooting_id", shootingId)
        .eq("is_freelance", false);

      // Delete removed freelancers
      if (deletedFreelancerIds.length > 0) {
        await supabase
          .from("shooting_crew")
          .delete()
          .in("id", deletedFreelancerIds);
      }

      // Re-add user campers
      if (selectedCampers.length > 0) {
        const camperRecords = selectedCampers.map(userId => ({
          shooting_id: shootingId,
          user_id: userId,
          role: 'camper',
          is_freelance: false,
        }));
        
        await supabase.from("shooting_crew").insert(camperRecords);
      }

      // Re-add user additional crew
      if (selectedAdditional.length > 0) {
        const additionalRecords = selectedAdditional.map(userId => ({
          shooting_id: shootingId,
          user_id: userId,
          role: 'additional',
          is_freelance: false,
        }));
        
        await supabase.from("shooting_crew").insert(additionalRecords);
      }

      // Handle freelancers - update existing and add new
      for (const freelancer of freelancers) {
        if (freelancer.id) {
          // Update existing
          await supabase
            .from("shooting_crew")
            .update({
              freelance_name: freelancer.name,
              freelance_cost: freelancer.cost,
              role: freelancer.role,
            })
            .eq("id", freelancer.id);
        } else {
          // Insert new
          await supabase
            .from("shooting_crew")
            .insert({
              shooting_id: shootingId,
              user_id: null,
              role: freelancer.role,
              is_freelance: true,
              freelance_name: freelancer.name,
              freelance_cost: freelancer.cost,
            });
        }
      }

      toast.success("Shooting schedule updated successfully!");
      queryClient.invalidateQueries({ queryKey: ["shooting-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-crew"] });
      queryClient.invalidateQueries({ queryKey: ["shooting-detail", shootingId] });
      queryClient.invalidateQueries({ queryKey: ["shooting-edit", shootingId] });
      queryClient.invalidateQueries({ queryKey: ["shooting-crew-edit", shootingId] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || "Failed to update shooting schedule");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Shooting Schedule</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 max-h-[calc(90vh-140px)] pr-4">
            <div className="space-y-4 pb-4">
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
                  <Label htmlFor="director">Director</Label>
                  <Select
                    value={formData.director || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, director: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select director" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {users?.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="runner">Runner</Label>
                  <Select
                    value={formData.runner || "_none"}
                    onValueChange={(value) => setFormData({ ...formData, runner: value === "_none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select runner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
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
                <Label>Campers</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-32 overflow-y-auto">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-camper-${user.id}`}
                        checked={selectedCampers.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCampers([...selectedCampers, user.id]);
                          } else {
                            setSelectedCampers(selectedCampers.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <label htmlFor={`edit-camper-${user.id}`} className="text-sm cursor-pointer">
                        {user.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Additional Crew</Label>
                <div className="border rounded-md p-4 space-y-2 max-h-32 overflow-y-auto">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-additional-${user.id}`}
                        checked={selectedAdditional.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAdditional([...selectedAdditional, user.id]);
                          } else {
                            setSelectedAdditional(selectedAdditional.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <label htmlFor={`edit-additional-${user.id}`} className="text-sm cursor-pointer">
                        {user.full_name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Freelancers Section */}
              <div className="space-y-2">
                <Label>Freelancers</Label>
                <div className="border rounded-md p-4 space-y-3">
                  {freelancers.length > 0 && (
                    <div className="space-y-2">
                      {freelancers.map((f, index) => (
                        <div key={f.id || index} className="flex items-center gap-2 p-2 bg-muted rounded">
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
                        <SelectItem value="runner">Runner</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Cost"
                      value={newFreelancer.cost || ""}
                      onChange={(e) => setNewFreelancer({ ...newFreelancer, cost: parseInt(e.target.value) || 0 })}
                    />
                    <Button type="button" variant="outline" onClick={addFreelancer}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
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
          
          <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
