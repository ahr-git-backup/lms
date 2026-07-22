import { useEffect, useState } from "react";
import { CalendarClock, Calendar, FileText, ListChecks, Video, BookOpen, History, StickyNote, Files, Trophy, User, AlertCircle, Bookmark, Sparkles, Bell, CheckCircle, AlertTriangle, Trash2, ChevronDown, ChevronUp, Infinity, Flag, Megaphone, BarChart3, Zap, TrendingUp, Target } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { setExamSourceList } from "@/lib/examSourceTracker";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getEmbedUrl } from "@/lib/videoUtils";

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
      { title: "FB & Telegram Group", icon: Files, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950", url: "/dashboard/community" },
      { title: "Bookmarks", icon: Bookmark, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", url: "/dashboard/bookmarks" },
      { title: "Study Tools", icon: Sparkles, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950", url: "/dashboard/program" },
      { title: "Exam Routine", icon: CalendarClock, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950", url: "/dashboard/calendar" },
      { title: "Profile", icon: User, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950", url: "/dashboard/profile" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="w-full">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Welcome to Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Get a quick overview of your upcoming activities.
            </p>
          </div>
          {tutorialVideoUrl && (
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => setShowTutorialVideo(true)}
            >
              <Video className="h-4 w-4" />
              Watch Tutorial
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={() => navigate("/quick-practice")}
          className="shrink-0 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-400/50 hover:border-amber-400 rounded-full px-3 py-2 transition-all"
          title="Quick Practice Points"
        >
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{qpPoints ?? 0}</span>
        </button>
      </div>

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

      {/* Smart Tracking System */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight text-center">Smart Tracking System</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card
            className="cursor-pointer border-blue-500/30 hover:border-blue-500 transition-all bg-blue-50/50 dark:bg-blue-950/20"
            onClick={() => toast({ title: "Coming Soon", description: "My Progress feature আসছে খুব শীঘ্রই।" })}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-blue-500 flex-shrink-0" />
              <p className="font-semibold text-sm">My Progress</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-red-500/30 hover:border-red-500 transition-all bg-red-50/50 dark:bg-red-950/20"
            onClick={() => toast({ title: "Coming Soon", description: "Weak Topics & Analysis feature আসছে খুব শীঘ্রই।" })}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Target className="h-6 w-6 text-red-500 flex-shrink-0" />
              <p className="font-semibold text-sm">Weak Topics & Analysis</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-purple-500/30 hover:border-purple-500 transition-all bg-purple-50/50 dark:bg-purple-950/20"
            onClick={() => navigate("/study-history")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <History className="h-6 w-6 text-purple-500 flex-shrink-0" />
              <p className="font-semibold text-sm">History</p>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-yellow-500/30 hover:border-yellow-500 transition-all bg-yellow-50/50 dark:bg-yellow-950/20"
            onClick={() => navigate("/quick-practice/leaderboard")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Trophy className="h-6 w-6 text-yellow-500 flex-shrink-0" />
              <p className="font-semibold text-sm">Top Performer</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Admin-only quick actions */}
      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-amber-500/40 hover:border-amber-500 transition-all bg-amber-50/50 dark:bg-amber-950/20"
            onClick={() => navigate("/admin/reports")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Flag className="h-6 w-6 text-amber-600 flex-shrink-0 animate-icon-float" />
              <div>
                <p className="font-semibold text-sm">Reports</p>
                <p className="text-xs text-muted-foreground">
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
                <p className="text-xs text-muted-foreground">Send to all users</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isAdmin && (
        <div className="grid grid-cols-2 gap-4">
          <Card
            className="cursor-pointer border-sky-500/40 hover:border-sky-500 transition-all bg-sky-50/50 dark:bg-sky-950/20"
            onClick={() => navigate("/admin/syllabus-tracker")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-sky-600 flex-shrink-0 animate-icon-float" />
              <div>
                <p className="font-semibold text-sm">Study Tracker</p>
                <p className="text-xs text-muted-foreground">Manage content</p>
              </div>
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer border-violet-500/40 hover:border-violet-500 transition-all bg-violet-50/50 dark:bg-violet-950/20"
            onClick={() => navigate("/admin/quick-practice")}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-6 w-6 text-violet-600 flex-shrink-0 animate-icon-float" />
              <div>
                <p className="font-semibold text-sm">Quick Practice</p>
                <p className="text-xs text-muted-foreground">Manage content</p>
              </div>
            </CardContent>
          </Card>
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
           <div className="rounded-lg border p-4">
             <h2 className="text-lg font-semibold tracking-tight text-center">Quick Access</h2>
             <hr className="mt-3 border-border" />
           </div>
           <Link
             to="/dashboard/routine"
             className="flex items-center justify-center gap-2 w-full rounded-lg border bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors py-3 font-medium text-indigo-600 dark:text-indigo-300"
           >
             <Calendar className="h-4 w-4" /> Routine
           </Link>
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
                               {item.title === "Notice" && unreadNoticeCount > 0 && (
                                   <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                                       {unreadNoticeCount > 9 ? "9+" : unreadNoticeCount}
                                   </span>
                               )}
                               <item.icon className={`h-6 w-6 ${item.color} ${item.isExternal ? 'animate-pulse' : 'animate-icon-float'}`} />
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
