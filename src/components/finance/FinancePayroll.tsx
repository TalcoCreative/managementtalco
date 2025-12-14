import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { format, startOfMonth, addMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users, RefreshCw, CheckCircle, Trash2, FileDown, Settings } from "lucide-react";
import { toast } from "sonner";
import { generatePayrollPDF } from "@/lib/payroll-pdf";
import { CompanySettingsDialog } from "./CompanySettingsDialog";

export function FinancePayroll() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [payrollToDelete, setPayrollToDelete] = useState<any>(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: payrollList, isLoading } = useQuery({
    queryKey: ["finance-payroll", selectedMonth],
    queryFn: async () => {
      const monthDate = startOfMonth(new Date(selectedMonth + "-01"));
      const { data, error } = await supabase
        .from("payroll")
        .select("*, profiles(full_name, salary, gaji_pokok, tj_transport, tj_internet, tj_kpi, contract_start, contract_end)")
        .gte("month", format(monthDate, "yyyy-MM-dd"))
        .lt("month", format(addMonths(monthDate, 1), "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch company settings for PDF
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

  // Fetch user roles for PDF
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

  // Fetch employees with active contracts
  const { data: employees } = useQuery({
    queryKey: ["employees-with-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, salary, contract_start, contract_end, status")
        .not("salary", "is", null)
        .or("status.is.null,status.eq.active");
      
      if (error) throw error;
      return data || [];
    },
  });

  const generatePayroll = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error("Not authenticated");

      const monthDate = startOfMonth(new Date(selectedMonth + "-01"));

      // Filter employees with active contracts
      const activeEmployees = employees?.filter(emp => {
        if (!emp.salary) return false;
        if (emp.contract_start && new Date(emp.contract_start) > monthDate) return false;
        if (emp.contract_end && new Date(emp.contract_end) < monthDate) return false;
        return true;
      }) || [];

      if (activeEmployees.length === 0) {
        toast.error("No employees with active contracts found");
        return;
      }

      // Check existing payroll for this month
      const existingIds = payrollList?.map(p => p.employee_id) || [];
      const newEmployees = activeEmployees.filter(emp => !existingIds.includes(emp.id));

      if (newEmployees.length === 0) {
        toast.info("Payroll already generated for all active employees this month");
        return;
      }

      const payrollEntries = newEmployees.map(emp => ({
        employee_id: emp.id,
        month: format(monthDate, "yyyy-MM-dd"),
        amount: emp.salary,
        created_by: session.session.user.id,
      }));

      const { error } = await supabase.from("payroll").insert(payrollEntries);
      if (error) throw error;

      toast.success(`Generated payroll for ${newEmployees.length} employee(s)`);
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to generate payroll");
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
          sub_type: "sdm",
          sub_category: "gaji_upah",
          amount: payroll.amount,
          source: "payroll",
          notes: `Payroll for ${payroll.profiles?.full_name} - ${format(new Date(payroll.month), "MMMM yyyy")}`,
          created_by: session.session.user.id,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      // Create expense entry for payroll
      const { error: expenseError } = await supabase
        .from("expenses")
        .insert({
          category: "sdm",
          sub_category: "gaji_upah",
          amount: payroll.amount,
          description: `Gaji ${payroll.profiles?.full_name} - ${format(new Date(payroll.month), "MMMM yyyy")}`,
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

      toast.success("Payroll marked as paid and added to expenses & ledger");
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
      queryClient.invalidateQueries({ queryKey: ["finance-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["finance-expenses"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to mark payroll as paid");
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

      toast.success("Payroll deleted successfully");
      setDeleteDialogOpen(false);
      setPayrollToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["finance-payroll"] });
    } catch (error: any) {
      toast.error(error.message || "Failed to delete payroll");
    }
  };

  const getEmployeeRole = (userId: string): string => {
    const roles = userRoles?.filter(r => r.user_id === userId).map(r => r.role) || [];
    if (roles.length === 0) return "-";
    // Return the first role formatted nicely
    return roles[0].replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
  };

  const handleDownloadPDF = async (payroll: any) => {
    if (payroll.status !== "paid") {
      toast.error("PDF hanya bisa di-download untuk payroll dengan status PAID");
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

  // Generate month options (last 12 months + next 3 months)
  const monthOptions = Array.from({ length: 15 }, (_, i) => {
    const date = addMonths(new Date(), i - 11);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "MMMM yyyy")
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
          <Button onClick={generatePayroll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate
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
                  <TableHead>Employee</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Pay Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollList.map((payroll) => (
                  <TableRow key={payroll.id}>
                    <TableCell className="font-medium">{payroll.profiles?.full_name}</TableCell>
                    <TableCell>{format(new Date(payroll.month), "MMMM yyyy")}</TableCell>
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
                          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(payroll)}>
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
            <p>No payroll data for this month</p>
            <p className="text-sm mt-2">Click "Generate" to create payroll from active contracts</p>
          </div>
        )}
      </CardContent>

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