import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ExamAttempt } from "@/types/student";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const ExamAnalytics = () => {
  const { user } = useAuth();

  useEffect(() => {
    document.title = "Exam Analytics – Beshi Joss LMS";
  }, []);

  const { data: attempts, isLoading } = useQuery({
    queryKey: ["exam-analytics", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("exam_attempts")
        .select("*, exam:exams(*, course:courses(*))")
        .eq("profile_id", user.id)
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const totalAttempts = attempts?.length ?? 0;
  const avgScore =
    totalAttempts > 0
      ? Math.round(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (attempts!.reduce((sum: number, a: any) => sum + (a.score ?? 0), 0) / totalAttempts) * 10,
        ) / 10
      : null;

  const attemptsByCourse: Record<string, { name: string; count: number }> = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (attempts || []).forEach((a: any) => {
    const id = a.exam.course_id;
    const name = a.exam.course.name;
    if (!attemptsByCourse[id]) {
      attemptsByCourse[id] = { name, count: 0 };
    }
    attemptsByCourse[id].count += 1;
  });

  const latestAttempts = (attempts || []).slice(0, 5);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Exam analytics</h1>
        <p className="text-sm text-muted-foreground">
          High-level view of your exam performance across all courses.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading analytics…</p>
      ) : totalAttempts === 0 ? (
        <Card className="border border-foreground/60">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            You have not completed any exams yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border border-foreground/60">
              <CardHeader>
                <CardTitle className="text-sm">Total attempts</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{totalAttempts}</p>
              </CardContent>
            </Card>

            <Card className="border border-foreground/60">
              <CardHeader>
                <CardTitle className="text-sm">Average score</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">
                  {avgScore !== null ? `${avgScore}` : "-"}
                  <span className="text-sm text-muted-foreground ml-1">marks</span>
                </p>
              </CardContent>
            </Card>

            <Card className="border border-foreground/60">
              <CardHeader>
                <CardTitle className="text-sm">Courses attempted</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{Object.keys(attemptsByCourse).length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border border-foreground/60">
              <CardHeader>
                <CardTitle className="text-sm">Attempts by course</CardTitle>
                <CardDescription>How many exams you have taken per course.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {Object.entries(attemptsByCourse).map(([id, value]) => (
                    <div key={id} className="flex items-center justify-between">
                      <span className="text-muted-foreground">{value.name}</span>
                      <span className="font-medium text-foreground">{value.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border border-foreground/60">
              <CardHeader>
                <CardTitle className="text-sm">Latest attempts</CardTitle>
                <CardDescription>Your 5 most recent exam submissions.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {latestAttempts.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-foreground text-sm">{a.exam?.title}</span>
                        <span className="text-xs">{a.exam?.course?.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-foreground">{a.score ?? "-"}</div>
                        <div className="text-[11px]">
                          {a.submitted_at && new Date(a.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </section>
  );
};

export default ExamAnalytics;
