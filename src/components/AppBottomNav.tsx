import { NavLink, useLocation } from "react-router-dom";
import { Home, GraduationCap, Gift, BookOpenCheck, User } from "lucide-react";
import { usePWADisplayMode } from "@/pwa/usePWADisplayMode";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Home", to: "/", icon: Home, end: true },
  { label: "Course", to: "/courses", icon: GraduationCap, end: false },
  { label: "Free", to: "/free", icon: Gift, end: false },
  { label: "Study Aid", to: "/study-aid", icon: BookOpenCheck, end: false },
  { label: "Profile", to: "/account", icon: User, end: false },
] as const;

/**
 * Fixed bottom tab bar, app-style. Only rendered inside an installed
 * PWA (standalone display-mode) — the regular browser website keeps its
 * normal layout with no bottom bar.
 */
export const AppBottomNav = () => {
  const isStandalone = usePWADisplayMode();
  const { pathname } = useLocation();
  if (!isStandalone) return null;
  // Hide while an exam is running so only the Submit controls are visible.
  // (Result / review pages live on other routes, so the nav stays there.)
  if (/^(\/dashboard)?\/take-exam\//.test(pathname)) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-between border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      style={{ height: "calc(60px + env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => {
        const isCenter = label === "Free";

        if (isCenter) {
          return (
            <NavLink
              key={label}
              to={to}
              end={end}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "-mt-7 flex h-14 w-14 items-center justify-center rounded-full border-2 bg-background transition-all",
                      isActive
                        ? "border-primary shadow-[0_0_10px_2px_rgba(59,130,246,0.6),0_0_20px_4px_rgba(59,130,246,0.35)]"
                        : "border-primary/70 shadow-[0_0_8px_1px_rgba(59,130,246,0.45),0_0_16px_3px_rgba(59,130,246,0.25)]"
                    )}
                  >
                    <Icon className={cn("h-6 w-6 text-primary", isActive && "fill-primary/10")} strokeWidth={isActive ? 2.4 : 2} />
                  </span>
                  <span className={isActive ? "text-primary" : undefined}>{label}</span>
                </>
              )}
            </NavLink>
          );
        }

        return (
          <NavLink
            key={label}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn("h-5 w-5", isActive && "fill-primary/10")} strokeWidth={isActive ? 2.4 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
};
