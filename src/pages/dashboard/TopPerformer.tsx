import { useEffect } from "react";
import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const TopPerformer = () => {
  useEffect(() => {
    document.title = "Top Performer – Atlas";
  }, []);

  return (
    <div className="space-y-4">
      <header className="space-y-0.5">
        <h1 className="text-xl font-semibold tracking-tight">Top Performer</h1>
        <p className="text-xs text-muted-foreground">
          See who's leading across exams and courses.
        </p>
      </header>

      <Card className="border border-dashed">
        <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
          <Trophy className="h-10 w-10 text-yellow-500" />
          <p className="text-sm text-muted-foreground">
            Top Performer ফিচারটি আসছে খুব শীঘ্রই।
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TopPerformer;
