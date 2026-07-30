# LMS Sidebar Reference

This file documents every navigation item currently in `src/components/AppSidebar.tsx`,
kept in sync manually whenever the sidebar changes. Source of truth is always the
actual code in `AppSidebar.tsx` — this is a readable reference copy.

## Student Sidebar (`studentItems`, rendered by `AppSidebar`)

| Title | Route | Icon |
|---|---|---|
| Dashboard | /dashboard | LayoutDashboard |
| My Courses | /dashboard/my-courses | GraduationCap |
| Extra Courses | /dashboard/extra-courses | GraduationCap |
| Routine | /dashboard/routine | CalendarClock |
| Profile | /dashboard/profile | User |
| Live Class | /dashboard/live-class | CalendarClock |
| Live Exam | /dashboard/live-exam | ListChecks |
| Record Class | /dashboard/recordings | BookOpen |
| Past Exams | /dashboard/past-exam | FileText |
| Readymade Exam | /dashboard/readymade | ListChecks |
| Quick Practice | /quick-practice | Zap |
| Unlimited Mock Test | /mock-test | Infinity |
| Study Tracker | /syllabus-tracker | BarChart3 |
| Archive Class & Exam | /dashboard/archive | Archive |
| Exam History | /dashboard/results | ClipboardList |
| My Progress & History | /dashboard/my-progress | BarChart3 |
| Top Performer | /dashboard/top-performer | Trophy |
| My Mistakes | /dashboard/my-mistakes | AlertCircle |
| Class Notes | /dashboard/class-notes | StickyNote |
| Notice | /dashboard/announcements | Megaphone |
| Bookmarks | /dashboard/bookmarks | Bookmark |
| FB & Telegram Group | /dashboard/community | Users |
| Exam Analytics | /dashboard/analytics | Settings2 |
| Study Tools | /dashboard/program | Sparkles |
| Exam Routine | /dashboard/calendar | CalendarClock |

## Admin / Teacher Sidebar (`adminItems`, rendered by `AdminSidebar`)

Roles column shows which of `admin` / `teacher` can see each item.

| Title | Route | Roles |
|---|---|---|
| Overview | /admin | admin, teacher |
| Courses | /admin/courses | admin |
| Students | /admin/students | admin |
| Class Schedule | /admin/classes | admin, teacher |
| Routine Manager | /admin/routines | admin, teacher |
| Exams | /admin/exams | admin, teacher |
| Content Creator | /admin/content-creator | admin, teacher |
| Question Bank | /admin/question-bank | admin, teacher |
| Notice | /admin/announcements | admin, teacher |
| Community Manager | /admin/community | admin, teacher |
| Notes Manager | /admin/notes | admin, teacher |
| Archive Manager | /admin/archive | admin, teacher |
| Exam Routine Manager | /admin/calendar | admin, teacher |
| Free Manager | /admin/free-content | admin |
| Payments | /admin/payments | admin |
| Promo Codes | /admin/promos | admin |
| Site Heroes | /admin/heroes | admin |
| Mentors/Founders | /admin/mentors | admin |
| Reviews | /admin/reviews | admin |
| Quick Practice | /admin/quick-practice | admin, teacher |
| Study Tracker | /admin/syllabus-tracker | admin, teacher |
| Reports | /admin/reports | admin, teacher |

## Notes
- `AppSidebar` (student view) is mounted in `DashboardLayout.tsx`.
- `AdminSidebar` (admin/teacher view) is mounted in `AdminLayout.tsx`.
- Both share icons/colors defined inline per item; no shared constant file for colors.
- When adding a new page that should be reachable from the sidebar, add an entry here
  AND in `AppSidebar.tsx` in the same commit so this file doesn't drift.
