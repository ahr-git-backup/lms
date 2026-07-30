import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardX, Video, Lightbulb, TrendingDown, AlertTriangle, BookX } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_RANGES = [
  { key: "total", label: "Total", days: null },
  { key: "3", label: "বিগত ৩ দিন", days: 3 },
  { key: "7", label: "বিগত ৭ দিন", days: 7 },
  { key: "15", label: "বিগত ১৫ দিন", days: 15 },
  { key: "30", label: "বিগত ৩০ দিন", days: 30 },
  { key: "45", label: "বিগত ৪৫ দিন", days: 45 },
  { key: "60", label: "বিগত ৬০ দিন", days: 60 },
  { key: "75", label: "বিগত ৭৫ দিন", days: 75 },
  { key: "90", label: "বিগত ৯০ দিন", days: 90 },
] as const;

type RangeKey = typeof DAY_RANGES[number]["key"];

const DayRangeSelector = ({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) => (
  <div className="flex flex-wrap gap-1.5">
    {DAY_RANGES.map((r) => (
      <Button
        key={r.key}
        size="sm"
        variant={value === r.key ? "default" : "outline"}
        className="h-7 px-2.5 text-xs"
        onClick={() => onChange(r.key)}
      >
        {r.label}
      </Button>
    ))}
  </div>
);

type WeaknessCategoryKey = "exam" | "class" | "overall";

const WEAKNESS_CATEGORIES: { key: WeaknessCategoryKey; label: string; icon: typeof ClipboardX }[] = [
  { key: "exam", label: "Exam Weakness Report", icon: ClipboardX },
  { key: "class", label: "Class Weakness Report", icon: Video },
  { key: "overall", label: "Overall Suggestion", icon: Lightbulb },
];

const CategorySelector = ({ value, onChange }: { value: WeaknessCategoryKey; onChange: (v: WeaknessCategoryKey) => void }) => (
  <div className="grid grid-cols-3 gap-2">
    {WEAKNESS_CATEGORIES.map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 h-16 rounded-lg border-2 px-2 text-[11px] font-semibold text-center leading-tight transition-colors",
          value === key
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/40"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span>{label}</span>
      </button>
    ))}
  </div>
);

// -----------------------------------------------------------------------
// Exam Weakness Report — will eventually combine data from: Exam Report
// (routinewise + readymade), Exam History (every category result), My
// Mistakes, Readymade Exam attempts, Quick Practice, and Unlimited Mock
// Test — to surface which exams/subjects/chapters need more focus, and
// which question types are commonly missed. Rule-based (not AI-generated):
// fixed thresholds compare subject/chapter-wise average score against the
// student's own overall average and flag the weakest ones.
// -----------------------------------------------------------------------
const ExamWeaknessReport = ({ range }: { range: RangeKey }) => {
  return (
    <div className="space-y-3">
      <Card className="border-red-500/30 bg-red-50/40 dark:bg-red-950/10">
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-red-500" /> দুর্বল বিষয়/অধ্যায়
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-3 text-center text-sm text-muted-foreground">
          এই ফিচারটি আসছে খুব শীঘ্রই — Exam Report, Exam History, My Mistakes, Readymade Exam,
          Quick Practice ও Mock Test মিলিয়ে সাবজেক্ট/চ্যাপ্টার ভিত্তিক দুর্বলতা analysis দেখাবে।
        </CardContent>
      </Card>
      <Card className="border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/10">
        <CardHeader className="py-2.5 px-3">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <BookX className="h-4 w-4 text-amber-500" /> কম ধরা প্রশ্নের ধরন
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-3 text-center text-sm text-muted-foreground">
          কোন ধরনের প্রশ্নে বেশি ভুল হচ্ছে তা এখানে দেখা যাবে।
        </CardContent>
      </Card>
    </div>
  );
};

// -----------------------------------------------------------------------
// Class Weakness Report — will combine watch-history from Class Report
// (Live/Record/Archive) to flag subjects/classes with low attendance or
// low watch-completion percentage.
// -----------------------------------------------------------------------
const ClassWeaknessReport = ({ range }: { range: RangeKey }) => {
  return (
    <Card className="border-orange-500/30 bg-orange-50/40 dark:bg-orange-950/10">
      <CardHeader className="py-2.5 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-orange-500" /> কম দেখা ক্লাস/বিষয়
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-3 text-center text-sm text-muted-foreground">
        এই ফিচারটি আসছে খুব শীঘ্রই — Live Class, Record Class, Archive Class মিলিয়ে কোন বিষয়ে
        কম সময় দেওয়া হচ্ছে তা দেখাবে।
      </CardContent>
    </Card>
  );
};

// -----------------------------------------------------------------------
// Overall Suggestion — combines everything (exam performance, class watch
// time, site activity/leaderboard position over recent days) into one
// rule-based recommendation of what to do next to improve overall rank.
// -----------------------------------------------------------------------
const OverallSuggestion = ({ range }: { range: RangeKey }) => {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="py-2.5 px-3">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Lightbulb className="h-4 w-4 text-primary" /> সার্বিক পরামর্শ
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-4 px-3 text-center text-sm text-muted-foreground">
        এই ফিচারটি আসছে খুব শীঘ্রই — Exam ও Class activity, সাইটে সক্রিয় সময়, এবং সাম্প্রতিক
        leaderboard position বিশ্লেষণ করে position উন্নত করার নির্দিষ্ট পরামর্শ দেখাবে।
      </CardContent>
    </Card>
  );
};

const WeaknessAnalysis = () => {
  const [category, setCategory] = useState<WeaknessCategoryKey>("exam");
  const [range, setRange] = useState<RangeKey>("total");

  return (
    <div className="space-y-4">
      <CategorySelector value={category} onChange={setCategory} />
      <DayRangeSelector value={range} onChange={setRange} />
      {category === "exam" && <ExamWeaknessReport range={range} />}
      {category === "class" && <ClassWeaknessReport range={range} />}
      {category === "overall" && <OverallSuggestion range={range} />}
    </div>
  );
};

export default WeaknessAnalysis;
