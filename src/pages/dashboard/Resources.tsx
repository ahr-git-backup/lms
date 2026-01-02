import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Link as LinkIcon, Video } from "lucide-react";

const Resources = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const { data: enrollments } = useEnrollments();

  useEffect(() => {
    document.title = "Resources – Beshi Joss LMS";
  }, []);

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources", selectedCourse, enrolledCourseIds],
    queryFn: async () => {
      // Security: Always filter by enrolled courses to prevent data leaks
      if (enrolledCourseIds.length === 0) return [];

      let query = supabase
        .from("resources")
        .select("*, course:courses(*)")
        .order("created_at", { ascending: false });

      if (selectedCourse !== "all") {
        // Double check strict enrollment
        if (!enrolledCourseIds.includes(selectedCourse)) return [];
        query = query.eq("course_id", selectedCourse);
      } else {
        query = query.in("course_id", enrolledCourseIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: enrolledCourseIds.length > 0,
  });

  const filteredResources = resources || [];

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

      <div className="flex items-center gap-4">
        <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Course filter</div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-56">
            <SelectValue />
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

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : filteredResources.length === 0 ? (
        <Card className="border border-foreground/50">
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            No resources available for this course yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="border border-foreground/50">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-mono uppercase text-muted-foreground">
                    {resource.course?.name || "All Courses"}
                  </p>
                  <Badge variant="outline">{resource.resource_type}</Badge>
                </div>
                <CardTitle className="text-base">{resource.title}</CardTitle>
                {resource.description && (
                  <CardDescription className="text-xs">{resource.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" asChild>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">
                    {getResourceIcon(resource.resource_type)}
                    <span className="ml-2">Open</span>
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Resources;
