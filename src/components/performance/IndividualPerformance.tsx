import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Briefcase, CheckSquare, Video, Target, Calendar, ArrowUpDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IndividualPerformanceProps {
  profiles: any[];
  employeeRoles: Record<string, string[]>;
  payrollData: any[];
  reimbursements: any[];
  tasks: any[];
  projects: any[];
  shootings: any[];
  prospects: any[];
  attendance: any[];
  leaveRequests: any[];
  selectedMonth: string;
  selectedEmployee: string | null;
  setSelectedEmployee: (id: string | null) => void;
  filterByMonth: (date: string | null) => boolean;
}

type SortField = 'name' | 'cost' | 'tasks' | 'projects' | 'efficiency';
type SortDirection = 'asc' | 'desc';

export function IndividualPerformance({
  profiles,
  employeeRoles,
  payrollData,
  reimbursements,
  tasks,
  projects,
  shootings,
  prospects,
  attendance,
  leaveRequests,
  selectedMonth,
  selectedEmployee,
  setSelectedEmployee,
  filterByMonth,
}: IndividualPerformanceProps) {
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate individual metrics
  const employeeMetrics = useMemo(() => {
    return profiles.map(profile => {
      const userPayroll = payrollData
        .filter(p => p.employee_id === profile.id && filterByMonth(p.month) && p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      const userReimburse = reimbursements
        .filter(r => r.user_id === profile.id && filterByMonth(r.created_at) && r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      const totalCost = userPayroll + userReimburse;

      const userTasks = tasks.filter(t => 
        t.assigned_to === profile.id && filterByMonth(t.created_at)
      );
      const completedTasks = userTasks.filter(t => t.status === 'done').length;

      const userProjects = projects.filter(p => 
        p.assigned_to === profile.id && filterByMonth(p.created_at)
      );
      const completedProjects = userProjects.filter(p => p.status === 'completed').length;

      const userShootings = shootings.filter(s => 
        (s.director === profile.id || s.runner === profile.id || s.requested_by === profile.id) && 
        filterByMonth(s.scheduled_date)
      ).length;

      const userProspects = prospects.filter(p => 
        (p.created_by === profile.id || p.pic_id === profile.id) && filterByMonth(p.created_at)
      );
      const wonProspects = userProspects.filter(p => p.status === 'closed-won').length;

      const userAttendance = attendance.filter(a => 
        a.user_id === profile.id && filterByMonth(a.date)
      ).length;

      const userLeaves = leaveRequests.filter(l => 
        l.user_id === profile.id && filterByMonth(l.start_date) && l.status === 'approved'
      ).length;

      const roles = employeeRoles[profile.id] || [];

      const totalOutput = userTasks.length + userProjects.length + userProspects.length;
      const costPerTask = userTasks.length > 0 ? totalCost / userTasks.length : 0;
      const costPerProject = userProjects.length > 0 ? totalCost / userProjects.length : 0;
      const costPerProspect = userProspects.length > 0 ? totalCost / userProspects.length : 0;

      return {
        id: profile.id,
        name: profile.full_name,
        avatar: profile.avatar_url,
        status: profile.status,
        roles,
        payroll: userPayroll,
        reimburse: userReimburse,
        totalCost,
        taskCount: userTasks.length,
        completedTasks,
        projectCount: userProjects.length,
        completedProjects,
        shootingCount: userShootings,
        prospectCount: userProspects.length,
        wonProspects,
        attendanceCount: userAttendance,
        leaveCount: userLeaves,
        costPerTask,
        costPerProject,
        costPerProspect,
        totalOutput,
        efficiency: totalOutput > 0 ? totalCost / totalOutput : Infinity,
      };
    });
  }, [profiles, employeeRoles, payrollData, reimbursements, tasks, projects, shootings, prospects, attendance, leaveRequests, filterByMonth]);

  // Sort metrics
  const sortedMetrics = useMemo(() => {
    return [...employeeMetrics].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'cost':
          comparison = a.totalCost - b.totalCost;
          break;
        case 'tasks':
          comparison = a.taskCount - b.taskCount;
          break;
        case 'projects':
          comparison = a.projectCount - b.projectCount;
          break;
        case 'efficiency':
          comparison = (a.efficiency === Infinity ? 999999999 : a.efficiency) - 
                       (b.efficiency === Infinity ? 999999999 : b.efficiency);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [employeeMetrics, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Selected employee detail
  const selectedMetric = employeeMetrics.find(m => m.id === selectedEmployee);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto p-0 hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kinerja Karyawan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortButton field="name">Nama</SortButton></TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right"><SortButton field="cost">Total Cost</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="tasks">Tasks</SortButton></TableHead>
                  <TableHead className="text-right"><SortButton field="projects">Projects</SortButton></TableHead>
                  <TableHead className="text-right">Prospects</TableHead>
                  <TableHead className="text-right"><SortButton field="efficiency">Cost/Output</SortButton></TableHead>
                  <TableHead className="text-center">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMetrics.length > 0 ? (
                  sortedMetrics.map((metric) => (
                    <TableRow key={metric.id} className={metric.status !== 'active' ? 'opacity-50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={metric.avatar || ''} />
                            <AvatarFallback>{metric.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{metric.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {metric.roles.slice(0, 2).map(role => (
                            <Badge key={role} variant="secondary" className="text-xs">
                              {role.replace('_', ' ')}
                            </Badge>
                          ))}
                          {metric.roles.length > 2 && (
                            <Badge variant="outline" className="text-xs">+{metric.roles.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(metric.totalCost)}</TableCell>
                      <TableCell className="text-right">
                        {metric.completedTasks}/{metric.taskCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.completedProjects}/{metric.projectCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {metric.wonProspects}/{metric.prospectCount}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {metric.efficiency !== Infinity ? formatCurrency(metric.efficiency) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedEmployee(metric.id)}
                        >
                          Lihat
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Tidak ada data karyawan
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Employee Detail Dialog */}
      <Dialog open={!!selectedMetric} onOpenChange={() => setSelectedEmployee(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedMetric?.avatar || ''} />
                <AvatarFallback>{selectedMetric?.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <span>{selectedMetric?.name}</span>
                <div className="flex gap-1 mt-1">
                  {selectedMetric?.roles.map(role => (
                    <Badge key={role} variant="secondary" className="text-xs font-normal">
                      {role.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh]">
            {selectedMetric && (
              <div className="space-y-6 pr-4">
                {/* Cost Summary */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Total Cost
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Gaji</p>
                        <p className="text-lg font-bold">{formatCurrency(selectedMetric.payroll)}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Reimburse</p>
                        <p className="text-lg font-bold">{formatCurrency(selectedMetric.reimburse)}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-primary/5">
                      <CardContent className="pt-4">
                        <p className="text-sm text-muted-foreground">Total</p>
                        <p className="text-lg font-bold text-primary">{formatCurrency(selectedMetric.totalCost)}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Activity Summary */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" /> Aktivitas
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <CheckSquare className="h-4 w-4" />
                        <span className="text-sm">Tasks</span>
                      </div>
                      <p className="text-xl font-bold">{selectedMetric.completedTasks}/{selectedMetric.taskCount}</p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Briefcase className="h-4 w-4" />
                        <span className="text-sm">Projects</span>
                      </div>
                      <p className="text-xl font-bold">{selectedMetric.completedProjects}/{selectedMetric.projectCount}</p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Video className="h-4 w-4" />
                        <span className="text-sm">Shooting</span>
                      </div>
                      <p className="text-xl font-bold">{selectedMetric.shootingCount}</p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <div className="flex items-center gap-2 text-muted-foreground mb-1">
                        <Target className="h-4 w-4" />
                        <span className="text-sm">Prospects</span>
                      </div>
                      <p className="text-xl font-bold">{selectedMetric.wonProspects}/{selectedMetric.prospectCount}</p>
                    </div>
                  </div>
                </div>

                {/* Attendance */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Kehadiran
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Hari Hadir</p>
                      <p className="text-xl font-bold">{selectedMetric.attendanceCount}</p>
                    </div>
                    <div className="p-3 rounded-lg border">
                      <p className="text-sm text-muted-foreground">Cuti (Approved)</p>
                      <p className="text-xl font-bold">{selectedMetric.leaveCount}</p>
                    </div>
                  </div>
                </div>

                {/* Cost Ratios */}
                <div>
                  <h4 className="font-semibold mb-3">Rasio Biaya</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Cost/Task</p>
                      <p className="text-lg font-bold">
                        {selectedMetric.costPerTask > 0 ? formatCurrency(selectedMetric.costPerTask) : '-'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Cost/Project</p>
                      <p className="text-lg font-bold">
                        {selectedMetric.costPerProject > 0 ? formatCurrency(selectedMetric.costPerProject) : '-'}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-sm text-muted-foreground">Cost/Prospect</p>
                      <p className="text-lg font-bold">
                        {selectedMetric.costPerProspect > 0 ? formatCurrency(selectedMetric.costPerProspect) : '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
