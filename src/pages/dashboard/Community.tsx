import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Facebook, Link as LinkIcon, Users, MessageCircle } from "lucide-react";

const Community = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const { data: enrollments } = useEnrollments();

  useEffect(() => {
    document.title = "Community – Atlas";
  }, []);

  const enrolledCourseIds = enrollments?.map(e => e.course_id) || [];

  const { data: links, isLoading } = useQuery({
    queryKey: ["community-links", selectedCourse, enrolledCourseIds],
    queryFn: async () => {
      let query = supabase
        .from("resources")
        .select("*, course:courses(name)")
        .eq("resource_type", "Link") // Strictly fetch Links
        .order("created_at", { ascending: false });

      if (selectedCourse !== "all") {
        // Double check enrollment if trying to view a specific course
        if (!enrolledCourseIds.includes(selectedCourse)) return [];
        query = query.eq("course_id", selectedCourse);
      } else {
         // Show public links OR links for enrolled courses
         if (enrolledCourseIds.length > 0) {
             query = query.or(`course_id.in.(${enrolledCourseIds.join(',')}),course_id.is.null`);
         } else {
             query = query.is("course_id", null);
         }
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const getIcon = (url: string) => {
      if (url.includes("t.me")) return <Send className="h-6 w-6" />;
      if (url.includes("facebook.com") || url.includes("fb.me")) return <Facebook className="h-6 w-6" />;
      if (url.includes("wa.me") || url.includes("whatsapp")) return <MessageCircle className="h-6 w-6" />;
      return <Users className="h-6 w-6" />;
  };

  const getBgColor = (url: string) => {
      if (url.includes("t.me")) return "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900";
      if (url.includes("facebook.com")) return "border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-900";
      if (url.includes("wa.me")) return "border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900";
      return "border-gray-200 bg-gray-50/50 dark:bg-gray-800/20 dark:border-gray-700";
  };

  const getBtnColor = (url: string) => {
       if (url.includes("t.me")) return "bg-blue-500 hover:bg-blue-600";
       if (url.includes("facebook.com")) return "bg-indigo-600 hover:bg-indigo-700";
       if (url.includes("wa.me")) return "bg-green-600 hover:bg-green-700";
       return "";
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
        <p className="text-sm text-muted-foreground">Join our community channels to stay updated.</p>
      </header>

      {/* Course Filter */}
      <div className="flex items-center gap-2">
            <div className="text-xs uppercase tracking-[0.25em] text-muted-foreground hidden sm:block">Filter by Course</div>
            <Select
                value={selectedCourse}
                onValueChange={setSelectedCourse}
            >
            <SelectTrigger className="w-full sm:w-64">
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

      {isLoading ? (
          <div className="text-muted-foreground py-10">Loading community links...</div>
      ) : links?.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/10 text-muted-foreground">
              No community links found for the selected course.
          </div>
      ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {links?.map((link) => (
                <Card key={link.id} className={`shadow-md hover:shadow-lg transition-all ${getBgColor(link.url)}`}>
                <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                             {link.course?.name || "Official Community"}
                         </span>
                    </div>
                    <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full text-white shadow-sm ${getBtnColor(link.url) || "bg-primary"}`}>
                        {getIcon(link.url)}
                    </div>
                    <CardTitle className="text-xl leading-tight">{link.title}</CardTitle>
                    </div>
                    <CardDescription className="line-clamp-2 mt-2">
                        {link.description || "Click the button below to join."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button className={`w-full text-white shadow-sm ${getBtnColor(link.url) || "bg-primary hover:bg-primary/90"}`} asChild>
                    <a href={link.url} target="_blank" rel="noopener noreferrer">
                        Join Now
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

export default Community;
