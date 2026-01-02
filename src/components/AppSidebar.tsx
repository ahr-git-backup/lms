import { useLocation } from "react-router-dom";
import { BookOpen, CalendarClock, FileText, GraduationCap, HelpCircle, LayoutDashboard, ListChecks, Megaphone, Settings2, User, Users, ClipboardList, CreditCard, Bookmark, Sparkles, StickyNote, PenTool, LayoutTemplate, Tag } from "lucide-react";
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
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Profile", url: "/dashboard/profile", icon: User },
  { title: "Live Class", url: "/dashboard/live-class", icon: CalendarClock },
  { title: "Live Exam", url: "/dashboard/live-exam", icon: ListChecks },
  { title: "Past Class", url: "/dashboard/past-class", icon: BookOpen },
  { title: "Past Exams", url: "/dashboard/past-exam", icon: FileText },
  { title: "Results", url: "/dashboard/results", icon: ClipboardList },
  { title: "Routine", url: "/dashboard/routine", icon: CalendarClock },
  { title: "Class Notes", url: "/dashboard/class-notes", icon: StickyNote },
  { title: "Announcements", url: "/dashboard/announcements", icon: Megaphone, hasDot: true },
  { title: "Bookmarks", url: "/dashboard/bookmarks", icon: Bookmark },
  { title: "Resources", url: "/dashboard/resources", icon: GraduationCap },
  { title: "Study Tools", url: "/dashboard/program", icon: Sparkles },
  { title: "Exam Analytics", url: "/dashboard/analytics", icon: Settings2 },
  { title: "Reminders", url: "/dashboard/reminders", icon: CalendarClock },
  { title: "Help & FAQ", url: "/dashboard/help", icon: HelpCircle },
];

const adminItems = [
  { title: "Overview", url: "/dashboard/admin", icon: LayoutDashboard, roles: ["admin", "teacher"] },
  { title: "Courses", url: "/dashboard/admin/courses", icon: GraduationCap, roles: ["admin"] },
  { title: "Students", url: "/dashboard/admin/students", icon: Users, roles: ["admin"] },
  { title: "Class Schedule", url: "/dashboard/admin/classes", icon: CalendarClock, roles: ["admin", "teacher"] },
  { title: "Exams", url: "/dashboard/admin/exams", icon: ListChecks, roles: ["admin", "teacher"] },
  { title: "Announcements", url: "/dashboard/admin/announcements", icon: Megaphone, roles: ["admin", "teacher"] },
  { title: "Resources", url: "/dashboard/admin/resources", icon: BookOpen, roles: ["admin", "teacher"] },
  { title: "Notes Manager", url: "/dashboard/admin/notes", icon: StickyNote, roles: ["admin", "teacher"] },
  { title: "Payments", url: "/dashboard/admin/payments", icon: CreditCard, roles: ["admin"] },
  { title: "Promo Codes", url: "/dashboard/admin/promos", icon: Tag, roles: ["admin"] },
  { title: "Site Heroes", url: "/dashboard/admin/heroes", icon: LayoutTemplate, roles: ["admin"] },
  { title: "Mentors/Founders", url: "/dashboard/admin/mentors", icon: PenTool, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const { isAdmin, isTeacher } = useAuth();

  const isActive = (path: string) => {
      // Exact match for dashboard root to avoid highlighting on sub-routes unless intended
      if (path === "/dashboard/admin") {
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
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground w-56 data-[state=collapsed]:w-16 mt-14 h-[calc(100svh-3.5rem)]"
    >
      <SidebarContent className="flex h-full flex-col group-data-[collapsible=icon]:!overflow-y-auto no-scrollbar">
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
                          <item.icon className="h-4 w-4 shrink-0" />
                          {/* @ts-expect-error - hasDot is not in the type definition yet */}
                          {item.hasDot && (
                             <span id="desktop-announcement-dot" className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-500 hidden border border-background" />
                          )}
                      </div>
                      {state === "expanded" && <span>{item.title}</span>}
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
                        <item.icon className="h-4 w-4 shrink-0" />
                        {state === "expanded" && <span>{item.title}</span>}
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
