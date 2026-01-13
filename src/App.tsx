import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/ui/theme-provider";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Courses from "./pages/Courses";
import CourseDetails from "./pages/CourseDetails";
import CourseBuy from "./pages/CourseBuy";
import PublicLayout from "./layouts/PublicLayout";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import LiveClass from "./pages/dashboard/LiveClass";
import PastClass from "./pages/dashboard/PastClass";
import LiveExam from "./pages/dashboard/LiveExam";
import ExamResults from "./pages/dashboard/ExamResults";
import PastExamCatalog from "./pages/dashboard/PastExamCatalog";
import TakeExam from "./pages/dashboard/TakeExam";
import TakeMistakeExam from "./pages/dashboard/TakeMistakeExam";
import ExamReview from "./pages/dashboard/ExamReview";
import Leaderboard from "./pages/dashboard/Leaderboard";
import Bookmarks from "./pages/dashboard/Bookmarks";
import MyMistakes from "./pages/dashboard/MyMistakes";
import Routine from "./pages/dashboard/Routine";
import ClassNotes from "./pages/dashboard/ClassNotes";
import NoteDetails from "./pages/dashboard/NoteDetails";
import Resources from "./pages/dashboard/Resources";
import Announcements from "./pages/dashboard/Announcements";
import StudentProfile from "./pages/dashboard/StudentProfile";
import ExamAnalytics from "./pages/dashboard/ExamAnalytics";
import AdminDashboardHome from "./pages/dashboard/admin/AdminDashboardHome";
import AdminCourses from "./pages/dashboard/admin/AdminCourses";
import AdminStudents from "./pages/dashboard/admin/AdminStudents";
import AdminClasses from "./pages/dashboard/admin/AdminClasses";
import AdminExams from "./pages/dashboard/admin/AdminExams";
import AdminAnnouncements from "./pages/dashboard/admin/AdminAnnouncements";
import AdminResources from "./pages/dashboard/admin/AdminResources";
import AdminPayments from "./pages/dashboard/admin/AdminPayments";
import AdminNotes from "./pages/dashboard/admin/AdminNotes";
import AdminMentors from "./pages/dashboard/admin/AdminMentors";
import AdminPromoCodes from "./pages/dashboard/admin/AdminPromoCodes";
import AdminHeroes from "./pages/dashboard/admin/AdminHeroes";
import ExamCreator from "./pages/dashboard/admin/ExamCreator";
import ClassPlayerPage from "./pages/dashboard/ClassPlayerPage";
import DemoClassPlayerPage from "./pages/dashboard/DemoClassPlayerPage";
import Program from "./pages/dashboard/Program";
import PublicExamEntry from "./pages/public/PublicExamEntry";
import FreeClass from "./pages/public/FreeClass";
import FreeExam from "./pages/public/FreeExam";
import { useEffect } from "react";
import { useAntiCheat } from "@/hooks/useAntiCheat";
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes (Reduce polling/refetching)
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      retry: 1,
      refetchOnWindowFocus: false, // Disable refetch on window focus to reduce load
      refetchOnReconnect: false, // Disable refetch on reconnect
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
    <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
            <Routes>
              <Route element={<PublicLayout />}>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/courses/:courseId" element={<CourseDetails />} />
                <Route path="/courses/:courseId/buy" element={<CourseBuy />} />
                <Route path="/courses/:courseId/demo/:demoIndex" element={<DemoClassPlayerPage />} />
                <Route path="/open-exam/:examId" element={<PublicExamEntry />} />
                <Route path="/free-class" element={<FreeClass />} />
                <Route path="/free-exam" element={<FreeExam />} />
              </Route>

              <Route path="/dashboard" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                <Route index element={<DashboardHome />} />
                <Route path="live-class" element={<LiveClass />} />
                <Route path="class/:classId" element={<ClassPlayerPage />} />
                <Route path="past-class" element={<PastClass />} />
                <Route path="live-exam" element={<LiveExam />} />
                <Route path="take-exam/:examId" element={<TakeExam />} />
                <Route path="take-mistakes" element={<TakeMistakeExam />} />
                <Route path="past-exam" element={<PastExamCatalog />} />
                <Route path="results" element={<ExamResults />} />
                <Route path="exam-review/:attemptId" element={<ExamReview />} />
                <Route path="leaderboard/:examId" element={<Leaderboard />} />
                <Route path="bookmarks" element={<Bookmarks />} />
                <Route path="my-mistakes" element={<MyMistakes />} />
                <Route path="routine" element={<Routine />} />
                <Route path="class-notes" element={<ClassNotes />} />
                <Route path="class-notes/:noteId" element={<NoteDetails />} />
                <Route path="resources" element={<Resources />} />
                <Route path="announcements" element={<Announcements />} />
                <Route path="profile" element={<StudentProfile />} />
                <Route path="analytics" element={<ExamAnalytics />} />
                <Route path="program" element={<Program />} />

                <Route path="admin" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminDashboardHome /></ProtectedRoute>} />
                <Route path="admin/courses" element={<ProtectedRoute requireAdmin><AdminCourses /></ProtectedRoute>} />
                <Route path="admin/students" element={<ProtectedRoute requireAdmin><AdminStudents /></ProtectedRoute>} />
                <Route path="admin/classes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminClasses /></ProtectedRoute>} />
                <Route path="admin/exams" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminExams /></ProtectedRoute>} />
                <Route path="admin/exams/question-maker" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamCreator /></ProtectedRoute>} />
                <Route path="admin/exams/question-maker/:examId" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamCreator /></ProtectedRoute>} />
                <Route path="admin/announcements" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminAnnouncements /></ProtectedRoute>} />
                <Route path="admin/resources" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminResources /></ProtectedRoute>} />
                <Route path="admin/notes" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><AdminNotes /></ProtectedRoute>} />
                <Route path="admin/payments" element={<ProtectedRoute requireAdmin><AdminPayments /></ProtectedRoute>} />
                <Route path="admin/mentors" element={<ProtectedRoute requireAdmin><AdminMentors /></ProtectedRoute>} />
                <Route path="admin/promos" element={<ProtectedRoute requireAdmin><AdminPromoCodes /></ProtectedRoute>} />
                <Route path="admin/heroes" element={<ProtectedRoute requireAdmin><AdminHeroes /></ProtectedRoute>} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
