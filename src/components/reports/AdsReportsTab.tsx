import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useAdsReports,
  useCreateAdsReport,
  useUpdateAdsReport,
  useDeleteAdsReport,
  useLockReport,
  usePlatformAccounts,
} from "@/hooks/useReports";
import {
  ADS_PLATFORMS,
  ADS_OBJECTIVES,
  MONTHS,
  getMonthLabel,
  formatCurrencyIDR,
  formatNumber,
  getPlatformLabel,
  type AdsPlatform,
  type AdsObjective,
  type MonthlyAdsReport,
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

export function AdsReportsTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<MonthlyAdsReport | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(currentYear.toString());
  const [filterMonth, setFilterMonth] = useState<string>("all");

  const [formData, setFormData] = useState({
    client_id: "",
    platform: "" as AdsPlatform | "",
    platform_account_id: "",
    report_month: new Date().getMonth() + 1,
    report_year: currentYear,
    total_spend: 0,
    impressions: 0,
    reach: 0,
    clicks: 0,
    results: 0,
    objective: "" as AdsObjective | "",
  });

  const { data: reports = [], isLoading } = useAdsReports({
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

  const createMutation = useCreateAdsReport();
  const updateMutation = useUpdateAdsReport();
  const deleteMutation = useDeleteAdsReport();
  const lockMutation = useLockReport();

  // Filter accounts based on selected client
  const filteredAccounts = accounts.filter(
    (a) => a.client_id === formData.client_id && a.status === "active"
  );

  const handleOpenCreate = () => {
    setSelectedReport(null);
    setIsEditing(false);
    setFormData({
      client_id: "",
      platform: "",
      platform_account_id: "",
      report_month: new Date().getMonth() + 1,
      report_year: currentYear,
      total_spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      results: 0,
      objective: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (report: MonthlyAdsReport) => {
    setSelectedReport(report);
    setIsEditing(true);
    setFormData({
      client_id: report.client_id,
      platform: report.platform,
      platform_account_id: report.platform_account_id || "",
      report_month: report.report_month,
      report_year: report.report_year,
      total_spend: report.total_spend,
      impressions: report.impressions,
      reach: report.reach,
      clicks: report.clicks,
      results: report.results,
      objective: report.objective,
    });
    setDialogOpen(true);
  };

  const handleView = (report: MonthlyAdsReport) => {
    setSelectedReport(report);
    setViewDialogOpen(true);
  };

  const handleSubmit = () => {
    if (
      !formData.client_id ||
      !formData.platform ||
      !formData.objective ||
      formData.total_spend < 0
    ) {
      return;
    }

    const payload = {
      client_id: formData.client_id,
      platform: formData.platform as AdsPlatform,
      platform_account_id: formData.platform_account_id && formData.platform_account_id !== "none" ? formData.platform_account_id : undefined,
      report_month: formData.report_month,
      report_year: formData.report_year,
      total_spend: formData.total_spend,
      impressions: formData.impressions,
      reach: formData.reach,
      clicks: formData.clicks,
      results: formData.results,
      objective: formData.objective as AdsObjective,
    };

    if (isEditing && selectedReport) {
      updateMutation.mutate(
        {
          id: selectedReport.id,
          previousValues: selectedReport as unknown as Record<string, unknown>,
          ...payload,
        },
        { onSuccess: () => setDialogOpen(false) }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => setDialogOpen(false),
      });
    }
  };

  const handleDelete = () => {
    if (selectedReport) {
      deleteMutation.mutate(
        { id: selectedReport.id, previousValues: selectedReport as unknown as Record<string, unknown> },
        { onSuccess: () => setDeleteDialogOpen(false) }
      );
    }
  };

  const handleToggleLock = (report: MonthlyAdsReport) => {
    lockMutation.mutate({
      id: report.id,
      reportType: "ads",
      lock: !report.is_locked,
    });
  };

  // Calculate totals
  const totalSpend = reports.reduce((sum, r) => sum + r.total_spend, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold">Ads Reports</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Total Spend: {formatCurrencyIDR(totalSpend)}
          </p>
        </div>
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
              {ADS_PLATFORMS.map((p) => (
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
                <TableHead>Objective</TableHead>
                <TableHead className="text-right">Spend</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Belum ada ads report
                  </TableCell>
                </TableRow>
              ) : (
                reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell className="font-medium">
                      {getMonthLabel(report.report_month)} {report.report_year}
                    </TableCell>
                    <TableCell>{report.clients?.name || "-"}</TableCell>
                    <TableCell>{getPlatformLabel(report.platform)}</TableCell>
                    <TableCell className="capitalize">{report.objective}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrencyIDR(report.total_spend)}
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
                {isEditing ? "Edit Ads Report" : "Input Ads Report"}
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(v) =>
                      setFormData({ ...formData, client_id: v, platform_account_id: "" })
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Platform *</Label>
                  <Select
                    value={formData.platform}
                    onValueChange={(v) =>
                      setFormData({ ...formData, platform: v as AdsPlatform })
                    }
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADS_PLATFORMS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Platform Account (Optional)</Label>
                  <Select
                    value={formData.platform_account_id}
                    onValueChange={(v) =>
                      setFormData({ ...formData, platform_account_id: v })
                    }
                    disabled={!formData.client_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih account (opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak ada</SelectItem>
                      {filteredAccounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bulan *</Label>
                    <Select
                      value={formData.report_month.toString()}
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
                      value={formData.report_year.toString()}
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

                <div className="space-y-2">
                  <Label>Objective *</Label>
                  <Select
                    value={formData.objective}
                    onValueChange={(v) =>
                      setFormData({ ...formData, objective: v as AdsObjective })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih objective" />
                    </SelectTrigger>
                    <SelectContent>
                      {ADS_OBJECTIVES.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h4 className="font-medium">Ads Metrics</h4>
                  <div className="space-y-2">
                    <Label>Total Spend (IDR) *</Label>
                    <Input
                      type="number"
                      value={formData.total_spend || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          total_spend: parseInt(e.target.value) || 0,
                        })
                      }
                      placeholder="15000000"
                      min={0}
                    />
                    <p className="text-xs text-muted-foreground">
                      {formData.total_spend > 0 && formatCurrencyIDR(formData.total_spend)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Impressions</Label>
                      <Input
                        type="number"
                        value={formData.impressions || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            impressions: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Reach</Label>
                      <Input
                        type="number"
                        value={formData.reach || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            reach: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Clicks</Label>
                      <Input
                        type="number"
                        value={formData.clicks || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            clicks: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Results</Label>
                      <Input
                        type="number"
                        value={formData.results || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            results: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
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
                  !formData.client_id ||
                  !formData.platform ||
                  !formData.objective
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
              <DialogTitle>Detail Ads Report</DialogTitle>
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
                    <p className="font-medium">{selectedReport.clients?.name || "-"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Platform:</span>
                    <p className="font-medium">
                      {getPlatformLabel(selectedReport.platform)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Objective:</span>
                    <p className="font-medium capitalize">{selectedReport.objective}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Metrics</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between col-span-2 bg-muted/50 p-2 rounded">
                      <span className="text-muted-foreground">Total Spend:</span>
                      <span className="font-bold">
                        {formatCurrencyIDR(selectedReport.total_spend)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Impressions:</span>
                      <span className="font-medium">
                        {formatNumber(selectedReport.impressions)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Reach:</span>
                      <span className="font-medium">
                        {formatNumber(selectedReport.reach)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Clicks:</span>
                      <span className="font-medium">
                        {formatNumber(selectedReport.clicks)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Results:</span>
                      <span className="font-medium">
                        {formatNumber(selectedReport.results)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Performance</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">CPM</p>
                      <p className="font-medium">
                        {selectedReport.cpm
                          ? formatCurrencyIDR(selectedReport.cpm)
                          : "-"}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">CPC</p>
                      <p className="font-medium">
                        {selectedReport.cpc
                          ? formatCurrencyIDR(selectedReport.cpc)
                          : "-"}
                      </p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded">
                      <p className="text-muted-foreground text-xs">Cost/Result</p>
                      <p className="font-medium">
                        {selectedReport.cost_per_result
                          ? formatCurrencyIDR(selectedReport.cost_per_result)
                          : "-"}
                      </p>
                    </div>
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
              <AlertDialogTitle>Hapus Ads Report?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini akan menghapus ads report secara permanen. Tindakan ini
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
