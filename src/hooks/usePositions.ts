import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEPARTMENTS = [
  "Creative",
  "Social Media",
  "Marketing",
  "Production",
  "Operations",
  "IT",
  "Finance",
  "Human Resources",
  "Sales",
  "Client Services",
  "Executive",
  "Intern",
  "Legal",
  "Customer Service",
];

export interface Position {
  id: string;
  name: string;
  description: string | null;
  department: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export function usePositions(activeOnly: boolean = true) {
  return useQuery({
    queryKey: ["positions", activeOnly],
    queryFn: async () => {
      let query = supabase
        .from("positions")
        .select("*")
        .order("department", { ascending: true })
        .order("name", { ascending: true });
      
      if (activeOnly) {
        query = query.eq("is_active", true);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Position[];
    },
  });
}

export function usePositionOptions(activeOnly: boolean = true) {
  const { data: positions, isLoading } = usePositions(activeOnly);
  
  const positionOptions = positions?.map(p => ({
    value: p.name,
    label: p.name,
    department: p.department,
    color: p.color,
  })) || [];
  
  return { positions, positionOptions, isLoading };
}

// Hook untuk mendapatkan roles dari positions untuk dropdown user
export function useRoleOptions() {
  const { data: positions, isLoading } = usePositions(true);

  const roleOptions =
    positions?.map((p) => ({
      value: p.name.toLowerCase().replace(/\s+/g, "_"),
      label: p.name,
      department: p.department,
      color: p.color,
    })) || [];

  // Tambah default system roles di awal
  const systemRoles = [
    { value: "super_admin", label: "Super Admin", department: "Executive", color: "#6366f1" },
  ];

  return { 
    roleOptions: [...systemRoles, ...roleOptions], 
    positions,
    isLoading 
  };
}

// Hook untuk mendapatkan departments unik dari positions
export function useDepartments() {
  const { data: positions, isLoading } = usePositions(false);

  const departments = positions
    ? [...new Set(positions.map((p) => p.department).filter(Boolean))]
    : DEPARTMENTS;

  return { departments: departments as string[], isLoading };
}

// Helper function untuk mendapatkan warna berdasarkan role/position
export function getPositionColor(positions: Position[] | undefined, roleName: string): string {
  if (!positions) return "#6366f1";
  
  const position = positions.find(
    (p) => p.name.toLowerCase().replace(/\s+/g, "_") === roleName ||
           p.name.toLowerCase() === roleName.toLowerCase()
  );
  
  return position?.color || "#6366f1";
}

// Helper function untuk mendapatkan label dari role value
export function getRoleLabel(positions: Position[] | undefined, roleValue: string): string {
  if (roleValue === "super_admin") return "Super Admin";
  if (!positions) return roleValue;
  
  const position = positions.find(
    (p) => p.name.toLowerCase().replace(/\s+/g, "_") === roleValue
  );
  
  return position?.name || roleValue;
}
