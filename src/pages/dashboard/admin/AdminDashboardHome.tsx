import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, CreditCard, DollarSign } from "lucide-react";

const AdminDashboardHome = () => {
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
    </div>
  );
};

export default AdminDashboardHome;
