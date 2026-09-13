import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import PushDebug from "./pages/PushDebug";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CompleteProfile from "./pages/CompleteProfile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Courses from "./pages/Courses";
import CourseDetails from "./pages/CourseDetails";
import CourseBuy from "./pages/CourseBuy";
import Reviews from "./pages/Reviews";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Tutorial from "./pages/public/Tutorial";
import InstallApp from "./pages/public/InstallApp";
import Free from "./pages/public/Free";
import StudyAid from "./pages/public/StudyAid";
import AllCoursesList from "./pages/public/AllCoursesList";
import PublicLayout from "./layouts/PublicLayout";
import { PWALoginGate } from "./pwa/PWALoginGate";import DashboardLayout from "./layouts/DashboardLayout";
import { AppBottomNav } from "./components/AppBottomNav";
import AdminLayout from "./layouts/AdminLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import LiveClass from "./pages/dashboard/LiveClass";
import Recordings from "./pages/dashboard/Recordings";
import LiveExam from "./pages/dashboard/LiveExam";
import ExamResults from "./pages/dashboard/ExamResults";
import PastExamCatalog from "./pages/dashboard/PastExamCatalog";
import TakeExam from "./pages/dashboard/TakeExam";
import TakeMistakeExam from "./pages/dashboard/TakeMistakeExam";
import ExamReview from "./pages/dashboard/ExamReview";
import Leaderboard from "./pages/dashboard/Leaderboard";
import Bookmarks from "./pages/dashboard/Bookmarks";
import MyMistakes from "./pages/dashboard/MyMistakes";
import MyProgress from "./pages/dashboard/MyProgress";
import TopPerformer from "./pages/dashboard/TopPerformer";
import Routine from "./pages/dashboard/Routine";
import ClassNotes from "./pages/dashboard/ClassNotes";
import NoteDetails from "./pages/dashboard/NoteDetails";
import Community from "./pages/dashboard/Community";
import Announcements from "./pages/dashboard/Announcements";
import StudentProfile from "./pages/dashboard/StudentProfile";
import ExamAnalytics from "./pages/dashboard/ExamAnalytics";
import Archive from "./pages/dashboard/Archive";
import Readymade from "./pages/dashboard/Readymade";
import SubjectPaperFinal from "./pages/dashboard/SubjectPaperFinal";
import TakeSpFinalExam from "./pages/dashboard/TakeSpFinalExam";
import ReadymadeHistory from "./pages/dashboard/ReadymadeHistory";
import CustomExamBuilder from "./pages/dashboard/CustomExamBuilder";
import ExamCalendar from "./pages/dashboard/ExamCalendar";
import MyCourses from "./pages/dashboard/MyCourses";
import ExtraCourses from "./pages/dashboard/ExtraCourses";
import CourseView from "./pages/dashboard/CourseView";
import AdminDashboardHome from "./pages/dashboard/admin/AdminDashboardHome";
import AdminCourses from "./pages/dashboard/admin/AdminCourses";
import AdminStudents from "./pages/dashboard/admin/AdminStudents";
import AdminClasses from "./pages/dashboard/admin/AdminClasses";
import AdminRoutines from "./pages/dashboard/admin/AdminRoutines";
import AdminExams from "./pages/dashboard/admin/AdminExams";
import AdminAnnouncements from "./pages/dashboard/admin/AdminAnnouncements";
import AdminCommunity from "./pages/dashboard/admin/AdminCommunity";
import AdminPayments from "./pages/dashboard/admin/AdminPayments";
import AdminPaymentHistory from "./pages/dashboard/admin/AdminPaymentHistory";
import AdminNotes from "./pages/dashboard/admin/AdminNotes";
import AdminArchiveManager from "./pages/dashboard/admin/ArchiveManager";
import AdminFreeContent from "./pages/dashboard/admin/AdminFreeContent";
import AdminMentors from "./pages/dashboard/admin/AdminMentors";
import AdminPromoCodes from "./pages/dashboard/admin/AdminPromoCodes";
import AdminHeroes from "./pages/dashboard/admin/AdminHeroes";
import AdminReviews from "./pages/dashboard/admin/AdminReviews";
import AdminReports from "./pages/dashboard/admin/AdminReports";
import AdminQuickPractice from "./pages/dashboard/admin/AdminQuickPractice";
import AdminMockPool from "./pages/dashboard/admin/AdminMockPool";
import AdminAdmissionTest from "./pages/dashboard/admin/AdminAdmissionTest";
import AdmissionTest from "./pages/dashboard/AdmissionTest";
import AdmissionTestPlay from "./pages/dashboard/AdmissionTestPlay";
import AdminSyllabusTracker from "./pages/dashboard/admin/AdminSyllabusTracker";
import AdminTelegramChannels from "./pages/dashboard/admin/AdminTelegramChannels";
import ExamCreator from "./pages/dashboard/admin/ExamCreator";
import QuestionBank from "./pages/dashboard/admin/QuestionBank";
import ClassPlayerPage from "./pages/dashboard/ClassPlayerPage";
import DemoClassPlayerPage from "./pages/dashboard/DemoClassPlayerPage";
import Program from "./pages/dashboard/Program";
import UnifiedContentCreator from "./pages/dashboard/admin/UnifiedContentCreator";
import CourseDashboard from "./pages/dashboard/admin/CourseDashboard";
import PublicExamEntry from "./pages/public/PublicExamEntry";
import FreeClass from "./pages/public/FreeClass";
import FreeExam from "./pages/public/FreeExam";
import FocusTimer from "./pages/public/FocusTimer";
import StudyHistory from "./pages/public/StudyHistory";
import StudyHistory from "./pages/public/StudyHistory";
import AtlasAI from "./pages/public/AtlasAI";
import TelegramSupportPage from "./pages/public/TelegramSupport";
import Pomodoro from "./pages/public/Pomodoro";
import SyllabusTracker from "./pages/public/SyllabusTracker";
import UnlimitedMockTest from "./pages/dashboard/UnlimitedMockTest";
import MockTestHistory from "./pages/dashboard/MockTestHistory";
import PlayUnlimitedMock from "./pages/dashboard/PlayUnlimitedMock";
import QuickPractice from "./pages/public/QuickPractice";
import QuickPracticePlay from "./pages/public/QuickPracticePlay";
import QuickPracticeLeaderboard from "./pages/public/QuickPracticeLeaderboard";
import QuickPracticeBookmarks from "./pages/public/QuickPracticeBookmarks";
import StudentProfileView from "./pages/dashboard/admin/StudentProfileView";
import StudentCourseResults from "./pages/dashboard/admin/StudentCourseResults";
import { useEffect } from "react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import MetaPixelRouteTracker from "@/components/MetaPixelRouteTracker";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes (Reduce polling/refetching)
      gcTime: 30 * 60 * 1000, // 30 minutes
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      refetchOnWindowFocus: false, // Disable refetch on window focus to reduce load
      // PWA on mobile frequently drops the network connection when the app
      // goes to background/foreground (OS suspends it, tab gets frozen).
      // With this off, a request that failed during that gap stayed failed
      // forever until the user manually refreshed — showing "Failed to load
      // dashboard data" even after the connection was back. Re-enabled so a
      // reconnect automatically retries anything that failed.
      refetchOnReconnect: true,
    },
  },
});

