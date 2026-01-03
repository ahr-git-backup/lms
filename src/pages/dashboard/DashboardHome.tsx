import { useEffect } from "react";
import { CalendarClock, FileText, ListChecks, Radio } from "lucide-react";
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

  const { data: recentResource } = useQuery({
    queryKey: ["dashboard-recent-resource", enrolledCourseIds],
    queryFn: async () => {
      if (enrolledCourseIds.length === 0) return null;
      const { data, error } = await supabase
        .from("resources")
        .select("*, course:courses(name)")
        .in("course_id", enrolledCourseIds)
        .order("created_at", { ascending: false })
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

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          See a quick overview of your upcoming activities.
        </p>
      </header>

      {/* Active Live Sessions Section - PRIORITY ORDER */}
      {(activeLiveClasses?.length > 0 || activeLiveExams?.length > 0) && (
        <div className="space-y-4 pb-4">
           <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold tracking-tight">Live Now</h2>
           </div>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeLiveClasses?.map((classItem) => (
                  <Card key={classItem.id} className="border transition-all border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] dark:shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-50/10 dark:bg-blue-900/10">
                    <CardHeader className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {classItem.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              LIVE CLASS
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{classItem.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Started: {new Date(classItem.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/class/${classItem.id}`)} className="w-full bg-blue-600 hover:bg-blue-700">
                          Join Live Class
                       </Button>
                    </CardContent>
                  </Card>
              ))}

              {activeLiveExams?.map((exam) => (
                  <Card key={exam.id} className="border transition-all border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] dark:shadow-[0_0_20px_rgba(59,130,246,0.3)] bg-blue-50/10 dark:bg-blue-900/10">
                    <CardHeader className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {exam.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              LIVE EXAM
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{exam.title}</CardTitle>
                      <CardDescription className="text-xs">
                        Ends at: {new Date(exam.time_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)} className="w-full bg-blue-600 hover:bg-blue-700">
                          Take Live Exam
                       </Button>
                    </CardContent>
                  </Card>
              ))}
           </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {/* Live Class Card */}
        <Card className="border border-foreground/60 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next live class</CardTitle>
            <CalendarClock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {nextClass ? (
              <>
                <div className="mb-2">
                  <p className="text-sm font-bold line-clamp-2">{nextClass.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextClass.course?.name || "Unknown Course"}
                  </p>
                  <p className="text-xs font-medium text-primary mt-1">
                    {new Date(nextClass.start_at).toLocaleString([], {
                      weekday: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                {nextClass.topic && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{nextClass.topic}</p>
                )}
                {nextClass.video_url && (
                  <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => navigate(`/dashboard/class/${nextClass.id}`)}>
                    Join Class
                  </Button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No upcoming classes scheduled.</p>
            )}
          </CardContent>
        </Card>

        {/* Exam Card */}
        <Card className="border border-foreground/60 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming exam</CardTitle>
            <ListChecks className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {nextExam ? (
              <>
                <div className="mb-2">
                  <p className="text-sm font-bold line-clamp-2">{nextExam.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {nextExam.course?.name || "Unknown Course"}
                  </p>
                  <p className="text-xs font-medium text-primary mt-1">
                    {new Date(nextExam.time_window_start).toLocaleString([], {
                      weekday: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => navigate('/dashboard/live-exam')}>
                  View Exams
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No upcoming exams.</p>
            )}
          </CardContent>
        </Card>

        {/* Resources Card */}
        <Card className="border border-foreground/60 shadow-sm flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New notes / Resources</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
            {recentResource ? (
              <>
                <div className="mb-2">
                  <p className="text-sm font-bold line-clamp-2">{recentResource.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {recentResource.course?.name || "Unknown Course"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 capitalize">
                    {recentResource.resource_type} • {new Date(recentResource.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => window.open(recentResource.url, '_blank')}>
                  Open Resource
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4">No new resources.</p>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
};

export default DashboardHome;
