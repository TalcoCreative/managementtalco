import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CompletedTasksFilterProps {
  projects: any[] | undefined;
  users: any[] | undefined;
  clients: any[] | undefined;
  onFilterChange: (filters: {
    search: string;
    project: string;
    assignee: string;
    client: string;
    startDate: string;
    endDate: string;
  }) => void;
}

export function CompletedTasksFilter({
  projects,
  users,
  clients,
  onFilterChange,
}: CompletedTasksFilterProps) {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [client, setClient] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleChange = (updates: Partial<{
    search: string;
    project: string;
    assignee: string;
    client: string;
    startDate: string;
    endDate: string;
  }>) => {
    const newFilters = {
      search: updates.search ?? search,
      project: updates.project ?? project,
      assignee: updates.assignee ?? assignee,
      client: updates.client ?? client,
      startDate: updates.startDate ?? startDate,
      endDate: updates.endDate ?? endDate,
    };
    
    if (updates.search !== undefined) setSearch(updates.search);
    if (updates.project !== undefined) setProject(updates.project);
    if (updates.assignee !== undefined) setAssignee(updates.assignee);
    if (updates.client !== undefined) setClient(updates.client);
    if (updates.startDate !== undefined) setStartDate(updates.startDate);
    if (updates.endDate !== undefined) setEndDate(updates.endDate);
    
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    setSearch("");
    setProject("all");
    setAssignee("all");
    setClient("all");
    setStartDate("");
    setEndDate("");
    onFilterChange({
      search: "",
      project: "all",
      assignee: "all",
      client: "all",
      startDate: "",
      endDate: "",
    });
  };

  const hasFilters = search || project !== "all" || assignee !== "all" || client !== "all" || startDate || endDate;

  return (
    <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filter Completed Tasks</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto h-7">
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
      
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="sm:col-span-2">
          <Label className="text-xs">Search</Label>
          <Input
            placeholder="Search task title..."
            value={search}
            onChange={(e) => handleChange({ search: e.target.value })}
            className="h-9"
          />
        </div>
        
        <div>
          <Label className="text-xs">Project</Label>
          <Select value={project} onValueChange={(v) => handleChange({ project: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-xs">Assignee</Label>
          <Select value={assignee} onValueChange={(v) => handleChange({ assignee: v })}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {users?.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label className="text-xs">Completed From</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => handleChange({ startDate: e.target.value })}
            className="h-9"
          />
        </div>
        
        <div>
          <Label className="text-xs">Completed To</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => handleChange({ endDate: e.target.value })}
            className="h-9"
          />
        </div>
      </div>
    </div>
  );
}
