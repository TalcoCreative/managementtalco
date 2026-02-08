import { format, isToday, isTomorrow, parseISO, isThisWeek } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Camera,
  Users,
  FileText,
  CalendarDays,
} from "lucide-react";

interface ScheduleItem {
  id: string;
  type: "meeting" | "shooting";
  title: string;
  date: string;
  time: string | null;
  endTime: string | null;
  location: string | null;
  mode: string | null;
  meetingLink: string | null;
  status: string;
}

interface EditorialPlanItem {
  id: string;
  title: string;
  period: string | null;
  slug: string;
}

interface PublicClientScheduleProps {
  schedule: ScheduleItem[];
  editorialPlans: EditorialPlanItem[];
  clientSlug: string;
}

function getDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return "Hari Ini";
  if (isTomorrow(date)) return "Besok";
  return format(date, "EEEE, d MMMM yyyy", { locale: localeId });
}

function getDateBadgeVariant(dateStr: string): "default" | "secondary" | "destructive" | "outline" {
  const date = parseISO(dateStr);
  if (isToday(date)) return "destructive";
  if (isTomorrow(date)) return "default";
  return "secondary";
}

function groupByDate(items: ScheduleItem[]): Record<string, ScheduleItem[]> {
  const groups: Record<string, ScheduleItem[]> = {};
  items.forEach((item) => {
    const key = item.date;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });
  return groups;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  // Handle HH:mm:ss or HH:mm format
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
}

function getTypeConfig(type: string) {
  switch (type) {
    case "meeting":
      return {
        label: "Meeting",
        icon: Users,
        bgColor: "bg-indigo-50 dark:bg-indigo-950/30",
        borderColor: "border-l-indigo-500",
        badgeClass: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
        iconColor: "text-indigo-500",
      };
    case "shooting":
      return {
        label: "Shooting",
        icon: Camera,
        bgColor: "bg-pink-50 dark:bg-pink-950/30",
        borderColor: "border-l-pink-500",
        badgeClass: "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
        iconColor: "text-pink-500",
      };
    default:
      return {
        label: type,
        icon: Calendar,
        bgColor: "bg-muted/50",
        borderColor: "border-l-muted-foreground",
        badgeClass: "bg-muted text-muted-foreground",
        iconColor: "text-muted-foreground",
      };
  }
}

function getStatusConfig(status: string) {
  switch (status) {
    case "scheduled":
    case "approved":
      return { label: "Dijadwalkan", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300" };
    case "pending":
      return { label: "Menunggu", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300" };
    case "completed":
    case "done":
      return { label: "Selesai", className: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300" };
    case "in_progress":
      return { label: "Berlangsung", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300" };
    default:
      return { label: status, className: "bg-muted text-muted-foreground" };
  }
}

export function PublicClientSchedule({ schedule, editorialPlans, clientSlug }: PublicClientScheduleProps) {
  const grouped = groupByDate(schedule);
  const dateKeys = Object.keys(grouped).sort();

  // Split into this week and later
  const thisWeekDates = dateKeys.filter((d) => isThisWeek(parseISO(d), { weekStartsOn: 1 }));
  const laterDates = dateKeys.filter((d) => !isThisWeek(parseISO(d), { weekStartsOn: 1 }));

  const hasSchedule = schedule.length > 0;
  const hasEP = editorialPlans.length > 0;

  if (!hasSchedule && !hasEP) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Jadwal Mendatang</h2>
      </div>

      {hasSchedule ? (
        <div className="space-y-6">
          {/* This week */}
          {thisWeekDates.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Minggu Ini
              </p>
              {thisWeekDates.map((dateKey) => (
                <DateGroup key={dateKey} dateKey={dateKey} items={grouped[dateKey]} />
              ))}
            </div>
          )}

          {/* Later */}
          {laterDates.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Mendatang
              </p>
              {laterDates.map((dateKey) => (
                <DateGroup key={dateKey} dateKey={dateKey} items={grouped[dateKey]} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Calendar className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Belum ada jadwal mendatang</p>
          </CardContent>
        </Card>
      )}

      {/* Editorial Plans section */}
      {hasEP && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-purple-500" />
            <h3 className="text-base font-semibold">Editorial Plan</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {editorialPlans.map((ep) => (
              <a
                key={ep.id}
                href={`/ep-list/${clientSlug}`}
                className="block"
              >
                <Card className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 border-l-purple-500">
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{ep.title}</p>
                        {ep.period && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ep.period}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">
                        EP
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DateGroup({ dateKey, items }: { dateKey: string; items: ScheduleItem[] }) {
  const label = getDateLabel(dateKey);
  const badgeVariant = getDateBadgeVariant(dateKey);

  return (
    <div className="space-y-2">
      {/* Date header */}
      <div className="flex items-center gap-2">
        <Badge variant={badgeVariant} className="text-xs font-medium">
          {label}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "jadwal" : "jadwal"}
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item) => (
          <ScheduleCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function ScheduleCard({ item }: { item: ScheduleItem }) {
  const typeConfig = getTypeConfig(item.type);
  const statusConfig = getStatusConfig(item.status);
  const Icon = typeConfig.icon;

  return (
    <Card className={`border-l-4 ${typeConfig.borderColor} ${typeConfig.bgColor} transition-all`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`mt-0.5 shrink-0 ${typeConfig.iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>

          {/* Content */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Title row */}
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm leading-tight">{item.title}</p>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${typeConfig.badgeClass}`}>
                  {typeConfig.label}
                </Badge>
                <Badge className={`text-[10px] px-1.5 py-0 h-5 border-0 ${statusConfig.className}`}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>

            {/* Details row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {item.time && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(item.time)}
                  {item.endTime && ` - ${formatTime(item.endTime)}`}
                </span>
              )}
              {item.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[180px]">{item.location}</span>
                </span>
              )}
              {item.mode === "online" && item.meetingLink && (
                <a
                  href={item.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Video className="h-3 w-3" />
                  Link Meeting
                </a>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
