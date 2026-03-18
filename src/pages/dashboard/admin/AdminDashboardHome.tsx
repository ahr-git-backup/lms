import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, CreditCard, DollarSign, CalendarClock, ListChecks, StickyNote, Database, Megaphone, Flag, BookOpen, PenTool } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AdminDashboardHome = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = "Admin Overview – Atlas";
  }, []);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      // Fetch counts in parallel
      const [students, courses, pendingPayments, revenue] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.rpc("get_total_revenue") // Assuming we might need an RPC for this or sum locally. For now, let's just count enrollments or paid requests.
      ]);

      // Fallback for revenue if RPC doesn't exist yet: sum locally from payment_requests (approved) + enrollments (if price stored)
      // Since `payment_requests` is the source of truth for manual payments:
      // We can query approved payments.
      // But for speed, let's just show counts first.

      return {
        students: students.count || 0,
        courses: courses.count || 0,
        pendingPayments: pendingPayments.count || 0,
        // revenue: ...
      };
    },
  });

  const quickLinks = [
    { title: "Courses", icon: GraduationCap, url: "/admin/courses", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950" },
    { title: "Students", icon: Users, url: "/admin/students", color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950" },
    { title: "Classes", icon: CalendarClock, url: "/admin/classes", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950" },
    { title: "Exams", icon: ListChecks, url: "/admin/exams", color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950" },
    { title: "Question Bank", icon: Database, url: "/admin/question-bank", color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" },
    { title: "Content Creator", icon: StickyNote, url: "/admin/content-creator", color: "text-teal-600", bg: "bg-teal-50 dark:bg-teal-950" },
    { title: "Notices", icon: Megaphone, url: "/admin/announcements", color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950" },
    { title: "Payments", icon: CreditCard, url: "/admin/payments", color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">Dashboard Overview</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats?.students}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Courses</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats?.courses}</div>
            <p className="text-xs text-muted-foreground">Publicly available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{isLoading ? "..." : stats?.pendingPayments}</div>
            <p className="text-xs text-muted-foreground">Requires approval</p>
          </CardContent>
        </Card>
        {/* Revenue Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">---</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 pt-6">
           <h2 className="text-xl font-semibold tracking-tight">Quick Access</h2>
           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
               {quickLinks.map((item, index) => (
                   <Card
                        key={index}
                        className="group hover:border-primary/50 transition-all cursor-pointer border-muted-foreground/20"
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

export default AdminDashboardHome;
