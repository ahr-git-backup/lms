import { useEffect } from "react";
import PublicHeader from "@/components/PublicHeader";
import { CourseSection } from "@/components/home/CourseSection";

const AllCoursesList = () => {
  useEffect(() => {
    document.title = "All Courses - Atlas";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <PublicHeader />
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-16 px-4 pb-16 pt-10 sm:pt-14 flex-1">
        <CourseSection />
      </main>
    </div>
  );
};

export default AllCoursesList;
