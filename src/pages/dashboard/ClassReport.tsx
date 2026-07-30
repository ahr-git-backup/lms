import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Video, History, Archive, Clock } from "lucide-react";
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

type ClassCategoryKey = "live" | "record" | "archive";

const CLASS_CATEGORIES: { key: ClassCategoryKey; label: string; icon: typeof Video }[] = [
  { key: "live", label: "Live Class", icon: Video },
  { key: "record", label: "Record Class", icon: History },
  { key: "archive", label: "Archive Class", icon: Archive },
];

// Placeholder watch-record shape — once watch-time tracking is wired up,
// this will come from a real query (per category), mirroring how
// ReadymadeAttempt/AnalyticsExam feed ExamAnalytics.tsx.
type ClassWatchRecord = {
  id: string;
  class_name: string;
  date: string;
  time: string;
  watched_minutes: number;
  total_minutes: number | null;
  rank: number | null;
  total_participants: number | null;
};

const CategorySelector = ({ value, onChange }: { value: ClassCategoryKey; onChange: (v: ClassCategoryKey) => void }) => (
  <div className="grid grid-cols-3 gap-2">
    {CLASS_CATEGORIES.map(({ key, label, icon: Icon }) => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        className={cn(
          "flex flex-col items-center justify-center gap-1 h-14 rounded-lg border-2 px-2 text-xs font-semibold text-center transition-colors",
          value === key
            ? "border-primary bg-primary/10 text-primary"
            : "border-border text-muted-foreground hover:border-primary/40"
        )}
      >
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="leading-tight">{label}</span>
      </button>
    ))}
  </div>
);

const StatBoxRow = ({
  totalAttended,
  avgWatchMinutes,
  avgRank,
}: {
  totalAttended: number;
  avgWatchMinutes: number | null;
  avgRank: number | null;
}) => (
  <div className="grid grid-cols-3 gap-2">
    <Card className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
      <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
        <span className="text-[10px] text-muted-foreground leading-tight">Total Class Attended</span>
        <span className="text-base font-bold text-blue-600 leading-tight">{totalAttended}</span>
      </CardContent>
    </Card>
    <Card className="border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
      <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
        <span className="text-[10px] text-muted-foreground leading-tight">Avg. Watch Duration</span>
        <span className="text-xs font-bold text-emerald-600 leading-tight">
          {avgWatchMinutes !== null ? `${avgWatchMinutes.toFixed(0)} min` : "-"}
        </span>
      </CardContent>
    </Card>
    <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <CardContent className="p-2 flex flex-col items-center text-center gap-0.5">
        <span className="text-[10px] text-muted-foreground leading-tight">Your Average Rank</span>
        <span className="text-xs font-bold text-amber-600 leading-tight">
          {avgRank !== null ? `#${avgRank.toFixed(1)}` : "-"}
        </span>
      </CardContent>
    </Card>
  </div>
);

const CompactTrendGraph = ({
  data,
  title,
}: {
  data: { name: string; fullTitle: string; date: string; watched: number; total: number | null }[];
  title: string;
}) => {
  if (data.length === 0) {
    return (
      <Card className="shadow-sm border">
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No class activity in this range.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm border">
      <CardHeader className="py-2 px-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[180px] px-2 pb-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickMargin={6} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-background border rounded-lg shadow-lg p-2 text-xs">
                      <p className="font-bold mb-0.5">{d.fullTitle}</p>
                      <p className="text-muted-foreground mb-1">{label}</p>
                      <p className="font-semibold text-primary">
                        Watched: {d.watched} min{d.total ? ` / ${d.total} min` : ""}
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line type="monotone" dataKey="watched" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

const ClassRecordCard = ({ item }: { item: ClassWatchRecord }) => (
  <Card className="shadow-sm border">
    <CardContent className="p-3 flex items-center justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm leading-tight line-clamp-1">{item.class_name}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {item.date} · {item.time}
        </div>
      </div>
      <div className="text-right whitespace-nowrap">
        <div className="font-bold text-sm flex items-center gap-1 justify-end">
          <Clock className="h-3 w-3 text-muted-foreground" />
          {item.watched_minutes} <span className="text-[10px] text-muted-foreground font-normal">min</span>
        </div>
        {item.rank !== null && item.total_participants !== null && (
          <span className="inline-flex items-center justify-center h-5 px-2 mt-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
            #{item.rank} / {item.total_participants}
          </span>
        )}
      </div>
    </CardContent>
  </Card>
);

const CategoryReport = ({ category }: { category: ClassCategoryKey }) => {
  const [range, setRange] = useState<RangeKey>("total");

  // Placeholder — no watch-time tracking exists yet. Once wired up, this will
  // fetch real records per category (live / record / archive) filtered by
  // `range`, following the same shape ExamAnalytics uses for exam data.
  const records: ClassWatchRecord[] = [];
  const graphData: { name: string; fullTitle: string; date: string; watched: number; total: number | null }[] = [];

  const categoryLabel = CLASS_CATEGORIES.find((c) => c.key === category)?.label ?? "";

  return (
    <div className="space-y-4">
      <DayRangeSelector value={range} onChange={setRange} />
      <CompactTrendGraph data={graphData} title={`${categoryLabel} Watch Trend`} />
      <StatBoxRow totalAttended={records.length} avgWatchMinutes={null} avgRank={null} />
      {records.length === 0 ? (
        <Card className="border border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {categoryLabel} watch tracking ফিচারটি আসছে খুব শীঘ্রই।
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {records.map((item) => (
            <ClassRecordCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
};

const ClassReport = () => {
  const [category, setCategory] = useState<ClassCategoryKey>("live");

  return (
    <div className="space-y-4">
      <CategorySelector value={category} onChange={setCategory} />
      <CategoryReport category={category} />
    </div>
  );
};

export default ClassReport;
