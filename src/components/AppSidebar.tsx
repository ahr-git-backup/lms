import { useLocation } from "react-router-dom";
import { BookOpen, CalendarClock, CalendarRange, FileText, GraduationCap, HelpCircle, LayoutDashboard, ListChecks, Megaphone, Settings2, User, Users, ClipboardList, CreditCard, Bookmark, Sparkles, StickyNote, PenTool, LayoutTemplate, Tag, AlertCircle, Archive, Database, Gift, Flag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const studentItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, color: "text-blue-500" },
  { title: "My Courses", url: "/dashboard/my-courses", icon: GraduationCap, color: "text-indigo-500" },
  { title: "Routine", url: "/dashboard/routine", icon: CalendarClock, color: "text-indigo-500" },
  { title: "Profile", url: "/dashboard/profile", icon: User, color: "text-green-500" },
  { title: "Live Class", url: "/dashboard/live-class", icon: CalendarClock, color: "text-red-500" },
  { title: "Live Exam", url: "/dashboard/live-exam", icon: ListChecks, color: "text-purple-500" },
  { title: "Record Class", url: "/dashboard/recordings", icon: BookOpen, color: "text-orange-500" },
  { title: "Past Exams", url: "/dashboard/past-exam", icon: FileText, color: "text-yellow-500" },
  { title: "Readymade Exam", url: "/dashboard/readymade", icon: ListChecks, color: "text-blue-400" },
  { title: "Archive", url: "/dashboard/archive", icon: Archive, color: "text-gray-500" },
  { title: "Results", url: "/dashboard/results", icon: ClipboardList, color: "text-teal-500" },
  { title: "My Mistakes", url: "/dashboard/my-mistakes", icon: AlertCircle, color: "text-red-600" },
  { title: "Notice", url: "/dashboard/announcements", icon: Megaphone, hasDot: true, color: "text-rose-500" },
  { title: "Bookmarks", url: "/dashboard/bookmarks", icon: Bookmark, color: "text-emerald-500" },
  { title: "Community", url: "/dashboard/community", icon: Users, color: "text-cyan-500" },
  { title: "Exam Analytics", url: "/dashboard/analytics", icon: Settings2, color: "text-slate-500" },
  { title: "Study Tools", url: "/dashboard/program", icon: Sparkles, color: "text-amber-500" },
  { title: "Exam Routine", url: "/dashboard/calendar", icon: CalendarClock, color: "text-indigo-500" },
];

const adminItems = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, roles: ["admin", "teacher"], color: "text-blue-600" },
  { title: "Courses", url: "/admin/courses", icon: GraduationCap, roles: ["admin"], color: "text-green-600" },
  { title: "Students", url: "/admin/students", icon: Users, roles: ["admin"], color: "text-purple-600" },
  { title: "Class Schedule", url: "/admin/classes", icon: CalendarClock, roles: ["admin", "teacher"], color: "text-red-600" },
  { title: "Routine Manager", url: "/admin/routines", icon: CalendarClock, roles: ["admin", "teacher"], color: "text-indigo-600" },
  { title: "Exams", url: "/admin/exams", icon: ListChecks, roles: ["admin", "teacher"], color: "text-orange-600" },
  { title: "Question Bank", url: "/admin/question-bank", icon: Database, roles: ["admin", "teacher"], color: "text-blue-500" },
  { title: "Notice", url: "/admin/announcements", icon: Megaphone, roles: ["admin", "teacher"], color: "text-yellow-600" },
  { title: "Community Manager", url: "/admin/community", icon: Users, roles: ["admin", "teacher"], color: "text-teal-600" },
  { title: "Notes Manager", url: "/admin/notes", icon: StickyNote, roles: ["admin", "teacher"], color: "text-pink-600" },
  { title: "Archive Manager", url: "/admin/archive", icon: BookOpen, roles: ["admin", "teacher"], color: "text-purple-500" },
  { title: "Exam Routine Manager", url: "/admin/calendar", icon: CalendarRange, roles: ["admin", "teacher"], color: "text-rose-500" },
  { title: "Free Manager", url: "/admin/free-content", icon: StickyNote, roles: ["admin"], color: "text-indigo-500" },
  { title: "Payments", url: "/admin/payments", icon: CreditCard, roles: ["admin"], color: "text-emerald-600" },
  { title: "Promo Codes", url: "/admin/promos", icon: Tag, roles: ["admin"], color: "text-cyan-600" },
  { title: "Site Heroes", url: "/admin/heroes", icon: LayoutTemplate, roles: ["admin"], color: "text-indigo-600" },
  { title: "Mentors/Founders", url: "/admin/mentors", icon: PenTool, roles: ["admin"], color: "text-violet-600" },
  { title: "Reviews", url: "/admin/reviews", icon: Megaphone, roles: ["admin"], color: "text-pink-600" },
  { title: "Reports", url: "/admin/reports", icon: Flag, roles: ["admin", "teacher"], color: "text-red-500" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { isAdmin, isTeacher } = useAuth();

  const isActive = (path: string) => {
      // Exact match for dashboard root to avoid highlighting on sub-routes unless intended
      if (path === "/admin") {
          return currentPath === path;
      }
      return currentPath.startsWith(path);
  };

  const visibleAdminItems = adminItems.filter(item => {
      if (item.roles.includes("admin") && isAdmin) return true;
      if (item.roles.includes("teacher") && isTeacher) return true;
      return false;
  });

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-background text-sidebar-foreground w-56 data-[state=collapsed]:w-16 mt-14 h-[calc(100svh-3.5rem)] z-30"
    >
      <SidebarContent className="flex h-full flex-col group-data-[collapsible=icon]:!overflow-y-auto no-scrollbar bg-background">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70">Student</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {studentItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground relative"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <div className="relative">
                          <item.icon className={`h-5 w-5 shrink-0 ${item.color || ''}`} />
                          {/* @ts-expect-error - hasDot is not in the type definition yet */}
                          {item.hasDot && (
                             <span id="desktop-announcement-dot" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 hidden border border-background" />
                          )}
                      </div>
                      {state === "expanded" && <span className="font-medium">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAdmin || isTeacher) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70">
                {isAdmin ? "Admin Panel" : "Teacher Panel"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleAdminItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className={`h-5 w-5 shrink-0 ${item.color || ''}`} />
                        {state === "expanded" && <span className="font-medium">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}

export default AppSidebar;
