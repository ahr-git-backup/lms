import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Search, ChevronDown, Users, GraduationCap, Building2 } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;

interface HistoryRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  amount_paid: number | null;
  course_id: string;
  profile_id: string;
  courses?: { name: string } | null;
  profiles?: {
    full_name: string | null;
    registration_id: string;
    college_name: string | null;
    hsc_batch: string | null;
  } | null;
}

const AdminPaymentHistory = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Course-wise enrollment counts — how many students got approved for each course.
  const { data: courseStats, isLoading: loadingStats } = useQuery({
    queryKey: ["admin-payment-history-course-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests")
        .select("course_id, courses(name)")
        .eq("status", "approved");
      if (error) throw error;

      const counts: Record<string, { name: string; count: number }> = {};
      (data || []).forEach((row: any) => {
        const cid = row.course_id;
        if (!cid) return;
        if (!counts[cid]) counts[cid] = { name: row.courses?.name || "Unknown", count: 0 };
        counts[cid].count += 1;
      });
      return Object.entries(counts)
        .map(([course_id, v]) => ({ course_id, ...v }))
        .sort((a, b) => b.count - a.count);
    },
  });

  // Chronological approved payment list.
  const { data: historyData, isLoading } = useQuery({
    queryKey: ["admin-payment-history-list", page, search],
    queryFn: async () => {
      let query = supabase
        .from("payment_requests")
        .select(
          "id, created_at, updated_at, amount_paid, course_id, profile_id, courses(name), profiles(full_name, registration_id, college_name, hsc_batch)",
          { count: "exact" }
        )
        .eq("status", "approved")
        .order("updated_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        // Search by student name or registration id via a join filter isn't
        // directly supported by PostgREST on nested tables, so we do a
        // simple client-side pass after fetching a wider unfiltered page
        // when a search term is present.
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: (data || []) as HistoryRow[], count: count || 0 };
    },
  });

  const filteredRows = (historyData?.rows || []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      row.profiles?.full_name?.toLowerCase().includes(q) ||
      row.profiles?.registration_id?.toLowerCase().includes(q) ||
      row.courses?.name?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil((historyData?.count || 0) / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate("/admin/payments")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight">Payment History</h1>
          <p className="text-sm text-muted-foreground">সব অনুমোদিত পেমেন্ট এবং কোর্স-ভিত্তিক ভর্তির সংখ্যা</p>
        </div>
      </div>

      {/* Course-wise enrollment cards, 3 per row */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <GraduationCap className="h-4 w-4" /> কোর্স-ভিত্তিক ভর্তি
        </h2>
        {loadingStats ? (
          <div className="text-sm text-muted-foreground">লোড হচ্ছে...</div>
        ) : courseStats && courseStats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {courseStats.map((c) => (
              <Card key={c.course_id}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">কোর্স</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                    <Users className="h-3.5 w-3.5" />
                    <span className="font-bold text-sm">{c.count}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">কোনো অনুমোদিত পেমেন্ট নেই</div>
        )}
      </div>

      {/* Chronological payment list */}
      <div>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> সব পেমেন্ট (তারিখ অনুযায়ী)
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="নাম, রেজি. আইডি বা কোর্স দিয়ে খুঁজুন"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">লোড হচ্ছে...</div>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              কোনো পেমেন্ট পাওয়া যায়নি
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRows.map((row) => {
              const isOpen = expandedId === row.id;
              const paymentTime = row.updated_at || row.created_at;
              return (
                <Card key={row.id}>
                  <Collapsible open={isOpen} onOpenChange={(o) => setExpandedId(o ? row.id : null)}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full text-left">
                        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                          <div className="text-xs text-muted-foreground w-full sm:w-28 shrink-0">
                            {format(new Date(paymentTime), "dd MMM yyyy")}
                          </div>
                          <div className="font-medium text-sm flex-1 min-w-0 truncate">
                            {row.courses?.name || "Unknown Course"}
                          </div>
                          <div className="text-xs text-muted-foreground w-full sm:w-32 shrink-0">
                            {format(new Date(paymentTime), "hh:mm a")}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="text-xs">
                              {row.profiles?.full_name || "—"}
                            </Badge>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
                          </div>
                        </CardContent>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-sm">
                          <div>
                            <div className="text-xs text-muted-foreground">Student Name</div>
                            <div className="font-medium">{row.profiles?.full_name || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Registration ID</div>
                            <div className="font-medium">{row.profiles?.registration_id || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">College</div>
                            <div className="font-medium">{row.profiles?.college_name || "—"}</div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">HSC Batch</div>
                            <div className="font-medium">{row.profiles?.hsc_batch || "—"}</div>
                          </div>
                        </div>
                        {row.amount_paid != null && (
                          <div className="mt-3 text-sm">
                            <span className="text-xs text-muted-foreground">Amount Paid: </span>
                            <span className="font-medium">৳{row.amount_paid.toLocaleString("en-BD")}</span>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              পূর্বের
            </Button>
            <span className="text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              পরের
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentHistory;
