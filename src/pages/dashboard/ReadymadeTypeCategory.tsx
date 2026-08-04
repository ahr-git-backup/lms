import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ExamForm } from "@/components/admin/ExamForm";
import ErrorBoundary from "@/components/ErrorBoundary";

const PANELS: Record<string, { title: string; items: string[]; cols: string }> = {
  "type-based": {
    title: "টাইপভিত্তিক এক্সাম",
    items: ["মেডিকেল স্ট্যান্ডার্ড প্রশ্ন", "সত্য-মিথ্যার প্রশ্ন", "ছকভিত্তিক প্রশ্ন", "ছোট প্রশ্ন-বড় অপশন"],
    cols: "grid-cols-2",
  },
  "model-test": {
    title: "মডেল টেস্ট বানাও",
    items: ["Subject Final", "Paper Final", "Full Model Test"],
    cols: "grid-cols-1",
  },
};

const ReadymadeTypeCategory = () => {
  const { panelType } = useParams<{ panelType: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [addQuestionCategory, setAddQuestionCategory] = useState<string | null>(null);

  const panel = panelType ? PANELS[panelType] : undefined;

  if (!panel) {
    return (
      <div className="space-y-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/dashboard/readymade")}>
          <ArrowLeft className="h-4 w-4" /> ফিরে যান
        </Button>
        <p className="text-sm text-muted-foreground">এই পেইজটি পাওয়া যায়নি।</p>
      </div>
    );
  }

  return (
    <ErrorBoundary label="Readymade type category">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 gap-1" onClick={() => navigate("/dashboard/readymade")}>
            <ArrowLeft className="h-4 w-4" /> সব ক্যাটাগরি
          </Button>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">{panel.title}</h1>

        <div className={`grid ${panel.cols} gap-2`}>
          {panel.items.map((label) => (
            <div key={label} className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-auto py-2 text-xs whitespace-pre-line leading-tight w-full"
                onClick={() => navigate(`/dashboard/readymade/category/${encodeURIComponent(label)}`)}
              >
                {label}
              </Button>
              {isAdmin && (
                <button
                  type="button"
                  aria-label={`Add question to ${label}`}
                  onClick={(e) => { e.stopPropagation(); setAddQuestionCategory(label); }}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90"
                >
                  <Plus className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        <Dialog open={!!addQuestionCategory} onOpenChange={(o) => { if (!o) setAddQuestionCategory(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{addQuestionCategory} — নতুন এক্সাম যোগ করুন</DialogTitle>
            </DialogHeader>
            {addQuestionCategory && (
              <ExamForm
                exam={{ is_readymade: true, readymade_category: addQuestionCategory }}
                onSuccess={() => setAddQuestionCategory(null)}
                onCancel={() => setAddQuestionCategory(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
};

export default ReadymadeTypeCategory;
