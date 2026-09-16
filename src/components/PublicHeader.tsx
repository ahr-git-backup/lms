import { Flame, Menu, LayoutGrid, Video, FileQuestion, Zap, Timer, Clock, BarChart3, Star, ClipboardCheck, Send, GraduationCap, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import InstallPWA from "@/components/InstallPWA";
import { useAuth } from "@/contexts/AuthContext";

export const PublicHeader = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <header className="w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-2 py-1 sm:gap-4 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="/" className="block bg-white rounded p-1">
            <img src="/logo.png" alt="Atlas Logo" className="h-8 w-auto object-contain" />
          </a>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-4 text-xs font-medium sm:flex sm:text-sm">
          <a href="/" className="underline-offset-4 hover:underline">
            হোম
          </a>
          <a href="/#courses" className="underline-offset-4 hover:underline">
            কোর্সসমূহ
          </a>
          <a href="/free-class" className="underline-offset-4 hover:underline">
            ফ্রি ক্লাস
          </a>
          <a href="/free-exam" className="underline-offset-4 hover:underline">
            ফ্রি এক্সাম
          </a>
          <a href="/tutorial" className="underline-offset-4 hover:underline">
            টিউটোরিয়াল
          </a>
          {user ? (
            <a href="/dashboard">
              <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-green-600 hover:text-white">
                Dashboard
              </Button>
            </a>
          ) : (
            <>
              <a href="/login" className="underline-offset-4 hover:underline">
                Login
              </a>
              <a href="/register">
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-green-600 hover:text-white">
                  Create Account
                </Button>
              </a>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {/* Mobile Login + Create Account Buttons — same row */}
          <div className="sm:hidden flex items-center gap-1.5">
            {user ? (
              <a href="/dashboard">
                <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-green-600 hover:text-white">
                  Dashboard
                </Button>
              </a>
            ) : (
              <>
                <a href="/login">
                  <Button size="sm" variant="default" className="h-8 px-3 text-xs">
                    Login
                  </Button>
                </a>
                <a href="/register">
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white border-green-600 hover:text-white">
                    Create Account
                  </Button>
                </a>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Menu">
                  <Menu className="h-5 w-5 text-primary" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>মেনু</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-6 mt-6 pb-6">
                  {/* Main */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Main</p>
                    <a href="/" className="text-base font-semibold hover:text-primary">হোম</a>
                    <a href="/#courses" className="text-base font-semibold hover:text-primary">কোর্সসমূহ</a>
                    {user && (
                      <a href="/dashboard" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" /> Dashboard
                      </a>
                    )}
                  </div>

                  {/* Free Resources */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Free Resources</p>
                    <a href="/free-class" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Video className="h-4 w-4" /> ফ্রি ক্লাস
                    </a>
                    <a href="/free-exam" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <FileQuestion className="h-4 w-4" /> ফ্রি এক্সাম
                    </a>
                    <a href="/tutorial" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" /> টিউটোরিয়াল
                    </a>
                    <a href="/reviews" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Star className="h-4 w-4" /> Course Review
                    </a>
                  </div>

                  {/* Practice Tools */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Practice Tools</p>
                    <a href="/quick-practice" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Quick Practice
                    </a>
                    <a href="/mock-test" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <ClipboardCheck className="h-4 w-4" /> Unlimited Mock Test
                    </a>
                    <a href="/syllabus-tracker" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Study Tracker
                    </a>
                  </div>

                  {/* Timers */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Timers</p>
                    <a href="/focus-timer" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Timer className="h-4 w-4" /> Focus Timer
                    </a>
                    <a href="/pomodoro" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Clock className="h-4 w-4" /> Pomodoro Timer
                    </a>
                  </div>

                  {/* Support */}
                  <div className="flex flex-col gap-3">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Support</p>
                    <a href="/telegram-support" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                      <Send className="h-4 w-4" /> Telegram Support
                    </a>
                  </div>

                  {/* Account */}
                  <div className="flex flex-col gap-3 border-t pt-4">
                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Account</p>
                    {user ? (
                      <>
                        <a href="/dashboard/profile" className="text-base font-semibold hover:text-primary flex items-center gap-2">
                          <User className="h-4 w-4" /> Profile
                        </a>
                        <button
                          onClick={handleLogout}
                          className="text-base font-semibold text-destructive hover:opacity-80 flex items-center gap-2 text-left"
                        >
                          <LogOut className="h-4 w-4" /> Logout
                        </button>
                      </>
                    ) : (
                      <>
                        <a href="/login" className="text-base font-semibold hover:text-primary">
                          Login
                        </a>
                        <a href="/register" className="text-base font-semibold hover:text-primary">
                          Create Account
                        </a>
                      </>
                    )}
                  </div>
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
