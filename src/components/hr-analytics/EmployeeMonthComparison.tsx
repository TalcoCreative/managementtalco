import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { differenceInMinutes, parseISO } from "date-fns";

interface EmployeeMonthComparisonProps {
  currentAttendance: any[];
  compareAttendance: any[];
  currentTasks: any[];
  employeeId: string;
  currentMonth: string;
  compareMonth: string;
}

export function EmployeeMonthComparison({ currentAttendance, compareAttendance, currentMonth, compareMonth }: EmployeeMonthComparisonProps) {
  const calcHours = (att: any[]) => Math.round(att.reduce((s, a) => s + (a.clock_in && a.clock_out ? differenceInMinutes(parseISO(a.clock_out), parseISO(a.clock_in)) - (a.total_break_minutes || 0) : 0), 0) / 60);
  const calcDays = (att: any[]) => att.filter(a => a.clock_in).length;
  const calcAuto = (att: any[]) => att.filter(a => a.notes?.includes('[AUTO CLOCK-OUT')).length;

  const data = [
    { metric: 'Jam Kerja', [currentMonth]: calcHours(currentAttendance), [compareMonth]: calcHours(compareAttendance) },
    { metric: 'Hari Hadir', [currentMonth]: calcDays(currentAttendance), [compareMonth]: calcDays(compareAttendance) },
    { metric: 'Auto Clock-out', [currentMonth]: calcAuto(currentAttendance), [compareMonth]: calcAuto(compareAttendance) },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Perbandingan Bulan</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="metric" width={100} />
            <Tooltip /><Legend />
            <Bar dataKey={currentMonth} fill="hsl(var(--primary))" />
            <Bar dataKey={compareMonth} fill="hsl(var(--muted-foreground))" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
