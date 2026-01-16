import { useEffect } from "react";
import { CalendarClock, FileText, ListChecks, Video, BookOpen, History, StickyNote, Files, Trophy, User, AlertCircle, Bookmark } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

// Define shape of dashboard data (or cast to any for simplicity in this task, but interfaces are better)
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

const DashboardHome = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: enrollments, isLoading: enrollmentsLoading } = useEnrollments();

  useEffect(() => {
    document.title = "Dashboard – Atlas";
  }, []);

  const { data: pendingPayments, isLoading: pendingPaymentsLoading } = useQuery({
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

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
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
    return <div className="p-4 text-sm text-muted-foreground">Loading dashboard...</div>;
  }

  // Extract data with fallbacks
  const nextClass = dashboardData?.next_class;
  const activeLiveClasses = dashboardData?.active_live_classes || [];
  const activeLiveExams = dashboardData?.active_live_exams || [];
  const nextExam = dashboardData?.next_exam;

  const hasLiveActivity = activeLiveClasses.length > 0 || activeLiveExams.length > 0;
  const hasUpcomingActivity = !!nextClass || !!nextExam;

  const navigationItems = [
      { title: "Live Class", icon: Video, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950", url: "/dashboard/live-class" },
      { title: "Live Exam", icon: ListChecks, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950", url: "/dashboard/live-exam" },
      { title: "Past Class", icon: History, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950", url: "/dashboard/past-class" },
      { title: "Past Exams", icon: BookOpen, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950", url: "/dashboard/past-exam" },
      { title: "Archive", icon: History, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-950", url: "/dashboard/archive" },
      { title: "Results", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950", url: "/dashboard/results" },
      { title: "My Mistakes", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950", url: "/dashboard/my-mistakes" },
      { title: "Class Notes", icon: StickyNote, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950", url: "/dashboard/class-notes" },
      { title: "Resources", icon: Files, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950", url: "/dashboard/resources" },
      { title: "Bookmarks", icon: Bookmark, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950", url: "/dashboard/bookmarks" },
      { title: "Profile", icon: User, color: "text-slate-500", bg: "bg-slate-50 dark:bg-slate-950", url: "/dashboard/profile" },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">ড্যাশবোর্ডে স্বাগতম</h1>
        <p className="text-sm text-muted-foreground">
          আপনার আসন্ন কার্যক্রমের একটি দ্রুত ওভারভিউ দেখুন।
        </p>
      </header>

      {/* Enrollment Warning Card */}
      {!enrollmentsLoading && !pendingPaymentsLoading && enrollments && enrollments.length === 0 && (
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
                                <p>@atlasweb_Robot এ আপনার পেমেন্ট এর স্ক্রিনশট দিয়ে যোগাযোগ করুন। ২৪ ঘন্টার মাঝে এটলাস টিম যাবতীয় তথ্য চেক করে ওয়েবসাইটে এক্সেস দিয়ে দিবে।</p>
                                <p>এক্সেস পেলে নোটিশ এ মেসেজ আসবে।</p>
                                <p>২৪ ঘন্টার মাঝে এক্সেস না পেলে মেসেজ দিন এই নাম্বারে <a href="http://wa.me/8801999681290" target="_blank" rel="noreferrer" className="underline font-bold">01999681290</a> (WhatsApp)</p>
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
                                No Active Course
                            </h3>
                            <p className="text-red-700 dark:text-red-300">
                                আপনি কোনো কোর্সে এনরোল করেননি। ওয়েবসাইটটি সঠিকভাবে ব্যবহার করতে যেকোনো একটি কোর্স কিনুন।
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={() => navigate("/courses")}
                        className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                    >
                        কোর্স কিনতে এখানে ক্লিক করুন
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
                <h2 className="text-lg font-semibold tracking-tight">লাইভ এখন</h2>
           </div>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {activeLiveClasses.map((classItem: any) => (
                  <Card key={classItem.id} className="border transition-all border-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)] dark:shadow-[0_0_20px_rgba(5,150,105,0.3)] bg-emerald-50/50 dark:bg-emerald-900/20">
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
                       <Button size="sm" onClick={() => navigate(`/dashboard/class/${classItem.id}`)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white border-none">
                          লাইভ ক্লাসে যোগ দিন
                       </Button>
                    </CardContent>
                  </Card>
              ))}

              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {activeLiveExams.map((exam: any) => (
                  <Card key={exam.id} className="border transition-all border-emerald-600 shadow-[0_0_15px_rgba(5,150,105,0.5)] dark:shadow-[0_0_20px_rgba(5,150,105,0.3)] bg-emerald-50/50 dark:bg-emerald-900/20">
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
                       <Button size="sm" onClick={() => navigate(`/dashboard/take-exam/${exam.id}`)} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white border-none">
                          লাইভ এক্সাম দিন
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
           <h2 className="text-lg font-semibold tracking-tight">আসন্ন কার্যক্রম</h2>
           <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Next Live Class Card */}
                {nextClass && (
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">পরবর্তী লাইভ ক্লাস</CardTitle>
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
                    </CardContent>
                </Card>
                )}

                {/* Upcoming Exam Card */}
                {nextExam && (
                <Card className="border shadow-sm flex flex-col hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base">আসন্ন এক্সাম</CardTitle>
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
                                    {new Date(nextExam.time_window_start).toLocaleString([], {
                                    weekday: 'short', hour: '2-digit', minute: '2-digit'
                                    })}
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
           <h2 className="text-lg font-semibold tracking-tight">দ্রুত প্রবেশ</h2>
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
