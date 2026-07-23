import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Plus, Trash2, Edit, Link2, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MockTestForm } from "@/components/admin/MockTestForm";

const AdminMockTest = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMockExam, setEditingMockExam] = useState<any>(null);

  const { data: mockExams, isLoading } = useQuery({
    queryKey: ["admin-mock-exams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_exams")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mock_exams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Mock Test deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-exams"] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  if (showForm) {
    return (
      <MockTestForm
        mockExam={editingMockExam}
        onClose={() => {
          setShowForm(false);
          setEditingMockExam(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-fuchsia-600" /> Unlimited Mock Test
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Standalone content ecosystem — separate from the main Exam system.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/admin/mock-test/pool")}>
            <Target className="h-4 w-4 mr-1" /> Unlimited Mock (Question Pool)
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Mock Test
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && (!mockExams || mockExams.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No mock tests yet. Click "New Mock Test" to add subjects/chapters/topics, upload a CSV, pick from the
              question bank, or link a readymade exam.
            </CardContent>
          </Card>
        )}
        {(mockExams || []).map((exam: any) => (
          <Card key={exam.id}>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  {exam.title}
                  {exam.is_published ? (
                    <Badge className="bg-green-500/10 text-green-700 border-green-500/20">Published</Badge>
                  ) : (
                    <Badge variant="outline">Draft</Badge>
                  )}
                  {exam.linked_exam_id && (
                    <Badge variant="secondary" className="gap-1"><Link2 className="h-3 w-3" /> Linked</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {[exam.subject, exam.chapter, exam.topic].filter(Boolean).join(" • ") || "No subject/chapter/topic set"}
                  {" · "}{exam.duration_minutes} min
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => { setEditingMockExam(exam); setShowForm(true); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(exam.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AdminMockTest;
