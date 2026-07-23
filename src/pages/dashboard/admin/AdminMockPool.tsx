import { useState } from "react";
import Papa from "papaparse";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Trash2, FileUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];

const AdminMockPool = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [subject, setSubject] = useState("");
  const [paper, setPaper] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [standard, setStandard] = useState("medical");
  const [csvData, setCsvData] = useState<any[] | null>(null);
  const [csvFileName, setCsvFileName] = useState("");

  const { data: pools, isLoading } = useQuery({
    queryKey: ["admin-mock-pool"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = (result.data as any[]).filter((r) => r["questions"] || r["question_text"]);
        setCsvData(rows);
      },
    });
  };

  const clearForm = () => {
    setSubject("");
    setPaper("");
    setChapter("");
    setTopic("");
    setStandard("medical");
    setCsvData(null);
    setCsvFileName("");
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!csvData?.length) throw new Error("CSV আপলোড করুন");
      if (!subject.trim() || !chapter.trim()) throw new Error("সাবজেক্ট ও চ্যাপ্টার দিন");
      const { error } = await supabase.from("mock_question_pool").insert({
        subject: subject.trim(),
        paper: paper.trim() || null,
        chapter: chapter.trim(),
        topic: topic.trim() || null,
        standard,
        question_count: csvData.length,
        questions_json: csvData,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "মক টেস্ট প্রশ্ন সেভ হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-pool"] });
      clearForm();
    },
    onError: (e: any) => toast({ title: "সেভ ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mock_question_pool").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "মুছে ফেলা হয়েছে" });
      queryClient.invalidateQueries({ queryKey: ["admin-mock-pool"] });
    },
    onError: (e: any) => toast({ title: "মুছতে ব্যর্থ", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
          <Target className="h-6 w-6 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">আনলিমিটেড মক টেস্ট — প্রশ্ন ব্যাংক</h1>
          <p className="text-sm text-muted-foreground">
            Subject/Chapter/Topic ভিত্তিক প্রশ্নের পুল আপলোড করুন — স্টুডেন্টরা এখান থেকে র‍্যান্ডম টেস্ট নিবে।
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">মক টেস্ট যোগ/এডিট</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>সাবজেক্ট</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="সাবজেক্ট" />
            </div>
            <div>
              <Label>পেপার (ঐচ্ছিক)</Label>
              <Input value={paper} onChange={(e) => setPaper(e.target.value)} placeholder="পেপার" />
            </div>
          </div>
          <div>
            <Label>চ্যাপ্টার</Label>
            <Input value={chapter} onChange={(e) => setChapter(e.target.value)} placeholder="চ্যাপ্টার" />
          </div>
          <div>
            <Label>টপিক (ঐচ্ছিক)</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="টপিক" />
          </div>
          <div>
            <Label className="mb-2 block">স্ট্যান্ডার্ড</Label>
            <div className="flex gap-2 flex-wrap">
              {STANDARDS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStandard(s.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    standard === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50"
            onClick={() => document.getElementById("mockPoolCSV")?.click()}
          >
            <FileUp className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-sm">CSV আপলোড করুন</p>
            <input
              id="mockPoolCSV"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSV}
            />
            {csvFileName && (
              <p className="text-xs text-primary mt-1">
                {csvFileName} — {csvData?.length || 0} প্রশ্ন পাওয়া গেছে
              </p>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Header: questions, option1, option2, option3, option4, answer, explanation
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেইভ"}
            </Button>
            <Button variant="outline" onClick={clearForm}>
              ক্লিয়ার
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">তালিকা</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!isLoading && (!pools || pools.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-6">কোনো প্রশ্ন যোগ করা হয়নি।</p>
          )}
          <div className="space-y-2">
            {(pools || []).map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between border rounded-lg px-3 py-2"
              >
                <div className="text-sm">
                  <p className="font-semibold">
                    {p.subject}
                    {p.paper ? ` (${p.paper})` : ""} › {p.chapter}
                    {p.topic ? ` › ${p.topic}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STANDARDS.find((s) => s.value === p.standard)?.label || p.standard} ·{" "}
                    {p.question_count} প্রশ্ন
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => deleteMutation.mutate(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMockPool;