const App = () => {
  useAntiCheat();

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U, Ctrl+S, Ctrl+P
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) ||
        (e.ctrlKey && (e.key === "u" || e.key === "U")) ||
        (e.ctrlKey && (e.key === "s" || e.key === "S")) ||
        (e.ctrlKey && (e.key === "p" || e.key === "P"))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <HelmetProvider>
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <MetaPixelRouteTracker />
          <AuthProvider>
            <NotificationProvider>
            <ErrorBoundary label="PWALoginGate" fallback={null}>
              <PWALoginGate />
            </ErrorBoundary>
            <Routes>
              <Route element={<ErrorBoundary><PublicLayout /></ErrorBoundary>}>
                <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                <Route path="/push-debug" element={<ErrorBoundary><PushDebug /></ErrorBoundary>} />
                <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
                <Route path="/register" element={<ErrorBoundary><Register /></ErrorBoundary>} />
                <Route path="/complete-profile" element={<ErrorBoundary><CompleteProfile /></ErrorBoundary>} />
                <Route path="/forgot-password" element={<ErrorBoundary><ForgotPassword /></ErrorBoundary>} />
                <Route path="/reset-password" element={<ErrorBoundary><ResetPassword /></ErrorBoundary>} />
                <Route path="/courses" element={<ErrorBoundary><Courses /></ErrorBoundary>} />
                <Route path="/courses/all" element={<ErrorBoundary><AllCoursesList /></ErrorBoundary>} />
                <Route path="/courses/:courseId" element={<ErrorBoundary><CourseDetails /></ErrorBoundary>} />
                <Route path="/courses/:courseId/buy" element={<ErrorBoundary><CourseBuy /></ErrorBoundary>} />
                <Route path="/courses/:courseId/demo/:demoIndex" element={<ErrorBoundary><DemoClassPlayerPage /></ErrorBoundary>} />
                <Route path="/open-exam/:examId" element={<ErrorBoundary><PublicExamEntry /></ErrorBoundary>} />
                <Route path="/free-class" element={<ErrorBoundary><FreeClass /></ErrorBoundary>} />
                <Route path="/free-exam" element={<ErrorBoundary><FreeExam /></ErrorBoundary>} />
                <Route path="/free" element={<ErrorBoundary><Free /></ErrorBoundary>} />
                <Route path="/study-aid" element={<ErrorBoundary><StudyAid /></ErrorBoundary>} />
                <Route path="/tutorial" element={<ErrorBoundary><Tutorial /></ErrorBoundary>} />
                <Route path="/install" element={<ErrorBoundary><InstallApp /></ErrorBoundary>} />
                <Route path="/reviews" element={<ErrorBoundary><Reviews /></ErrorBoundary>} />
                <Route path="/privacy-policy" element={<ErrorBoundary><PrivacyPolicy /></ErrorBoundary>} />
              </Route>
              <Route path="/quick-practice" element={<ErrorBoundary><QuickPractice /></ErrorBoundary>} />
              <Route path="/quick-practice/play" element={<ErrorBoundary><QuickPracticePlay /></ErrorBoundary>} />
              <Route path="/quick-practice/leaderboard" element={<ErrorBoundary><QuickPracticeLeaderboard /></ErrorBoundary>} />
              <Route path="/quick-practice/bookmarks" element={<ErrorBoundary><QuickPracticeBookmarks /></ErrorBoundary>} />
              <Route path="/focus-timer" element={<ErrorBoundary><FocusTimer /></ErrorBoundary>} />
              <Route path="/focus-timer/history" element={<ErrorBoundary><StudyHistory /></ErrorBoundary>} />
              <Route path="/atlas-ai" element={<ErrorBoundary><AtlasAI /></ErrorBoundary>} />
              <Route path="/telegram-support" element={<ErrorBoundary><TelegramSupportPage /></ErrorBoundary>} />
              <Route path="/pomodoro" element={<ErrorBoundary><Pomodoro /></ErrorBoundary>} />
              <Route path="/study-history" element={<ErrorBoundary><StudyHistory /></ErrorBoundary>} />
              <Route path="/syllabus-tracker" element={<ErrorBoundary><SyllabusTracker /></ErrorBoundary>} />
              <Route path="/mock-test" element={<ErrorBoundary><UnlimitedMockTest /></ErrorBoundary>} />
              <Route path="/mock-test/history" element={<ErrorBoundary><MockTestHistory /></ErrorBoundary>} />
              <Route path="/mock-test/play" element={<ErrorBoundary><PlayUnlimitedMock /></ErrorBoundary>} />
              {/* Public route so guest-allowed exams (allow_guest=true) can actually be taken
                  without login — /dashboard/take-exam is behind ProtectedRoute and would redirect
                  guests to /login before TakeExam.tsx's own guest-info logic ever runs. */}
              <Route path="/take-exam/:examId" element={<ErrorBoundary><TakeExam /></ErrorBoundary>} />

              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<ErrorBoundary><DashboardHome /></ErrorBoundary>} />
                <Route path="live-class" element={<ErrorBoundary><LiveClass /></ErrorBoundary>} />
                <Route path="class/:classId" element={<ErrorBoundary><ClassPlayerPage /></ErrorBoundary>} />
                <Route path="recordings" element={<ErrorBoundary><Recordings /></ErrorBoundary>} />
                <Route path="live-exam" element={<ErrorBoundary><LiveExam /></ErrorBoundary>} />
                <Route path="take-exam/:examId" element={<ErrorBoundary><TakeExam /></ErrorBoundary>} />
                <Route path="take-mistakes" element={<ErrorBoundary><TakeMistakeExam /></ErrorBoundary>} />
                <Route path="past-exam" element={<ErrorBoundary><PastExamCatalog /></ErrorBoundary>} />
                <Route path="results" element={<ErrorBoundary><ExamResults /></ErrorBoundary>} />
                <Route path="exam-review/:attemptId" element={<ErrorBoundary><ExamReview /></ErrorBoundary>} />
                <Route path="leaderboard/:examId" element={<ErrorBoundary><Leaderboard /></ErrorBoundary>} />
                <Route path="bookmarks" element={<ErrorBoundary><Bookmarks /></ErrorBoundary>} />
                <Route path="my-mistakes" element={<ErrorBoundary><MyMistakes /></ErrorBoundary>} />
                <Route path="my-progress" element={<ErrorBoundary><MyProgress /></ErrorBoundary>} />
                <Route path="top-performer" element={<ErrorBoundary><TopPerformer /></ErrorBoundary>} />
                <Route path="routine" element={<ErrorBoundary><Routine /></ErrorBoundary>} />
                <Route path="class-notes" element={<ErrorBoundary><ClassNotes /></ErrorBoundary>} />
                <Route path="class-notes/:noteId" element={<ErrorBoundary><NoteDetails /></ErrorBoundary>} />
                <Route path="community" element={<ErrorBoundary><Community /></ErrorBoundary>} />
                <Route path="announcements" element={<ErrorBoundary><Announcements /></ErrorBoundary>} />
                <Route path="profile" element={<ErrorBoundary><StudentProfile /></ErrorBoundary>} />
                <Route path="analytics" element={<ErrorBoundary><ExamAnalytics /></ErrorBoundary>} />
                <Route path="program" element={<ErrorBoundary><Program /></ErrorBoundary>} />
                <Route path="calendar" element={<ErrorBoundary><ExamCalendar /></ErrorBoundary>} />
                <Route path="readymade" element={<ErrorBoundary><Readymade /></ErrorBoundary>} />
                <Route path="admission-test" element={<ErrorBoundary><AdmissionTest /></ErrorBoundary>} />
                <Route path="admission-test/play" element={<ErrorBoundary><AdmissionTestPlay /></ErrorBoundary>} />
                <Route path="readymade/category/:categoryName" element={<ErrorBoundary><Readymade /></ErrorBoundary>} />
                <Route path="readymade/custom-exam" element={<ErrorBoundary><CustomExamBuilder /></ErrorBoundary>} />
                <Route path="readymade/subject-paper-final" element={<ErrorBoundary><SubjectPaperFinal /></ErrorBoundary>} />
                <Route path="readymade/subject-paper-final/take" element={<ErrorBoundary><TakeSpFinalExam /></ErrorBoundary>} />
                <Route path="readymade/history" element={<ErrorBoundary><ReadymadeHistory /></ErrorBoundary>} />
                <Route path="archive" element={<ErrorBoundary><Archive /></ErrorBoundary>} />
                <Route path="my-courses" element={<ErrorBoundary><MyCourses /></ErrorBoundary>} />
                <Route path="extra-courses" element={<ErrorBoundary><ExtraCourses /></ErrorBoundary>} />
                <Route path="course/:courseId" element={<ErrorBoundary><CourseView /></ErrorBoundary>} />


              </Route>

              <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminLayout /></ProtectedRoute>}>
                <Route index element={<ErrorBoundary><AdminDashboardHome /></ErrorBoundary>} />
                <Route path="courses" element={<ProtectedRoute requireAdmin><AdminCourses /></ProtectedRoute>} />
                <Route path="students" element={<ProtectedRoute requireAdmin><AdminStudents /></ProtectedRoute>} />
                <Route path="classes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminClasses /></ProtectedRoute>} />
                <Route path="routines" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminRoutines /></ProtectedRoute>} />
                <Route path="exams" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminExams /></ProtectedRoute>} />
                <Route path="exams/question-maker" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamCreator /></ProtectedRoute>} />
                <Route path="exams/question-maker/:examId" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamCreator /></ProtectedRoute>} />
                <Route path="question-bank" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><QuestionBank /></ProtectedRoute>} />
                <Route path="announcements" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminAnnouncements /></ProtectedRoute>} />
                <Route path="community" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminCommunity /></ProtectedRoute>} />
                <Route path="notes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminNotes /></ProtectedRoute>} />
                <Route path="archive" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminArchiveManager /></ProtectedRoute>} />
                <Route path="free-content" element={<ProtectedRoute requireAdmin><AdminFreeContent /></ProtectedRoute>} />
                <Route path="payments" element={<ProtectedRoute requireAdmin><ErrorBoundary><AdminPayments /></ErrorBoundary></ProtectedRoute>} />
                <Route path="payments/history" element={<ProtectedRoute requireAdmin><AdminPaymentHistory /></ProtectedRoute>} />
                <Route path="mentors" element={<ProtectedRoute requireAdmin><AdminMentors /></ProtectedRoute>} />
                <Route path="promos" element={<ProtectedRoute requireAdmin><AdminPromoCodes /></ProtectedRoute>} />
                <Route path="heroes" element={<ProtectedRoute requireAdmin><AdminHeroes /></ProtectedRoute>} />
                <Route path="reviews" element={<ProtectedRoute requireAdmin><AdminReviews /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminReports /></ProtectedRoute>} />
                <Route path="quick-practice" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminQuickPractice /></ProtectedRoute>} />
                <Route path="mock-test" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminMockPool /></ProtectedRoute>} />
                <Route path="admission-test" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminAdmissionTest /></ProtectedRoute>} />
                <Route path="syllabus-tracker" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminSyllabusTracker /></ProtectedRoute>} />
                <Route path="telegram-channels" element={<ProtectedRoute requireAdmin><AdminTelegramChannels /></ProtectedRoute>} />
                <Route path="content-creator" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><UnifiedContentCreator /></ProtectedRoute>} />
                <Route path="course-dashboard/:courseId" element={<ProtectedRoute requireAdmin><CourseDashboard /></ProtectedRoute>} />
                <Route path="student/:studentId" element={<ProtectedRoute requireAdmin><StudentProfileView /></ProtectedRoute>} />
                <Route path="student/:studentId/course-results/:courseId" element={<ProtectedRoute requireAdmin><StudentCourseResults /></ProtectedRoute>} />
              </Route>

              {/* Public/guest-accessible exam routes — used for Free Exam attempts by
                  visitors who are NOT logged in. These render the exact same
                  TakeExam/ExamReview components as the dashboard versions (all
                  features identical), just without the ProtectedRoute login gate
                  and without the dashboard sidebar/topbar. TakeExam/ExamReview
                  internally detect the guest case (no user + is_visible_on_free
                  exam) and prompt for guest info instead of requiring login. */}
              <Route path="/take-exam/:examId" element={<ErrorBoundary><TakeExam /></ErrorBoundary>} />
              <Route path="/exam-review/:attemptId" element={<ErrorBoundary><ExamReview /></ErrorBoundary>} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<ErrorBoundary><NotFound /></ErrorBoundary>} />
            </Routes>
            <AppBottomNav />
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
