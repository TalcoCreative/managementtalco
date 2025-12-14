import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, MapPin, CreditCard, Calendar, DollarSign, Phone, Mail, Edit, Save, X, AlertCircle, Landmark, Shield } from "lucide-react";
import { format } from "date-fns";

const allRoles = [
  { value: "super_admin", label: "Super Admin" },
  { value: "hr", label: "HR" },
  { value: "graphic_designer", label: "Graphic Designer" },
  { value: "socmed_admin", label: "Social Media Admin" },
  { value: "copywriter", label: "Copywriter" },
  { value: "video_editor", label: "Video Editor" },
  { value: "finance", label: "Finance" },
  { value: "accounting", label: "Accounting" },
  { value: "marketing", label: "Marketing" },
  { value: "photographer", label: "Photographer" },
  { value: "director", label: "Director" },
  { value: "project_manager", label: "Project Manager" },
];

interface EmployeeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: any;
  canEdit: boolean;
}

export function EmployeeDetailDialog({ open, onOpenChange, employee, canEdit }: EmployeeDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [currentRoles, setCurrentRoles] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    full_name: "",
    address: "",
    ktp_number: "",
    contract_start: "",
    contract_end: "",
    salary: "",
    gaji_pokok: "",
    tj_transport: "",
    tj_internet: "",
    tj_kpi: "",
    avatar_url: "",
    phone: "",
    email: "",
    emergency_contact: "",
    bank_account_number: "",
    bank_account_name: "",
    status: "active",
  });
  const queryClient = useQueryClient();

  useEffect(() => {
    if (employee) {
      setFormData({
        full_name: employee.full_name || "",
        address: employee.address || "",
        ktp_number: employee.ktp_number || "",
        contract_start: employee.contract_start || "",
        contract_end: employee.contract_end || "",
        salary: employee.salary?.toString() || "",
        gaji_pokok: employee.gaji_pokok?.toString() || "",
        tj_transport: employee.tj_transport?.toString() || "",
        tj_internet: employee.tj_internet?.toString() || "",
        tj_kpi: employee.tj_kpi?.toString() || "",
        avatar_url: employee.avatar_url || "",
        phone: employee.phone || "",
        email: employee.email || employee.user_id || "",
        emergency_contact: employee.emergency_contact || "",
        bank_account_number: employee.bank_account_number || "",
        bank_account_name: employee.bank_account_name || "",
        status: employee.status || "active",
      });
      setCurrentRoles(employee.user_roles?.map((ur: any) => ur.role) || []);
    }
  }, [employee]);

  const availableRoles = allRoles.filter(role => !currentRoles.includes(role.value));

  const handleAddRole = async () => {
    if (!selectedRole) {
      toast.error("Please select a role");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .insert([{
          user_id: employee.id,
          role: selectedRole as any,
        }]);

      if (error) throw error;

      toast.success("Role added successfully");
      setCurrentRoles([...currentRoles, selectedRole]);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
      setSelectedRole("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleToRemove: string) => {
    if (currentRoles.length <= 1) {
      toast.error("User must have at least one role");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", employee.id)
        .eq("role", roleToRemove as any);

      if (error) throw error;

      toast.success("Role removed successfully");
      setCurrentRoles(currentRoles.filter(r => r !== roleToRemove));
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          address: formData.address || null,
          ktp_number: formData.ktp_number || null,
          contract_start: formData.contract_start || null,
          contract_end: formData.contract_end || null,
          salary: formData.salary ? parseFloat(formData.salary) : null,
          gaji_pokok: formData.gaji_pokok ? parseFloat(formData.gaji_pokok) : 0,
          tj_transport: formData.tj_transport ? parseFloat(formData.tj_transport) : 0,
          tj_internet: formData.tj_internet ? parseFloat(formData.tj_internet) : 0,
          tj_kpi: formData.tj_kpi ? parseFloat(formData.tj_kpi) : 0,
          avatar_url: formData.avatar_url || null,
          phone: formData.phone || null,
          email: formData.email || null,
          emergency_contact: formData.emergency_contact || null,
          bank_account_number: formData.bank_account_number || null,
          bank_account_name: formData.bank_account_name || null,
          status: formData.status,
        })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Employee data updated successfully");
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to update employee data");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null) => {
    if (!value) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "bg-primary";
      case "hr":
        return "bg-blue-500";
      case "socmed_admin":
        return "bg-yellow-500";
      case "graphic_designer":
        return "bg-purple-500";
      case "copywriter":
        return "bg-green-500";
      case "video_editor":
        return "bg-red-500";
      case "finance":
        return "bg-emerald-500";
      case "accounting":
        return "bg-cyan-500";
      case "marketing":
        return "bg-orange-500";
      case "photographer":
        return "bg-pink-500";
      case "director":
        return "bg-indigo-500";
      case "project_manager":
        return "bg-teal-500";
      default:
        return "bg-muted";
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Employee Detail</DialogTitle>
            {canEdit && !isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={loading}>
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Profile Header */}
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={formData.avatar_url} />
              <AvatarFallback className="text-2xl bg-gradient-primary text-primary-foreground">
                {formData.full_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <h2 className="text-2xl font-bold">{employee.full_name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex flex-wrap gap-2">
                      {currentRoles.map((role: string, index: number) => (
                        <Badge key={index} className={getRoleColor(role)}>
                          {role.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                    <Badge variant={formData.status === 'active' ? 'default' : 'secondary'}>
                      {formData.status === 'active' ? 'Active' : 'Non-Active'}
                    </Badge>
                  </div>
                </>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Avatar URL</Label>
                <Input
                  placeholder="https://example.com/photo.jpg"
                  value={formData.avatar_url}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Status Karyawan</Label>
                  <p className="text-sm text-muted-foreground">Aktifkan atau nonaktifkan karyawan</p>
                </div>
                <Switch
                  checked={formData.status === 'active'}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked ? 'active' : 'non_active' })}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Role Management */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Manage Roles
            </h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {currentRoles.map((role: string) => (
                  <Badge key={role} className={`${getRoleColor(role)} flex items-center gap-1`}>
                    {role.replace(/_/g, " ")}
                    {canEdit && (
                      <button
                        onClick={() => handleRemoveRole(role)}
                        disabled={loading || currentRoles.length <= 1}
                        className="hover:bg-white/20 rounded-full p-0.5 disabled:opacity-50"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </Badge>
                ))}
              </div>
              
              {canEdit && availableRoles.length > 0 && (
                <div className="flex gap-2">
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a role to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddRole} disabled={loading || !selectedRole} size="sm">
                    Add
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="font-semibold mb-3">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> Email
                </Label>
                {isEditing ? (
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <p className="font-medium">{employee.email || employee.user_id || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-4 w-4" /> Phone Number
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                  />
                ) : (
                  <p className="font-medium">{employee.phone || "-"}</p>
                )}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" /> Emergency Contact
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    placeholder="08xxxxxxxxxx"
                  />
                ) : (
                  <p className="font-medium">{employee.emergency_contact || "-"}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Bank Account Information */}
          <div>
            <h3 className="font-semibold mb-3">Bank Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Landmark className="h-4 w-4" /> Account Number
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.bank_account_number}
                    onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                    placeholder="Nomor Rekening"
                  />
                ) : (
                  <p className="font-medium">{employee.bank_account_number || "-"}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" /> Account Holder Name
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.bank_account_name}
                    onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                    placeholder="Atas Nama Rekening"
                  />
                ) : (
                  <p className="font-medium">{employee.bank_account_name || "-"}</p>
                )}
              </div>
            </div>
          </div>
          </div>

          <Separator />

          {/* Personal Information */}
          <div>
            <h3 className="font-semibold mb-3">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <CreditCard className="h-4 w-4" /> KTP Number
                </Label>
                {isEditing ? (
                  <Input
                    value={formData.ktp_number}
                    onChange={(e) => setFormData({ ...formData, ktp_number: e.target.value })}
                    placeholder="16 digit KTP number"
                    maxLength={16}
                  />
                ) : (
                  <p className="font-medium">{employee.ktp_number || "-"}</p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" /> Address
                </Label>
                {isEditing ? (
                  <Textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address"
                    rows={2}
                  />
                ) : (
                  <p className="font-medium">{employee.address || "-"}</p>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Employment Information */}
          <div>
            <h3 className="font-semibold mb-3">Employment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Contract Start
                </Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formData.contract_start}
                    onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
                  />
                ) : (
                  <p className="font-medium">
                    {employee.contract_start
                      ? format(new Date(employee.contract_start), "dd MMMM yyyy")
                      : "-"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Contract End
                </Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={formData.contract_end}
                    onChange={(e) => setFormData({ ...formData, contract_end: e.target.value })}
                  />
                ) : (
                  <p className="font-medium">
                    {employee.contract_end
                      ? format(new Date(employee.contract_end), "dd MMMM yyyy")
                      : "-"}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Gaji Pokok
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.gaji_pokok}
                    onChange={(e) => setFormData({ ...formData, gaji_pokok: e.target.value })}
                    placeholder="Gaji Pokok"
                  />
                ) : (
                  <p className="font-medium">{formatCurrency(employee.gaji_pokok)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Tj. Transport
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.tj_transport}
                    onChange={(e) => setFormData({ ...formData, tj_transport: e.target.value })}
                    placeholder="Tunjangan Transport"
                  />
                ) : (
                  <p className="font-medium">{formatCurrency(employee.tj_transport)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Tj. Internet
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.tj_internet}
                    onChange={(e) => setFormData({ ...formData, tj_internet: e.target.value })}
                    placeholder="Tunjangan Internet"
                  />
                ) : (
                  <p className="font-medium">{formatCurrency(employee.tj_internet)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Tj. KPI
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.tj_kpi}
                    onChange={(e) => setFormData({ ...formData, tj_kpi: e.target.value })}
                    placeholder="Tunjangan KPI"
                  />
                ) : (
                  <p className="font-medium">{formatCurrency(employee.tj_kpi)}</p>
                )}
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Total Salary
                </Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="Total gaji per bulan"
                  />
                ) : (
                  <p className="font-medium text-lg text-primary">{formatCurrency(employee.salary)}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}