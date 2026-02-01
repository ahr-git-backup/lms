import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEnrollments } from "@/hooks/useEnrollments";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Facebook, Link as LinkIcon, Users, MessageCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        .select("id, title, url, description, resource_type, course_id, course:courses(name)")
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
      if (url.includes("t.me")) return <Send className="h-5 w-5" />;
      if (url.includes("facebook.com") || url.includes("fb.me")) return <Facebook className="h-5 w-5" />;
      if (url.includes("wa.me") || url.includes("whatsapp")) return <MessageCircle className="h-5 w-5" />;
      return <Users className="h-5 w-5" />;
  };

  const getPlatformName = (url: string) => {
      if (url.includes("t.me")) return "Telegram";
      if (url.includes("facebook.com") || url.includes("fb.me")) return "Facebook";
      if (url.includes("wa.me") || url.includes("whatsapp")) return "WhatsApp";
      return "Community";
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderGrid = (items: any[]) => {
      if (items.length === 0) {
          return (
            <div className="text-center py-12 border rounded-lg bg-muted/10 text-muted-foreground border-dashed">
                No community links found in this category.
            </div>
          );
      }
      return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {items.map((link: any) => (
                <Card key={link.id} className={`shadow-sm hover:shadow-md transition-all ${getBgColor(link.url)}`}>
                    <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between gap-2">
                             <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-lg text-white shadow-sm shrink-0 ${getBtnColor(link.url) || "bg-primary"}`}>
                                    {getIcon(link.url)}
                                </div>
                                <div>
                                    <CardTitle className="text-base font-semibold leading-tight">{link.title}</CardTitle>
                                    <div className="text-[10px] uppercase font-bold tracking-wider opacity-70 mt-0.5">
                                        {link.course?.name || getPlatformName(link.url)}
                                    </div>
                                </div>
                             </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-2">
                        <CardDescription className="line-clamp-2 text-xs mb-3 min-h-[2.5em]">
                            {link.description || "Join the discussion and stay updated."}
                        </CardDescription>
                        <Button
                            size="sm"
                            className={`w-full h-8 text-xs font-semibold text-white shadow-sm ${getBtnColor(link.url) || "bg-primary hover:bg-primary/90"}`}
                            asChild
                        >
                            <a href={link.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 mr-2" />
                                Join Now
                            </a>
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
      );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Community</h1>
            <p className="text-sm text-muted-foreground">Join our community channels to stay updated.</p>
        </div>

        {/* Course Filter */}
        <div className="w-full sm:w-auto">
            <Select
                value={selectedCourse}
                onValueChange={setSelectedCourse}
            >
            <SelectTrigger className="w-full sm:w-[250px]">
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
      </header>

      {isLoading ? (
          <div className="text-muted-foreground py-10 text-center">Loading community links...</div>
      ) : (
          <Tabs defaultValue="all" className="w-full space-y-6">
             <TabsList className="grid w-full grid-cols-4 max-w-xl">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="facebook">Facebook</TabsTrigger>
                <TabsTrigger value="telegram">Telegram</TabsTrigger>
                <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
             </TabsList>

             <TabsContent value="all" className="space-y-4">
                {renderGrid(links || [])}
             </TabsContent>

             <TabsContent value="facebook" className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {renderGrid(links?.filter((l: any) => l.url.includes("facebook") || l.url.includes("fb.me")) || [])}
             </TabsContent>

             <TabsContent value="telegram" className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {renderGrid(links?.filter((l: any) => l.url.includes("t.me")) || [])}
             </TabsContent>

             <TabsContent value="whatsapp" className="space-y-4">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {renderGrid(links?.filter((l: any) => l.url.includes("wa.me") || l.url.includes("whatsapp")) || [])}
             </TabsContent>
          </Tabs>
      )}
    </div>
  );
};

export default Community;
