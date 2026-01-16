import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useOrganicReports,
  useCreateOrganicReport,
  useUpdateOrganicReport,
  useDeleteOrganicReport,
  useLockReport,
  usePlatformAccounts,
} from "@/hooks/useReports";
import {
  PLATFORMS,
  MONTHS,
  PLATFORM_METRICS,
  getMonthLabel,
  formatNumber,
  type Platform,
  type MonthlyOrganicReport,
} from "@/lib/report-constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  Eye,
} from "lucide-react";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

export function OrganicReportsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyOrganicReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const [formData, setFormData] = useState<Record<string, unknown>>({
    platform_account_id: "",
    report_month: new Date().getMonth() + 1,
    report_year: currentYear,
  });

  const { data: reports = [], isLoading } = useOrganicReports({
    clientId: filterClient !== "all" ? filterClient : undefined,
    platform: filterPlatform !== "all" ? filterPlatform : undefined,
    year: filterYear ? parseInt(filterYear) : undefined,
    month: filterMonth !== "all" ? parseInt(filterMonth) : undefined,
  });

  const { data: accounts = [] } = usePlatformAccounts();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-for-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useCreateOrganicReport();
  const updateMutation = useUpdateOrganicReport();
  const deleteMutation = useDeleteOrganicReport();
  const lockMutation = useLockReport();

  const selectedAccount = accounts.find(
    (a) => a.id === formData.platform_account_id
  );
  const platformMetrics = selectedAccount
    ? PLATFORM_METRICS[selectedAccount.platform as keyof typeof PLATFORM_METRICS]
    : null;

  const handleOpenCreate = () => {
    setSelectedReport(null);
    setIsEditing(false);
    setFormData({
      platform_account_id: "",
      report_month: new Date().getMonth() + 1,
      report_year: currentYear,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (report: MonthlyOrganicReport) => {
    setSelectedReport(report);
    setIsEditing(true);
    const data: Record<string, unknown> = {
      platform_account_id: report.platform_account_id,
      report_month: report.report_month,
      report_year: report.report_year,
    };
    // Copy all metric values
    Object.keys(report).forEach((key) => {
      if (
        key.startsWith("ig_") ||
        key.startsWith("fb_") ||
        key.startsWith("li_") ||
        key.startsWith("yt_") ||
        key.startsWith("tt_") ||
        key.startsWith("gb_")
      ) {
        data[key] = report[key];
      }
    });
    setFormData(data);
    setDialogOpen(true);
  };

  const handleView = (report: MonthlyOrganicReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.platform_account_id || !formData.report_month || !formData.report_year) {
      return;
    }

    if (isEditing && selectedReport) {
      updateMutation.mutate(
        {
          id: selectedReport.id,
          previousValues: selectedReport as Record<string, unknown>,
          ...formData,
        },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(formData, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (selectedReport) {
      deleteMutation.mutate(
        { id: selectedReport.id, previousValues: selectedReport as Record<string, unknown> },
        { onSuccess: () => setDeleteDialogOpen(false) }
      );
    }
  };

  const handleToggleLock = (report: MonthlyOrganicReport) => {
    lockMutation.mutate({
      id: report.id,
      reportType: "organic",
      lock: !report.is_locked,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">Organic Reports</CardTitle>
        <Button size="sm" onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Input Report
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Semua Client" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Client</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Semua Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Platform</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Semua Bulan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Bulan</SelectItem>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periode</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Belum ada report
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {getMonthLabel(report.report_month)} {report.report_year}
                    </TableCell>
                    <TableCell>
                      {report.platform_accounts?.clients?.name || "-"}
                    </TableCell>
                    <TableCell>
                      {PLATFORMS.find(
                        (p) => p.value === report.platform_accounts?.platform
                      )?.label || "-"}
                    </TableCell>
                    <TableCell>
                      {report.platform_accounts?.account_name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.is_locked ? "destructive" : "default"}>
                        {report.is_locked ? (
                          <><Lock className="h-3 w-3 mr-1" /> Locked</>
                        ) : (
                          "Open"
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleView(report)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Lihat Detail
                          </DropdownMenuItem>
                          {!report.is_locked && (
                            <>
                              <DropdownMenuItem onClick={() => handleOpenEdit(report)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedReport(report);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Hapus
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuItem onClick={() => handleToggleLock(report)}>
                            {report.is_locked ? (
                              <>
                                <Unlock className="mr-2 h-4 w-4" />
                                Unlock
                              </>
                            ) : (
                              <>
                                <Lock className="mr-2 h-4 w-4" />
                                Lock
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? "Edit Organic Report" : "Input Organic Report"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Platform Account *</Label>
                  <Select
                    value={formData.platform_account_id as string}
                    onValueChange={(v) =>
                      setFormData({ ...formData, platform_account_id: v })
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.status === "active")
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.clients?.name} - {a.account_name} (
                            {PLATFORMS.find((p) => p.value === a.platform)?.label})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bulan *</Label>
                    <Select
                      value={(formData.report_month as number).toString()}
                      onValueChange={(v) =>
                        setFormData({ ...formData, report_month: parseInt(v) })
                      }
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m) => (
                          <SelectItem key={m.value} value={m.value.toString()}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tahun *</Label>
                    <Select
                      value={(formData.report_year as number).toString()}
                      onValueChange={(v) =>
                        setFormData({ ...formData, report_year: parseInt(v) })
                      }
                      disabled={isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={y.toString()}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {platformMetrics && (
                  <div className="space-y-4 pt-4 border-t">
                    <h4 className="font-medium">{platformMetrics.label} Metrics</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {platformMetrics.metrics.map((metric) => (
                        <div key={metric.key} className="space-y-2">
                          <Label className="text-sm">{metric.label}</Label>
                          <Input
                            type="number"
                            value={(formData[metric.key] as number) || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [metric.key]: e.target.value
                                  ? parseFloat(e.target.value)
                                  : null,
                              })
                            }
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  createMutation.isPending ||
                  updateMutation.isPending ||
                  !formData.platform_account_id
                }
              >
                {isEditing ? "Simpan" : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Detail Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Detail Organic Report</DialogTitle>
            </DialogHeader>
            {selectedReport && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Periode:</span>
                    <p className="font-medium">
                      {getMonthLabel(selectedReport.report_month)}{" "}
                      {selectedReport.report_year}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Client:</span>
                    <p className="font-medium">
                      {selectedReport.platform_accounts?.clients?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Platform:</span>
                    <p className="font-medium">
                      {PLATFORMS.find(
                        (p) => p.value === selectedReport.platform_accounts?.platform
                      )?.label || "-"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Account:</span>
                    <p className="font-medium">
                      {selectedReport.platform_accounts?.account_name || "-"}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Metrics</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedReport.platform_accounts &&
                      PLATFORM_METRICS[
                        selectedReport.platform_accounts.platform as keyof typeof PLATFORM_METRICS
                      ]?.metrics.map((metric) => (
                        <div key={metric.key} className="flex justify-between">
                          <span className="text-muted-foreground">{metric.label}:</span>
                          <span className="font-medium">
                            {formatNumber(selectedReport[metric.key] as number | null)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Report?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus report secara permanen. Tindakan ini
                tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
