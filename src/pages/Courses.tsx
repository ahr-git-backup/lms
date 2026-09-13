import { useEffect } from "react";
import PublicHeader from "@/components/PublicHeader";
import { CourseSection } from "@/components/home/CourseSection";
import { useAuth } from "@/contexts/AuthContext";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap, Gift } from "lucide-react";

const MyCoursesStrip = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: enrollments, isLoading } = useEnrollments();

  if (!user) return null;
  const directEnrollments = (enrollments || []).filter((e: any) => !e.is_extra);
  if (isLoading || directEnrollments.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">My Courses</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {directEnrollments.map((enrollment: any) => (
          <Card key={enrollment.id} className="flex flex-col h-full group transition-all duration-300 hover:shadow-md hover:border-primary/50">
            <div className="aspect-video w-full overflow-hidden rounded-t-xl bg-muted/20 relative">
              {enrollment.course?.image_url ? (
                <img
                  src={enrollment.course.image_url}
                  alt={enrollment.course.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  {enrollment.is_extra ? <Gift className="h-12 w-12 opacity-20" /> : <GraduationCap className="h-12 w-12 opacity-20" />}
                </div>
              )}
              <div className="absolute top-2 right-2">
                <span className="bg-background/80 backdrop-blur text-xs font-semibold px-2 py-1 rounded-full shadow-sm">
                  Enrolled
                </span>
              </div>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="line-clamp-2 leading-tight text-lg group-hover:text-primary transition-colors">
                {enrollment.course?.name || "Unknown Course"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
              <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {enrollment.course?.short_description || "No description available."}
              </p>
            </CardContent>
            <CardFooter className="pt-0 mt-auto pb-6 px-6">
              <Button
                className="w-full gap-2 rounded-full shadow-lg shadow-primary/10 group-hover:shadow-primary/20 transition-all"
                onClick={() => navigate(`/dashboard/course/${enrollment.course_id}`)}
              >
                <BookOpen className="h-4 w-4" /> Enter Course
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  );
};

const Courses = () => {
  useEffect(() => {
    document.title = "Courses - Atlas";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-16 px-4 pb-16 pt-10 sm:pt-14 flex-1">
        <MyCoursesStrip />
        <CourseSection />
      </main>

      {/* Footer can be added here if needed, usually managed by Layout */}
    </div>
  );
};

export default Courses;
