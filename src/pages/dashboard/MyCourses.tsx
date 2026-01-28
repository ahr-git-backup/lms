import { useEffect } from "react";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { BookOpen, GraduationCap } from "lucide-react";

const MyCourses = () => {
  const { data: enrollments, isLoading } = useEnrollments();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "My Courses – Atlas";
  }, []);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading courses...</div>;
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <GraduationCap className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Active Courses</h2>
        <p className="text-muted-foreground">You are not enrolled in any courses yet.</p>
        <Button onClick={() => navigate("/courses")}>Browse Courses</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">My Courses</h1>
        <p className="text-sm text-muted-foreground">Access your enrolled courses and content.</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {enrollments.map((enrollment: any) => (
          <Card key={enrollment.id} className="flex flex-col h-full group hover:border-primary/50 transition-all duration-300">
            {enrollment.course?.image_url && (
                <div className="aspect-video w-full overflow-hidden rounded-t-lg">
                    <img
                        src={enrollment.course.image_url}
                        alt={enrollment.course.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="line-clamp-2 leading-tight text-lg">
                {enrollment.course?.name || "Unknown Course"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 pb-4">
               <p className="text-sm text-muted-foreground line-clamp-3">
                   {enrollment.course?.short_description}
               </p>
            </CardContent>
            <CardFooter className="pt-0 mt-auto">
              <Button className="w-full gap-2 rounded-full" onClick={() => navigate(`/dashboard/course/${enrollment.course_id}`)}>
                <BookOpen className="h-4 w-4" /> Enter Course
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyCourses;
