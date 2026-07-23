import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Target, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const STANDARDS = [
  { value: "medical", label: "Medical" },
  { value: "varsity", label: "Varsity" },
  { value: "onushiloni", label: "Onushiloni" },
];
const COUNTS = [25, 35, 50, 75, 100];

const UnlimitedMockTest = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topic, setTopic] = useState("");
  const [standard, setStandard] = useState("medical");
  const [count, setCount] = useState(50);
  const [customCount, setCustomCount] = useState("");
  const [customMinutes, setCustomMinutes] = useState("");
  const [starting, setStarting] = useState(false);

  const { data: subjects } = useQuery({
    queryKey: ["mock-pool-subjects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("mock_question_pool").select("subject");
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.subject))];
    },
  });

  const { data: chapters } = useQuery({
    queryKey: ["mock-pool-chapters", subject],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("chapter")
        .eq("subject", subject);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.chapter))];
    },
    enabled: !!subject,
  });

  const { data: topics } = useQuery({
    queryKey: ["mock-pool-topics", subject, chapter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mock_question_pool")
        .select("topic")
        .eq("subject", subject)
        .eq("chapter", chapter);
      if (error) throw error;
      return [...new Set((data || []).map((d: any) => d.topic).filter(Boolean))];
    },
    enabled: !!subject && !!chapter,
  });

  const buildAndStart = async (finalCount: number, finalMinutes?: number) => {
    if (!subject || !chapter) {
      toast({ title: "সাবজেক্ট ও চ্যাপ্টার নির্বাচন করুন", variant: "destructive" });
      return;
    }
    setStarting(true);
    try {
      let q = supabase
        .from("mock_question_pool")
        .select("*")
        .eq("subject", subject)
        .eq("chapter", chapter)
        .eq("standard", standard);
      if (topic) q = q.eq("topic", topic);

      const { data, error } = await q;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast({ title: "প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setStarting(false);
        return;
      }

      let all: any[] = [];
      data.forEach((row: any) => {
        const qs = Array.isArray(row.questions_json) ? row.questions_json : [];
        all = all.concat(qs);
      });

      if (all.length === 0) {
        toast({ title: "প্রশ্ন পাওয়া যায়নি", variant: "destructive" });
        setStarting(false);
        return;
      }

      all.sort(() => Math.random() - 0.5);
      const picked = all.slice(0, finalCount).map((qq: any, i: number) => ({
        id: qq.id ? String(qq.id) : `mock_${i}_${Date.now()}`,
        question_text: qq.question_text || qq.questions || "",
        option_a: qq.option_a || qq.option1 || "",
        option_b: qq.option_b || qq.option2 || "",
        option_c: qq.option_c || qq.option3 || "",
        option_d: qq.option_d || qq.option4 || "",
        correct_option:
          qq.correct_option ||
          (["A", "B", "C", "D"][(Number(qq.answer) || 1) - 1] ?? "A"),
        explanation: qq.explanation || "",
      }));

      const time = finalMinutes || Math.ceil(finalCount / 1.5);

      sessionStorage.setItem("unlimitedMockQuestions", JSON.stringify(picked));
      sessionStorage.setItem(
        "unlimitedMockTitle",
        `${subject} - ${chapter} (Mock Test)`
      );
      sessionStorage.setItem("unlimitedMockTime", String(time));

      navigate("/dashboard/mock-test/play");
    } catch (e: any) {
      toast({ title: "লোড করতে সমস্যা", description: e.message, variant: "destructive" });
    } finally {
      setStarting(false);
    }
  };

  const handleCustomStart = () => {
    const c = parseInt(customCount);
    if (!c || c < 1) {
      toast({ title: "প্রশ্ন সংখ্যা দিন", variant: "destructive" });
      return;
    }
    const mins = parseInt(customMinutes) || undefined;
    buildAndStart(c, mins);
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center shrink-0">
          <Target className="h-6 w-6 text-fuchsia-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold">আনলিমিটেড মক টেস্ট</h1>
          <p className="text-sm text-muted-foreground">
            সাবজেক্ট, চ্যাপ্টার বেছে নিয়ে র‍্যান্ডম প্রশ্নের টেস্ট দিন — যতবার খুশি।
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">টেস্ট সেটআপ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>সাবজেক্ট</Label>
            <Select
              value={subject}
              onValueChange={(v) => {
                setSubject(v);
                setChapter("");
                setTopic("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="— নির্বাচন —" />
              </SelectTrigger>
              <SelectContent>
                {(subjects || []).map((s: string) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>চ্যাপ্টার</Label>
            <Select
              value={chapter}
              onValueChange={(v) => {
                setChapter(v);
                setTopic("");
              }}
              disabled={!subject}
            >
              <SelectTrigger>
                <SelectValue placeholder={subject ? "— নির্বাচন —" : "প্রথমে সাবজেক্ট"} />
              </SelectTrigger>
              <SelectContent>
                {(chapters || []).map((c: string) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>টপিক (ঐচ্ছিক)</Label>
            <Select value={topic} onValueChange={setTopic} disabled={!subject || !chapter}>
              <SelectTrigger>
                <SelectValue placeholder="— ঐচ্ছিক —" />
              </SelectTrigger>
              <SelectContent>
                {(topics || []).map((t: string) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

          <div>
            <Label className="mb-2 block">প্রশ্ন সংখ্যা</Label>
            <div className="flex gap-2 flex-wrap">
              {COUNTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-colors ${
                    count === c
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <Card className="bg-muted/40">
            <CardContent className="pt-4 space-y-2">
              <Label className="text-xs text-primary font-semibold">কাস্টম সেটিং</Label>
              <div className="flex gap-2 flex-wrap">
                <Input
                  type="number"
                  min={5}
                  max={200}
                  placeholder="প্রশ্ন সংখ্যা"
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  className="flex-1 min-w-[120px]"
                />
                <Input
                  type="number"
                  min={1}
                  max={300}
                  placeholder="মিনিট (ফাঁকা=auto)"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="flex-1 min-w-[120px]"
                />
                <Button onClick={handleCustomStart} disabled={starting}>
                  শুরু
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                মিনিট ফাঁকা রাখলে: প্রশ্ন÷1.5 = সময়
              </p>
            </CardContent>
          </Card>

          <Button
            className="w-full"
            size="lg"
            onClick={() => buildAndStart(count)}
            disabled={starting}
          >
            {starting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            এক্সাম শুরু করুন
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default UnlimitedMockTest;
