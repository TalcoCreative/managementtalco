import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, Building2, Star, Home } from "lucide-react";
import { format } from "date-fns";

interface Holiday {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  holiday_type: string;
  description: string | null;
}

const holidayTypeLabels: Record<string, string> = {
  national: "Libur Nasional",
  office: "Libur Kantor",
  special: "Libur Khusus",
  wfh: "WFH",
};

const holidayTypeIcons: Record<string, typeof Calendar> = {
  national: Calendar,
  office: Building2,
  special: Star,
  wfh: Home,
};

const HolidayBanner = () => {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: todayHolidays } = useQuery({
    queryKey: ["today-holidays", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holidays")
        .select("*")
        .eq("is_active", true)
        .lte("start_date", today)
        .gte("end_date", today);

      if (error) throw error;
      return data as Holiday[];
    },
  });

  if (!todayHolidays || todayHolidays.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {todayHolidays.map((holiday) => {
        const Icon = holidayTypeIcons[holiday.holiday_type] || Calendar;
        const typeLabel = holidayTypeLabels[holiday.holiday_type] || holiday.holiday_type;
        
        // Different styles based on holiday type
        const styles: Record<string, string> = {
          national: "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
          office: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
          special: "border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200",
          wfh: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
        };

        return (
          <Alert key={holiday.id} className={styles[holiday.holiday_type] || ""}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="font-semibold">
              Hari ini {typeLabel}: {holiday.name}
            </AlertTitle>
            {holiday.description && (
              <AlertDescription className="mt-1 opacity-80">
                {holiday.description}
              </AlertDescription>
            )}
          </Alert>
        );
      })}
    </div>
  );
};

export default HolidayBanner;
