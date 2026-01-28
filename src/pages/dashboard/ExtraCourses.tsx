import { useEffect } from "react";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Gift, BookOpen } from "lucide-react";

const ExtraCourses = () => {
  const { data: enrollments, isLoading } = useEnrollments();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Extra Courses – Atlas";
  }, []);

  // Filter for filtered/virtual enrollments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const extraCourses = enrollments?.filter((e: any) => e.is_extra) || [];

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (extraCourses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <Gift className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Extra Courses</h2>
        <p className="text-muted-foreground">You don't have any bonus courses assigned yet.</p>
        <Button variant="outline" onClick={() => navigate("/dashboard/my-courses")}>View My Courses</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Extra Courses</h1>
        <p className="text-sm text-muted-foreground">Bonus content included with your enrollments.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {extraCourses.map((enrollment: any) => (
          <Card key={enrollment.id} className="flex flex-col h-full hover:shadow-md transition-all border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="line-clamp-2 leading-tight flex items-start justify-between gap-2">
                {enrollment.course?.name || "Unknown Course"}
                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full whitespace-nowrap">BONUS</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
               <p className="text-sm text-muted-foreground line-clamp-3">
                   {enrollment.course?.short_description}
               </p>
            </CardContent>
            <CardFooter className="pt-4 border-t">
              <Button className="w-full gap-2" onClick={() => navigate(`/dashboard/course/${enrollment.course_id}`)}>
                <BookOpen className="h-4 w-4" /> Enter Course
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ExtraCourses;
