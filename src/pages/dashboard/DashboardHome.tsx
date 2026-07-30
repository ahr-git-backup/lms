import { useEffect, useState } from "react";
import { CalendarClock, Calendar, FileText, ListChecks, Video, BookOpen, History, StickyNote, Files, Trophy, User, AlertCircle, Bookmark, Sparkles, Bell, CheckCircle, AlertTriangle, Trash2, ChevronDown, ChevronUp, Infinity, Flag, Megaphone, BarChart3, Zap, TrendingUp, Target, ClipboardCheck } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { quickAccessItems } from "@/config/dashboardCardItems";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { setExamSourceList } from "@/lib/examSourceTracker";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmbedUrl } from "@/lib/videoUtils";
import { QuickAccessSortDialog, QUICK_ACCESS_ORDER_KEY } from "@/components/dashboard/QuickAccessSortDialog";

const TUTORIAL_VIDEO_KEY = "dashboard_tutorial_video_url";

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
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedNotifIds, setExpandedNotifIds] = useState<string[]>([]);
  const [unreadNoticeCount, setUnreadNoticeCount] = useState(0);
  const [showTutorialVideo, setShowTutorialVideo] = useState(false);
  const [showQuickAccessSort, setShowQuickAccessSort] = useState(false);
  const [showAdminQuickActions, setShowAdminQuickActions] = useState(false);

  const { data: tutorialVideoUrl } = useQuery({
    queryKey: ["dashboard-tutorial-video"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", TUTORIAL_VIDEO_KEY).maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return typeof v === "string" ? v : (v ? String(v) : null);
    },
  });

  useEffect(() => {
    const updateCount = () => {
      const stored = localStorage.getItem("unread_notification_count");
      setUnreadNoticeCount(stored ? parseInt(stored, 10) : 0);
    };
    updateCount();
    window.addEventListener("unread-notifications-updated", updateCount);
    return () => window.removeEventListener("unread-notifications-updated", updateCount);
  }, []);

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

  const { data: pendingReportsCount } = useQuery({
    queryKey: ["admin-pending-reports-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("question_reports")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");
      return count || 0;
    },
    enabled: !!isAdmin,
  });

  const { data: quickAccessOrder } = useQuery({
    queryKey: ["quick-access-order"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("value").eq("key", QUICK_ACCESS_ORDER_KEY).maybeSingle();
      if (error) return [];
      return Array.isArray(data?.value) ? (data.value as string[]) : [];
    },
  });

  const { data: qpPoints } = useQuery({
    queryKey: ["qp-user-points", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("qp_user_points")
        .select("total_points")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) return 0;
      return data?.total_points ?? 0;
    },
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

  const navigationItems = quickAccessItems;

  const orderedNavigationItems = (() => {
    if (!quickAccessOrder || quickAccessOrder.length === 0) return navigationItems;
    const byTitle = new Map(navigationItems.map((item) => [item.title, item]));
    const ordered = quickAccessOrder.map((t) => byTitle.get(t)).filter(Boolean) as typeof navigationItems;
    const remaining = navigationItems.filter((item) => !quickAccessOrder.includes(item.title));
    return [...ordered, ...remaining];
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <Card className="w-full">
        <CardContent className="p-3 flex flex-col items-center gap-2">
          <h1 className="text-xl font-extrabold tracking-tight whitespace-nowrap animate-text-fade-sweep">Welcome to Dashboard</h1>
          {tutorialVideoUrl && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5 h-7 px-3 text-xs"
              onClick={() => setShowTutorialVideo(true)}
            >
              <Video className="h-3.5 w-3.5 animate-icon-float text-primary" />
              Watch Tutorial
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showTutorialVideo} onOpenChange={setShowTutorialVideo}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Dashboard Tutorial</DialogTitle>
          </DialogHeader>
          {tutorialVideoUrl && (
            <div className="aspect-video w-full">
              <iframe
                src={getEmbedUrl(tutorialVideoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Dashboard Tutorial"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                          <p className="text-sm font-mono uppercase text-muted-foreground">
                              {classItem?.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE CLASS
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{classItem?.title || "Live Class"}</CardTitle>
                      <CardDescription className="text-sm">
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
                          <p className="text-sm font-mono uppercase text-muted-foreground">
                              {exam?.course?.name || "Unknown Course"}
                          </p>
                          <span className="animate-pulse inline-flex items-center px-2 py-0.5 rounded text-sm font-medium bg-red-100 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800">
                              LIVE EXAM
                          </span>
                      </div>
                      <CardTitle className="text-base break-words">{exam?.title || "Live Exam"}</CardTitle>
                      <CardDescription className="text-sm">
                        Ends: {formatDate(exam?.time_window_end, { hour: '2-digit', minute: '2-digit' })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Button size="sm" onClick={() => { if (exam?.id) setExamSourceList(exam.id, "/dashboard/live-exam"); navigate(`/dashboard/take-exam/${exam?.id}`); }} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white border-none">
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
                            <p className="text-sm text-muted-foreground">
                                {nextClass.course?.name || "Unknown Course"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary">
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
                            <p className="text-sm text-muted-foreground">
                                {nextExam.course?.name || "Unknown Course"}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md text-sm font-medium bg-primary/10 text-primary">
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

      {/* Smart Tracking System */}
      <div className="animate-border-chase border border-primary/30 rounded-lg px-3 sm:px-6 py-3 space-y-2 -mx-2 sm:mx-0" style={{ ["--border-chase-color" as any]: "hsl(var(--primary))" }}>
        <h2 className="text-base font-semibold tracking-tight text-center">Smart Tracking System</h2>
        <div className="grid grid-cols-3 gap-2">
          <Card
            className="animate-border-chase cursor-pointer border-blue-500/30 hover:border-blue-500 transition-all bg-blue-50/50 dark:bg-blue-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(217 91% 60%)" }}
            onClick={() => navigate("/dashboard/my-progress")}
          >
            <CardContent className="p-2.5 flex flex-col items-center text-center gap-1">
              <TrendingUp className="h-6 w-6 text-blue-500 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">My Progress & History</p>
            </CardContent>
          </Card>
          <Card
            className="animate-border-chase cursor-pointer border-sky-500/30 hover:border-sky-500 transition-all bg-sky-50/50 dark:bg-sky-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(199 89% 48%)" }}
            onClick={() => navigate("/syllabus-tracker")}
          >
            <CardContent className="p-2.5 flex flex-col items-center text-center gap-1">
              <BarChart3 className="h-6 w-6 text-sky-600 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">Study Tracker</p>
            </CardContent>
          </Card>
          <Card
            className="animate-border-chase cursor-pointer border-yellow-500/30 hover:border-yellow-500 transition-all bg-yellow-50/50 dark:bg-yellow-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(45 93% 55%)" }}
            onClick={() => navigate("/dashboard/top-performer")}
          >
            <CardContent className="p-2.5 flex flex-col items-center text-center gap-1">
              <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">Top Performer</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="animate-border-chase border border-primary/30 rounded-lg px-3 sm:px-6 py-3 space-y-2 -mx-2 sm:mx-0" style={{ ["--border-chase-color" as any]: "hsl(var(--primary))" }}>
        <h2 className="text-base font-semibold tracking-tight text-center">Best Practice Tool</h2>
        <div className="grid grid-cols-3 gap-2">
          <Card
            className="animate-border-chase cursor-pointer border-violet-500/30 hover:border-violet-500 transition-all bg-violet-50/50 dark:bg-violet-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(262 83% 58%)" }}
            onClick={() => navigate("/quick-practice")}
          >
            <CardContent className="px-2.5 py-1.5 flex flex-col items-center text-center gap-1">
              <Zap className="h-6 w-6 text-violet-500 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">Quick Practice</p>
            </CardContent>
          </Card>
          <Card
            className="animate-border-chase cursor-pointer border-fuchsia-500/30 hover:border-fuchsia-500 transition-all bg-fuchsia-50/50 dark:bg-fuchsia-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(292 84% 61%)" }}
            onClick={() => navigate("/mock-test")}
          >
            <CardContent className="px-2.5 py-1.5 flex flex-col items-center text-center gap-1">
              <Infinity className="h-6 w-6 text-fuchsia-500 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">Unlimited Practice Exam</p>
            </CardContent>
          </Card>
          <Card
            className="animate-border-chase cursor-pointer border-pink-500/30 hover:border-pink-500 transition-all bg-pink-50/50 dark:bg-pink-950/20"
            style={{ ["--border-chase-color" as any]: "hsl(330 81% 60%)" }}
            onClick={() => navigate("/dashboard/readymade")}
          >
            <CardContent className="px-2.5 py-1.5 flex flex-col items-center text-center gap-1">
              <FileText className="h-6 w-6 text-pink-500 flex-shrink-0" />
              <p className="font-semibold text-sm leading-snug">Readymade Exam</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin-only quick actions — collapsed by default behind a floating
          toggle so the 5 admin cards don't push down content other users
          see; nothing about the cards themselves changes, only visibility. */}
      {isAdmin && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAdminQuickActions(v => !v)}
            aria-label={showAdminQuickActions ? "Hide admin quick actions" : "Show admin quick actions"}
            className="absolute -top-2 right-0 z-10 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center animate-pulse hover:animate-none transition-all"
          >
            {showAdminQuickActions ? <ChevronUp className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </button>
          {showAdminQuickActions && (
            <div className="space-y-4 pt-9 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <Card
                  className="cursor-pointer border-amber-500/40 hover:border-amber-500 transition-all bg-amber-50/50 dark:bg-amber-950/20"
                  onClick={() => navigate("/admin/reports")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Flag className="h-6 w-6 text-amber-600 flex-shrink-0 animate-icon-float" />
                    <div>
                      <p className="font-semibold text-sm">Reports</p>
                      <p className="text-sm text-muted-foreground">
                        {pendingReportsCount ?? "..."} pending
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer border-yellow-500/40 hover:border-yellow-500 transition-all bg-yellow-50/50 dark:bg-yellow-950/20"
                  onClick={() => navigate("/admin/announcements")}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <Megaphone className="h-6 w-6 text-yellow-600 flex-shrink-0 animate-icon-float" />
                    <div>
                      <p className="font-semibold text-sm">Notice</p>
                      <p className="text-sm text-muted-foreground">Send to all users</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <Card
                  className="cursor-pointer border-sky-500/40 hover:border-sky-500 transition-all bg-sky-50/50 dark:bg-sky-950/20"
                  onClick={() => navigate("/admin/syllabus-tracker")}
                >
                  <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                    <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-sky-600 flex-shrink-0 animate-icon-float" />
                    <div>
                      <p className="font-semibold text-sm sm:text-base leading-tight">Study Tracker</p>
                      <p className="hidden sm:block text-sm text-muted-foreground">Manage content</p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer border-violet-500/40 hover:border-violet-500 transition-all bg-violet-50/50 dark:bg-violet-950/20"
                  onClick={() => navigate("/admin/quick-practice")}
                >
                  <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 flex-shrink-0 animate-icon-float" />
                    <div>
                      <p className="font-semibold text-sm sm:text-base leading-tight">Quick Practice</p>
                      <p className="hidden sm:block text-sm text-muted-foreground">Manage content</p>
                    </div>
                  </CardContent>
                </Card>
                <Card
                  className="cursor-pointer border-fuchsia-500/40 hover:border-fuchsia-500 transition-all bg-fuchsia-50/50 dark:bg-fuchsia-950/20"
                  onClick={() => navigate("/admin/mock-test")}
                >
                  <CardContent className="p-2.5 sm:p-4 flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 text-center sm:text-left">
                    <ClipboardCheck className="h-5 w-5 sm:h-6 sm:w-6 text-fuchsia-600 flex-shrink-0 animate-icon-float" />
                    <div>
                      <p className="font-semibold text-sm sm:text-base leading-tight">Mock Test</p>
                      <p className="hidden sm:block text-sm text-muted-foreground">Manage content</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

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
                                    <p className="text-sm text-muted-foreground">{new Date(notif.created_at).toLocaleString()}</p>
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

      {/* 3. Navigation Cards Section */}
      <div className="space-y-4">
           <div className="rounded-lg border p-4">
             <div className="flex items-center justify-center relative">
               <h2 className="text-lg font-semibold tracking-tight text-center">Quick Access</h2>
               {isAdmin && !showQuickAccessSort && (
                 <Button
                   size="sm"
                   variant="ghost"
                   className="absolute right-0 text-xs text-muted-foreground hover:text-primary"
                   onClick={() => setShowQuickAccessSort(true)}
                 >
                   Reorder
                 </Button>
               )}
             </div>
             <hr className="mt-3 border-border" />
           </div>
           {isAdmin && showQuickAccessSort ? (
             <QuickAccessSortDialog
               titles={orderedNavigationItems.map((item) => item.title)}
               onClose={() => setShowQuickAccessSort(false)}
             />
           ) : (
           <>
           <Link
             to="/dashboard/routine"
             className="flex items-center justify-center gap-2 w-full rounded-lg border bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors py-3 font-medium text-indigo-600 dark:text-indigo-300"
           >
             <Calendar className="h-4 w-4" /> Routine
           </Link>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
               {orderedNavigationItems.map((item, index) => (
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
                               {item.title === "Notice" && unreadNoticeCount > 0 && (
                                   <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                                       {unreadNoticeCount > 9 ? "9+" : unreadNoticeCount}
                                   </span>
                               )}
                               <item.icon className={`h-6 w-6 ${item.color} ${item.isExternal ? 'animate-pulse' : 'animate-icon-float'}`} />
                           </div>
                           <p className="font-semibold text-lg">{item.title}</p>
                       </CardContent>
                   </Card>
               ))}
           </div>
           </>
           )}
      </div>

    </div>
  );
};

export default DashboardHome;
