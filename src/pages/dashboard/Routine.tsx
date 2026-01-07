import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, ListChecks, Video } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_SLOTS = [
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
  "18:00-19:00",
  "19:00-20:00",
  "20:00-21:00",
  "21:00-22:00"
];

const Routine = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const { data: enrollments } = useEnrollments();

  useEffect(() => {
    document.title = "Routine – Atlas";
  }, []);

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  // Fetch Classes
  const { data: classes } = useQuery({
    queryKey: ["routine-classes", enrolledCourseIds],
    queryFn: async () => {
        if (enrolledCourseIds.length === 0) return [];
        const { data, error } = await supabase
            .from("classes")
            .select("*, course:courses(name)")
            .in("course_id", enrolledCourseIds)
            .gte("start_at", new Date().toISOString()) // Only future/recent
            .order("start_at", { ascending: true });
        if (error) throw error;
        return data || [];
    },
    enabled: enrolledCourseIds.length > 0
  });

  // Fetch Exams
  const { data: exams } = useQuery({
    queryKey: ["routine-exams", enrolledCourseIds],
    queryFn: async () => {
        if (enrolledCourseIds.length === 0) return [];
        const { data, error } = await supabase
            .from("exams")
            .select("*, course:courses(name)")
            .in("course_id", enrolledCourseIds)
            .gte("time_window_start", new Date().toISOString())
            .order("time_window_start", { ascending: true });
        if (error) throw error;
        return data || [];
    },
    enabled: enrolledCourseIds.length > 0
  });

  // Filter by selected course
  const filteredClasses = classes?.filter(c => selectedCourse === "all" || c.course_id === selectedCourse) || [];
  const filteredExams = exams?.filter(e => selectedCourse === "all" || e.course_id === selectedCourse) || [];

  // --- Logic for Weekly Timetable (Current Week) ---
  const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
    // Actually, usually week starts Sunday or Monday. Let's assume Sunday start for DAYS array matching.
    const diffSun = d.getDate() - day;
    return new Date(d.setDate(diffSun));
  };

  const currentWeekStart = getStartOfWeek(new Date());
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekEnd.getDate() + 6);
  currentWeekEnd.setHours(23, 59, 59, 999);

  const thisWeekClasses = filteredClasses.filter(c => {
      const d = new Date(c.start_at);
      return d >= currentWeekStart && d <= currentWeekEnd;
  });

  const getClassesForTimeSlot = (dayIndex: number, timeSlot: string) => {
    return thisWeekClasses.filter((classItem) => {
      if (!classItem.start_at) return false;
      const date = new Date(classItem.start_at);
      if (date.getDay() !== dayIndex) return false; // Match day

      const classHour = date.getHours();
      const [slotStart] = timeSlot.split("-");
      const [slotStartHour] = slotStart.split(":").map(Number);

      return classHour === slotStartHour;
    });
  };

  // --- Logic for Monthly Schedule List ---
  const allEvents = [
      ...filteredClasses.map(c => ({
          type: 'class',
          date: new Date(c.start_at),
          title: c.title,
          subtitle: c.class_type === 'live' ? 'Live Class' : 'Recorded Class',
          course: c.course?.name,
          id: c.id
      })),
      ...filteredExams.map(e => ({
          type: 'exam',
          date: new Date(e.time_window_start),
          title: e.title,
          subtitle: 'Exam',
          course: e.course?.name,
          id: e.id
      }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Group by Month -> Date
  const groupedEvents: Record<string, typeof allEvents> = {};
  allEvents.forEach(event => {
      const dateKey = event.date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
      if (!groupedEvents[dateKey]) groupedEvents[dateKey] = [];
      groupedEvents[dateKey].push(event);
  });

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Routine & Schedule</h1>
        <p className="text-sm text-muted-foreground">View your weekly timetable and upcoming monthly schedule.</p>
      </header>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground whitespace-nowrap">Course filter</div>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-56">
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {enrollments?.map((enrollment) => (
                <SelectItem key={enrollment.course_id} value={enrollment.course_id}>
                    {enrollment.course.name}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList>
            <TabsTrigger value="schedule">Monthly Schedule</TabsTrigger>
            <TabsTrigger value="timetable">This Week's Timetable</TabsTrigger>
        </TabsList>

        <TabsContent value="timetable" className="mt-4">
            <Card className="border border-foreground/50 overflow-x-auto">
            <CardContent className="p-0">
                <div className="min-w-[800px]">
                    <table className="w-full text-sm">
                    <thead className="border-b border-border bg-muted/30">
                        <tr>
                        <th className="p-3 text-left font-semibold w-24 sticky left-0 bg-background border-r">Time</th>
                        {DAYS.map((day, i) => (
                            <th key={day} className={`p-3 text-left font-semibold ${new Date().getDay() === i ? 'bg-primary/5 text-primary' : ''}`}>
                            {day}
                            </th>
                        ))}
                        </tr>
                    </thead>
                    <tbody>
                        {TIME_SLOTS.map((timeSlot) => (
                        <tr key={timeSlot} className="border-b border-border last:border-0">
                            <td className="p-3 text-xs font-medium text-muted-foreground sticky left-0 bg-background border-r">
                                {timeSlot}
                            </td>
                            {DAYS.map((day, dayIndex) => {
                            const dayClasses = getClassesForTimeSlot(dayIndex, timeSlot);
                            return (
                                <td key={day} className={`p-2 align-top h-16 ${new Date().getDay() === dayIndex ? 'bg-primary/5' : ''}`}>
                                {dayClasses.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                    {dayClasses.map((classItem) => (
                                        <div key={classItem.id} className="text-xs bg-card border rounded p-1.5 shadow-sm">
                                        <div className="font-semibold text-primary truncate" title={classItem.title}>{classItem.title}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">{classItem.course.name}</div>
                                        </div>
                                    ))}
                                    </div>
                                )}
                                </td>
                            );
                            })}
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
            </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
            <Card className="border border-foreground/50">
                <CardHeader>
                    <CardTitle className="text-base">Upcoming Classes & Exams</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {Object.keys(groupedEvents).length === 0 ? (
                        <p className="text-muted-foreground text-sm">No upcoming events scheduled.</p>
                    ) : (
                        Object.entries(groupedEvents).map(([dateStr, events]) => (
                            <div key={dateStr}>
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 sticky top-0 bg-background py-2 border-b">
                                    {dateStr}
                                </h3>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                    {events.map((event, idx) => (
                                        <div key={`${event.type}-${event.id}-${idx}`} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
                                            <div className={`p-2 rounded-full shrink-0 ${event.type === 'class' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                                {event.type === 'class' ? <Video className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate" title={event.title}>{event.title}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                                        {event.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground truncate">{event.course}</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1 capitalize">{event.subtitle}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Routine;
