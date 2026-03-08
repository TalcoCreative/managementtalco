import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, FileText, Filter, Lock, FileDown, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { CreateLetterDialog } from "@/components/letters/CreateLetterDialog";
import { LetterDetailDialog } from "@/components/letters/LetterDetailDialog";
import { generatePayrollPDF } from "@/lib/payroll-pdf";
import { toast } from "sonner";

const ENTITIES = [
  { code: "TCI", name: "Talco Creative Indonesia" },
  { code: "TS", name: "Talco Studio" },
  { code: "TW", name: "Talco World" },
];

const STATUSES = [
  { value: "draft", label: "Draft", color: "bg-muted text-muted-foreground" },
  { value: "ready_to_send", label: "Siap Dikirim", color: "bg-blue-500/20 text-blue-600" },
  { value: "sent", label: "Terkirim", color: "bg-green-500/20 text-green-600" },
  { value: "closed", label: "Closed", color: "bg-gray-500/20 text-gray-600" },
];

const ALLOWED_ROLES = ["project_manager", "hr", "super_admin", "finance", "sales"];

export default function Letters() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedLetter, setSelectedLetter] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [downloadingPDF, setDownloadingPDF] = useState<string | null>(null);

  const { data: currentUser } = useQuery({
    queryKey: ["current-user-letters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-letters"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      
      return data?.map(r => r.role) || [];
    },
  });

  const hasAccess = userRoles?.some(role => ALLOWED_ROLES.includes(role));
  const isSuperAdmin = userRoles?.includes("super_admin");
  const canManage = userRoles?.some(role => 
    ["hr", "super_admin", "finance", "project_manager"].includes(role)
  );

  const { data: letters, isLoading, refetch } = useQuery({
    queryKey: ["letters", entityFilter, statusFilter, categoryFilter, currentUser?.id, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from("letters")
        .select(`
          *,
          created_by_profile:profiles!letters_created_by_fkey(full_name),
          sent_by_profile:profiles!letters_sent_by_fkey(full_name),
          project:projects(title)
        `)
        .order("created_at", { ascending: false });

      if (entityFilter && entityFilter !== "all") {
        query = query.eq("entity_code", entityFilter);
      }
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category_code", categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter confidential letters - only creator, super_admin, hr, finance can see
      return data?.filter(letter => {
        if (!letter.is_confidential) return true;
        if (isSuperAdmin) return true;
        if (letter.created_by === currentUser?.id) return true;
        // For payroll slips, also allow HR and Finance
        if (letter.letter_type === 'payroll_slip') {
          return userRoles?.some(role => ['hr', 'finance'].includes(role));
        }
        return false;
      });
    },
    enabled: hasAccess,
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-letters"],
    queryFn: async () => {
      const { data } = await supabase.from("company_settings").select("*");
      const map: Record<string, string | null> = {};
      data?.forEach((s: any) => { map[s.setting_key] = s.setting_value; });
      return map;
    },
  });

  const filteredLetters = letters?.filter(letter => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      letter.letter_number.toLowerCase().includes(query) ||
      letter.recipient_name.toLowerCase().includes(query) ||
      letter.recipient_company?.toLowerCase().includes(query)
    );
  });

  const handleDownloadSlipPDF = async (letter: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!letter.employee_id) {
      toast.error("Data karyawan tidak ditemukan untuk surat ini");
      return;
    }
    setDownloadingPDF(letter.id);
    try {
      // Fetch employee payroll data
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, gaji_pokok, tj_transport, tj_internet, tj_kpi, salary")
        .eq("id", letter.employee_id)
        .single();

      // Fetch payroll entry for that month
      const monthStart = `${letter.year}-${String(letter.month).padStart(2, "0")}-01`;
      const nextMonth = letter.month === 12 ? `${letter.year + 1}-01-01` : `${letter.year}-${String(letter.month + 1).padStart(2, "0")}-01`;
      
      const { data: payrollData } = await supabase
        .from("payroll")
        .select("*")
        .eq("employee_id", letter.employee_id)
        .gte("month", monthStart)
        .lt("month", nextMonth)
        .maybeSingle();

      // Get employee role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", letter.employee_id);
      const jabatan = roleData?.map(r => r.role.replace(/_/g, " ")).join(", ") || "-";

      const periode = format(new Date(monthStart), "MMMM yyyy", { locale: idLocale });

      await generatePayrollPDF(
        {
          employeeName: profile?.full_name || letter.recipient_name,
          jabatan,
          periode,
          gajiPokok: Number(profile?.gaji_pokok) || 0,
          tjTransport: Number(profile?.tj_transport) || 0,
          tjInternet: Number(profile?.tj_internet) || 0,
          tjKpi: Number(profile?.tj_kpi) || 0,
          reimburse: Number(payrollData?.reimburse) || 0,
          bonus: Number(payrollData?.bonus) || 0,
          potonganTerlambat: Number(payrollData?.potongan_terlambat) || 0,
          potonganKasbon: Number(payrollData?.potongan_kasbon) || 0,
          adjustmentLainnya: Number(payrollData?.adjustment_lainnya) || 0,
          totalGaji: Number(payrollData?.amount) || Number(profile?.salary) || 0,
          payDate: payrollData?.pay_date || format(new Date(), "yyyy-MM-dd"),
          letterNumber: letter.letter_number,
        },
        companySettings || {}
      );
      toast.success("PDF slip gaji berhasil di-download");
    } catch (error: any) {
      toast.error(error.message || "Gagal generate PDF");
    } finally {
      setDownloadingPDF(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = STATUSES.find(s => s.value === status);
    return (
      <Badge className={statusInfo?.color || ""}>
        {statusInfo?.label || status}
      </Badge>
    );
  };

  if (!hasAccess) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Akses Terbatas</h2>
            <p className="text-muted-foreground">
              Anda tidak memiliki akses ke halaman Manajemen Surat.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Manajemen Surat</h1>
            <p className="text-muted-foreground">
              Kelola surat dengan nomor otomatis terstruktur
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Buat Surat Baru
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filter & Pencarian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nomor surat atau penerima..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Semua Entitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Entitas</SelectItem>
                  {ENTITIES.map(entity => (
                    <SelectItem key={entity.code} value={entity.code}>
                      {entity.code} - {entity.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="FIN">Finance</SelectItem>
                  <SelectItem value="ADM">Admin</SelectItem>
                  <SelectItem value="MKT">Marketing</SelectItem>
                  <SelectItem value="PRJ">Project</SelectItem>
                  <SelectItem value="GEN">General</SelectItem>
                  <SelectItem value="SLIP">Slip Gaji</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Daftar Surat ({filteredLetters?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Memuat data...
              </div>
            ) : filteredLetters?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Tidak ada surat ditemukan
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor Surat</TableHead>
                      <TableHead>Entitas</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Penerima</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Pembuat</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLetters?.map((letter) => (
                      <TableRow
                        key={letter.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedLetter(letter)}
                      >
                        <TableCell className="font-mono text-sm font-medium">
                          <div className="flex items-center gap-2">
                            {letter.is_confidential && (
                              <Lock className="h-4 w-4 text-red-500" />
                            )}
                            {letter.letter_number}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{letter.entity_code}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={letter.category_code === 'SLIP' ? 'default' : 'secondary'} className="text-xs">
                            {letter.category_name || letter.category_code}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{letter.recipient_name}</div>
                            {letter.recipient_company && (
                              <div className="text-sm text-muted-foreground">
                                {letter.recipient_company}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(letter.status)}</TableCell>
                        <TableCell>
                          {format(new Date(letter.created_at), "dd MMM yyyy", {
                            locale: idLocale,
                          })}
                        </TableCell>
                        <TableCell>
                          {letter.created_by_profile?.full_name || "-"}
                        </TableCell>
                        <TableCell>
                          {letter.letter_type === 'payroll_slip' && letter.employee_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleDownloadSlipPDF(letter, e)}
                              disabled={downloadingPDF === letter.id}
                            >
                              {downloadingPDF === letter.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          ) : letter.document_url ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.open(letter.document_url, "_blank");
                              }}
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <CreateLetterDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={() => {
            refetch();
            setCreateDialogOpen(false);
          }}
        />

        {selectedLetter && (
          <LetterDetailDialog
            letter={selectedLetter}
            open={!!selectedLetter}
            onOpenChange={(open) => !open && setSelectedLetter(null)}
            onUpdate={() => {
              refetch();
            }}
            canManage={canManage || false}
          />
        )}
      </div>
    </AppLayout>
  );
}
