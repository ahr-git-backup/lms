import { Flame, Menu, Moon, Sun } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

        {/* Desktop Navigation */}
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

          {/* Mobile Menu */}
          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="h-5 w-5 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <a href="/" className="text-lg font-medium hover:text-primary">
                    Home
                  </a>
                  <a href="/#courses" className="text-lg font-medium hover:text-primary">
                    Courses
                  </a>
                  <a href="/login" className="text-lg font-medium hover:text-primary">
                    Student Login
                  </a>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
