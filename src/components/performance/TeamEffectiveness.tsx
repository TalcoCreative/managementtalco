import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TeamEffectivenessProps {
  profiles: any[];
  employeeRoles: Record<string, string[]>;
  payrollData: any[];
  reimbursements: any[];
  tasks: any[];
  projects: any[];
  prospects: any[];
  selectedMonth: string;
  filterByMonth: (date: string | null) => boolean;
}

const COLORS = ['hsl(250, 80%, 60%)', 'hsl(270, 85%, 65%)', 'hsl(142, 76%, 36%)', 'hsl(25, 95%, 53%)', 'hsl(217, 91%, 60%)', 'hsl(0, 84%, 60%)'];

export function TeamEffectiveness({
  profiles,
  employeeRoles,
  payrollData,
  reimbursements,
  tasks,
  projects,
  prospects,
  selectedMonth,
  filterByMonth,
}: TeamEffectivenessProps) {
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate cost and output per role/division
  const roleMetrics = useMemo(() => {
    const roles: Record<string, {
      cost: number;
      taskCount: number;
      projectCount: number;
      prospectCount: number;
      employeeCount: number;
    }> = {};

    // Get all unique roles
    Object.values(employeeRoles).forEach(userRoles => {
      userRoles.forEach(role => {
        if (!roles[role]) {
          roles[role] = { cost: 0, taskCount: 0, projectCount: 0, prospectCount: 0, employeeCount: 0 };
        }
      });
    });

    // Calculate costs per role
    profiles.forEach(profile => {
      const userRolesList = employeeRoles[profile.id] || [];
      
      // Get payroll cost
      const userPayroll = payrollData
        .filter(p => p.employee_id === profile.id && filterByMonth(p.month) && p.status === 'paid')
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
      
      // Get reimbursement cost
      const userReimburse = reimbursements
        .filter(r => r.user_id === profile.id && filterByMonth(r.created_at) && r.status === 'paid')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);
      
      const totalCost = userPayroll + userReimburse;

      // Get task count
      const userTasks = tasks.filter(t => 
        t.assigned_to === profile.id && filterByMonth(t.created_at)
      ).length;

      // Get project count
      const userProjects = projects.filter(p => 
        p.assigned_to === profile.id && filterByMonth(p.created_at)
      ).length;

      // Get prospect count
      const userProspects = prospects.filter(p => 
        (p.created_by === profile.id || p.pic_id === profile.id) && filterByMonth(p.created_at)
      ).length;

      // Distribute costs evenly across user's roles
      userRolesList.forEach(role => {
        if (roles[role]) {
          const roleFraction = 1 / userRolesList.length;
          roles[role].cost += totalCost * roleFraction;
          roles[role].taskCount += userTasks * roleFraction;
          roles[role].projectCount += userProjects * roleFraction;
          roles[role].prospectCount += userProspects * roleFraction;
          roles[role].employeeCount += roleFraction;
        }
      });
    });

    return Object.entries(roles).map(([role, metrics]) => ({
      role: role.replace('_', ' ').toUpperCase(),
      roleKey: role,
      ...metrics,
      costPerTask: metrics.taskCount > 0 ? metrics.cost / metrics.taskCount : 0,
      costPerProject: metrics.projectCount > 0 ? metrics.cost / metrics.projectCount : 0,
      totalOutput: metrics.taskCount + metrics.projectCount + metrics.prospectCount,
    })).sort((a, b) => b.cost - a.cost);
  }, [profiles, employeeRoles, payrollData, reimbursements, tasks, projects, prospects, filterByMonth]);

  // Bar chart data for cost per division
  const costPerDivisionData = roleMetrics.slice(0, 8);

  // Output per division data
  const outputPerDivisionData = roleMetrics.map(r => ({
    role: r.role.length > 12 ? r.role.slice(0, 10) + '...' : r.role,
    tasks: Math.round(r.taskCount),
    projects: Math.round(r.projectCount),
    prospects: Math.round(r.prospectCount),
  })).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Cost per Division Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Biaya per Divisi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costPerDivisionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                  <YAxis dataKey="role" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="cost" name="Total Biaya" fill="hsl(250, 80%, 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Output per Divisi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={outputPerDivisionData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="role" tick={{ fontSize: 10 }} height={60} interval={0} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tasks" name="Tasks" fill="hsl(250, 80%, 60%)" stackId="output" />
                  <Bar dataKey="projects" name="Projects" fill="hsl(270, 85%, 65%)" stackId="output" />
                  <Bar dataKey="prospects" name="Prospects" fill="hsl(142, 76%, 36%)" stackId="output" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cost vs Output Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cost vs Output per Role</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Karyawan</TableHead>
                  <TableHead className="text-right">Total Biaya</TableHead>
                  <TableHead className="text-right">Tasks</TableHead>
                  <TableHead className="text-right">Projects</TableHead>
                  <TableHead className="text-right">Prospects</TableHead>
                  <TableHead className="text-right">Cost/Task</TableHead>
                  <TableHead className="text-right">Cost/Project</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roleMetrics.length > 0 ? (
                  roleMetrics.map((metric) => (
                    <TableRow key={metric.roleKey}>
                      <TableCell>
                        <Badge variant="secondary">{metric.role}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{Math.round(metric.employeeCount)}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(metric.cost)}</TableCell>
                      <TableCell className="text-right">{Math.round(metric.taskCount)}</TableCell>
                      <TableCell className="text-right">{Math.round(metric.projectCount)}</TableCell>
                      <TableCell className="text-right">{Math.round(metric.prospectCount)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {metric.costPerTask > 0 ? formatCurrency(metric.costPerTask) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {metric.costPerProject > 0 ? formatCurrency(metric.costPerProject) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Tidak ada data
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
