import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useEnrollments = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["enrollments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select(`
          *,
          course:courses(*)
        `)
        .eq("profile_id", user.id);

      if (error) throw error;

      // Handle Linked/Extra Courses
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const enrolledCourses = enrollments?.map((e: any) => e.course) || [];
      const extraCourseIds = new Set<string>();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      enrolledCourses.forEach((c: any) => {
          if (c.linked_course_ids && Array.isArray(c.linked_course_ids)) {
              c.linked_course_ids.forEach((id: string) => extraCourseIds.add(id));
          }
      });

      // Filter out courses the user is already directly enrolled in
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existingIds = new Set(enrollments?.map((e: any) => e.course_id));
      const newIds = Array.from(extraCourseIds).filter(id => !existingIds.has(id));

      if (newIds.length > 0) {
          const { data: extraCourses } = await supabase
              .from("courses")
              .select("*")
              .in("id", newIds);

          if (extraCourses) {
              const extraEnrollments = extraCourses.map(c => ({
                  id: `virtual-${c.id}`, // Virtual ID
                  course_id: c.id,
                  profile_id: user.id,
                  created_at: new Date().toISOString(),
                  course: c,
                  is_extra: true
              }));
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              return [...(enrollments || []), ...extraEnrollments] as any[];
          }
      }

      return enrollments || [];
    },
    enabled: !!user,
  });
};
