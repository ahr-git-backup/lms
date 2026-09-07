import { Flame, Menu } from "lucide-react";
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
  const { user } = useAuth();

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
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>মেনু</SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-4 mt-6">
                  <a href="/" className="text-lg font-medium hover:text-primary">
                    হোম
                  </a>
                  <a href="/#courses" className="text-lg font-medium hover:text-primary">
                    কোর্সসমূহ
                  </a>
                  <a href="/free-class" className="text-lg font-medium hover:text-primary">
                    ফ্রি ক্লাস
                  </a>
                  <a href="/free-exam" className="text-lg font-medium hover:text-primary">
                    ফ্রি এক্সাম
                  </a>
                  <a href="/tutorial" className="text-lg font-medium hover:text-primary">
                    টিউটোরিয়াল
                  </a>
                  {user ? (
                    <a href="/dashboard" className="text-lg font-medium hover:text-primary">
                      Dashboard
                    </a>
                  ) : (
                    <>
                      <a href="/login" className="text-lg font-medium hover:text-primary">
                        Login
                      </a>
                      <a href="/register" className="text-lg font-medium hover:text-primary">
                        Create Account
                      </a>
                    </>
                  )}
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
