import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Clock, ArrowRight, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const MockTest = () => {
  const navigate = useNavigate();

  const { data: mockExams, isLoading } = useQuery({
    queryKey: ["public-mock-exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_exams")
        .select("*")
        .eq("is_published", true)
        .eq("is_archive", false)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
          <ClipboardCheck className="h-6 w-6 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Unlimited Mock Test</h1>
          <p className="text-sm text-muted-foreground">Subject/chapter/topic-wise practice tests. Unlimited attempts.</p>
        </div>
      </div>

      <Card className="border-fuchsia-500/30 bg-fuchsia-500/5">
        <CardContent className="py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Target className="h-8 w-8 text-fuchsia-600 shrink-0" />
            <div>
              <p className="font-semibold text-sm">নিজের মতো টেস্ট বানান</p>
              <p className="text-xs text-muted-foreground">সাবজেক্ট/চ্যাপ্টার/টপিক বেছে র‍্যান্ডম প্রশ্নে টেস্ট দিন</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate("/dashboard/mock-test/unlimited")}>
            শুরু করুন
          </Button>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>}

      {!isLoading && (!mockExams || mockExams.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            এখনো কোনো Mock Test যোগ করা হয়নি। শীঘ্রই আসছে!
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {(mockExams || []).map((exam: any) => (
          <Card key={exam.id} className="flex flex-col hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{exam.title}</CardTitle>
              <CardDescription>
                {[exam.subject, exam.chapter, exam.topic].filter(Boolean).join(" • ") || "সাধারণ Mock Test"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" /> {exam.duration_minutes} মিনিট
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={() => {
                  if (exam.linked_exam_id) {
                    navigate(`/dashboard/take-exam/${exam.linked_exam_id}`);
                  } else {
                    navigate(`/dashboard/mock-test/${exam.id}`);
                  }
                }}
              >
                শুরু করুন <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MockTest;
