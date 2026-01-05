import { useEffect } from "react";
import { CalendarClock, FileText, ListChecks, Video, BookOpen, History, StickyNote, Files, Trophy, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const DashboardHome = () => {
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Dashboard – Beshi Joss LMS";
  }, []);

  const enrolledCourseIds = enrollments?.map((e) => e.course_id) || [];

  const { data: nextClass } = useQuery({
    queryKey: ["dashboard-next-class", enrolledCourseIds],
    queryFn: async () => {
      if (enrolledCourseIds.length === 0) return null;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("classes")
        .select("*, course:courses(name)")
        .in("course_id", enrolledCourseIds)
        .gt("start_at", now)
        .order("start_at", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") console.error(error);
      return data;
    },
    enabled: enrolledCourseIds.length > 0,
  });

  const { data: activeLiveClasses } = useQuery({
    queryKey: ["dashboard-active-live-classes", enrolledCourseIds],
    queryFn: async () => {
      if (enrolledCourseIds.length === 0) return [];
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("classes")
        .select("*, course:courses(name)")
        .in("course_id", enrolledCourseIds)
        .eq("class_type", "live")
        .lte("start_at", now)
        .gt("end_at", now)
        .order("start_at", { ascending: true });

      if (error) console.error(error);
      return data || [];
    },
    enabled: enrolledCourseIds.length > 0,
  });

  const { data: activeLiveExams } = useQuery({
    queryKey: ["dashboard-active-live-exams", enrolledCourseIds],
    queryFn: async () => {
      if (enrolledCourseIds.length === 0) return [];
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("exams")
        .select("*, course:courses(name)")
        .in("course_id", enrolledCourseIds)
        .eq("exam_type", "live")
        .lte("time_window_start", now)
        .gt("time_window_end", now)
        .order("time_window_end", { ascending: true });

      if (error) console.error(error);
      return data || [];
    },
    enabled: enrolledCourseIds.length > 0,
  });

  const { data: nextExam } = useQuery({
    queryKey: ["dashboard-next-exam", enrolledCourseIds],
    queryFn: async () => {
      if (enrolledCourseIds.length === 0) return null;
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("exams")
        .select("*, course:courses(name)")
        .in("course_id", enrolledCourseIds)
        .gt("time_window_start", now)
        .order("time_window_start", { ascending: true })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") console.error(error);
      return data;
    },
    enabled: enrolledCourseIds.length > 0,
  });

  if (enrollmentsLoading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  const hasLiveActivity = activeLiveClasses?.length > 0 || activeLiveExams?.length > 0;

  const navigationItems = [
      { title: "Live Class", icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", url: "/dashboard/live-class" },
      { title: "Live Exam", icon: ListChecks, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", url: "/dashboard/live-exam" },
      { title: "Past Class", icon: History, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950", url: "/dashboard/past-class" },
      { title: "Past Exams", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", url: "/dashboard/past-exam" },
      { title: "Results", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950", url: "/dashboard/results" },
      { title: "Class Notes", icon: StickyNote, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", url: "/dashboard/class-notes" },
      { title: "Resources", icon: Files, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950", url: "/dashboard/resources" },
      { title: "Profile", icon: User, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950", url: "/dashboard/profile" },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          See a quick overview of your upcoming activities.
        </p>
      </header>

      {/* 1. Live Activity Section (Priority 1) */}
      {hasLiveActivity ? (
        <div className="space-y-4">
           <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold tracking-tight">Live Now</h2>
           </div>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeLiveClasses?.map((classItem) => (
                  <Card key={classItem.id} className="border transition-all border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] dark:shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-50/50 dark:bg-amber-900/20">
                    <CardHeader className="space-y-1 pb-2">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {classItem.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE CLASS
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{classItem.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Started: {new Date(classItem.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/class/${classItem.id}`)} className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none">
                          Join Live Class
                       </Button>
                    </CardContent>
                  </Card>
              ))}

              {activeLiveExams?.map((exam) => (
                  <Card key={exam.id} className="border transition-all border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] dark:shadow-[0_0_20px_rgba(245,158,11,0.3)] bg-amber-50/50 dark:bg-amber-900/20">
                    <CardHeader className="space-y-1 pb-2">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {exam.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE EXAM
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{exam.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Ends at: {new Date(exam.time_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)} className="w-full bg-amber-600 hover:bg-amber-700 text-white border-none">
                          Take Live Exam
                       </Button>
                    </CardContent>
                  </Card>
              ))}
           </div>
        </div>
      ) : (
        /* 2. Upcoming Activity Section (Shown if no live activity) */
        <div className="space-y-4">
           <h2 className="text-lg font-semibold tracking-tight">Upcoming Activities</h2>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Next Live Class Card */}
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Next Live Class</CardTitle>
                            <CalendarClock className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        {nextClass ? (
                        <>
                            <div className="mb-4 space-y-1">
                                <p className="text-lg font-bold line-clamp-2 leading-tight">{nextClass.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    {nextClass.course?.name || "Unknown Course"}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                        {new Date(nextClass.start_at).toLocaleString([], {
                                        weekday: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                            {nextClass.video_url && (
                                <Button size="sm" variant="outline" className="w-full mt-auto" onClick={() => navigate(`/dashboard/class/${nextClass.id}`)}>
                                    Join Class
                                </Button>
                            )}
                        </>
                        ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-6">
                            <CalendarClock className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No classes scheduled.</p>
                        </div>
                        )}
                    </CardContent>
                </Card>

                {/* Upcoming Exam Card */}
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Upcoming Exam</CardTitle>
                            <ListChecks className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        {nextExam ? (
                        <>
                            <div className="mb-4 space-y-1">
                                <p className="text-lg font-bold line-clamp-2 leading-tight">{nextExam.title}</p>
                                <p className="text-xs text-muted-foreground">
                                    {nextExam.course?.name || "Unknown Course"}
                                </p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                        {new Date(nextExam.time_window_start).toLocaleString([], {
                                        weekday: 'short', hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" className="w-full mt-auto" onClick={() => navigate('/dashboard/live-exam')}>
                                View Exams
                            </Button>
                        </>
                        ) : (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-6">
                            <ListChecks className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">No exams scheduled.</p>
                        </div>
                        )}
                    </CardContent>
                </Card>
           </div>
        </div>
      )}

      {/* 3. Navigation Cards Section */}
      <div className="space-y-4">
           <h2 className="text-lg font-semibold tracking-tight">Quick Access</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {navigationItems.map((item, index) => (
                   <Card
                        key={index}
                        className="group hover:shadow-md transition-all cursor-pointer border-muted-foreground/20 hover:border-primary/50"
                        onClick={() => navigate(item.url)}
                    >
                       <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                           <div className={`p-3 rounded-full ${item.bg} group-hover:scale-110 transition-transform duration-300`}>
                               <item.icon className={`h-6 w-6 ${item.color}`} />
                           </div>
                           <p className="font-medium text-sm">{item.title}</p>
                       </CardContent>
                   </Card>
               ))}
           </div>
      </div>

    </div>
  );
};

export default DashboardHome;
