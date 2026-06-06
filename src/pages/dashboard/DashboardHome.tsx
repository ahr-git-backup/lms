import { useEffect, useState } from "react";
import { CalendarClock, FileText, ListChecks, Video, BookOpen, History, StickyNote, Files, Trophy, User, AlertCircle, Bookmark, Sparkles, Bell, CheckCircle, AlertTriangle, Trash2, ChevronDown, ChevronUp, Infinity } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

// Define shape of dashboard data
interface DashboardData {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next_class: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    active_live_classes: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    active_live_exams: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    next_exam: any;
}

// Safe Date Helper to prevent crashes
const formatDate = (dateStr: string | null | undefined, options?: Intl.DateTimeFormatOptions) => {
    if (!dateStr) return "N/A";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Invalid Date";
        return date.toLocaleString([], options);
    } catch (e) {
        console.error("Date formatting error", e);
        return "Error";
    }
};

const DashboardHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedNotifIds, setExpandedNotifIds] = useState<string[]>([]);

  useEffect(() => {
    document.title = "Dashboard – Atlas";
  }, []);

  // Fetch Personal Notifications
  const { data: userNotifications } = useQuery({
      queryKey: ["user-notifications-dashboard", user?.id],
      queryFn: async () => {
          if (!user) return [];
          const { data, error } = await supabase
              .from("user_notifications")
              .select("*")
              .eq("user_id", user.id)
              // We only want recent relevant notifications on dashboard, but user asked for "approval and decline"
              // Filters: payment_approved, payment_rejected, course_request_declined
              .in("type", ["payment_approved", "payment_rejected", "course_request_declined"])
              .order("created_at", { ascending: false });
          if (error) throw error;
          return data;
      },
      enabled: !!user
  });

  const deleteNotificationMutation = useMutation({
      mutationFn: async (id: string) => {
          const { error } = await supabase
              .from("user_notifications")
              .delete()
              .eq("id", id);
          if (error) throw error;
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["user-notifications-dashboard"] });
          queryClient.invalidateQueries({ queryKey: ["user-notifications"] }); // Refresh main list too
          toast({ title: "Notification dismissed" });
      },
      onError: () => {
          toast({ title: "Failed to dismiss", variant: "destructive" });
      }
  });

  const toggleExpandNotification = (id: string) => {
    if (expandedNotifIds.includes(id)) {
        setExpandedNotifIds(expandedNotifIds.filter(e => e !== id));
    } else {
        setExpandedNotifIds([...expandedNotifIds, id]);
    }
  };

  const { data: pendingPayments } = useQuery({
    queryKey: ["pending-payments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("payment_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: dashboardData, isLoading: dashboardLoading, isError } = useQuery({
    queryKey: ["dashboard-data", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Fetch aggregated data via RPC
      const { data, error } = await supabase.rpc("get_dashboard_data");

      if (error) {
        console.error("Dashboard data fetch error:", error);
        throw error;
      }
      return data as unknown as DashboardData;
    },
    enabled: !!user,
  });

  if (dashboardLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  if (isError) {
      return (
          <div className="p-8 text-center">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
              <h2 className="text-lg font-semibold text-destructive">Failed to load dashboard data.</h2>
              <p className="text-sm text-muted-foreground">Please check your connection and try again.</p>
              <Button onClick={() => window.location.reload()} size="sm" className="mt-4">Retry</Button>
          </div>
      );
  }

  // Extract data with fallbacks
  const nextClass = dashboardData?.next_class;
  const activeLiveClasses = dashboardData?.active_live_classes || [];
  const activeLiveExams = dashboardData?.active_live_exams || [];
  const nextExam = dashboardData?.next_exam;

  const hasLiveActivity = activeLiveClasses.length > 0 || activeLiveExams.length > 0;
  const hasUpcomingActivity = !!nextClass || !!nextExam;

  const navigationItems = [
      { title: "Notice", icon: Bell, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", url: "/dashboard/announcements" },
      { title: "Unlimited", icon: Infinity, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950", url: "https://unlimited.atlascourses.com", isExternal: true },
      { title: "Live Class", icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", url: "/dashboard/live-class" },
      { title: "Live Exam", icon: ListChecks, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", url: "/dashboard/live-exam" },
      { title: "My Courses", icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950", url: "/dashboard/my-courses" },
      { title: "Record Class", icon: History, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950", url: "/dashboard/recordings" },
      { title: "Past Exams", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", url: "/dashboard/past-exam" },
      { title: "Readymade Exam", icon: FileText, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950", url: "/dashboard/readymade" },
      { title: "Archive", icon: History, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-950", url: "/dashboard/archive" },
      { title: "Results", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950", url: "/dashboard/results" },
      { title: "My Mistakes", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950", url: "/dashboard/my-mistakes" },
      { title: "Community", icon: Files, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950", url: "/dashboard/community" },
      { title: "Bookmarks", icon: Bookmark, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", url: "/dashboard/bookmarks" },
      { title: "Study Tools", icon: Sparkles, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", url: "/dashboard/program" },
      { title: "Exam Routine", icon: CalendarClock, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950", url: "/dashboard/calendar" },
      { title: "Profile", icon: User, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950", url: "/dashboard/profile" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Get a quick overview of your upcoming activities.
        </p>
      </header>

      {/* User Notifications (Approvals/Declines) */}
      {userNotifications && userNotifications.length > 0 && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-4 duration-500">
             {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
             {userNotifications.map((notif: any) => {
                const isExpanded = expandedNotifIds.includes(notif.id);
                const isSuccess = notif.type === 'payment_approved';
                return (
                <Card key={notif.id}
                      className={`border cursor-pointer transition-colors shadow-sm ${isSuccess ? 'border-green-500/50 bg-green-500/5' : 'border-red-500/50 bg-red-500/5'}`}
                      onClick={() => toggleExpandNotification(notif.id)}
                >
                    <CardHeader className="space-y-0 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {isSuccess ? <CheckCircle className="h-5 w-5 text-green-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />}
                                <div>
                                    <CardTitle className="text-sm font-semibold">{notif.title}</CardTitle>
                                    <p className="text-xs text-muted-foreground">{new Date(notif.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if(confirm("Dismiss this notification?")) deleteNotificationMutation.mutate(notif.id);
                                    }}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground">
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    {isExpanded && (
                        <CardContent className="px-4 pb-4 pt-0">
                            <div className="h-px w-full bg-border/20 mb-3" />
                            <p className="text-sm text-foreground/90">{notif.body}</p>
                        </CardContent>
                    )}
                </Card>
            )})}
        </div>
      )}

      {/* Enrollment Warning Card */}
      {!enrollmentsLoading && enrollments && enrollments.length === 0 && (
        <>
          {pendingPayments && pendingPayments.length > 0 ? (
             <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 dark:border-yellow-800">
                <CardContent className="flex flex-col gap-4 p-6">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-yellow-100 text-yellow-600 rounded-full dark:bg-yellow-900/30 dark:text-yellow-400">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold text-lg text-yellow-900 dark:text-yellow-200">
                                এটলাসের কোর্সে আপনাকে স্বাগতম।
                            </h3>
                            <div className="text-yellow-800 dark:text-yellow-300 space-y-2 text-sm">
                                <p>
                                    <a href="https://t.me/atlasweb_robot" target="_blank" rel="noreferrer" className="font-semibold underline hover:text-yellow-900">
                                        @atlasweb_robot
                                    </a> এ আপনার পেমেন্ট এর স্ক্রিনশট দিয়ে যোগাযোগ করুন। ২৪ ঘন্টার মাঝে এটলাস টিম যাবতীয় তথ্য চেক করে ওয়েবসাইটে এক্সেস দিয়ে দিবে।
                                </p>
                                <p>এক্সেস পেলে নোটিশ এ মেসেজ আসবে।</p>
                                <p>
                                    ২৪ ঘন্টার মাঝে এক্সেস না পেলে মেসেজ দিন এই নাম্বারে <a href="http://wa.me/8801999681290" target="_blank" rel="noreferrer" className="underline font-bold hover:text-yellow-900">01999681290</a> (WhatsApp)
                                </p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
          ) : (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800">
                <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4 p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-100 text-red-600 rounded-full dark:bg-red-900/30 dark:text-red-400">
                            <AlertCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-red-900 dark:text-red-200">
                                আপনার কোনো কোর্স চালু নেই
                            </h3>
                            <p className="text-red-700 dark:text-red-300">
                                আপনি কোনো কোর্সে এনরোল করেননি। শুরু করতে একটি কোর্স কিনুন।
                            </p>
                            <p className="text-red-800 dark:text-red-300 mt-2 text-sm font-medium">
                                কোর্সে পেমেন্ট করে থাকলে শীঘ্রই যোগাযোগ করুন টেলিগ্রাম বটে <a href="https://t.me/atlasweb_Robot" target="_blank" rel="noreferrer" className="underline hover:text-red-950">@atlasweb_Robot</a>
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate("/courses")}
                        className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                    >
                        Browse Courses
                    </Button>
                </CardContent>
            </Card>
          )}
        </>
      )}

      {/* 1. Live Activity Section (Priority 1) */}
      {hasLiveActivity && (
        <div className="space-y-4">
           <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold tracking-tight">Live Now</h2>
           </div>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {activeLiveClasses.map((classItem: any) => (
                  <Card key={classItem?.id || Math.random()} className="border transition-all border-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)] dark:shadow-[0_0_20px_rgba(5,150,105,0.3)] bg-emerald-50/50 dark:bg-emerald-900/20">
                    <CardHeader className="space-y-1 pb-2">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {classItem?.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE CLASS
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{classItem?.title || "Live Class"}</CardTitle>
                      <CardDescription className="text-xs">
                        Started: {formatDate(classItem?.start_at, { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/class/${classItem?.id}`)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white border-none">
                          Join Class
                       </Button>
                    </CardContent>
                  </Card>
              ))}

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {activeLiveExams.map((exam: any) => (
                  <Card key={exam?.id || Math.random()} className="border transition-all border-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)] dark:shadow-[0_0_20px_rgba(5,150,105,0.3)] bg-emerald-50/50 dark:bg-emerald-900/20">
                    <CardHeader className="space-y-1 pb-2">
                      <div className="flex justify-between items-start gap-2">
                          <p className="text-xs font-mono uppercase text-muted-foreground">
                              {exam?.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE EXAM
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{exam?.title || "Live Exam"}</CardTitle>
                      <CardDescription className="text-xs">
                        Ends: {formatDate(exam?.time_window_end, { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => navigate(`/dashboard/take-exam/${exam?.id}`)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white border-none">
                          Take Exam
                       </Button>
                    </CardContent>
                  </Card>
              ))}
           </div>
        </div>
      )}

      {/* 2. Upcoming Activity Section */}
      {!hasLiveActivity && hasUpcomingActivity && (
        <div className="space-y-4">
           <h2 className="text-lg font-semibold tracking-tight">Upcoming Activities</h2>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Next Live Class Card */}
                {nextClass && (
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Next Live Class</CardTitle>
                            <CalendarClock className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        <div className="mb-4 space-y-1">
                            <p className="text-lg font-bold line-clamp-2 leading-tight">{nextClass.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {nextClass.course?.name || "Unknown Course"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                    {formatDate(nextClass.start_at, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                        {nextClass.video_url && (
                            <Button size="sm" variant="outline" className="w-full mt-auto" onClick={() => navigate(`/dashboard/class/${nextClass.id}`)}>
                                Join Class
                            </Button>
                        )}
                    </CardContent>
                </Card>
                )}

                {/* Upcoming Exam Card */}
                {nextExam && (
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Upcoming Exam</CardTitle>
                            <ListChecks className="h-4 w-4 text-primary" />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col justify-between">
                        <div className="mb-4 space-y-1">
                            <p className="text-lg font-bold line-clamp-2 leading-tight">{nextExam.title}</p>
                            <p className="text-xs text-muted-foreground">
                                {nextExam.course?.name || "Unknown Course"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                    {formatDate(nextExam.time_window_start, { weekday: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-auto" onClick={() => navigate('/dashboard/live-exam')}>
                            View Exams
                        </Button>
                    </CardContent>
                </Card>
                )}
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
                        className={`group hover:shadow-md transition-all cursor-pointer ${
                            item.isExternal
                                ? 'border-violet-500/50 hover:border-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.2)] dark:shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                                : 'border-muted-foreground/20 hover:border-primary/50'
                        }`}
                        onClick={() => {
                            if (item.isExternal) {
                                window.open(item.url, "_blank");
                            } else {
                                navigate(item.url);
                            }
                        }}
                    >
                       <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                           <div className={`p-3 rounded-full ${item.bg} group-hover:scale-110 transition-transform duration-300 relative`}>
                               {item.isExternal && (
                                   <div className="absolute inset-0 rounded-full bg-violet-400/20 animate-ping" />
                               )}
                               <item.icon className={`h-6 w-6 ${item.color} ${item.isExternal ? 'animate-pulse' : ''}`} />
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
