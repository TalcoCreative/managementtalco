import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";

interface EmployeeProjectContributionProps {
  tasks: any[];
  meetings: any[];
  shootings: any[];
  events: any[];
  employeeId: string;
}

export function EmployeeProjectContribution({ tasks, meetings, shootings, events, employeeId }: EmployeeProjectContributionProps) {
  const projectData = useMemo(() => {
    const map = new Map<string, { name: string; tasks: number; meetings: number; shootings: number; events: number; overdue: number }>();
    const addToProject = (projectId: string | null, projectTitle: string | null, type: string, isOverdue = false) => {
      const id = projectId || 'no-project';
      const name = projectTitle || 'Tanpa Project';
      if (!map.has(id)) map.set(id, { name, tasks: 0, meetings: 0, shootings: 0, events: 0, overdue: 0 });
      const p = map.get(id)!;
      if (type === 'task') p.tasks++;
      if (type === 'meeting') p.meetings++;
      if (type === 'shooting') p.shootings++;
      if (type === 'event') p.events++;
      if (isOverdue) p.overdue++;
    };
    tasks.forEach(t => addToProject(t.project_id, t.projects?.title, 'task', t.deadline && t.status !== 'done' && t.status !== 'completed' && new Date(t.deadline) < new Date()));
    meetings.forEach(m => addToProject(m.project_id, m.projects?.title, 'meeting'));
    shootings.forEach(s => addToProject(s.project_id, s.projects?.title, 'shooting'));
    events.forEach(e => addToProject(e.project_id, e.projects?.title, 'event'));
    return Array.from(map.values());
  }, [tasks, meetings, shootings, events]);

  return (
    <Card>
      <CardHeader><CardTitle>Kontribusi per Project</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead><TableHead className="text-center">Task</TableHead><TableHead className="text-center">Meeting</TableHead>
              <TableHead className="text-center">Shooting</TableHead><TableHead className="text-center">Event</TableHead><TableHead className="text-center">Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectData.map((p, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-center">{p.tasks}</TableCell><TableCell className="text-center">{p.meetings}</TableCell>
                <TableCell className="text-center">{p.shootings}</TableCell><TableCell className="text-center">{p.events}</TableCell>
                <TableCell className="text-center">{p.overdue > 0 ? <Badge variant="destructive">{p.overdue}</Badge> : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
