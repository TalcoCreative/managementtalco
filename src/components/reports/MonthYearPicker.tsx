import { useState } from "react";
import { format, setMonth, setYear } from "date-fns";
import { id } from "date-fns/locale";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des"
];

interface MonthYearPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  placeholder?: string;
  className?: string;
}

export function MonthYearPicker({ 
  value, 
  onChange, 
  placeholder = "Pilih bulan",
  className 
}: MonthYearPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());

  const handleMonthSelect = (monthIndex: number) => {
    const newDate = setMonth(setYear(new Date(), viewYear), monthIndex);
    onChange(newDate);
    setIsOpen(false);
  };

  const handlePrevYear = () => {
    setViewYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setViewYear(prev => prev + 1);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(value, "MMM yyyy", { locale: id }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3 pointer-events-auto" align="start">
        {/* Year navigation */}
        <div className="flex items-center justify-between mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handlePrevYear}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold">{viewYear}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleNextYear}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Month grid */}
        <div className="grid grid-cols-3 gap-2">
          {MONTHS.map((month, index) => {
            const isSelected = 
              value.getMonth() === index && 
              value.getFullYear() === viewYear;
            
            return (
              <Button
                key={month}
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-9",
                  isSelected && "bg-primary text-primary-foreground"
                )}
                onClick={() => handleMonthSelect(index)}
              >
                {month}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
