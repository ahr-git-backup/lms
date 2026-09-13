import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Home, GraduationCap, Compass } from "lucide-react";

interface PostSignupChoiceDialogProps {
  open: boolean;
  onDashboard: () => void;
  onHomepage: () => void;
}

const PostSignupChoiceDialog = ({ open, onDashboard, onHomepage }: PostSignupChoiceDialogProps) => {
  return (
    <Dialog open={open}>
      <DialogContent
        className="max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">অ্যাকাউন্ট তৈরি সম্পন্ন! এখন কোথায় যেতে চান?</DialogTitle>
          <DialogDescription>
            আপনার পছন্দমতো যেকোনো একটি অপশন বেছে নিন।
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          <button
            onClick={onDashboard}
            className="flex items-start gap-3 rounded-xl border-2 border-emerald-600/30 bg-emerald-50/60 dark:bg-emerald-900/20 p-4 text-left transition-all hover:border-emerald-600/60 hover:shadow-sm"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-600/15 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2">
                ড্যাশবোর্ডে যান
                <LayoutDashboard className="h-4 w-4 text-emerald-700" />
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                পেইড ব্যাচের স্টুডেন্ট হলে এখানেই আপনার ক্লাস, এক্সাম এবং কোর্স কনটেন্ট পাবেন।
              </p>
            </div>
          </button>

          <button
            onClick={onHomepage}
            className="flex items-start gap-3 rounded-xl border-2 border-border bg-card p-4 text-left transition-all hover:border-foreground/30 hover:shadow-sm"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
              <Compass className="h-5 w-5 text-foreground" />
            </div>
            <div className="flex-1">
              <p className="font-semibold flex items-center gap-2">
                হোমপেজে যান
                <Home className="h-4 w-4" />
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                কোনো পেইড কোর্সে ভর্তি না থাকলে এখান থেকে ফ্রি ক্লাস, ফ্রি এক্সাম ও অন্যান্য ফ্রি ফিচারগুলো ব্যবহার করতে পারবেন।
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostSignupChoiceDialog;
