import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, startOfMonth, addMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users, Edit, CheckCircle, Trash2, FileDown, Settings, Save } from "lucide-react";
import { toast } from "sonner";
import { generatePayrollPDF } from "@/lib/payroll-pdf";
import { CompanySettingsDialog } from "./CompanySettingsDialog";

interface PayrollEntry {
  id?: string;
  employee_id: string;
  employee_name: string;
  gaji_pokok: number;
  tj_transport: number;
  tj_internet: number;
  tj_kpi: number;
  reimburse: number;
  potongan_terlambat: number;
  potongan_kasbon: number;
  bonus: number;
  adjustment_lainnya: number;
  adjustment_notes: string;
  total: number;
  status: string;
  existing?: boolean;
}

export function FinancePayroll() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState<any>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const [editablePayroll, setEditablePayroll] = useState<PayrollEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const { data: payrollList, isLoading } = useQuery({
    queryKey: ["finance-payroll", selectedMonth],
    queryFn: async () => {
      const monthDate = startOfMonth(new Date(selectedMonth + "-01"));
      const { data, error } = await supabase
        .from("payroll")
        .select("*, profiles(full_name, salary, gaji_pokok, tj_transport, tj_internet, tj_kpi)")
        .gte("month", format(monthDate, "yyyy-MM-dd"))
        .lt("month", format(addMonths(monthDate, 1), "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, salary, gaji_pokok, tj_transport, tj_internet, tj_kpi, status")
        .or("status.is.null,status.eq.active");
      
      if (error) throw error;
      return data || [];
    },
  });

  const { data: companySettings } = useQuery({
    queryKey: ["company-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*");
      
      if (error) throw error;
      
      const settingsMap: Record<string, string | null> = {};
      data?.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      return settingsMap;
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["all-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (error) throw error;
      return data || [];
    },
  });

  const openEditDialog = () => {
    const existingIds = payrollList?.map(p => p.employee_id) || [];
    
    // Create editable list from existing payroll + new employees
    const entries: PayrollEntry[] = [];
    
    // Add existing payroll entries
    payrollList?.forEach(p => {
      entries.push({
        id: p.id,
        employee_id: p.employee_id,
        employee_name: p.profiles?.full_name || "-",
        gaji_pokok: Number(p.profiles?.gaji_pokok) || 0,
        tj_transport: Number(p.profiles?.tj_transport) || 0,
        tj_internet: Number(p.profiles?.tj_internet) || 0,
        tj_kpi: Number(p.profiles?.tj_kpi) || 0,
        reimburse: Number((p as any).reimburse) || 0,
        potongan_terlambat: Number((p as any).potongan_terlambat) || 0,
        potongan_kasbon: Number((p as any).potongan_kasbon) || 0,
        bonus: Number((p as any).bonus) || 0,
        adjustment_lainnya: Number((p as any).adjustment_lainnya) || 0,
        adjustment_notes: (p as any).adjustment_notes || "",
        total: Number(p.amount),
        status: p.status,
        existing: true,
      });
    });

    // Add employees not yet in payroll
    employees?.forEach(emp => {
      if (!existingIds.includes(emp.id)) {
        const baseTotal = (Number(emp.gaji_pokok) || 0) + 
                      (Number(emp.tj_transport) || 0) + 
                      (Number(emp.tj_internet) || 0) + 
                      (Number(emp.tj_kpi) || 0);
        entries.push({
          employee_id: emp.id,
          employee_name: emp.full_name,
          gaji_pokok: Number(emp.gaji_pokok) || 0,
          tj_transport: Number(emp.tj_transport) || 0,
          tj_internet: Number(emp.tj_internet) || 0,
          tj_kpi: Number(emp.tj_kpi) || 0,
          reimburse: 0,
          potongan_terlambat: 0,
          potongan_kasbon: 0,
          bonus: 0,
          adjustment_lainnya: 0,
          adjustment_notes: "",
          total: baseTotal || Number(emp.salary) || 0,
          status: "planned",
          existing: false,
        });
      }
    });

    setEditablePayroll(entries);
    setEditDialogOpen(true);
  };

  const updatePayrollEntry = (index: number, field: keyof PayrollEntry, value: number | string) => {
    const updated = [...editablePayroll];
    (updated[index] as any)[field] = value;
    
    // Recalculate total (base + additions - deductions)
    const e = updated[index];
    updated[index].total = 
      e.gaji_pokok + 
      e.tj_transport + 
      e.tj_internet + 
      e.tj_kpi +
      e.reimburse +
      e.bonus +
      e.adjustment_lainnya -
      e.potongan_terlambat -
      e.potongan_kasbon;
    
    setEditablePayroll(updated);
  };

  const savePayroll = async () => {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const monthDate = startOfMonth(new Date(selectedMonth + "-01"));

      for (const entry of editablePayroll) {
        if (entry.total <= 0) continue;

        const payrollData = {
          amount: entry.total,
          reimburse: entry.reimburse,
          potongan_terlambat: entry.potongan_terlambat,
          potongan_kasbon: entry.potongan_kasbon,
          bonus: entry.bonus,
          adjustment_lainnya: entry.adjustment_lainnya,
          adjustment_notes: entry.adjustment_notes || null,
        };

        if (entry.existing && entry.id) {
          // Update existing
          await supabase
            .from("payroll")
            .update(payrollData)
            .eq("id", entry.id);
        } else if (!entry.existing) {
          // Insert new
          await supabase
            .from("payroll")
            .insert({
              employee_id: entry.employee_id,
              month: format(monthDate, "yyyy-MM-dd"),
              created_by: session.session.user.id,
              ...payrollData,
            });
        }
      }

      toast.success("Payroll berhasil disimpan");
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal menyimpan payroll");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkPaid = async (payroll: any) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      // Create ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          type: "expense",
          sub_type: "payroll",
          sub_category: "gaji_upah",
          amount: payroll.amount,
          source: "payroll",
          notes: `Payroll ${payroll.profiles?.full_name} - ${format(new Date(payroll.month), "MMMM yyyy", { locale: idLocale })}`,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Create expense entry
      const { error: expenseError } = await supabase
        .from("expenses")
        .insert({
          category: "payroll",
          sub_category: "gaji_upah",
          amount: payroll.amount,
          description: `Gaji ${payroll.profiles?.full_name} - ${format(new Date(payroll.month), "MMMM yyyy", { locale: idLocale })}`,
          status: "paid",
          paid_at: new Date().toISOString(),
          ledger_entry_id: ledgerEntry.id,
          created_by: session.session.user.id,
        });

      if (expenseError) throw expenseError;

      // Update payroll status
      const { error: updateError } = await supabase
        .from("payroll")
        .update({ 
          status: "paid", 
          paid_at: new Date().toISOString(),
          pay_date: format(new Date(), "yyyy-MM-dd"),
          ledger_entry_id: ledgerEntry.id 
        })
        .eq("id", payroll.id);

      if (updateError) throw updateError;

      toast.success("Payroll ditandai PAID dan masuk ke Expenses");
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal update payroll");
    }
  };

  const handleDeletePayroll = async () => {
    if (!payrollToDelete) return;
    
    try {
      const { error } = await supabase
        .from("payroll")
        .delete()
        .eq("id", payrollToDelete.id);

      if (error) throw error;

      toast.success("Payroll dihapus");
      setDeleteDialogOpen(false);
      setPayrollToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    } catch (error: any) {
      toast.error(error.message || "Gagal hapus payroll");
    }
  };

  const getEmployeeRole = (userId: string): string => {
    const roles = userRoles?.filter(r => r.user_id === userId).map(r => r.role) || [];
    if (roles.length === 0) return "-";
    return roles[0].replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const handleDownloadPDF = async (payroll: any) => {
    if (payroll.status !== "paid") {
      toast.error("PDF hanya bisa di-download untuk payroll PAID");
      return;
    }

    setGeneratingPDF(payroll.id);
    try {
      const profile = payroll.profiles;
      
      await generatePayrollPDF(
        {
          employeeName: profile?.full_name || "-",
          jabatan: getEmployeeRole(payroll.employee_id),
          periode: format(new Date(payroll.month), "MMMM yyyy", { locale: idLocale }),
          gajiPokok: Number(profile?.gaji_pokok) || 0,
          tjTransport: Number(profile?.tj_transport) || 0,
          tjInternet: Number(profile?.tj_internet) || 0,
          tjKpi: Number(profile?.tj_kpi) || 0,
          totalGaji: Number(payroll.amount),
          payDate: payroll.pay_date || format(new Date(), "yyyy-MM-dd"),
        },
        {
          logoUrl: companySettings?.company_logo,
          signatureUrl: companySettings?.hr_signature,
          hrName: companySettings?.hr_name || "HR Manager",
        }
      );

      toast.success("PDF berhasil di-download");
    } catch (error: any) {
      toast.error(error.message || "Gagal generate PDF");
    } finally {
      setGeneratingPDF(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const date = addMonths(new Date(), i - 11);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy", { locale: idLocale })
    };
  });

  const totalPlanned = payrollList?.filter(p => p.status === "planned").reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const totalPaid = payrollList?.filter(p => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Payroll
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setSettingsDialogOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Pengaturan
          </Button>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openEditDialog}>
            <Edit className="h-4 w-4 mr-2" />
            Update Payroll
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Planned</div>
              <div className="text-2xl font-bold text-yellow-500">{formatCurrency(totalPlanned)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Paid</div>
              <div className="text-2xl font-bold text-green-500">{formatCurrency(totalPaid)}</div>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : payrollList && payrollList.length > 0 ? (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Total Gaji</TableHead>
                  <TableHead>Tanggal Bayar</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollList.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.profiles?.full_name}</TableCell>
                    <TableCell>{format(new Date(payroll.month), "MMMM yyyy", { locale: idLocale })}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(payroll.amount)}</TableCell>
                    <TableCell>
                      {payroll.pay_date ? format(new Date(payroll.pay_date), "dd MMM yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={payroll.status === "paid" ? "bg-green-500" : "bg-yellow-500"}>
                        {payroll.status === "paid" ? "Paid" : "Planned"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {payroll.status === "paid" && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleDownloadPDF(payroll)}
                            disabled={generatingPDF === payroll.id}
                          >
                            <FileDown className="h-4 w-4 mr-1" />
                            {generatingPDF === payroll.id ? "..." : "PDF"}
                          </Button>
                        )}
                        {payroll.status === "planned" && (
                          <Button size="sm" variant="default" onClick={() => handleMarkPaid(payroll)}>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setPayrollToDelete(payroll);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Belum ada data payroll untuk bulan ini</p>
            <p className="text-sm mt-2">Klik "Update Payroll" untuk membuat payroll</p>
          </div>
        )}
      </CardContent>

      {/* Edit Payroll Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Update Payroll - {format(new Date(selectedMonth + "-01"), "MMMM yyyy", { locale: idLocale })}
            </DialogTitle>
          </DialogHeader>
          
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">Karyawan</TableHead>
                  <TableHead className="text-right">Gaji Pokok</TableHead>
                  <TableHead className="text-right">Tj. Transport</TableHead>
                  <TableHead className="text-right">Tj. Internet</TableHead>
                  <TableHead className="text-right">Tj. KPI</TableHead>
                  <TableHead className="text-right text-green-600">Reimburse (+)</TableHead>
                  <TableHead className="text-right text-green-600">Bonus (+)</TableHead>
                  <TableHead className="text-right text-destructive">Pot. Terlambat (-)</TableHead>
                  <TableHead className="text-right text-destructive">Pot. Kasbon (-)</TableHead>
                  <TableHead className="text-right">Lainnya (+/-)</TableHead>
                  <TableHead className="text-right font-bold">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editablePayroll.map((entry, index) => (
                  <TableRow key={entry.employee_id}>
                    <TableCell className="font-medium sticky left-0 bg-background z-10">{entry.employee_name}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.gaji_pokok}
                        onChange={(e) => updatePayrollEntry(index, "gaji_pokok", Number(e.target.value))}
                        className="w-24 text-right"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.tj_transport}
                        onChange={(e) => updatePayrollEntry(index, "tj_transport", Number(e.target.value))}
                        className="w-20 text-right"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.tj_internet}
                        onChange={(e) => updatePayrollEntry(index, "tj_internet", Number(e.target.value))}
                        className="w-20 text-right"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.tj_kpi}
                        onChange={(e) => updatePayrollEntry(index, "tj_kpi", Number(e.target.value))}
                        className="w-20 text-right"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.reimburse}
                        onChange={(e) => updatePayrollEntry(index, "reimburse", Number(e.target.value))}
                        className="w-20 text-right text-green-600"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.bonus}
                        onChange={(e) => updatePayrollEntry(index, "bonus", Number(e.target.value))}
                        className="w-20 text-right text-green-600"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.potongan_terlambat}
                        onChange={(e) => updatePayrollEntry(index, "potongan_terlambat", Number(e.target.value))}
                        className="w-20 text-right text-destructive"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.potongan_kasbon}
                        onChange={(e) => updatePayrollEntry(index, "potongan_kasbon", Number(e.target.value))}
                        className="w-20 text-right text-destructive"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={entry.adjustment_lainnya}
                        onChange={(e) => updatePayrollEntry(index, "adjustment_lainnya", Number(e.target.value))}
                        className="w-20 text-right"
                        disabled={entry.status === "paid"}
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(entry.total)}
                    </TableCell>
                    <TableCell>
                      <Badge className={entry.status === "paid" ? "bg-green-500" : entry.existing ? "bg-yellow-500" : "bg-muted"}>
                        {entry.status === "paid" ? "Paid" : entry.existing ? "Planned" : "New"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={savePayroll} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Menyimpan..." : "Simpan Payroll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Payroll</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus payroll untuk "{payrollToDelete?.profiles?.full_name}"? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePayroll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanySettingsDialog 
        open={settingsDialogOpen} 
        onOpenChange={setSettingsDialogOpen} 
      />
    </Card>
  );
}
