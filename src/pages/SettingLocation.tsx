import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  MapPin, Plus, Edit2, Trash2, RefreshCw, Users, CheckCircle2, AlertCircle,
  Crosshair, ShieldAlert,
} from "lucide-react";
import { LocationMap, type MapEmployee, type MapLocation } from "@/components/setting-location/LocationMap";
import { getCurrentPosition } from "@/lib/geo-utils";

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

interface AttendanceRow {
  id: string;
  user_id: string;
  clock_in: string | null;
  photo_clock_in: string | null;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  location_status: string | null;
  matched_location_name: string | null;
  outside_reason: string | null;
  profiles: { full_name: string | null; avatar_url?: string | null } | null;
}

const today = () => format(new Date(), "yyyy-MM-dd");

export default function SettingLocation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSuperAdmin, isLoading: permLoading } = usePermissions();

  // ────── ACCESS GUARD ─────────────────────────────────────
  useEffect(() => {
    if (!permLoading && !isSuperAdmin) {
      toast.error("Hanya Super Admin yang dapat mengakses halaman ini");
      navigate("/");
    }
  }, [permLoading, isSuperAdmin, navigate]);

  // ────── GLOBAL TOGGLE ────────────────────────────────────
  const { data: globalSetting } = useQuery({
    queryKey: ["company-setting", "location_validation_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("setting_value")
        .eq("setting_key", "location_validation_enabled")
        .maybeSingle();
      return data?.setting_value === "true";
    },
  });

  const [togglingGlobal, setTogglingGlobal] = useState(false);
  const handleToggleGlobal = async (next: boolean) => {
    setTogglingGlobal(true);
    try {
      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("setting_key", "location_validation_enabled")
        .maybeSingle();
      if (existing) {
        await supabase
          .from("company_settings")
          .update({ setting_value: String(next) })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("company_settings")
          .insert({ setting_key: "location_validation_enabled", setting_value: String(next) });
      }
      queryClient.invalidateQueries({ queryKey: ["company-setting", "location_validation_enabled"] });
      toast.success(`Validasi lokasi ${next ? "diaktifkan" : "dinonaktifkan"}`);
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan pengaturan");
    } finally {
      setTogglingGlobal(false);
    }
  };

  // ────── LOCATIONS ────────────────────────────────────────
  const { data: locations = [], refetch: refetchLocations } = useQuery({
    queryKey: ["office-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("office_locations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as OfficeLocation[];
    },
  });

  // ────── ATTENDANCE (today) ───────────────────────────────
  const [filterDate, setFilterDate] = useState<string>(today());
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterLocationId, setFilterLocationId] = useState<string>("all");

  const { data: attendance = [], refetch: refetchAttendance } = useQuery({
    queryKey: ["setting-loc-attendance", filterDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          id, user_id, clock_in, photo_clock_in,
          clock_in_latitude, clock_in_longitude, location_status,
          matched_location_name, matched_location_id, outside_reason,
          profiles:profiles!fk_attendance_user_profiles ( full_name, avatar_url )
        `)
        .eq("date", filterDate)
        .not("clock_in", "is", null)
        .order("clock_in", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AttendanceRow[];
    },
    refetchInterval: 15000, // fallback poll every 15s
  });

  // Realtime: subscribe to attendance changes for live monitoring
  useEffect(() => {
    const channel = supabase
      .channel("setting-loc-attendance-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["setting-loc-attendance"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "office_locations" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["office-locations"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_settings" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["company-setting", "location_validation_enabled"] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((a) => {
      if (filterStatus !== "all" && a.location_status !== filterStatus) {
        // include "unknown" rows only when filter is 'all'
        return false;
      }
      if (filterLocationId !== "all" && (a as any).matched_location_id !== filterLocationId) {
        return false;
      }
      return true;
    });
  }, [attendance, filterStatus, filterLocationId]);

  const stats = useMemo(() => {
    const inside = attendance.filter((a) => a.location_status === "inside").length;
    const outside = attendance.filter((a) => a.location_status === "outside").length;
    const total = attendance.length;
    const insidePct = total > 0 ? Math.round((inside / total) * 100) : 0;
    return { total, inside, outside, insidePct, outsidePct: 100 - insidePct };
  }, [attendance]);

  // ────── LOCATION CRUD DIALOG ─────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    latitude: "",
    longitude: "",
    radius_meters: 100,
    is_active: true,
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ name: "", latitude: "", longitude: "", radius_meters: 100, is_active: true });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (loc: OfficeLocation) => {
    setEditingId(loc.id);
    setForm({
      name: loc.name,
      latitude: String(loc.latitude),
      longitude: String(loc.longitude),
      radius_meters: loc.radius_meters,
      is_active: loc.is_active,
    });
    setDialogOpen(true);
  };

  const handleUseMyLocation = async () => {
    try {
      const pos = await getCurrentPosition();
      setForm((f) => ({
        ...f,
        latitude: pos.coords.latitude.toFixed(6),
        longitude: pos.coords.longitude.toFixed(6),
      }));
      toast.success("Koordinat lokasi Anda telah diisi");
    } catch (e: any) {
      toast.error(e.message || "Gagal mendapatkan lokasi");
    }
  };

  const handleSaveLocation = async () => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (!form.name.trim()) return toast.error("Nama lokasi wajib diisi");
    if (Number.isNaN(lat) || Number.isNaN(lng)) return toast.error("Koordinat tidak valid");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const payload = {
        name: form.name.trim(),
        latitude: lat,
        longitude: lng,
        radius_meters: form.radius_meters,
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("office_locations").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Lokasi diperbarui");
      } else {
        const { error } = await supabase.from("office_locations").insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast.success("Lokasi ditambahkan");
      }
      setDialogOpen(false);
      resetForm();
      refetchLocations();
    } catch (e: any) {
      toast.error(e.message || "Gagal menyimpan lokasi");
    }
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from("office_locations").delete().eq("id", deleteId);
      if (error) throw error;
      toast.success("Lokasi dihapus");
      setDeleteId(null);
      refetchLocations();
    } catch (e: any) {
      toast.error(e.message || "Gagal menghapus lokasi");
    }
  };

  const handleToggleActive = async (loc: OfficeLocation) => {
    try {
      const { error } = await supabase
        .from("office_locations")
        .update({ is_active: !loc.is_active })
        .eq("id", loc.id);
      if (error) throw error;
      refetchLocations();
    } catch (e: any) {
      toast.error(e.message || "Gagal mengubah status");
    }
  };

  // ────── MAP DATA ─────────────────────────────────────────
  const mapLocations: MapLocation[] = locations.map((l) => ({
    id: l.id,
    name: l.name,
    latitude: l.latitude,
    longitude: l.longitude,
    radius_meters: l.radius_meters,
    is_active: l.is_active,
  }));

  const mapEmployees: MapEmployee[] = filteredAttendance
    .filter((a) => a.clock_in_latitude != null && a.clock_in_longitude != null)
    .map((a) => ({
      id: a.id,
      name: a.profiles?.full_name || "Unknown",
      latitude: a.clock_in_latitude!,
      longitude: a.clock_in_longitude!,
      status: (a.location_status === "inside" ? "inside" : "outside") as "inside" | "outside",
      time: a.clock_in ? format(new Date(a.clock_in), "dd MMM HH:mm") : undefined,
    }));

  const pickerMarker = useMemo(() => {
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
    return { lat, lng, radius: form.radius_meters };
  }, [form.latitude, form.longitude, form.radius_meters]);

  if (permLoading || !isSuperAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-7 w-7 text-primary" />
              Location Control Tower
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Atur dan pantau validasi lokasi clock-in karyawan
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refetchAttendance(); refetchLocations(); }}>
            <RefreshCw className="h-4 w-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* SECTION 1: GLOBAL TOGGLE */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-base font-semibold">Enable Location Validation</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Saat aktif, semua karyawan wajib clock-in dari lokasi kantor terdaftar.
                  Jika di luar radius, mereka harus mengisi alasan.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={globalSetting ? "default" : "secondary"}>
                  {globalSetting ? "ON" : "OFF"}
                </Badge>
                <Switch
                  checked={!!globalSetting}
                  disabled={togglingGlobal}
                  onCheckedChange={handleToggleGlobal}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 2: MONITORING SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Total Clocked In</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Inside Office</p>
                  <p className="text-2xl font-bold text-emerald-600">{stats.inside}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Outside Office</p>
                  <p className="text-2xl font-bold text-destructive">{stats.outside}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Inside vs Outside</p>
                <p className="text-2xl font-bold">{stats.insidePct}% / {stats.outsidePct}%</p>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${stats.insidePct}%` }} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SECTION 3: MAP */}
        <Card>
          <CardHeader>
            <CardTitle>Map Visualization</CardTitle>
          </CardHeader>
          <CardContent>
            <LocationMap locations={mapLocations} employees={mapEmployees} height={400} />
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-emerald-500" /> Inside
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-destructive" /> Outside
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> Office Location
              </span>
            </div>
          </CardContent>
        </Card>

        {/* SECTION: RECENT CLOCK-INS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle>Recent Clock-Ins</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="w-auto h-9"
                />
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="inside">Inside</SelectItem>
                    <SelectItem value="outside">Outside</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterLocationId} onValueChange={setFilterLocationId}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Photo</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location / Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Tidak ada data clock-in untuk filter ini
                    </TableCell>
                  </TableRow>
                )}
                {filteredAttendance.map((a) => {
                  const isOutside = a.location_status === "outside";
                  return (
                    <TableRow
                      key={a.id}
                      className={isOutside ? "bg-destructive/5" : undefined}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={a.profiles?.avatar_url ?? undefined} />
                            <AvatarFallback>
                              {a.profiles?.full_name?.charAt(0) ?? "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">
                            {a.profiles?.full_name || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.photo_clock_in ? (
                          <img
                            src={a.photo_clock_in}
                            alt="clock-in"
                            className="h-12 w-12 rounded object-cover border"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {a.clock_in ? format(new Date(a.clock_in), "HH:mm:ss") : "—"}
                      </TableCell>
                      <TableCell>
                        {a.location_status === "inside" ? (
                          <Badge className="bg-emerald-500 hover:bg-emerald-600">Inside</Badge>
                        ) : a.location_status === "outside" ? (
                          <Badge variant="destructive">Outside</Badge>
                        ) : (
                          <Badge variant="secondary">No GPS</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm max-w-[280px]">
                        {a.location_status === "inside" && (
                          <span className="text-emerald-700 dark:text-emerald-400">
                            📍 {a.matched_location_name || "Office"}
                          </span>
                        )}
                        {a.location_status === "outside" && (
                          <span className="text-destructive">
                            ⚠️ {a.outside_reason || "(no reason)"}
                          </span>
                        )}
                        {!a.location_status && (
                          <span className="text-muted-foreground">No location data</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* SECTION 4: LOCATION CRUD */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Office Locations</CardTitle>
              <Button onClick={openCreate} size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Location
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead>Radius</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Belum ada lokasi. Tambah lokasi pertama Anda.
                    </TableCell>
                  </TableRow>
                )}
                {locations.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">{loc.name}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                    </TableCell>
                    <TableCell>{loc.radius_meters}m</TableCell>
                    <TableCell>
                      <Switch
                        checked={loc.is_active}
                        onCheckedChange={() => handleToggleActive(loc)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(loc)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(loc.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* CREATE/EDIT DIALOG */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Location" : "Add Office Location"}</DialogTitle>
            <DialogDescription>
              Klik peta untuk memilih koordinat, atau gunakan lokasi GPS Anda saat ini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Location Name</Label>
              <Input
                placeholder="Talco HQ Jakarta"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.latitude}
                  onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.longitude}
                  onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                />
              </div>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleUseMyLocation}>
              <Crosshair className="h-4 w-4 mr-2" /> Gunakan Lokasi Saya
            </Button>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Radius: {form.radius_meters}m</Label>
              </div>
              <Slider
                min={50}
                max={500}
                step={10}
                value={[form.radius_meters]}
                onValueChange={(v) => setForm((f) => ({ ...f, radius_meters: v[0] }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>

            <LocationMap
              locations={[]}
              height={280}
              onMapClick={(lat, lng) =>
                setForm((f) => ({ ...f, latitude: lat.toFixed(6), longitude: lng.toFixed(6) }))
              }
              pickerMarker={pickerMarker}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveLocation}>{editingId ? "Save Changes" : "Add Location"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRM */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus lokasi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Lokasi akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
