import { ClipboardCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const MockTest = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="h-16 w-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center">
        <ClipboardCheck className="h-8 w-8 text-fuchsia-600" />
      </div>
      <h1 className="text-xl font-bold">Mock Test</h1>
      <Card className="max-w-sm">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Unlimited Mock Test is coming soon — practice with subject/chapter/topic-wise tests built from our full
          question bank.
        </CardContent>
      </Card>
    </div>
  );
};

export default MockTest;
