const fs = require('fs');

const path = 'src/pages/dashboard/admin/AdminDashboardHome.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add pending reports to the query
const oldQuery = `      const [students, courses, pendingPayments, revenue] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.rpc("get_total_revenue") // Assuming we might need an RPC for this or sum locally. For now, let's just count enrollments or paid requests.
      ]);`;

const newQuery = `      const [students, courses, pendingPayments, pendingReports, revenue] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("courses").select("id", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("payment_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("question_reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.rpc("get_total_revenue") // Assuming we might need an RPC for this or sum locally. For now, let's just count enrollments or paid requests.
      ]);`;

content = content.replace(oldQuery, newQuery);

const oldReturn = `      return {
        students: students.count || 0,
        courses: courses.count || 0,
        pendingPayments: pendingPayments.count || 0,
        // revenue: ...
      };`;

const newReturn = `      return {
        students: students.count || 0,
        courses: courses.count || 0,
        pendingPayments: pendingPayments.count || 0,
        pendingReports: pendingReports.count || 0,
        // revenue: ...
      };`;

content = content.replace(oldReturn, newReturn);

// Add Flag card
const oldCards = `        {/* Revenue Placeholder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">---</div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>`;

const newCards = `        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Reports</CardTitle>
            <Flag className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-600">{isLoading ? "..." : stats?.pendingReports}</div>
            <p className="text-xs text-muted-foreground">Unresolved questions</p>
          </CardContent>
        </Card>
      </div>`;

content = content.replace(oldCards, newCards);
content = content.replace('md:grid-cols-2 lg:grid-cols-4', 'md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4'); // Might want to adjust grid if there are 4 cards now, wait, previously there were 4 cards. If we replace Total Revenue with Pending Reports, there are still 4.

// Add audio logic
const audioLogic = `  const [isMuted, setIsMuted] = useState(() => localStorage.getItem("admin_sound_muted") === "true");

  useEffect(() => {
    // Check for pending reports and beep
    const checkForPendingReports = async () => {
        const { count } = await supabase
            .from("question_reports")
            .select("*", { count: 'exact', head: true })
            .eq("status", "pending");

        if (count && count > 0) {
            // Play beep if not muted
            if (!isMuted) {
                const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                audio.play().catch(e => console.error("Audio play failed", e));
            }
        }
    };

    const interval = setInterval(checkForPendingReports, 60000); // 60s
    checkForPendingReports();

    return () => clearInterval(interval);
  }, [isMuted]);

  const { data: stats, isLoading } = useQuery({`;

content = content.replace('  const { data: stats, isLoading } = useQuery({', `  import { useState } from "react";\n` + audioLogic);

content = content.replace('import { useEffect } from "react";', 'import { useEffect, useState } from "react";');
// Fix double import useState: we'll clean it up with regex
content = content.replace(/import\s+{\s*useState\s*}\s*from\s*"react";\n/, '');

fs.writeFileSync(path, content, 'utf8');
console.log("Patched AdminDashboardHome.tsx");
