import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, User, Users } from "lucide-react";
import { toast } from "sonner";

interface EventCrewTabProps {
  eventId: string;
  canManage: boolean;
}

const crewRoles = [
  "Event Coordinator",
  "Stage Manager",
  "Documentation",
  "Production Crew",
  "Talent Handler",
  "Runner",
  "Technical Support",
  "MC / Host",
  "Other",
];

const crewStatusColors: Record<string, string> = {
  planned: "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  on_duty: "bg-green-100 text-green-800",
};

const crewStatusLabels: Record<string, string> = {
  planned: "Planned",
  confirmed: "Confirmed",
  on_duty: "On Duty",
};

export function EventCrewTab({ eventId, canManage }: EventCrewTabProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [crewType, setCrewType] = useState<string>("internal");
  const [userId, setUserId] = useState("");
  const [freelancerName, setFreelancerName] = useState("");
  const [freelancerContact, setFreelancerContact] = useState("");
  const [freelancerCompany, setFreelancerCompany] = useState("");
  const [freelancerLocation, setFreelancerLocation] = useState("");
  const [role, setRole] = useState("");
  const [notes, setNotes] = useState("");
  const [fee, setFee] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  const { data: crew, refetch } = useQuery({
    queryKey: ["event-crew", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_crew")
        .select(`
          *,
          user:profiles(full_name)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: freelancers } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addCrewMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("event_crew").insert({
        event_id: eventId,
        crew_type: crewType,
        user_id: crewType === "internal" ? userId : null,
        freelancer_name: crewType === "freelancer" ? freelancerName : null,
        freelancer_contact: crewType === "freelancer" ? freelancerContact : null,
        freelancer_company: crewType === "freelancer" ? freelancerCompany : null,
        freelancer_location: crewType === "freelancer" ? freelancerLocation : null,
        role,
        notes,
        fee: fee ? parseFloat(fee) : null,
      });
      if (error) throw error;

      // Save freelancer to database for future use
      if (crewType === "freelancer" && freelancerName) {
        const { data: session } = await supabase.auth.getSession();
        if (session.session) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("user_id", session.session.user.email)
            .single();

          if (profile) {
            // Check if freelancer already exists
            const { data: existing } = await supabase
              .from("freelancers")
              .select("id")
              .eq("name", freelancerName)
              .single();

            if (!existing) {
              await supabase.from("freelancers").insert({
                name: freelancerName,
                contact: freelancerContact,
                company: freelancerCompany,
                location: freelancerLocation,
                created_by: profile.id,
              });
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Crew berhasil ditambahkan");
      resetForm();
      setAddOpen(false);
      refetch();
    },
    onError: (error) => {
      console.error("Error adding crew:", error);
      toast.error("Gagal menambahkan crew");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("event_crew")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status crew diperbarui");
      refetch();
    },
    onError: () => {
      toast.error("Gagal memperbarui status");
    },
  });

  const deleteCrewMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_crew")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Crew dihapus");
      refetch();
    },
    onError: () => {
      toast.error("Gagal menghapus crew");
    },
  });

  const resetForm = () => {
    setCrewType("internal");
    setUserId("");
    setFreelancerName("");
    setFreelancerContact("");
    setFreelancerCompany("");
    setFreelancerLocation("");
    setRole("");
    setNotes("");
    setFee("");
  };

  const handleSelectFreelancer = (freelancerId: string) => {
    const freelancer = freelancers?.find(f => f.id === freelancerId);
    if (freelancer) {
      setFreelancerName(freelancer.name);
      setFreelancerContact(freelancer.contact || "");
      setFreelancerCompany(freelancer.company || "");
      setFreelancerLocation(freelancer.location || "");
    }
  };

  const filteredCrew = crew?.filter(c => {
    if (filterType === "all") return true;
    return c.crew_type === filterType;
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h3 className="font-medium">Crew Event</h3>
          <Badge variant="outline">{crew?.length || 0} orang</Badge>
        </div>
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="internal">Internal</SelectItem>
              <SelectItem value="freelancer">Freelancer</SelectItem>
            </SelectContent>
          </Select>
          {canManage && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Crew
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Kontak</TableHead>
            {canManage && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCrew?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                Belum ada crew
              </TableCell>
            </TableRow>
          ) : (
            filteredCrew?.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{member.crew_type === "internal" ? member.user?.full_name : member.freelancer_name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={member.crew_type === "internal" ? "default" : "secondary"}>
                    {member.crew_type === "internal" ? "Internal" : "Freelancer"}
                  </Badge>
                </TableCell>
                <TableCell>{member.role}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Select
                      value={member.status}
                      onValueChange={(status) => updateStatusMutation.mutate({ id: member.id, status })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="on_duty">On Duty</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={crewStatusColors[member.status]}>
                      {crewStatusLabels[member.status]}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {member.crew_type === "freelancer" ? member.freelancer_contact : "-"}
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteCrewMutation.mutate(member.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Crew</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipe Crew</Label>
              <Select value={crewType} onValueChange={setCrewType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal Staff</SelectItem>
                  <SelectItem value="freelancer">Freelancer / External</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {crewType === "internal" ? (
              <div>
                <Label>Pilih Karyawan</Label>
                <Select value={userId} onValueChange={setUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih karyawan" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                {freelancers && freelancers.length > 0 && (
                  <div>
                    <Label>Pilih dari Database (opsional)</Label>
                    <Select onValueChange={handleSelectFreelancer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih freelancer tersimpan" />
                      </SelectTrigger>
                      <SelectContent>
                        {freelancers.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name} {f.company ? `(${f.company})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Nama Lengkap *</Label>
                  <Input
                    value={freelancerName}
                    onChange={(e) => setFreelancerName(e.target.value)}
                    placeholder="Nama freelancer"
                  />
                </div>
                <div>
                  <Label>Kontak (WA/Email)</Label>
                  <Input
                    value={freelancerContact}
                    onChange={(e) => setFreelancerContact(e.target.value)}
                    placeholder="Nomor WA atau email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Perusahaan</Label>
                    <Input
                      value={freelancerCompany}
                      onChange={(e) => setFreelancerCompany(e.target.value)}
                      placeholder="Nama perusahaan"
                    />
                  </div>
                  <div>
                    <Label>Lokasi</Label>
                    <Input
                      value={freelancerLocation}
                      onChange={(e) => setFreelancerLocation(e.target.value)}
                      placeholder="Kota/lokasi"
                    />
                  </div>
                </div>
                <div>
                  <Label>Fee / Rate (opsional)</Label>
                  <Input
                    type="number"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </>
            )}

            <div>
              <Label>Role dalam Event *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {crewRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan..."
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={() => addCrewMutation.mutate()}
                disabled={addCrewMutation.isPending || !role || (crewType === "internal" ? !userId : !freelancerName)}
              >
                Tambah
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
