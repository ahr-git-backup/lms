import { ArrowLeft, Flame, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import InstallPWA from "@/components/InstallPWA";

export const PublicHeader = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header className="w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-primary bg-background text-primary ring-2 ring-primary/60">
            <Flame className="h-3.5 w-3.5" />
          </span>
          <div className="leading-tight">
            <a href="/" className="text-sm font-semibold tracking-tight sm:text-base">
              Beshi Joss LMS
            </a>
          </div>
        </div>

        <nav className="hidden items-center gap-4 text-xs font-medium sm:flex sm:text-sm">
          <a href="/" className="underline-offset-4 hover:underline">
            Home
          </a>
          <a href="/#courses" className="underline-offset-4 hover:underline">
            Courses
          </a>
          <a href="/login" className="underline-offset-4 hover:underline">
            Student Login
          </a>
        </nav>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label="Toggle theme"
            className="rounded-full"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Go back"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
