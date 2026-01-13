import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { FileText, Link as LinkIcon, Video, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 9;

const Resources = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [page, setPage] = useState(0);
  const { data: enrollments } = useEnrollments();

  useEffect(() => {
    document.title = "Resources – Atlas";
  }, []);

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ["resources", selectedCourse, selectedSubject, enrolledCourseIds, page],
    queryFn: async () => {
      // Security: Always filter by enrolled courses to prevent data leaks
      if (enrolledCourseIds.length === 0) return { data: [], count: 0 };

      let query = supabase
        .from("resources")
        .select("*, course:courses(*)", { count: 'exact' })
        .order("created_at", { ascending: false });

      if (selectedCourse !== "all") {
        // Double check strict enrollment
        if (!enrolledCourseIds.includes(selectedCourse)) return { data: [], count: 0 };
        query = query.eq("course_id", selectedCourse);
      } else {
        query = query.or(`course_id.in.(${enrolledCourseIds.join(',')}),course_id.is.null`);
      }

      if (selectedSubject !== "all") {
        query = query.eq("subject", selectedSubject);
      }

      const { data, error, count } = await query
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: enrolledCourseIds.length > 0,
  });

  const resources = resourcesData?.data || [];
  const totalCount = resourcesData?.count || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const getResourceIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-4 w-4" />;
      case "video":
        return <Video className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resources</h1>
        <p className="text-sm text-muted-foreground">Access additional learning materials and resources.</p>
      </header>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Course</div>
            <Select
                value={selectedCourse}
                onValueChange={(val) => {
                    setSelectedCourse(val);
                    setPage(0);
                }}
            >
            <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {enrollments?.map((enrollment) => (
                <SelectItem key={enrollment.course_id} value={enrollment.course_id}>
                    {enrollment.course.name}
                </SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>

        <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Subject</div>
            <Select
                value={selectedSubject}
                onValueChange={(val) => {
                    setSelectedSubject(val);
                    setPage(0);
                }}
            >
            <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {["Physics", "Chemistry", "Math", "Biology", "English", "Bangla", "ICT"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
            </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : resources.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No resources available for this course yet.
          </CardContent>
        </Card>
      ) : (
        <>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <Card key={resource.id} className="border border-emerald-100 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900 rounded-2xl shadow-md hover:shadow-lg transition-all flex flex-col h-full">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono uppercase text-muted-foreground">
                    {resource.course?.name || "All Courses"}
                  </p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-emerald-200 bg-emerald-100/50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800">
                      {resource.resource_type}
                  </span>
                </div>
                <CardTitle className="text-base">{resource.title}</CardTitle>
                {resource.description && (
                  <CardDescription className="text-xs">{resource.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <Button size="sm" className="rounded-full mt-auto w-fit bg-emerald-600 hover:bg-emerald-700 text-white border-none" asChild>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    {getResourceIcon(resource.resource_type)}
                    <span className="ml-2">Open</span>
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Pagination Controls */}
        <div className="flex items-center justify-between pt-4">
             <div className="text-xs text-muted-foreground">
                 Page {page + 1} of {totalPages || 1} ({totalCount} items)
             </div>
             <div className="flex gap-2">
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                 >
                     <ChevronLeft className="h-4 w-4" />
                     Previous
                 </Button>
                 <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages - 1}
                 >
                     Next
                     <ChevronRight className="h-4 w-4" />
                 </Button>
             </div>
        </div>
        </>
      )}
    </div>
  );
};

export default Resources;
