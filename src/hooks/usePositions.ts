import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  
  const positionOptions = positions?.map(p => p.name) || [];
  
  return { positions, positionOptions, isLoading };
}
