import { NavLink } from "react-router-dom";
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
  if (!isStandalone) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-between border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      style={{ height: "calc(60px + env(safe-area-inset-bottom))" }}
    >
      {NAV_ITEMS.map(({ label, to, icon: Icon, end }) => (
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
      ))}
    </nav>
  );
};
