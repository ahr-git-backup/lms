import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type SpCategory = "subject_final" | "paper_final";
type SpMode = "medical_standard" | "standard_hard" | "varsity_standard";

const MODE_LABELS: Record<SpMode, string> = {
  medical_standard: "Medical Standard",
  standard_hard: "Standard+Hard",
  varsity_standard: "Varsity Standard",
};
// Which modes are offered depends on which admission track the student came
// from (Medical: Standard + Standard+Hard, Varsity: Standard only).
const MODES_BY_TRACK: Record<"medical" | "varsity", SpMode[]> = {
  medical: ["medical_standard", "standard_hard"],
  varsity: ["varsity_standard"],
};

interface SpItem {
  id: string;
  name: string;
  medical_standard_configured: number;
  standard_hard_configured: number;
  varsity_standard_configured: number;
}

/** Student-facing Subject Final / Paper Final browser: pick the category tab,
 *  tap an item (subject or paper name admin added) to open a popup asking
 *  which difficulty mode to take -- each fully-configured (>=100 MCQ) mode is
 *  tappable and materializes a real `exams` row via create_sp_final_exam (RPC),
 *  then redirects into the main TakeExam.tsx player -- same timer, negative
 *  marking, attempts and leaderboard as every other readymade exam. */
const SubjectPaperFinal = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const track = (searchParams.get("track") === "varsity" ? "varsity" : "medical") as "medical" | "varsity";
  const MODES = MODES_BY_TRACK[track];
  const [category, setCategory] = useState<SpCategory>("subject_final");
  const [selectedItem, setSelectedItem] = useState<SpItem | null>(null);
  const [startingMode, setStartingMode] = useState<SpMode | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ["sp-final-items", category],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sp_final_items", { p_category: category });
      if (error) throw error;
      return (data || []) as SpItem[];
    },
  });

  const startExam = async (item: SpItem, mode: SpMode) => {
    setStartingMode(mode);
    try {
      const { data: examId, error } = await supabase.rpc("create_sp_final_exam", {
        p_item_id: item.id,
        p_mode: mode,
      });
      if (error) throw error;
      navigate(`/dashboard/take-exam/${examId}`);
    } catch (err: any) {
      toast({ title: "শুরু করা যায়নি", description: err?.message || "আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setStartingMode(null);
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/readymade")} className="pl-0 h-8">
        <ArrowLeft className="mr-2 h-4 w-4" /> Readymade Exam
      </Button>
      <h1 className="text-xl font-bold">Subject/Paper Final {track === "varsity" ? "— Varsity" : "— Medical"}</h1>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={category === "subject_final" ? "default" : "outline"}
          className="flex-1 gap-1.5"
          onClick={() => setCategory("subject_final")}
        >
          <BookOpen className="h-4 w-4" /> Subject Final
        </Button>
        <div className="w-px bg-border" />
        <Button
          size="sm"
          variant={category === "paper_final" ? "default" : "outline"}
          className="flex-1 gap-1.5"
          onClick={() => setCategory("paper_final")}
        >
          <FileText className="h-4 w-4" /> Paper Final
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {isLoading && <p className="col-span-2 text-sm text-muted-foreground">Loading...</p>}
        {items?.length === 0 && (
          <p className="col-span-2 text-sm text-muted-foreground">
            এখনো কোনো {category === "subject_final" ? "Subject" : "Paper"} যোগ করা হয়নি।
          </p>
        )}
        {items?.map((item) => {
          const anyReady = MODES.some((m) => (item[`${m}_configured` as keyof SpItem] as number) >= 100);
          return (
            <Card
              key={item.id}
              className={`transition-all ${anyReady ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : "opacity-60"}`}
              onClick={() => {
                if (!anyReady || startingMode) return;
                // Varsity only has one mode -- skip the mode-select popup entirely.
                if (MODES.length === 1) { startExam(item, MODES[0]); return; }
                setSelectedItem(item);
              }}
            >
              <CardContent className="p-3 text-center">
                <p className="font-bold text-primary flex items-center justify-center gap-1.5">
                  {item.name}
                  {startingMode && MODES.length === 1 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </p>
                {!anyReady && <p className="text-[10px] text-muted-foreground mt-1">প্রস্তুত হচ্ছে</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!selectedItem} onOpenChange={(o) => { if (!o && !startingMode) setSelectedItem(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-2">Difficulty মোড বেছে নিন</p>
          <div className="grid grid-cols-1 gap-3">
            {selectedItem && MODES.map((mode) => {
              const key = `${mode}_configured` as keyof SpItem;
              const count = selectedItem[key] as number;
              const ready = count >= 100;
              return (
                <Card
                  key={mode}
                  className={`transition-all ${ready && !startingMode ? "cursor-pointer hover:border-primary/50 hover:shadow-md" : "opacity-60"}`}
                  onClick={() => ready && !startingMode && startExam(selectedItem, mode)}
                >
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{MODE_LABELS[mode]}</p>
                      <p className="text-xs text-muted-foreground">{count}/100 MCQ {ready ? "প্রস্তুত" : "প্রস্তুত হচ্ছে"}</p>
                    </div>
                    {startingMode === mode ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : !ready ? (
                      <Badge variant="outline" className="text-[10px]">শীঘ্রই আসছে</Badge>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubjectPaperFinal;
